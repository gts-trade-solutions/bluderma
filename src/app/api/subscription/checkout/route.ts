import { NextResponse } from "next/server";
import {
  PaymentPurpose,
  PaymentStatus,
  SubscriptionStatus,
} from "@prisma/client";
import { z } from "zod";

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
import { periodEndFrom, renewalStartFrom } from "@/lib/subscription/plan";

/**
 * Starts a White Collar term.
 *
 * Mirrors /api/razorpay/create exactly, including the two rules that matter:
 * the amount comes from the PLAN row and never from the request body, and the
 * thing being bought exists as a server-side row before checkout opens — so an
 * abandoned payment leaves a CREATED payment and an inactive subscription
 * rather than nothing at all.
 *
 * The membership itself is activated in settlePayment(), not here. Nobody gets
 * benefits for opening a payment window.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const schema = z.object({ planSlug: z.string().trim().min(1).max(120) });

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Please sign in first." },
      { status: 401 }
    );
  }

  const limit = rateLimit(`sub:${user.id}`, 20, 60 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Try again shortly." },
      { status: 429 }
    );
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const plan = await prisma.subscriptionPlan.findFirst({
    where: { slug: parsed.data.planSlug, isActive: true },
    select: { id: true, name: true, priceInr: true, interval: true },
  });
  if (!plan) {
    return NextResponse.json(
      { ok: false, error: "That plan is no longer available." },
      { status: 404 }
    );
  }

  const existing = await prisma.subscription.findFirst({
    where: { userId: user.id },
    orderBy: { currentPeriodEnd: "desc" },
    select: { id: true, status: true, currentPeriodEnd: true, planId: true },
  });

  // Renewing extends from the current period end; a first purchase starts now.
  const now = new Date();
  const startedAt = renewalStartFrom(
    existing && existing.status === SubscriptionStatus.ACTIVE
      ? existing.currentPeriodEnd
      : null,
    now
  );

  // The pending row. Reused rather than duplicated so a member never
  // accumulates a row per abandoned checkout.
  const subscription = existing
    ? await prisma.subscription.update({
        where: { id: existing.id },
        data: { planId: plan.id },
        select: { id: true },
      })
    : await prisma.subscription.create({
        data: {
          userId: user.id,
          planId: plan.id,
          // EXPIRED until money arrives. Nothing reads this as a live
          // membership, which is the point.
          status: SubscriptionStatus.EXPIRED,
          startedAt,
          currentPeriodEnd: now,
        },
        select: { id: true },
      });

  // A free plan needs no gateway at all.
  if (plan.priceInr < MIN_CHARGE_INR) {
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: SubscriptionStatus.ACTIVE,
        startedAt,
        currentPeriodEnd: periodEndFrom(startedAt, plan.interval),
      },
    });
    return NextResponse.json({
      ok: true,
      free: true,
      message: `Your ${plan.name} membership is active.`,
    });
  }

  if (!isRazorpayConfigured()) {
    return NextResponse.json({
      ok: true,
      unavailable: true,
      message:
        "Online payment isn't switched on yet. Please contact us to start your membership.",
    });
  }

  const order = await razorpayClient().orders.create({
    amount: toMinorUnits(plan.priceInr),
    currency: "INR",
    receipt: subscription.id,
    notes: {
      purpose: "subscription",
      userId: user.id,
      planSlug: parsed.data.planSlug,
    },
  });

  await prisma.payment.create({
    data: {
      purpose: PaymentPurpose.SUBSCRIPTION,
      userId: user.id,
      subscriptionId: subscription.id,
      providerOrderId: order.id,
      amountInr: plan.priceInr,
      amountMinor: toMinorUnits(plan.priceInr),
      status: PaymentStatus.CREATED,
    },
  });

  return NextResponse.json({
    ok: true,
    key: razorpayKeyId(),
    order: { id: order.id, amount: order.amount, currency: order.currency },
    prefill: { name: user.name ?? "", email: user.email ?? "" },
    subscriptionId: subscription.id,
  });
}
