import {
  AppointmentStatus,
  PaymentPurpose,
  PaymentStatus,
  SubscriptionStatus,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { periodEndFrom, renewalStartFrom } from "@/lib/subscription/plan";

/**
 * Settling a payment, shared by the two paths that can report one.
 *
 * The browser's return from checkout is the fast path; Razorpay's webhook is
 * the reliable one. Both land here so a payment settles identically whichever
 * arrives first — and so the second arrival is a no-op rather than a double
 * confirmation or a second receipt.
 *
 * A payment buys one of three things, and settling means something different
 * for each: an appointment payment confirms the booking, a scan payment
 * releases the analysis credit it paid for, and a subscription payment starts
 * or extends a membership term. The `purpose` column decides, never the
 * caller.
 *
 * Callers are responsible for proving the payment is genuine (signature or
 * webhook HMAC) before calling this. It verifies nothing itself.
 */

export type SettleResult =
  | { ok: true; appointmentId: string | null; alreadySettled: boolean }
  | { ok: false; reason: "not_found" };

export async function settlePayment(input: {
  /** Razorpay order id — our own row's stable handle on the transaction. */
  providerOrderId: string;
  providerPaymentId: string;
  signature?: string | null;
}): Promise<SettleResult> {
  const payment = await prisma.payment.findUnique({
    where: { providerOrderId: input.providerOrderId },
    select: {
      id: true,
      purpose: true,
      giftCardId: true,
      status: true,
      amountInr: true,
      userId: true,
      appointmentId: true,
      entitlementId: true,
      subscriptionId: true,
      appointment: {
        select: {
          id: true,
          scheduledAt: true,
          mode: true,
          patientName: true,
          patientEmail: true,
          doctor: { select: { name: true, clinic: true, location: true } },
        },
      },
    },
  });

  if (!payment) return { ok: false, reason: "not_found" };

  // Already done — whichever path got here first did the work.
  if (payment.status === PaymentStatus.PAID) {
    return {
      ok: true,
      appointmentId: payment.appointmentId,
      alreadySettled: true,
    };
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: PaymentStatus.PAID,
      providerPaymentId: input.providerPaymentId,
      signature: input.signature ?? null,
      paidAt: new Date(),
      failureReason: null,
    },
  });

  if (payment.purpose === PaymentPurpose.SKIN_SCAN) {
    await releaseScanCredit(payment.id, payment.userId, payment.entitlementId);
    await sendScanReceipt(payment.userId, payment.amountInr, input.providerPaymentId);
  } else if (payment.purpose === PaymentPurpose.GIFT_CARD) {
    await releaseGiftCardBalance(payment.giftCardId);
  } else if (payment.purpose === PaymentPurpose.SUBSCRIPTION) {
    await activateMembership(payment.id, payment.userId, payment.subscriptionId);
    await sendMembershipReceipt(
      payment.userId,
      payment.amountInr,
      input.providerPaymentId
    );
  } else if (payment.appointmentId && payment.appointment) {
    await prisma.appointment.update({
      where: { id: payment.appointmentId },
      data: { status: AppointmentStatus.CONFIRMED },
    });
    await sendBookingReceipt(
      payment.appointment,
      payment.amountInr,
      input.providerPaymentId
    );
  }

  return {
    ok: true,
    appointmentId: payment.appointmentId,
    alreadySettled: false,
  };
}

/**
 * Starts or extends the membership term this payment bought.
 *
 * Like the scan credit, the term is granted HERE and not at checkout: an
 * abandoned payment must not leave someone a live membership. The pending row
 * created at checkout carries the plan, so this only has to move it to ACTIVE
 * and set the dates.
 *
 * Renewing EXTENDS from the existing period end rather than from today, so a
 * member who pays a week early is not quietly charged for a week they had
 * already bought.
 *
 * Scan credits that come with the plan are granted the same way — through the
 * existing entitlement table, so they behave exactly like any other credit.
 */
async function activateMembership(
  paymentId: string,
  userId: string | null,
  subscriptionId: string | null
) {
  if (!userId || !subscriptionId) return;

  const sub = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    select: {
      id: true,
      userId: true,
      status: true,
      currentPeriodEnd: true,
      plan: { select: { interval: true, scanCredits: true, name: true } },
    },
  });
  // A payment whose subscription vanished, or which points at somebody else's,
  // settles as money received and grants nothing. Refusing is safer than
  // guessing whose membership to extend.
  if (!sub || sub.userId !== userId) return;
  if (sub.status === SubscriptionStatus.ACTIVE && sub.currentPeriodEnd > new Date()) {
    // Already live for this term — a webhook and a browser return both
    // arriving is normal, and neither should stack a second year on.
    const settled = await prisma.payment.findUnique({
      where: { id: paymentId },
      select: { paidAt: true },
    });
    if (settled?.paidAt) return;
  }

  const now = new Date();
  const startedAt = renewalStartFrom(sub.currentPeriodEnd, now);
  const currentPeriodEnd = periodEndFrom(startedAt, sub.plan.interval);

  await prisma.subscription.update({
    where: { id: sub.id },
    data: {
      status: SubscriptionStatus.ACTIVE,
      startedAt,
      currentPeriodEnd,
      cancelledAt: null,
      renewalNoticeSentAt: null,
    },
  });

  if (sub.plan.scanCredits > 0) {
    await prisma.skinEntitlement.createMany({
      data: Array.from({ length: sub.plan.scanCredits }, () => ({
        userId,
        state: "available",
        source: "granted",
      })),
    });
  }
}

/**
 * Puts the money on a gift card, once it has actually arrived.
 *
 * Called only from here, for the same reason releaseScanCredit is: a card
 * created at checkout carries a zero balance, so an abandoned payment leaves
 * something inert rather than treatment somebody can walk out with.
 *
 * Idempotent. A retried webhook must not double a card's value, so the write
 * is conditional on `paidAt` still being unset.
 */
async function releaseGiftCardBalance(giftCardId: string | null): Promise<void> {
  if (!giftCardId) return;

  const card = await prisma.giftCard.findUnique({
    where: { id: giftCardId },
    select: { id: true, valueInr: true, paidAt: true },
  });
  if (!card || card.paidAt) return;

  await prisma.giftCard.updateMany({
    where: { id: card.id, paidAt: null },
    data: { paidAt: new Date(), balanceInr: card.valueInr },
  });
}

/**
 * Hands the client the scan credit their payment bought.
 *
 * Created here rather than at checkout time on purpose: an abandoned payment
 * must not leave a usable credit behind. The row is linked back to the
 * payment so a refund can find and revoke it.
 */
async function releaseScanCredit(
  paymentId: string,
  userId: string | null,
  existingEntitlementId: string | null
) {
  if (!userId) return;

  if (existingEntitlementId) {
    await prisma.skinEntitlement.updateMany({
      where: { id: existingEntitlementId, state: "pending_payment" },
      data: { state: "available" },
    });
    return;
  }

  const entitlement = await prisma.skinEntitlement.create({
    data: { userId, state: "available", source: "paid" },
    select: { id: true },
  });
  await prisma.payment.update({
    where: { id: paymentId },
    data: { entitlementId: entitlement.id },
  });
}

type AppointmentForReceipt = {
  id: string;
  scheduledAt: Date;
  mode: string;
  patientName: string;
  patientEmail: string | null;
  doctor: { name: string; clinic: string; location: string };
};

/** A failed receipt must never undo a good payment, so these never throw. */
async function sendBookingReceipt(
  appt: AppointmentForReceipt,
  amountInr: number,
  paymentId: string
) {
  if (!appt.patientEmail) return;

  const when = appt.scheduledAt.toISOString().replace("T", " ").slice(0, 16);
  const where =
    appt.mode === "VIDEO"
      ? "Video consult: link to follow"
      : appt.mode === "HOME"
      ? "Home visit: the clinic will call to confirm the address"
      : `${appt.doctor.clinic}, ${appt.doctor.location}`;

  await sendEmail({
    to: appt.patientEmail,
    template: "booking-confirmation",
    relatedId: appt.id,
    subject: `Payment received: your appointment with ${appt.doctor.name} is confirmed`,
    text: `Hi ${appt.patientName},\n\nWe've received ₹${amountInr}. Your appointment with ${appt.doctor.name} on ${when} (UTC) is confirmed.\nWhere: ${where}\nPayment reference: ${paymentId}\n\n, BluDerma`,
    html: `<p>Hi ${appt.patientName},</p><p>We've received <strong>₹${amountInr}</strong>. Your appointment with <strong>${appt.doctor.name}</strong> on <strong>${when}</strong> (UTC) is confirmed.</p><p>Where: ${where}<br/>Payment reference: ${paymentId}</p><p>, BluDerma</p>`,
  }).catch((e) => console.error("payment receipt email failed", e));
}

async function sendScanReceipt(
  userId: string | null,
  amountInr: number,
  paymentId: string
) {
  if (!userId) return;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });
  if (!user?.email) return;

  await sendEmail({
    to: user.email,
    template: "booking-confirmation",
    relatedId: paymentId,
    subject: "Payment received: your skin analysis is ready to run",
    text: `Hi ${user.name ?? "there"},\n\nWe've received ₹${amountInr}. Your skin analysis is unlocked and waiting in your account.\nPayment reference: ${paymentId}\n\n, BluDerma`,
    html: `<p>Hi ${user.name ?? "there"},</p><p>We've received <strong>₹${amountInr}</strong>. Your skin analysis is unlocked and waiting in your account.</p><p>Payment reference: ${paymentId}</p><p>, BluDerma</p>`,
  }).catch((e) => console.error("scan receipt email failed", e));
}

/**
 * Records a payment that did not complete. Only a CREATED row moves, so a
 * late-arriving failure event can never un-settle a payment that succeeded.
 */
export async function markPaymentFailed(
  providerOrderId: string,
  reason: string
): Promise<void> {
  await prisma.payment.updateMany({
    where: { providerOrderId, status: PaymentStatus.CREATED },
    data: { status: PaymentStatus.FAILED, failureReason: reason.slice(0, 500) },
  });
}

/**
 * Membership receipt. Best-effort like the others — a mail failure must never
 * undo a good payment.
 */
async function sendMembershipReceipt(
  userId: string | null,
  amountInr: number,
  providerPaymentId: string
) {
  if (!userId) return;
  const [user, sub] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    }),
    prisma.subscription.findFirst({
      where: { userId },
      orderBy: { currentPeriodEnd: "desc" },
      select: { currentPeriodEnd: true, plan: { select: { name: true } } },
    }),
  ]);
  if (!user?.email || !sub) return;

  const until = sub.currentPeriodEnd.toISOString().slice(0, 10);
  const name = user.name ?? "there";
  await sendEmail({
    to: user.email,
    template: "booking-confirmation",
    subject: `Your ${sub.plan.name} membership is active`,
    text: `Hi ${name},\n\nYour ${sub.plan.name} membership is active until ${until}.\n\nPaid: ₹${amountInr}\nPayment reference: ${providerPaymentId}\n\n, BluDerma`,
    html: `<p>Hi ${name},</p><p>Your <strong>${sub.plan.name}</strong> membership is active until <strong>${until}</strong>.</p><p>Paid: ₹${amountInr}<br/>Payment reference: ${providerPaymentId}</p><p>, BluDerma</p>`,
  }).catch((e) => console.error("membership receipt failed", e));
}
