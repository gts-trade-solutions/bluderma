import { NextResponse } from "next/server";
import { PaymentPurpose, PaymentStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { rateLimit } from "@/lib/rateLimit";
import { getScanOffer } from "@/lib/integrations/skinPricing";
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
 * Buying a skin analysis.
 *
 * The credit is NOT created here. It is created when the payment settles, so
 * an abandoned checkout cannot leave a usable scan behind — the same reason
 * the appointment flow holds its slot but stays PENDING until payment
 * verifies.
 *
 * The price comes from settings, never from the request body.
 */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const limit = rateLimit(`scanbuy:${user.id}`, 20, 60 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Please try again later." },
      { status: 429 }
    );
  }

  const offer = await getScanOffer(user.id);

  // Nothing to sell them — they already have a scan waiting.
  if (offer.free) {
    return NextResponse.json({
      ok: true,
      free: true,
      message: "You already have an analysis available.",
    });
  }

  if (offer.priceInr < MIN_CHARGE_INR) {
    // Priced at zero: hand over the credit rather than open a payment.
    await prisma.skinEntitlement.create({
      data: { userId: user.id, state: "available", source: "free" },
    });
    return NextResponse.json({ ok: true, free: true });
  }

  if (!isRazorpayConfigured()) {
    return NextResponse.json({
      ok: false,
      unavailable: true,
      error:
        "Online payment isn't enabled yet. Ask the clinic to add an analysis to your account.",
    });
  }

  try {
    const order = await razorpayClient().orders.create({
      amount: toMinorUnits(offer.priceInr),
      currency: "INR",
      receipt: `scan-${user.id}-${Date.now()}`,
      notes: { purpose: "skin_scan", userId: user.id },
    });

    await prisma.payment.create({
      data: {
        purpose: PaymentPurpose.SKIN_SCAN,
        userId: user.id,
        provider: "razorpay",
        providerOrderId: order.id,
        amountInr: offer.priceInr,
        amountMinor: toMinorUnits(offer.priceInr),
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
    console.error("[RZP:scan]", err);
    return NextResponse.json(
      { ok: false, error: "Could not start the payment. Please try again." },
      { status: 500 }
    );
  }
}
