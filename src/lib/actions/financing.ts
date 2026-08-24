"use server";

import { revalidatePath } from "next/cache";
import { FinancingStatus } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { fieldErrors } from "@/lib/validation";
import type { ActionResult } from "./enquiry";

/**
 * A client asking whether a treatment can be paid for over time.
 *
 * ── Why this is a request and not a quote ────────────────────────────────
 * What stood here quoted an "approved limit of ₹60,000 through BluDerma Care
 * Credit" and listed EMI options, which reads as though this platform were
 * itself a lender. It is not one, there is no finance partner integrated, and
 * a limit shown to somebody deciding whether they can afford treatment is a
 * representation about money they can borrow.
 *
 * So the honest MVP inverts it: the client says what they are interested in
 * and roughly what they think it costs, and the clinic comes back to them.
 * Nothing is approved, no rate is shown, and the figure on the screen is
 * theirs rather than ours.
 */

const requestSchema = z.object({
  treatment: z.string().trim().min(2, "Which treatment?").max(160),
  // Their estimate, and optional. Asking for it is useful triage; requiring it
  // would make somebody guess a number and then feel held to it.
  estimatedInr: z
    .union([z.number(), z.string()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === "") return null;
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
    }),
  note: z.string().trim().max(1000).optional().default(""),
});

/** Open requests one client may have at a time. */
const MAX_OPEN = 3;

export async function requestFinancing(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in." };

  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please check the form.",
      fields: fieldErrors(parsed.error),
    };
  }
  const d = parsed.data;

  // A cap on OPEN requests rather than on total: somebody who asked about
  // three treatments last year and had them all closed off should not be
  // locked out of asking about a fourth.
  const open = await prisma.financingRequest.count({
    where: { userId: user.id, status: { not: FinancingStatus.CLOSED } },
  });
  if (open >= MAX_OPEN) {
    return {
      ok: false,
      error: `You already have ${open} open enquiries. The clinic will come back to you on those first.`,
    };
  }

  try {
    await prisma.financingRequest.create({
      data: {
        userId: user.id,
        treatment: d.treatment,
        estimatedInr: d.estimatedInr,
        note: d.note || null,
      },
    });
    revalidatePath("/patient/profile");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not send that. Please try again." };
  }
}

/** Withdraw an enquiry that has not been picked up yet. */
export async function withdrawFinancingRequest(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in." };

  // Scoped by userId, and only while NEW: once staff have made contact, the
  // record of that conversation is not the client's to delete.
  const res = await prisma.financingRequest.deleteMany({
    where: { id, userId: user.id, status: FinancingStatus.NEW },
  });
  if (res.count === 0) {
    return { ok: false, error: "That enquiry is not yours, or has already been picked up." };
  }

  revalidatePath("/patient/profile");
  return { ok: true };
}

/**
 * Staff moving an enquiry along.
 *
 * Admin only. A doctor seeing which of their patients is worried about cost is
 * a different feature with a different consent question behind it, and is not
 * assumed here.
 */
export async function updateFinancingRequest(
  id: string,
  status: FinancingStatus,
  staffNote?: string
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return { ok: false, error: "Not permitted." };

  await prisma.financingRequest.update({
    where: { id },
    data: {
      status,
      staffNote: staffNote?.trim() || undefined,
      // Stamped the first time it leaves NEW, so "how long did we take to
      // reply" stays answerable after later edits.
      respondedAt: status === FinancingStatus.NEW ? null : new Date(),
    },
  });

  revalidatePath("/admin/financing");
  return { ok: true };
}
