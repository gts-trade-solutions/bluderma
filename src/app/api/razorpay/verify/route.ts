import { NextResponse } from "next/server";
import { PaymentStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { verifyPaymentSignature } from "@/lib/payments/razorpay";
import { settlePayment } from "@/lib/payments/settle";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * The browser's return path from checkout — the fast confirmation.
 *
 * The signature is the only thing that decides success: HMAC-SHA256 of
 * "<order_id>|<payment_id>" under our secret, which only Razorpay can
 * produce. Every claim in the body is re-read from our own rows.
 *
 * This is not the last line of defence. If the patient closes the tab before
 * this runs, the webhook settles the same payment — both call settlePayment,
 * which is idempotent, so whichever arrives second is a no-op.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const orderId = String(body?.razorpay_order_id ?? "");
  const paymentId = String(body?.razorpay_payment_id ?? "");
  const signature = String(body?.razorpay_signature ?? "");

  if (!orderId || !paymentId || !signature) {
    return NextResponse.json(
      { ok: false, error: "Missing payment details" },
      { status: 400 }
    );
  }

  const payment = await prisma.payment.findUnique({
    where: { providerOrderId: orderId },
    select: { id: true, userId: true, status: true, appointmentId: true },
  });

  if (!payment) {
    return NextResponse.json({ ok: false, error: "Payment not found" }, { status: 404 });
  }
  if (payment.userId && payment.userId !== user.id) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  if (payment.status === PaymentStatus.PAID) {
    return NextResponse.json({ ok: true, appointmentId: payment.appointmentId });
  }

  if (!verifyPaymentSignature({ orderId, paymentId, signature })) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.FAILED, failureReason: "signature mismatch" },
    });
    return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 400 });
  }

  const settled = await settlePayment({
    providerOrderId: orderId,
    providerPaymentId: paymentId,
    signature,
  });

  if (!settled.ok) {
    return NextResponse.json({ ok: false, error: "Payment not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, appointmentId: settled.appointmentId });
}
