"use server";

import { revalidatePath } from "next/cache";
import { MedicineOrderStatus, Prisma, StockMoveReason } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getOwnDoctor } from "@/lib/doctor/guard";
import { claimId, newOrderId } from "@/lib/publicId";
import { fieldErrors } from "@/lib/validation";
import type { ActionResult } from "./enquiry";

/**
 * A doctor's own dispensary, and patients ordering from it.
 *
 * ── This is deliberately NOT the injectables catalogue ───────────────────
 * The 210 rows in `Product` are botulinum toxins, fillers, biostimulators and
 * topical anaesthetics: prescription-only clinical consumables a practitioner
 * administers, whose prices that model marks internal-only. They cannot
 * lawfully be sold to a consumer and nothing here can reach them.
 *
 * What a patient can order is what their own doctor listed: the topicals and
 * orals handed over after a consultation.
 *
 * ── The prescription is asked for, not assumed ───────────────────────────
 * Where a basket contains anything marked prescription-only, an order cannot
 * be placed without one attached. That is checked on the server against the
 * medicines actually in the basket, never from a flag the client sends.
 */

/* ------------------------------ Stock ----------------------------------- */

/**
 * The only way the count on the shelf ever changes.
 *
 * -- What was wrong -------------------------------------------------------
 * placeMedicineOrder READ Medicine.stock to refuse an order it could not
 * fill, and then created the order without taking anything off the shelf. A
 * practice with ten units could accept fifty orders and still show ten. The
 * check was there, so the bug read as working software: the first order was
 * refused correctly, and every one after it was refused correctly too, against
 * a number that had stopped meaning anything.
 *
 * -- Why a ledger and not a decrement -------------------------------------
 * A bare `{ decrement: qty }` makes the number right and leaves it
 * unexplainable. A doctor who counts 8 where they expected 12 needs to know
 * which four went and when, and "the software says 8" is not an answer in a
 * room with a regulator in it. So every change writes a row, the row carries
 * the balance AFTER it, and Medicine.stock is simply the latest balance —
 * written in the same transaction, so the count and its history cannot drift.
 *
 * Returns null when the medicine does not track stock at all, which is
 * legitimate and common: a practice may list something it orders in per
 * patient. A null stock is left null; it is never quietly turned into a zero.
 */
export async function applyStockMovement(
  tx: Prisma.TransactionClient,
  input: {
    medicineId: string;
    delta: number;
    reason: StockMoveReason;
    note?: string | null;
    orderId?: string | null;
    actorUserId?: string | null;
  }
): Promise<number | null> {
  const medicine = await tx.medicine.findUnique({
    where: { id: input.medicineId },
    select: { stock: true },
  });
  // Not tracked. Nothing to move, and inventing a starting point would be
  // worse than leaving it alone.
  if (!medicine || medicine.stock === null) return null;

  // Never below zero. A negative shelf is not a state the world can be in, and
  // a race that would produce one should land on empty rather than on nonsense.
  const balance = Math.max(0, medicine.stock + input.delta);
  // The delta as ACTUALLY applied, so the ledger sums to the balance even
  // where the clamp bit.
  const applied = balance - medicine.stock;

  await tx.medicine.update({
    where: { id: input.medicineId },
    data: { stock: balance },
  });

  if (applied !== 0) {
    await tx.stockMovement.create({
      data: {
        medicineId: input.medicineId,
        delta: applied,
        balance,
        reason: input.reason,
        note: input.note ?? null,
        orderId: input.orderId ?? null,
        actorUserId: input.actorUserId ?? null,
      },
    });
  }

  return balance;
}

const stockSchema = z.object({
  medicineId: z.string().min(1),
  /// Signed, and never zero: an adjustment of nothing is not an adjustment.
  delta: z
    .union([z.number(), z.string()])
    .transform((v) => Math.round(Number(v)))
    .refine((n) => Number.isFinite(n) && n !== 0, "How many, and which way?"),
  reason: z.enum([
    "RECEIVED",
    "DISPENSED",
    "CORRECTION",
    "EXPIRED",
    "DAMAGED",
  ]),
  note: z.string().trim().max(300).optional().default(""),
});

/**
 * A practitioner counting the shelf, or booking a delivery in.
 *
 * A CORRECTION always carries a note. It is the one reason that means "the
 * software and the shelf disagreed", and a correction with no explanation is
 * the row that makes the whole ledger untrustworthy six months later.
 */
export async function adjustStock(input: unknown): Promise<ActionResult> {
  const owner = await getOwnDoctor();
  if (!owner) return { ok: false, error: "Not permitted." };

  const parsed = stockSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please check that.", fields: fieldErrors(parsed.error) };
  }
  const d = parsed.data;

  if (d.reason === "CORRECTION" && !d.note.trim()) {
    return {
      ok: false,
      error: "Say what the correction is for. A count that changed for no recorded reason is one nobody can rely on later.",
    };
  }

  const mine = await prisma.medicine.findFirst({
    where: { id: d.medicineId, doctorId: owner.doctorId },
    select: { id: true, stock: true },
  });
  if (!mine) return { ok: false, error: "That medicine is not yours." };
  if (mine.stock === null) {
    return {
      ok: false,
      error: "This one does not track a count. Set a stock level on it first.",
    };
  }

  await prisma.$transaction((tx) =>
    applyStockMovement(tx, {
      medicineId: d.medicineId,
      delta: d.delta,
      reason: d.reason as StockMoveReason,
      note: d.note || null,
      actorUserId: owner.userId,
    })
  );

  revalidatePath("/doctor/portal/medicines");
  return { ok: true };
}

const medicineSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(2, "Name the medicine.").max(160),
  brand: z.string().trim().max(120).optional().default(""),
  form: z.string().trim().max(60).optional().default(""),
  strength: z.string().trim().max(60).optional().default(""),
  about: z.string().trim().max(600).optional().default(""),
  priceInr: z
    .union([z.number(), z.string()])
    .transform((v) => Math.round(Number(v)))
    .refine((n) => Number.isFinite(n) && n > 0, "What does it cost?"),
  mrpInr: z
    .union([z.number(), z.string()])
    .optional()
    .transform((v) => {
      const n = Math.round(Number(v ?? 0));
      return Number.isFinite(n) && n > 0 ? n : null;
    }),
  stock: z
    .union([z.number(), z.string()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === "") return null;
      const n = Math.round(Number(v));
      return Number.isFinite(n) && n >= 0 ? n : null;
    }),
  lowStockAt: z
    .union([z.number(), z.string()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === "") return null;
      const n = Math.round(Number(v));
      return Number.isFinite(n) && n >= 0 ? n : null;
    }),
  prescriptionOnly: z.boolean().optional().default(true),
});

export async function saveMedicine(input: unknown): Promise<ActionResult> {
  const owner = await getOwnDoctor();
  if (!owner) return { ok: false, error: "Not permitted." };

  const parsed = medicineSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please check the form.", fields: fieldErrors(parsed.error) };
  }
  const d = parsed.data;

  const data = {
    name: d.name,
    brand: d.brand || null,
    form: d.form || null,
    strength: d.strength || null,
    about: d.about || null,
    priceInr: d.priceInr,
    mrpInr: d.mrpInr,
    stock: d.stock,
    lowStockAt: d.lowStockAt,
    prescriptionOnly: d.prescriptionOnly,
  };

  if (d.id) {
    const before = await prisma.medicine.findFirst({
      where: { id: d.id, doctorId: owner.doctorId },
      select: { id: true, stock: true },
    });
    if (!before) return { ok: false, error: "That medicine is not yours." };

    // Typing over the count in the edit form is a stock movement like any
    // other. Writing it straight through would leave a hole in the ledger at
    // exactly the point somebody changed the number by hand, which is the
    // point a ledger is for.
    const { stock: _next, ...rest } = data;
    await prisma.$transaction(async (tx) => {
      await tx.medicine.update({ where: { id: d.id }, data: rest });

      if (d.stock === null && before.stock !== null) {
        // Stopped tracking it. Left as null rather than zeroed: "we do not
        // count this" and "we have none" are different facts.
        await tx.medicine.update({ where: { id: d.id }, data: { stock: null } });
      } else if (d.stock !== null && before.stock === null) {
        // Started tracking it. The opening balance is not a movement of
        // anything, so it is recorded as the correction it is.
        await tx.medicine.update({ where: { id: d.id }, data: { stock: d.stock } });
        await tx.stockMovement.create({
          data: {
            medicineId: d.id!,
            delta: d.stock,
            balance: d.stock,
            reason: StockMoveReason.CORRECTION,
            note: "Opening count",
            actorUserId: owner.userId,
          },
        });
      } else if (d.stock !== null && before.stock !== null && d.stock !== before.stock) {
        await applyStockMovement(tx, {
          medicineId: d.id!,
          delta: d.stock - before.stock,
          reason: StockMoveReason.CORRECTION,
          note: "Counted and corrected on the medicine form",
          actorUserId: owner.userId,
        });
      }
    });
  } else {
    const created = await prisma.medicine.create({
      data: { doctorId: owner.doctorId, ...data },
      select: { id: true },
    });
    if (d.stock !== null) {
      await prisma.stockMovement.create({
        data: {
          medicineId: created.id,
          delta: d.stock,
          balance: d.stock,
          reason: StockMoveReason.CORRECTION,
          note: "Opening count",
          actorUserId: owner.userId,
        },
      });
    }
  }

  revalidatePath("/doctor/portal/medicines");
  return { ok: true };
}

/** Delisted, never deleted: past orders reference it. */
export async function retireMedicine(id: string): Promise<ActionResult> {
  const owner = await getOwnDoctor();
  if (!owner) return { ok: false, error: "Not permitted." };

  const res = await prisma.medicine.updateMany({
    where: { id, doctorId: owner.doctorId },
    data: { isActive: false },
  });
  if (res.count === 0) return { ok: false, error: "That medicine is not yours." };

  revalidatePath("/doctor/portal/medicines");
  return { ok: true };
}

const orderSchema = z.object({
  items: z
    .array(z.object({ medicineId: z.string().min(1), qty: z.number().int().min(1).max(20) }))
    .min(1, "Nothing in the basket."),
  deliverTo: z.string().trim().min(6, "Where should it go?").max(600),
  phone: z.string().trim().max(24).optional().default(""),
  prescriptionUrl: z.string().trim().max(600).optional().default(""),
  prescriptionKey: z.string().trim().max(400).optional().default(""),
  note: z.string().trim().max(500).optional().default(""),
});

export async function placeMedicineOrder(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in." };

  const parsed = orderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please check the order.", fields: fieldErrors(parsed.error) };
  }
  const d = parsed.data;

  // Prices are read from the DATABASE, never from the basket. A price in the
  // payload is a number the client chose.
  const ids = d.items.map((i) => i.medicineId);
  const medicines = await prisma.medicine.findMany({
    where: { id: { in: ids }, isActive: true },
    select: {
      id: true,
      name: true,
      priceInr: true,
      prescriptionOnly: true,
      stock: true,
      doctorId: true,
    },
  });
  if (medicines.length !== ids.length) {
    return { ok: false, error: "Something in your basket is no longer available." };
  }

  const needsScript = medicines.some((m) => m.prescriptionOnly);
  if (needsScript && !d.prescriptionUrl) {
    return {
      ok: false,
      error: "Your basket needs a prescription. Attach the one your doctor gave you.",
    };
  }

  const byId = new Map(medicines.map((m) => [m.id, m]));
  for (const line of d.items) {
    const m = byId.get(line.medicineId)!;
    // Stock is optional, so only enforced where the practice tracks it.
    if (m.stock !== null && m.stock < line.qty) {
      return { ok: false, error: `Only ${m.stock} of ${m.name} left.` };
    }
  }

  const items = d.items.map((line) => {
    const m = byId.get(line.medicineId)!;
    return { medicineId: m.id, name: m.name, priceInr: m.priceInr, qty: line.qty };
  });
  const subtotalInr = items.reduce((n, i) => n + i.priceInr * i.qty, 0);

  try {
    await claimId(newOrderId, async (publicId) => {
      try {
        // One transaction, because an order that exists without its stock
        // having moved is precisely the state this used to be permanently in.
        await prisma.$transaction(async (tx) => {
          const order = await tx.medicineOrder.create({
            data: {
              publicId,
              userId: user.id,
              // Every basket comes from one doctor's list, so the first is the
              // order's doctor. Mixing lists is not offered.
              doctorId: medicines[0]?.doctorId ?? null,
              deliverTo: d.deliverTo,
              phone: d.phone || null,
              subtotalInr,
              deliveryInr: 0,
              totalInr: subtotalInr,
              prescriptionUrl: d.prescriptionUrl || null,
              prescriptionKey: d.prescriptionKey || null,
              note: d.note || null,
              items: { create: items },
            },
            select: { id: true },
          });

          // Off the shelf. The stock check above happened outside the
          // transaction and is therefore advisory — applyStockMovement clamps
          // at zero, so two simultaneous orders for the last unit leave the
          // count at zero rather than at minus one.
          for (const line of items) {
            if (!line.medicineId) continue;
            await applyStockMovement(tx, {
              medicineId: line.medicineId,
              delta: -line.qty,
              reason: StockMoveReason.ORDER,
              orderId: order.id,
            });
          }
        });
        return true;
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          return false;
        }
        throw e;
      }
    });

    revalidatePath("/patient/profile");
    revalidatePath("/doctor/portal/medicines");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not place that order." };
  }
}

export async function setOrderStatus(
  id: string,
  status: MedicineOrderStatus
): Promise<ActionResult> {
  const owner = await getOwnDoctor();
  const user = await getCurrentUser();
  const isAdmin = user?.role === "ADMIN";
  if (!owner && !isAdmin) return { ok: false, error: "Not permitted." };

  const existing = await prisma.medicineOrder.findFirst({
    where: isAdmin ? { id } : { id, doctorId: owner!.doctorId },
    select: {
      id: true,
      status: true,
      items: { select: { medicineId: true, qty: true } },
    },
  });
  if (!existing) return { ok: false, error: "That order is not yours." };

  const cancelling =
    status === MedicineOrderStatus.CANCELLED &&
    existing.status !== MedicineOrderStatus.CANCELLED;

  await prisma.$transaction(async (tx) => {
    await tx.medicineOrder.update({ where: { id }, data: { status } });

    // Cancelled stock goes back on the shelf. Only on the TRANSITION into
    // cancelled: setting an already-cancelled order to cancelled again must
    // not credit the stock a second time, and a status screen makes that easy
    // to do by accident.
    if (cancelling) {
      for (const line of existing.items) {
        if (!line.medicineId) continue;
        await applyStockMovement(tx, {
          medicineId: line.medicineId,
          delta: line.qty,
          reason: StockMoveReason.ORDER_CANCELLED,
          orderId: existing.id,
          actorUserId: user?.id ?? null,
        });
      }
    }
  });

  revalidatePath("/doctor/portal/medicines");
  revalidatePath("/patient/profile");
  return { ok: true };
}
