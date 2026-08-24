"use server";

import { revalidatePath } from "next/cache";
import { MedicineOrderStatus, Prisma } from "@prisma/client";
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
    prescriptionOnly: d.prescriptionOnly,
  };

  if (d.id) {
    const res = await prisma.medicine.updateMany({
      where: { id: d.id, doctorId: owner.doctorId },
      data,
    });
    if (res.count === 0) return { ok: false, error: "That medicine is not yours." };
  } else {
    await prisma.medicine.create({ data: { doctorId: owner.doctorId, ...data } });
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
        await prisma.medicineOrder.create({
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

  const res = await prisma.medicineOrder.updateMany({
    where: isAdmin ? { id } : { id, doctorId: owner!.doctorId },
    data: { status },
  });
  if (res.count === 0) return { ok: false, error: "That order is not yours." };

  revalidatePath("/doctor/portal/medicines");
  revalidatePath("/patient/profile");
  return { ok: true };
}
