"use server";

import { revalidatePath } from "next/cache";
import {
  AppointmentStatus,
  ApprovalState,
  ConsultMode,
  Prisma,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { bookingSchema, fieldErrors } from "@/lib/validation";
import { getCurrentUser } from "@/lib/session";
import {
  clinicNow,
  getSlotsForDoctor,
  slotInstant,
} from "@/lib/queries/availability";
import { sendEmail } from "@/lib/email";
import { getHomeVisitFee } from "@/lib/queries/content";
import { MIN_CHARGE_INR, isRazorpayConfigured } from "@/lib/payments/razorpay";
import {
  evaluateCancellation,
  evaluateReschedule,
} from "@/lib/booking/policy";
import { getBookingPolicy } from "@/lib/booking/policySettings";
import { PUBLIC_DOCTOR_WHERE } from "@/lib/queries/doctorAccess";
import { getMembership, benefitsOf } from "@/lib/subscription/membership";
import { applyMemberDiscount } from "@/lib/subscription/plan";
import { notifyDoctorOfBooking } from "@/lib/doctor/notify";
import {
  intakeEmailBlock,
  isUrgent,
  reasonLabel,
} from "@/lib/booking/visitIntake";
import { rateLimit } from "@/lib/rateLimit";
import type { ActionResult } from "./enquiry";

export interface BookingResult extends ActionResult {
  appointmentId?: string;
  /** True when the caller must now run the Razorpay checkout to confirm. */
  paymentDue?: boolean;
  /**
   * True when the doctor vets their own list, so the booking is held rather
   * than confirmed. The slot is locked either way.
   */
  awaiting?: boolean;
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
    where: { slug: d.doctorSlug, ...PUBLIC_DOCTOR_WHERE },
    select: {
      id: true,
      name: true,
      fee: true,
      clinic: true,
      location: true,
      requiresApproval: true,
      email: true,
      user: { select: { email: true } },
      modes: { select: { mode: true } },
      clinics: {
        where: { isActive: true },
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
        select: {
          feeInr: true,
          isPrimary: true,
          clinic: {
            select: { id: true, name: true, area: true, city: true, isActive: true },
          },
        },
      },
    },
  });
  if (!doctor) {
    return { ok: false, error: "That doctor is no longer available." };
  }

  const wantedMode =
    d.mode === "video"
      ? ConsultMode.VIDEO
      : d.mode === "home"
      ? ConsultMode.HOME
      : ConsultMode.CLINIC;
  // A home visit is scheduled against the doctor's clinic hours — they travel
  // during a slot they would otherwise be consulting in — so the mode check
  // is for the clinic offering, not a separate HOME availability.
  const requiredMode =
    wantedMode === ConsultMode.HOME ? ConsultMode.CLINIC : wantedMode;
  if (!doctor.modes.some((m) => m.mode === requiredMode)) {
    return { ok: false, error: "That consultation type isn't offered." };
  }

  // Which location. A doctor may now hold hours at several, and the fee is
  // per-location — the same practitioner charges differently at a flagship and
  // a suburban branch. An unrecognised clinic is refused rather than quietly
  // falling back, because silently booking someone into the wrong part of the
  // city is worse than making them choose again.
  const practices = doctor.clinics.filter((p) => p.clinic.isActive);
  let practice = practices.find((p) => p.isPrimary) ?? practices[0] ?? null;
  if (d.clinicId) {
    const picked = practices.find((p) => p.clinic.id === d.clinicId);
    if (!picked) {
      return { ok: false, error: "That clinic is no longer bookable for this doctor." };
    }
    practice = picked;
  }

  // Doctor.fee remains the headline figure for practitioners who have not been
  // migrated onto per-clinic pricing yet.
  const listFee = practice ? practice.feeInr : doctor.fee;

  // The surcharge is admin-editable and snapshotted onto the appointment.
  const visitFee =
    wantedMode === ConsultMode.HOME ? await getHomeVisitFee() : 0;

  // White Collar pricing. Resolved server-side from the session — the client
  // never gets to assert that it is a member.
  const membership = await getMembership(user.id);
  const benefits = benefitsOf(membership);
  const { payableInr, discountInr } = applyMemberDiscount(listFee, benefits);

  // Age and sex go on the appointment as a snapshot — dermatology reads
  // differently by both, and the doctor needs what was true at booking time.
  const profile = await prisma.patientProfile.findUnique({
    where: { userId: user.id },
    select: { age: true, gender: true },
  });

  // An attached scan is only ever the patient's own. The id arrives from the
  // browser, so it is re-checked here rather than trusted; a scan belonging to
  // somebody else is dropped silently rather than failing the booking, because
  // the booking is the thing the patient came to do.
  let attachedAnalysisId: string | null = null;
  let attachedScanId: string | null = null;
  if (d.skinReportId) {
    if (d.skinReportSource === "scan") {
      const owned = await prisma.skinScan.findFirst({
        where: { id: d.skinReportId, userId: user.id },
        select: { id: true },
      });
      attachedScanId = owned?.id ?? null;
    } else {
      const owned = await prisma.skinAnalysis.findFirst({
        where: { id: d.skinReportId, userId: user.id },
        select: { id: true },
      });
      attachedAnalysisId = owned?.id ?? null;
    }
  }

  // Photographs the patient attached. The keys come from the browser, so each
  // is matched against the upload record that names who put it there — an
  // attacker cannot bolt somebody else's clinical photograph onto a booking of
  // their own and then read it back through the signed-view route.
  const photoAssets = d.photoKeys?.length
    ? await prisma.mediaAsset.findMany({
        where: {
          storageKey: { in: d.photoKeys },
          uploadedById: user.id,
        },
        select: { storageKey: true, url: true },
      })
    : [];

  const scheduledAt = slotInstant(d.daySeed, d.time);
  if (Number.isNaN(scheduledAt.getTime())) {
    return { ok: false, error: "Pick a valid date and time." };
  }
  if (scheduledAt.getTime() <= clinicNow()) {
    return { ok: false, error: "That time has already passed." };
  }

  // Re-derive availability server-side. The client sends a slot label, but it
  // doesn't get to assert that the slot exists or is free.
  const slots = await getSlotsForDoctor(d.doctorSlug, d.daySeed, {
    clinicId: practice?.clinic.id,
    isMember: benefits.priorityBooking,
  });
  const slot = slots.find((s) => s.label === d.time);
  if (!slot) {
    return { ok: false, error: "That time isn't in the doctor's schedule." };
  }
  if (!slot.available) {
    return { ok: false, error: "That slot has just been taken. Pick another." };
  }

  // Online settlement only happens when the gateway is configured and there
  // is something to charge; otherwise the visit is paid at the clinic and
  // the appointment confirms on the spot.
  // Their login address first: the directory `email` may be a shared reception
  // inbox nobody watches for individual bookings.
  const doctorContact = doctor.user?.email ?? doctor.email;

  const paymentDue =
    isRazorpayConfigured() && payableInr + visitFee >= MIN_CHARGE_INR;

  // Some practitioners vet their own list. The slot is locked either way — a
  // booking awaiting a decision still holds its time, or the doctor would be
  // reviewing a request whose slot had already gone.
  const approvalState = doctor.requiresApproval
    ? ApprovalState.AWAITING_DOCTOR
    : ApprovalState.AUTO;

  try {
    const appointment = await prisma.appointment.create({
      data: {
        patientUserId: user.id,
        doctorId: doctor.id,
        clinicId: practice?.clinic.id ?? null,
        scheduledAt,
        mode: wantedMode,
        // Held, not confirmed, while there is a fee to settle online: the
        // slot is locked either way, but the booking only becomes CONFIRMED
        // once payment verifies (or immediately when nothing is payable).
        status: paymentDue ? AppointmentStatus.PENDING : AppointmentStatus.CONFIRMED,
        approvalState,
        // The fee actually owed, after any membership discount. Storing the
        // net figure keeps this in step with what Razorpay is asked to charge;
        // discountInr beside it preserves what was given away.
        feeAtBooking: payableInr,
        discountInr,
        subscriptionId: discountInr > 0 ? membership?.id ?? null : null,
        isPriority: benefits.priorityBooking,
        visitFee,
        patientName: d.patientName,
        patientPhone: d.patientPhone || null,
        patientEmail: user.email ?? null,
        notes: d.notes || null,

        // What the appointment is actually for. See lib/booking/visitIntake.ts
        // for the vocabulary these render through.
        reason: d.reason,
        reasonDetail: d.reasonDetail,
        symptomDuration: d.symptomDuration,
        severity: d.severity,
        isFirstVisit: d.isFirstVisit,
        priorTreatment: d.priorTreatment || null,
        medications: d.medications || null,
        allergies: d.allergies || null,
        photoConsent: d.photoConsent,
        // Snapshotted, not joined: a profile edited next year must not change
        // what the doctor was told at the time of this consultation.
        patientAge: profile?.age ?? null,
        patientGender: profile?.gender ?? null,
        skinAnalysisId: attachedAnalysisId,
        skinScanId: attachedScanId,

        slotLock: slotLockFor(doctor.id, scheduledAt),
        photos: photoAssets.length
          ? {
              create: photoAssets.map((p, sortOrder) => ({
                url: p.url,
                storageKey: p.storageKey,
                sortOrder,
              })),
            }
          : undefined,
      },
      select: { id: true },
    });

    // With a payment pending, the confirmation email waits for the receipt —
    // telling someone their appointment is confirmed before they have paid is
    // the wrong message.
    const awaiting = approvalState === ApprovalState.AWAITING_DOCTOR;
    if (user.email && !paymentDue) {
      const when = `${d.daySeed} at ${d.time}`;
      const where =
        d.mode === "video"
          ? "Video consult — link to follow"
          : practice
          ? `${practice.clinic.name}, ${practice.clinic.area}, ${practice.clinic.city}`
          : `${doctor.clinic}, ${doctor.location}`;
      const savedLine = discountInr > 0 ? `\nWhite Collar saving: ₹${discountInr}` : "";
      await sendEmail({
        to: user.email,
        template: "booking-confirmation",
        relatedId: appointment.id,
        subject: awaiting
          ? `Your appointment request with ${doctor.name}`
          : `Your appointment with ${doctor.name} is confirmed`,
        text: awaiting
          ? `Hi ${d.patientName},\n\nWe have asked ${doctor.name} to confirm ${when}.\nWhere: ${where}\nConsultation fee: ₹${payableInr}${savedLine}\n\nYour slot is held while they review it, and we will email you as soon as they respond.\n\n— BluDerma`
          : `Hi ${d.patientName},\n\nYour appointment with ${doctor.name} is confirmed for ${when}.\nWhere: ${where}\nConsultation fee: ₹${payableInr}${savedLine}\n\nManage or cancel it any time from your BluDerma account.\n\n— BluDerma`,
        html: awaiting
          ? `<p>Hi ${d.patientName},</p><p>We have asked <strong>${doctor.name}</strong> to confirm <strong>${when}</strong>.</p><p>Where: ${where}<br/>Consultation fee: ₹${payableInr}${savedLine.replace("\n", "<br/>")}</p><p>Your slot is held while they review it, and we will email you as soon as they respond.</p><p>— BluDerma</p>`
          : `<p>Hi ${d.patientName},</p><p>Your appointment with <strong>${doctor.name}</strong> is confirmed for <strong>${when}</strong>.</p><p>Where: ${where}<br/>Consultation fee: ₹${payableInr}${savedLine.replace("\n", "<br/>")}</p><p>Manage or cancel it any time from your BluDerma account.</p><p>— BluDerma</p>`,
        // A failed confirmation email must not undo a valid booking.
      }).catch((e) => console.error("confirmation email failed", e));
    }

    // And tell the DOCTOR. Until now no appointment event ever reached the
    // practitioner — a booking simply appeared in the portal and waited to be
    // noticed, which is no use at all when it needs confirming.
    await notifyDoctorOfBooking({
      to: doctorContact,
      doctorName: doctor.name,
      patientName: d.patientName,
      at: scheduledAt,
      where:
        d.mode === "video"
          ? "Video consultation"
          : practice
          ? `${practice.clinic.name}, ${practice.clinic.area}`
          : doctor.clinic,
      needsApproval: awaiting,
      appointmentId: appointment.id,
      intake: intakeEmailBlock({
        reason: d.reason,
        reasonDetail: d.reasonDetail,
        symptomDuration: d.symptomDuration,
        severity: d.severity,
        priorTreatment: d.priorTreatment || null,
        medications: d.medications || null,
        allergies: d.allergies || null,
        isFirstVisit: d.isFirstVisit,
        patientAge: profile?.age ?? null,
        patientGender: profile?.gender ?? null,
      }),
      reasonLine: reasonLabel(d.reason),
      urgent: isUrgent(d.severity),
    });

    revalidatePath("/patient/appointments");
    revalidatePath("/doctor/portal");
    return { ok: true, appointmentId: appointment.id, paymentDue, awaiting };
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

export interface CancelResult extends ActionResult {
  /** Charged against the booking, when it fell inside the fee window. */
  feeInr?: number;
  /** Set when the client must phone instead — with the number to ring. */
  contact?: { phone: string };
}

/**
 * A client cancelling their own appointment.
 *
 * Not a plain delete: how close the appointment is decides whether it is
 * free, carries a fee, or has to go through reception. The policy is
 * evaluated here rather than trusted from the caller, so a crafted request
 * cannot skip a fee, and the same helper drives the warning the client sees
 * before they commit.
 */
export async function cancelAppointment(
  appointmentId: string,
  reason?: string
): Promise<CancelResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in." };

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: {
      id: true,
      patientUserId: true,
      status: true,
      scheduledAt: true,
      patientName: true,
      patientEmail: true,
      doctor: { select: { name: true } },
    },
  });

  // Same response whether it does not exist or is not theirs — no probing
  // for other people's appointment ids.
  if (!appointment || appointment.patientUserId !== user.id) {
    return { ok: false, error: "Appointment not found." };
  }
  if (appointment.status === AppointmentStatus.CANCELLED) {
    return { ok: true };
  }

  const policy = await getBookingPolicy();
  // Must match what the client was shown on the appointments page, which
  // resolves the same membership. A member who was promised a free cancel and
  // then charged for it would be a straightforward breach.
  const membership = await getMembership(user.id);
  const outcome = evaluateCancellation(appointment.scheduledAt, policy, new Date(), {
    waiveFee: benefitsOf(membership).waiveCancellationFee,
  });

  if (outcome.kind === "not_applicable") {
    return { ok: false, error: outcome.reason };
  }
  if (outcome.kind === "contact") {
    // Deliberately refused. At this range somebody needs to speak to the
    // patient, and a silent cancel button hides that from both sides.
    return {
      ok: false,
      error: outcome.phone
        ? `This appointment is within ${policy.contactHours} hours. Please call reception on ${outcome.phone} to cancel.`
        : `This appointment is within ${policy.contactHours} hours. Please call the clinic to cancel.`,
      contact: { phone: outcome.phone },
    };
  }

  const feeInr = outcome.kind === "fee" ? outcome.feeInr : 0;

  await prisma.appointment.update({
    where: { id: appointment.id },
    data: {
      status: AppointmentStatus.CANCELLED,
      cancelledAt: new Date(),
      cancelReason: reason?.trim() || "Cancelled by client",
      cancellationFeeInr: feeInr,
      // Releasing the lock is what makes the slot bookable again.
      slotLock: null,
    },
  });

  const to = appointment.patientEmail ?? user.email;
  if (to) {
    const feeLine = feeInr
      ? `A late-cancellation fee of INR ${feeInr} applies, and reception will be in touch about it.`
      : "There is nothing to pay.";
    await sendEmail({
      to,
      template: "booking-confirmation",
      relatedId: appointment.id,
      subject: `Your appointment with ${appointment.doctor.name} is cancelled`,
      text: `Hi ${appointment.patientName},\n\nYour appointment with ${appointment.doctor.name} has been cancelled.\n${feeLine}\n\n- BluDerma`,
      html: `<p>Hi ${appointment.patientName},</p><p>Your appointment with <strong>${appointment.doctor.name}</strong> has been cancelled.</p><p>${feeLine}</p><p>- BluDerma</p>`,
    }).catch((e) => console.error("cancellation email failed", e));
  }

  revalidatePath("/patient/appointments");
  revalidatePath("/patient/profile");
  return { ok: true, feeInr };
}

/**
 * Moving an existing appointment to a different slot.
 *
 * The update swaps the slot lock in one statement, so the booking can never
 * hold both slots or neither. If someone claims the new slot in the same
 * instant, the unique index rejects the write and the original booking is
 * left exactly as it was.
 */
export async function rescheduleAppointment(input: {
  appointmentId: string;
  daySeed: string;
  time: string;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in." };

  const appointment = await prisma.appointment.findUnique({
    where: { id: input.appointmentId },
    select: {
      id: true,
      patientUserId: true,
      status: true,
      scheduledAt: true,
      rescheduleCount: true,
      doctorId: true,
      patientName: true,
      patientEmail: true,
      doctor: { select: { slug: true, name: true } },
    },
  });

  if (!appointment || appointment.patientUserId !== user.id) {
    return { ok: false, error: "Appointment not found." };
  }
  if (appointment.status === AppointmentStatus.CANCELLED) {
    return { ok: false, error: "That appointment has been cancelled." };
  }

  const policy = await getBookingPolicy();
  const allowed = evaluateReschedule(
    appointment.scheduledAt,
    appointment.rescheduleCount,
    policy
  );
  if (allowed.kind === "not_applicable") {
    return { ok: false, error: allowed.reason };
  }
  if (allowed.kind === "limit_reached") {
    return {
      ok: false,
      error: allowed.phone
        ? `This booking has already been moved ${allowed.max} times. Please call reception on ${allowed.phone}.`
        : `This booking has already been moved ${allowed.max} times. Please call the clinic.`,
    };
  }
  if (allowed.kind === "too_late") {
    return {
      ok: false,
      error: allowed.phone
        ? `Appointments can only be moved more than ${allowed.minHours} hours ahead. Please call reception on ${allowed.phone}.`
        : `Appointments can only be moved more than ${allowed.minHours} hours ahead. Please call the clinic.`,
    };
  }

  const scheduledAt = slotInstant(input.daySeed, input.time);
  if (Number.isNaN(scheduledAt.getTime())) {
    return { ok: false, error: "Pick a valid date and time." };
  }
  if (scheduledAt.getTime() <= clinicNow()) {
    return { ok: false, error: "That time has already passed." };
  }

  // The new slot is re-derived server-side, exactly as it is at booking.
  const slots = await getSlotsForDoctor(appointment.doctor.slug, input.daySeed);
  const slot = slots.find((s) => s.label === input.time);
  if (!slot) {
    return { ok: false, error: "That time is not in the doctor's schedule." };
  }
  if (!slot.available) {
    return { ok: false, error: "That slot has just been taken. Pick another." };
  }

  try {
    await prisma.appointment.update({
      where: { id: appointment.id },
      data: {
        scheduledAt,
        slotLock: slotLockFor(appointment.doctorId, scheduledAt),
        rescheduleCount: { increment: 1 },
        status: AppointmentStatus.CONFIRMED,
        reminderSentAt: null,
      },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return {
        ok: false,
        error: "That slot was just booked by someone else. Please pick another.",
      };
    }
    console.error("reschedule failed", err);
    return { ok: false, error: "Could not move your appointment. Try again." };
  }

  const to = appointment.patientEmail ?? user.email;
  if (to) {
    const when = `${input.daySeed} at ${input.time}`;
    await sendEmail({
      to,
      template: "booking-confirmation",
      relatedId: appointment.id,
      subject: `Your appointment with ${appointment.doctor.name} has moved`,
      text: `Hi ${appointment.patientName},\n\nYour appointment with ${appointment.doctor.name} is now ${when}.\n\n- BluDerma`,
      html: `<p>Hi ${appointment.patientName},</p><p>Your appointment with <strong>${appointment.doctor.name}</strong> is now <strong>${when}</strong>.</p><p>- BluDerma</p>`,
    }).catch((e) => console.error("reschedule email failed", e));
  }

  revalidatePath("/patient/appointments");
  return { ok: true };
}
