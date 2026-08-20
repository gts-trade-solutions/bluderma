import { NextResponse } from "next/server";
import { AppointmentStatus, PaymentStatus } from "@prisma/client";

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
 * Opens a Razorpay order for an appointment the caller already holds.
 *
 * The appointment is created first and holds its slot (see the booking
 * action), so payment never races another patient for the same time. The
 * amount is read from the appointment's own fee snapshot — never from the
 * request body, which the browser controls.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const limit = rateLimit(`pay:${user.id}`, 20, 60 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many payment attempts. Please try again later." },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const appointmentId = String(body?.appointmentId ?? "");
  if (!appointmentId) {
    return NextResponse.json(
      { ok: false, error: "Missing appointmentId" },
      { status: 400 }
    );
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: {
      id: true,
      patientUserId: true,
      status: true,
      feeAtBooking: true,
      visitFee: true,
      patientName: true,
      patientPhone: true,
      patientEmail: true,
      doctor: { select: { name: true } },
    },
  });

  if (!appointment) {
    return NextResponse.json({ ok: false, error: "Appointment not found" }, { status: 404 });
  }
  if (appointment.patientUserId !== user.id) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  if (appointment.status === AppointmentStatus.CANCELLED) {
    return NextResponse.json(
      { ok: false, error: "That appointment has been cancelled." },
      { status: 400 }
    );
  }

  // Already settled — don't open a second order for the same appointment.
  const settled = await prisma.payment.findFirst({
    where: { appointmentId, status: PaymentStatus.PAID },
    select: { id: true },
  });
  if (settled) {
    return NextResponse.json({ ok: true, alreadyPaid: true, appointmentId });
  }

  const amountInr = appointment.feeAtBooking + appointment.visitFee;

  // Nothing chargeable (a free consultation, or a fee waived to zero) —
  // confirm it outright rather than sending Razorpay an unpayable order.
  if (amountInr < MIN_CHARGE_INR) {
    return NextResponse.json({ ok: true, free: true, appointmentId });
  }

  // No keys on this environment: the booking stands and is settled at the
  // clinic. This is what keeps the flow working before the secrets land.
  if (!isRazorpayConfigured()) {
    return NextResponse.json({
      ok: true,
      unavailable: true,
      appointmentId,
      message: "Online payment isn't enabled yet. Pay at the clinic.",
    });
  }

  try {
    const order = await razorpayClient().orders.create({
      amount: toMinorUnits(amountInr),
      currency: "INR",
      receipt: appointment.id,
      notes: {
        appointmentId: appointment.id,
        doctor: appointment.doctor.name,
        patient: appointment.patientName,
      },
    });

    await prisma.payment.create({
      data: {
        appointmentId: appointment.id,
        userId: user.id,
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
      prefill: {
        name: appointment.patientName,
        email: appointment.patientEmail ?? user.email ?? "",
        contact: appointment.patientPhone ?? "",
      },
      appointmentId: appointment.id,
    });
  } catch (err) {
    console.error("[RZP:create]", err);
    return NextResponse.json(
      { ok: false, error: "Could not start the payment. Please try again." },
      { status: 500 }
    );
  }
}
