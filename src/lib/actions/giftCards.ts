"use server";

import { revalidatePath } from "next/cache";
import { OfferStatus, Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getOwnDoctor } from "@/lib/doctor/guard";
import { rateLimit } from "@/lib/rateLimit";
import { claimId, newGiftCardCode } from "@/lib/publicId";
import { fieldErrors } from "@/lib/validation";
import type { ActionResult } from "./enquiry";

/**
 * Gift cards: a clinic offers, BluDerma approves, a patient buys, a clinic
 * redeems.
 *
 * ── Why approval is not optional ─────────────────────────────────────────
 * An offer is a promise about money, made in our name, on our storefront. A
 * clinic writing "₹10,000 of treatment for ₹1,000" and it appearing instantly
 * is not a marketplace feature, it is our problem. So DRAFT is where an offer
 * lives until a clinic submits it, PENDING is a queue, and only APPROVED
 * reaches a patient.
 *
 * ── Why a card is not spendable the moment it is bought ──────────────────
 * `paidAt` is set when the payment SETTLES, not when checkout opens. A card
 * that can be redeemed on an abandoned payment is a clinic giving treatment
 * away for nothing.
 */

const offerSchema = z.object({
  id: z.string().min(1).optional(),
  title: z.string().trim().min(3, "Name the card.").max(120),
  description: z.string().trim().max(600).optional().default(""),
  valueInr: z
    .union([z.number(), z.string()])
    .transform((v) => Math.round(Number(v)))
    .refine((n) => Number.isFinite(n) && n > 0, "What is it worth?"),
  priceInr: z
    .union([z.number(), z.string()])
    .transform((v) => Math.round(Number(v)))
    .refine((n) => Number.isFinite(n) && n > 0, "What does it cost?"),
  terms: z.string().trim().max(1000).optional().default(""),
  validMonths: z
    .union([z.number(), z.string()])
    .optional()
    .transform((v) => {
      const n = Math.round(Number(v ?? 12));
      return Number.isFinite(n) && n >= 1 && n <= 60 ? n : 12;
    }),
  clinicId: z.string().optional().default(""),
});

export async function saveOffer(input: unknown): Promise<ActionResult> {
  const owner = await getOwnDoctor();
  if (!owner) return { ok: false, error: "Not permitted." };

  const parsed = offerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please check the form.", fields: fieldErrors(parsed.error) };
  }
  const d = parsed.data;

  // A card sold for more than it is worth is not a gift, it is a trap. Caught
  // here rather than left to a reviewer to notice.
  if (d.priceInr > d.valueInr) {
    return { ok: false, error: "The price cannot be more than the card is worth." };
  }

  const clinicId = d.clinicId
    ? (
        await prisma.doctorClinic.findFirst({
          where: { doctorId: owner.doctorId, clinicId: d.clinicId },
          select: { clinicId: true },
        })
      )?.clinicId ?? null
    : null;

  const data = {
    title: d.title,
    description: d.description || null,
    valueInr: d.valueInr,
    priceInr: d.priceInr,
    terms: d.terms || null,
    validMonths: d.validMonths,
    clinicId,
  };

  if (d.id) {
    // Editing an approved offer puts it back in the queue. The alternative is
    // a clinic getting "₹1,000 for ₹5,000" approved and then quietly changing
    // the figures, which would make the review meaningless.
    const existing = await prisma.giftCardOffer.findFirst({
      where: { id: d.id, doctorId: owner.doctorId },
      select: { status: true },
    });
    if (!existing) return { ok: false, error: "That offer is not yours." };

    await prisma.giftCardOffer.update({
      where: { id: d.id },
      data: {
        ...data,
        status:
          existing.status === OfferStatus.APPROVED
            ? OfferStatus.PENDING
            : existing.status,
        reviewedAt: existing.status === OfferStatus.APPROVED ? null : undefined,
      },
    });
  } else {
    await prisma.giftCardOffer.create({
      data: { doctorId: owner.doctorId, ...data },
    });
  }

  revalidatePath("/doctor/portal/gift-cards");
  revalidatePath("/admin/gift-cards");
  return { ok: true };
}

/** The clinic sending an offer for review. */
export async function submitOffer(id: string): Promise<ActionResult> {
  const owner = await getOwnDoctor();
  if (!owner) return { ok: false, error: "Not permitted." };

  const res = await prisma.giftCardOffer.updateMany({
    where: {
      id,
      doctorId: owner.doctorId,
      status: { in: [OfferStatus.DRAFT, OfferStatus.REJECTED, OfferStatus.WITHDRAWN] },
    },
    data: { status: OfferStatus.PENDING, reviewNote: null },
  });
  if (res.count === 0) return { ok: false, error: "That offer cannot be submitted." };

  revalidatePath("/doctor/portal/gift-cards");
  revalidatePath("/admin/gift-cards");
  return { ok: true };
}

/** Taking an approved offer off sale. Existing cards are untouched. */
export async function withdrawOffer(id: string): Promise<ActionResult> {
  const owner = await getOwnDoctor();
  if (!owner) return { ok: false, error: "Not permitted." };

  const res = await prisma.giftCardOffer.updateMany({
    where: { id, doctorId: owner.doctorId },
    data: { status: OfferStatus.WITHDRAWN },
  });
  if (res.count === 0) return { ok: false, error: "That offer is not yours." };

  revalidatePath("/doctor/portal/gift-cards");
  revalidatePath("/patient/gift-cards");
  return { ok: true };
}

/** Admin deciding. */
export async function reviewOffer(
  id: string,
  status: OfferStatus,
  reviewNote?: string
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return { ok: false, error: "Not permitted." };

  await prisma.giftCardOffer.update({
    where: { id },
    data: {
      status,
      reviewNote: reviewNote?.trim() || undefined,
      reviewedAt: new Date(),
    },
  });

  revalidatePath("/admin/gift-cards");
  revalidatePath("/patient/gift-cards");
  return { ok: true };
}

const buySchema = z.object({
  offerId: z.string().min(1),
  recipientName: z.string().trim().max(120).optional().default(""),
  recipientEmail: z.string().trim().max(160).optional().default(""),
  message: z.string().trim().max(600).optional().default(""),
});

/**
 * Buying a card.
 *
 * Creates it UNPAID, with no balance available to spend, and returns the id so
 * checkout can be opened against it. Marking it paid is a separate step that
 * only the settlement path may take.
 */
export async function buyGiftCard(
  input: unknown
): Promise<ActionResult & { cardId?: string; amountInr?: number }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in to buy a gift card." };

  const parsed = buySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please check the form." };
  const d = parsed.data;

  // Only an approved offer can be bought. Checked at purchase time rather than
  // trusted from the page the buyer was looking at, which may have been open
  // since before it was withdrawn.
  const offer = await prisma.giftCardOffer.findFirst({
    where: { id: d.offerId, status: OfferStatus.APPROVED },
    select: { id: true, valueInr: true, priceInr: true, validMonths: true },
  });
  if (!offer) return { ok: false, error: "That gift card is no longer on sale." };

  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + offer.validMonths);

  try {
    const code = await claimId(newGiftCardCode, async (candidate) => {
      try {
        await prisma.giftCard.create({
          data: {
            offerId: offer.id,
            code: candidate,
            buyerUserId: user.id,
            recipientName: d.recipientName || null,
            recipientEmail: d.recipientEmail || null,
            message: d.message || null,
            valueInr: offer.valueInr,
            // Zero until the money arrives. A card that can be spent on an
            // abandoned payment is treatment given away for nothing.
            balanceInr: 0,
            expiresAt,
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

    const card = await prisma.giftCard.findUniqueOrThrow({
      where: { code },
      select: { id: true },
    });

    revalidatePath("/patient/profile");
    return { ok: true, cardId: card.id, amountInr: offer.priceInr };
  } catch {
    return { ok: false, error: "Could not start that purchase." };
  }
}

/**
 * Release the balance once the money has settled.
 *
 * Separate from purchase on purpose, and idempotent: a retried payment webhook
 * must not double a card's balance.
 */
export async function markGiftCardPaid(
  cardId: string,
  paymentId: string
): Promise<ActionResult> {
  const res = await prisma.giftCard.updateMany({
    where: { id: cardId, paidAt: null },
    data: { paidAt: new Date(), paymentId },
  });
  if (res.count === 0) return { ok: true }; // already settled; nothing to do

  const card = await prisma.giftCard.findUnique({
    where: { id: cardId },
    select: { valueInr: true },
  });
  if (card) {
    await prisma.giftCard.update({
      where: { id: cardId },
      data: { balanceInr: card.valueInr },
    });
  }

  revalidatePath("/patient/profile");
  return { ok: true };
}

const redeemSchema = z.object({
  code: z.string().trim().min(4).max(40),
  amountInr: z
    .union([z.number(), z.string()])
    .transform((v) => Math.round(Number(v)))
    .refine((n) => Number.isFinite(n) && n > 0, "How much?"),
  note: z.string().trim().max(300).optional().default(""),
});

/**
 * A clinic spending part of a card.
 *
 * The balance is decremented inside a transaction that re-reads it, so two
 * tills redeeming the same card at once cannot both succeed against the same
 * money.
 */
export async function redeemGiftCard(
  input: unknown
): Promise<ActionResult & { remainingInr?: number }> {
  const owner = await getOwnDoctor();
  if (!owner) return { ok: false, error: "Not permitted." };

  // A card code is a BEARER token: whoever can say it can spend the money. The
  // code space is large, but "large" only helps against an attacker who is
  // rate-limited, so this is the other half of that argument. Scoped per
  // practice, generous enough that a busy counter never notices.
  const limit = rateLimit(`redeem:${owner.doctorId}`, 40, 60 * 60 * 1000);
  if (!limit.ok) {
    return { ok: false, error: "Too many attempts. Please try again shortly." };
  }

  const parsed = redeemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please check the form." };
  const d = parsed.data;

  try {
    return await prisma.$transaction(async (tx) => {
      const card = await tx.giftCard.findUnique({
        where: { code: d.code.toUpperCase() },
        select: { id: true, balanceInr: true, paidAt: true, expiresAt: true },
      });
      if (!card) return { ok: false as const, error: "No card with that code." };
      if (!card.paidAt) return { ok: false as const, error: "That card has not been paid for." };
      if (card.expiresAt && card.expiresAt < new Date()) {
        return { ok: false as const, error: "That card has expired." };
      }
      if (card.balanceInr < d.amountInr) {
        return {
          ok: false as const,
          error: `That card has only ₹${card.balanceInr.toLocaleString("en-IN")} left.`,
        };
      }

      // Conditional update: the balance must still be what we read. If another
      // till got there first, count is 0 and nothing is spent twice.
      const taken = await tx.giftCard.updateMany({
        where: { id: card.id, balanceInr: card.balanceInr },
        data: { balanceInr: card.balanceInr - d.amountInr },
      });
      if (taken.count === 0) {
        return { ok: false as const, error: "That card was just used elsewhere. Try again." };
      }

      await tx.giftCardRedemption.create({
        data: {
          giftCardId: card.id,
          amountInr: d.amountInr,
          doctorId: owner.doctorId,
          note: d.note || null,
        },
      });

      // Handed back so the counter can be told what is left without going to
      // look it up.
      return { ok: true as const, remainingInr: card.balanceInr - d.amountInr };
    });
  } catch {
    return { ok: false, error: "Could not redeem that." };
  }
}
