"use server";

import { revalidatePath } from "next/cache";
import { AppointmentStatus, ConsultMode, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { bookingSchema, fieldErrors } from "@/lib/validation";
import { getCurrentUser } from "@/lib/session";
import { getSlotsForDoctor, slotInstant } from "@/lib/queries/availability";
import { sendEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rateLimit";
import type { ActionResult } from "./enquiry";

export interface BookingResult extends ActionResult {
  appointmentId?: string;
}

/** The lock value whose unique index prevents two people holding one slot. */
function slotLockFor(doctorId: string, at: Date): string {
  return `${doctorId}@${at.toISOString()}`;
}

export async function bookAppointment(input: unknown): Promise<BookingResult> {
  // Booking requires an account — that is a product decision from the sprint
  // plan, and it's also what ties an appointment to a patient record.
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "Please sign in to book an appointment." };
  }

  // Keyed by user id, not IP — booking requires a session. Caps churn (rapid
  // book/cancel to probe or hold slots) without getting in a real patient's way.
  const limit = rateLimit(`book:${user.id}`, 15, 60 * 60 * 1000);
  if (!limit.ok) {
    return {
      ok: false,
      error: "You've made a lot of booking changes recently. Please try again later.",
    };
  }

  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please check the form.",
      fields: fieldErrors(parsed.error),
    };
  }
  const d = parsed.data;

  const doctor = await prisma.doctor.findFirst({
    where: { slug: d.doctorSlug, isActive: true },
    select: {
      id: true,
      name: true,
      fee: true,
      clinic: true,
      location: true,
      modes: { select: { mode: true } },
    },
  });
  if (!doctor) {
    return { ok: false, error: "That doctor is no longer available." };
  }

  const wantedMode =
    d.mode === "video" ? ConsultMode.VIDEO : ConsultMode.CLINIC;
  if (!doctor.modes.some((m) => m.mode === wantedMode)) {
    return { ok: false, error: "That consultation type isn't offered." };
  }

  const scheduledAt = slotInstant(d.daySeed, d.time);
  if (Number.isNaN(scheduledAt.getTime())) {
    return { ok: false, error: "Pick a valid date and time." };
  }
  if (scheduledAt.getTime() <= Date.now()) {
    return { ok: false, error: "That time has already passed." };
  }

  // Re-derive availability server-side. The client sends a slot label, but it
  // doesn't get to assert that the slot exists or is free.
  const slots = await getSlotsForDoctor(d.doctorSlug, d.daySeed);
  const slot = slots.find((s) => s.label === d.time);
  if (!slot) {
    return { ok: false, error: "That time isn't in the doctor's schedule." };
  }
  if (!slot.available) {
    return { ok: false, error: "That slot has just been taken. Pick another." };
  }

  try {
    const appointment = await prisma.appointment.create({
      data: {
        patientUserId: user.id,
        doctorId: doctor.id,
        scheduledAt,
        mode: wantedMode,
        status: AppointmentStatus.CONFIRMED,
        feeAtBooking: doctor.fee,
        patientName: d.patientName,
        patientPhone: d.patientPhone || null,
        patientEmail: user.email ?? null,
        notes: d.notes || null,
        slotLock: slotLockFor(doctor.id, scheduledAt),
      },
      select: { id: true },
    });

    if (user.email) {
      const when = `${d.daySeed} at ${d.time}`;
      const where =
        d.mode === "video"
          ? "Video consult — link to follow"
          : `${doctor.clinic}, ${doctor.location}`;
      await sendEmail({
        to: user.email,
        template: "booking-confirmation",
        relatedId: appointment.id,
        subject: `Your appointment with ${doctor.name} is confirmed`,
        text: `Hi ${d.patientName},\n\nYour appointment with ${doctor.name} is confirmed for ${when}.\nWhere: ${where}\nConsultation fee: ₹${doctor.fee}\n\nManage or cancel it any time from your BluDerma account.\n\n— BluDerma`,
        html: `<p>Hi ${d.patientName},</p><p>Your appointment with <strong>${doctor.name}</strong> is confirmed for <strong>${when}</strong>.</p><p>Where: ${where}<br/>Consultation fee: ₹${doctor.fee}</p><p>Manage or cancel it any time from your BluDerma account.</p><p>— BluDerma</p>`,
        // A failed confirmation email must not undo a valid booking.
      }).catch((e) => console.error("confirmation email failed", e));
    }

    revalidatePath("/patient/appointments");
    return { ok: true, appointmentId: appointment.id };
  } catch (err) {
    // P2002 on slotLock = someone booked the same slot between our
    // availability check and this insert. The database is the arbiter.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return {
        ok: false,
        error: "That slot was just booked by someone else. Please pick another.",
      };
    }
    console.error("booking failed", err);
    return { ok: false, error: "Could not complete your booking. Try again." };
  }
}

export async function cancelAppointment(
  appointmentId: string
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in." };

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { id: true, patientUserId: true, status: true },
  });

  // Same response whether it doesn't exist or isn't theirs — no probing for
  // other people's appointment ids.
  if (!appointment || appointment.patientUserId !== user.id) {
    return { ok: false, error: "Appointment not found." };
  }
  if (appointment.status === AppointmentStatus.CANCELLED) {
    return { ok: true };
  }

  await prisma.appointment.update({
    where: { id: appointment.id },
    data: {
      status: AppointmentStatus.CANCELLED,
      cancelledAt: new Date(),
      // Releasing the lock is what makes the slot bookable again.
      slotLock: null,
    },
  });

  revalidatePath("/patient/appointments");
  return { ok: true };
}
