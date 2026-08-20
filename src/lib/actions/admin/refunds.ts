"use server";

import { AppointmentStatus, PaymentStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { type AdminResult, parseForm, runAction } from "@/lib/admin/form";
import { audit } from "@/lib/admin/audit";
import { requireAdminUser } from "@/lib/admin/guard";
import { sendEmail } from "@/lib/email";
import {
  isRazorpayConfigured,
  razorpayClient,
  toMinorUnits,
} from "@/lib/payments/razorpay";

/**
 * Issuing a refund from the admin console.
 *
 * The money moves at Razorpay — we call their API and record what they tell
 * us. We never mark a payment refunded on our own say-so, because then the
 * ledger would claim something the bank never did.
 *
 * Partial refunds are allowed (a cancelled home visit might return the visit
 * fee but not the consultation), which is why the amount is explicit rather
 * than assumed to be the full payment.
 */

const refundSchema = z.object({
  paymentId: z.string().trim().min(1),
  amountInr: z.coerce.number().int().min(1, "Enter an amount to refund."),
  reason: z.string().trim().max(500).optional().or(z.literal("")),
  /// Cancel the appointment too — usually why a refund is being issued.
  cancelAppointment: z
    .union([z.literal("on"), z.literal("true"), z.literal(""), z.undefined()])
    .transform((v) => v === "on" || v === "true"),
});

export async function refundPayment(formData: FormData): Promise<AdminResult> {
  return runAction("refundPayment", async () => {
    const user = await requireAdminUser();
    const parsed = parseForm(refundSchema, formData);
    if (!parsed.ok) return parsed.result;

    const d = parsed.data;

    const payment = await prisma.payment.findUnique({
      where: { id: d.paymentId },
      include: {
        appointment: {
          select: {
            id: true,
            patientName: true,
            patientEmail: true,
            doctor: { select: { name: true } },
          },
        },
      },
    });

    if (!payment) return { ok: false, error: "That payment no longer exists." };
    if (payment.status !== PaymentStatus.PAID) {
      return {
        ok: false,
        error: `Only a paid payment can be refunded. This one is ${payment.status}.`,
      };
    }
    if (!payment.providerPaymentId) {
      return {
        ok: false,
        error: "This payment has no Razorpay payment id to refund against.",
      };
    }
    if (d.amountInr > payment.amountInr) {
      return {
        ok: false,
        error: `That is more than the ₹${payment.amountInr} taken.`,
      };
    }
    if (!isRazorpayConfigured()) {
      return {
        ok: false,
        error:
          "Razorpay is not configured on this environment, so no refund can be issued.",
      };
    }

    let refundId: string;
    try {
      const refund = await razorpayClient().payments.refund(
        payment.providerPaymentId,
        {
          amount: toMinorUnits(d.amountInr),
          notes: {
            appointmentId: payment.appointmentId,
            issuedBy: user.email ?? user.id,
            reason: d.reason || "",
          },
        }
      );
      refundId = refund.id;
    } catch (err) {
      // Razorpay refused — the ledger stays honest and says why.
      const message =
        err instanceof Error ? err.message : "Razorpay rejected the refund.";
      console.error("[RZP:refund]", err);
      return { ok: false, error: message };
    }

    const full = d.amountInr >= payment.amountInr;

    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        // Only a full return leaves nothing owed; a partial one is still a
        // paid payment with money returned against it.
        status: full ? PaymentStatus.REFUNDED : PaymentStatus.PAID,
        refundId,
        refundedInr: (payment.refundedInr ?? 0) + d.amountInr,
        refundReason: d.reason || null,
        refundedAt: new Date(),
        refundedById: user.id,
      },
    });

    // Only an appointment payment has something to cancel; a scan refund
    // just returns the money and leaves the credit alone.
    if (d.cancelAppointment && payment.appointmentId) {
      await prisma.appointment.update({
        where: { id: payment.appointmentId },
        data: {
          status: AppointmentStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelReason: d.reason || "Refunded by the clinic",
          // Releasing the lock frees the slot for someone else.
          slotLock: null,
        },
      });
    }

    await audit({
      userId: user.id,
      action: "refund",
      entity: "Payment",
      entityId: payment.id,
      before: payment,
      after: updated,
    });

    const appt = payment.appointment;
    const to = appt?.patientEmail ?? null;
    if (to) {
      const what = appt
        ? `your appointment with ${appt.doctor.name}`
        : "your skin analysis";
      const cancelled =
        d.cancelAppointment && payment.appointmentId
          ? " The appointment has been cancelled."
          : "";
      await sendEmail({
        to,
        template: "booking-confirmation",
        relatedId: payment.appointmentId ?? payment.id,
        subject: `Refund issued - INR ${d.amountInr}`,
        text: `Hi ${appt?.patientName ?? "there"},\n\nWe have refunded INR ${d.amountInr} for ${what}.${cancelled}\nIt usually reaches your account in 5-7 working days.\nReference: ${refundId}\n\n- BluDerma`,
        html: `<p>Hi ${appt?.patientName ?? "there"},</p><p>We have refunded <strong>INR ${d.amountInr}</strong> for ${what}.${cancelled}</p><p>It usually reaches your account in 5-7 working days.<br/>Reference: ${refundId}</p><p>- BluDerma</p>`,
      }).catch((e) => console.error("refund email failed", e));
    }

    revalidatePath("/admin/payments");
    revalidatePath("/patient/appointments");
    revalidatePath("/patient/profile");
    return { ok: true, id: refundId };
  });
}
