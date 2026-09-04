"use server";

import { revalidatePath } from "next/cache";
import { ExpenseCategory, IncomeSource } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { newAssetId } from "@/lib/publicId";
import { getOwnDoctor } from "@/lib/doctor/guard";
import { fieldErrors } from "@/lib/validation";
import type { ActionResult } from "./enquiry";

/**
 * What a practice spent, what it owns, and what its machines have earned back.
 *
 * Every write here is scoped by the signed-in doctor's own id, and every read
 * of somebody else's row is filtered rather than merely unlinked: a server
 * action is a public endpoint, so an id in a payload is an assertion by the
 * caller and nothing more.
 */

const CATEGORIES = [
  "RENT",
  "SALARY",
  "CONSUMABLES",
  "MARKETING",
  "UTILITIES",
  "MAINTENANCE",
  "TAX",
  /// Stock bought FOR the dispensary — the other half of medicine sales.
  "MEDICINES",
  "LAUNDRY",
  "OTHER",
] as const;

// A literal tuple rather than z.nativeEnum: a stale generated client makes the
// enum object undefined at import time, and the failure is a confusing runtime
// error rather than a type error.
const expenseSchema = z.object({
  id: z.string().min(1).optional(),
  category: z.enum(CATEGORIES).default("OTHER"),
  label: z.string().trim().min(2, "What was it for?").max(160),
  amountInr: z
    .union([z.number(), z.string()])
    .transform((v) => Math.round(Number(v)))
    .refine((n) => Number.isFinite(n) && n > 0, "Enter an amount."),
  spentOn: z.string().min(1, "When?"),
  clinicId: z.string().optional().default(""),
  note: z.string().trim().max(500).optional().default(""),
  /**
   * How many people a SALARY row covers.
   *
   * Ignored on every other category rather than rejected: a doctor who types
   * a number and then changes the category should not be stopped by a field
   * that is no longer on screen.
   */
  headcount: z
    .union([z.number(), z.string()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === "") return null;
      const n = Math.round(Number(v));
      return Number.isFinite(n) && n > 0 && n < 2000 ? n : null;
    }),
});

export async function saveExpense(input: unknown): Promise<ActionResult> {
  const owner = await getOwnDoctor();
  if (!owner) return { ok: false, error: "Not permitted." };

  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please check the form.", fields: fieldErrors(parsed.error) };
  }
  const d = parsed.data;

  const spentOn = new Date(d.spentOn);
  if (Number.isNaN(spentOn.getTime())) return { ok: false, error: "That is not a date." };

  const clinicId = await ownClinic(owner.doctorId, d.clinicId);

  const data = {
    category: d.category as ExpenseCategory,
    label: d.label,
    amountInr: d.amountInr,
    spentOn,
    clinicId,
    note: d.note || null,
    // Only meaningful on a salary row. Cleared otherwise so a category change
    // cannot leave "6 people" attached to the electricity bill.
    headcount: d.category === "SALARY" ? d.headcount : null,
  };

  try {
    if (d.id) {
      const res = await prisma.practiceExpense.updateMany({
        where: { id: d.id, doctorId: owner.doctorId },
        data,
      });
      if (res.count === 0) return { ok: false, error: "That entry is not yours." };
    } else {
      await prisma.practiceExpense.create({
        data: { doctorId: owner.doctorId, ...data },
      });
    }
    revalidatePath("/doctor/portal/finance");
    revalidatePath("/doctor/portal");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not save that." };
  }
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  const owner = await getOwnDoctor();
  if (!owner) return { ok: false, error: "Not permitted." };

  const res = await prisma.practiceExpense.deleteMany({
    where: { id, doctorId: owner.doctorId },
  });
  if (res.count === 0) return { ok: false, error: "That entry is not yours." };

  revalidatePath("/doctor/portal/finance");
  revalidatePath("/doctor/portal");
  return { ok: true };
}

const assetSchema = z.object({
  name: z.string().trim().min(2, "Name the machine.").max(160),
  purpose: z.string().trim().max(200).optional().default(""),
  costInr: z
    .union([z.number(), z.string()])
    .transform((v) => Math.round(Number(v)))
    .refine((n) => Number.isFinite(n) && n > 0, "What did it cost?"),
  upkeepInr: z
    .union([z.number(), z.string()])
    .optional()
    .transform((v) => {
      const n = Math.round(Number(v ?? 0));
      return Number.isFinite(n) && n > 0 ? n : 0;
    }),
  purchasedOn: z.string().min(1, "When did you buy it?"),
  clinicId: z.string().optional().default(""),
});

export async function saveAsset(input: unknown): Promise<ActionResult> {
  const owner = await getOwnDoctor();
  if (!owner) return { ok: false, error: "Not permitted." };

  const parsed = assetSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please check the form.", fields: fieldErrors(parsed.error) };
  }
  const d = parsed.data;

  const purchasedOn = new Date(d.purchasedOn);
  if (Number.isNaN(purchasedOn.getTime())) return { ok: false, error: "That is not a date." };

  try {
    await prisma.practiceAsset.create({
      data: {
        // Quotable on a service docket or an insurance claim. See publicId.ts.
        publicId: newAssetId(),
        doctorId: owner.doctorId,
        name: d.name,
        purpose: d.purpose || null,
        costInr: d.costInr,
        upkeepInr: d.upkeepInr,
        purchasedOn,
        clinicId: await ownClinic(owner.doctorId, d.clinicId),
      },
    });
    revalidatePath("/doctor/portal/finance");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not save that." };
  }
}

const usageSchema = z.object({
  assetId: z.string().min(1),
  usedOn: z.string().min(1, "When was it used?"),
  // Zero is legitimate and must survive validation: a touch-up included in a
  // course still wears the machine, and pretending it did not happen would
  // overstate how well the thing is earning.
  chargedInr: z
    .union([z.number(), z.string()])
    .transform((v) => {
      const n = Math.round(Number(v === "" ? 0 : v));
      return Number.isFinite(n) && n >= 0 ? n : 0;
    }),
  treatment: z.string().trim().max(160).optional().default(""),
});

export async function recordUsage(input: unknown): Promise<ActionResult> {
  const owner = await getOwnDoctor();
  if (!owner) return { ok: false, error: "Not permitted." };

  const parsed = usageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please check the form." };
  const d = parsed.data;

  const usedOn = new Date(d.usedOn);
  if (Number.isNaN(usedOn.getTime())) return { ok: false, error: "That is not a date." };

  // The asset must be this doctor's, checked on the row.
  const asset = await prisma.practiceAsset.findFirst({
    where: { id: d.assetId, doctorId: owner.doctorId },
    select: { id: true },
  });
  if (!asset) return { ok: false, error: "That machine is not yours." };

  await prisma.assetUsage.create({
    data: {
      assetId: asset.id,
      usedOn,
      chargedInr: d.chargedInr,
      treatment: d.treatment || null,
    },
  });

  revalidatePath("/doctor/portal/finance");
  return { ok: true };
}

export async function retireAsset(id: string): Promise<ActionResult> {
  const owner = await getOwnDoctor();
  if (!owner) return { ok: false, error: "Not permitted." };

  // Retired, never deleted. The uses recorded against it are the practice's
  // own history of what the machine earned, and a sold laser does not unmake
  // the four years it paid for itself over.
  const res = await prisma.practiceAsset.updateMany({
    where: { id, doctorId: owner.doctorId },
    data: { isActive: false },
  });
  if (res.count === 0) return { ok: false, error: "That machine is not yours." };

  revalidatePath("/doctor/portal/finance");
  return { ok: true };
}

/** Resolve a clinic id only if this doctor actually practises there. */
async function ownClinic(doctorId: string, clinicId: string): Promise<string | null> {
  if (!clinicId) return null;
  const link = await prisma.doctorClinic.findFirst({
    where: { doctorId, clinicId },
    select: { clinicId: true },
  });
  return link?.clinicId ?? null;
}

/* ------------------------------- Income ---------------------------------- */

const INCOME_SOURCES = [
  "PRODUCT",
  "PACKAGE",
  "RENTAL",
  "PROFESSIONAL",
  "MISCELLANEOUS",
] as const;

const incomeSchema = z.object({
  id: z.string().min(1).optional(),
  source: z.enum(INCOME_SOURCES).default("MISCELLANEOUS"),
  label: z.string().trim().min(2, "What was it for?").max(160),
  amountInr: z
    .union([z.number(), z.string()])
    .transform((v) => Math.round(Number(v)))
    .refine((n) => Number.isFinite(n) && n > 0, "Enter an amount."),
  receivedOn: z.string().min(1, "When?"),
  clinicId: z.string().optional().default(""),
  note: z.string().trim().max(500).optional().default(""),
});

/**
 * Money in that was not a consultation, a medicine order or a machine use.
 *
 * -- The rule this action cannot enforce, and says so instead --------------
 * Each rupee belongs in exactly one stream. A laser charge goes on the machine,
 * a medicine sale on the order, a consultation on the appointment. Nothing
 * here can tell whether an amount has already been counted somewhere else —
 * only the person typing it knows — so the form says it at the point of entry
 * rather than the server pretending to a certainty it does not have.
 */
export async function saveIncome(input: unknown): Promise<ActionResult> {
  const owner = await getOwnDoctor();
  if (!owner) return { ok: false, error: "Not permitted." };

  const parsed = incomeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please check the form.", fields: fieldErrors(parsed.error) };
  }
  const d = parsed.data;

  const receivedOn = new Date(d.receivedOn);
  if (Number.isNaN(receivedOn.getTime())) return { ok: false, error: "That is not a date." };

  const clinicId = await ownClinic(owner.doctorId, d.clinicId);

  const data = {
    source: d.source as IncomeSource,
    label: d.label,
    amountInr: d.amountInr,
    receivedOn,
    clinicId,
    note: d.note || null,
  };

  try {
    if (d.id) {
      const res = await prisma.practiceIncome.updateMany({
        where: { id: d.id, doctorId: owner.doctorId },
        data,
      });
      if (res.count === 0) return { ok: false, error: "That entry is not yours." };
    } else {
      await prisma.practiceIncome.create({
        data: { doctorId: owner.doctorId, ...data },
      });
    }
  } catch {
    return { ok: false, error: "Could not save that." };
  }

  revalidatePath("/doctor/portal/finance");
  revalidatePath("/doctor/portal");
  return { ok: true };
}

export async function removeIncome(id: string): Promise<ActionResult> {
  const owner = await getOwnDoctor();
  if (!owner) return { ok: false, error: "Not permitted." };

  const res = await prisma.practiceIncome.deleteMany({
    where: { id, doctorId: owner.doctorId },
  });
  if (res.count === 0) return { ok: false, error: "That entry is not yours." };

  revalidatePath("/doctor/portal/finance");
  revalidatePath("/doctor/portal");
  return { ok: true };
}
