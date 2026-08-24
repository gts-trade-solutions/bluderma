import { NextResponse } from "next/server";
import { OfferStatus, PaymentPurpose, PaymentStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { rateLimit } from "@/lib/rateLimit";
import {
  MIN_CHARGE_INR,
  isRazorpayConfigured,
  razorpayClient,
  razorpayKeyId,
  toMinorUnits,
} from "@/lib/payments/razorpay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Opening checkout for a gift card.
 *
 * ── The card exists already and is worth nothing ─────────────────────────
 * buyGiftCard created it with a zero balance and no `paidAt`. This route only
 * opens a payment against it. The balance is released when the payment
 * SETTLES, on the same principle as the scan credit and the appointment slot:
 * an abandoned checkout must not leave anything spendable behind.
 *
 * ── The price comes from the offer, never the request ────────────────────
 * The body carries a card id and nothing else that matters. Everything
 * chargeable is read back from the database, because an amount in a payload is
 * a number the buyer chose.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const limit = rateLimit(`giftbuy:${user.id}`, 20, 60 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Please try again later." },
      { status: 429 }
    );
  }

  let cardId = "";
  try {
    const body = (await req.json()) as { cardId?: unknown };
    if (typeof body.cardId === "string") cardId = body.cardId;
  } catch {
    /* handled below */
  }
  if (!cardId) {
    return NextResponse.json({ ok: false, error: "No card given." }, { status: 400 });
  }

  // Theirs, unpaid, and against an offer still on sale. All three re-checked
  // here: the page they pressed buy on may have been open for an hour.
  const card = await prisma.giftCard.findFirst({
    where: { id: cardId, buyerUserId: user.id, paidAt: null },
    select: {
      id: true,
      valueInr: true,
      offer: { select: { priceInr: true, status: true, title: true } },
    },
  });
  if (!card) {
    return NextResponse.json(
      { ok: false, error: "That purchase is no longer open." },
      { status: 404 }
    );
  }
  if (card.offer.status !== OfferStatus.APPROVED) {
    return NextResponse.json({
      ok: false,
      error: "That gift card is no longer on sale.",
    });
  }

  const amountInr = card.offer.priceInr;

  if (amountInr < MIN_CHARGE_INR) {
    return NextResponse.json({
      ok: false,
      error: "That card is priced too low to charge for.",
    });
  }

  if (!isRazorpayConfigured()) {
    return NextResponse.json({
      ok: false,
      unavailable: true,
      error: "Online payment isn't enabled yet. Ask the clinic about buying this directly.",
    });
  }

  try {
    const order = await razorpayClient().orders.create({
      amount: toMinorUnits(amountInr),
      currency: "INR",
      receipt: `gift-${card.id}-${Date.now()}`,
      notes: { purpose: "gift_card", userId: user.id, giftCardId: card.id },
    });

    await prisma.payment.create({
      data: {
        purpose: PaymentPurpose.GIFT_CARD,
        userId: user.id,
        giftCardId: card.id,
        provider: "razorpay",
        providerOrderId: order.id,
        amountInr,
        amountMinor: toMinorUnits(amountInr),
        currency: "INR",
        status: PaymentStatus.CREATED,
      },
    });

    return NextResponse.json({
      ok: true,
      key: razorpayKeyId(),
      order: { id: order.id, amount: order.amount, currency: order.currency },
      prefill: { name: user.name ?? "", email: user.email ?? "", contact: "" },
    });
  } catch (err) {
    console.error("[RZP:gift]", err);
    return NextResponse.json(
      { ok: false, error: "Could not start the payment. Please try again." },
      { status: 500 }
    );
  }
}
