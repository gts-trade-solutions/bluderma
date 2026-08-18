"use server";

import { revalidatePath } from "next/cache";
import {
  ActorKind,
  AppointmentStatus,
  ApprovalState,
  PaymentStatus,
  Prisma,
} from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/admin/audit";
import { type AdminResult, parseForm, runAction } from "@/lib/admin/form";
import { getOwnDoctor, ownAppointment } from "@/lib/doctor/guard";
import { getBookingPolicy } from "@/lib/booking/policySettings";
import {
  clinicNow,
  getSlotsForDoctor,
  slotInstant,
} from "@/lib/queries/availability";
import {
  notifyAccepted,
  notifyCancelledByClinic,
  notifyDeclined,
  notifyMeetingLink,
  notifyMovedByClinic,
} from "@/lib/doctor/notify";

/**
 * What a doctor can do to their own list.
 *
 * The asymmetry with the client's own actions in actions/booking.ts is
 * deliberate and worth stating: the reschedule cap and the minimum-notice
 * window exist to stop a client holding a slot indefinitely. They protect the
 * clinic from the client, so they do not apply to the clinic. A doctor called
 * away to theatre has to be able to move tomorrow's list at short notice.
 *
 * What the doctor does NOT get is silence. Every change here emails the
 * client, because a clinic-side change is the one kind they cannot discover
 * for themselves.
 */

const REVALIDATE = [
  "/doctor/portal",
  "/doctor/portal/calendar",
  "/patient/appointments",
];

function refresh() {
  for (const p of REVALIDATE) revalidatePath(p);
}

/** "<doctorId>@<ISO datetime>" — the unique index that stops double-booking. */
function slotLockFor(doctorId: string, at: Date): string {
  return `${doctorId}@${at.toISOString()}`;
}

function placeOf(a: {
  mode: string;
  clinic: { name: string; area: string; city: string } | null;
}): string {
  if (a.mode === "VIDEO") return "Video consultation";
  if (a.mode === "HOME") return "Home visit";
  return a.clinic
    ? `${a.clinic.name}, ${a.clinic.area}, ${a.clinic.city}`
    : "Clinic — details to follow";
}

/* ------------------------- Accept / decline ---------------------------- */

export async function acceptAppointment(
  appointmentId: string
): Promise<AdminResult> {
  return runAction("acceptAppointment", async () => {
    const owner = await getOwnDoctor();
    if (!owner) return { ok: false, error: "You don't have a doctor profile." };

    const appt = await ownAppointment(owner.doctorId, appointmentId);
    if (!appt) return { ok: false, error: "That appointment no longer exists." };
    if (appt.approvalState === ApprovalState.ACCEPTED) return { ok: true };
    if (appt.status === AppointmentStatus.CANCELLED) {
      return { ok: false, error: "That appointment has been cancelled." };
    }

    const after = await prisma.appointment.update({
      where: { id: appt.id },
      data: {
        approvalState: ApprovalState.ACCEPTED,
        approvedAt: new Date(),
        declineReason: null,
        // Only lift a booking out of PENDING when nothing is owed. A payment
        // still due keeps it PENDING until settlePayment says otherwise.
        ...(appt.status === AppointmentStatus.PENDING &&
        appt.feeAtBooking + appt.visitFee <= 0
          ? { status: AppointmentStatus.CONFIRMED }
          : {}),
      },
      select: { id: true, status: true, approvalState: true },
    });

    await audit({
      userId: owner.userId,
      action: "update",
      entity: "Appointment",
      entityId: appt.id,
      before: { approvalState: appt.approvalState },
      after,
    });

    await notifyAccepted({
      to: appt.patientEmail,
      patientName: appt.patientName,
      doctorName: appt.doctor.name,
      appointmentId: appt.id,
      at: appt.scheduledAt,
      where: placeOf(appt),
      meetingUrl: appt.meetingUrl,
    });

    refresh();
    return { ok: true };
  });
}

const declineSchema = z.object({
  appointmentId: z.string().trim().min(1),
  reason: z
    .string()
    .trim()
    .min(3, "Tell the client why — they see this.")
    .max(400),
});

export async function declineAppointment(
  formData: FormData
): Promise<AdminResult> {
  return runAction("declineAppointment", async () => {
    const owner = await getOwnDoctor();
    if (!owner) return { ok: false, error: "You don't have a doctor profile." };

    const parsed = parseForm(declineSchema, formData);
    if (!parsed.ok) return parsed.result;

    const appt = await ownAppointment(owner.doctorId, parsed.data.appointmentId);
    if (!appt) return { ok: false, error: "That appointment no longer exists." };

    const policy = await getBookingPolicy();

    // Declining releases the slot: the whole point of holding it was to keep
    // it available for this booking, and that booking is not happening.
    const after = await prisma.appointment.update({
      where: { id: appt.id },
      data: {
        approvalState: ApprovalState.DECLINED,
        declineReason: parsed.data.reason,
        status: AppointmentStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledBy: ActorKind.DOCTOR,
        cancelReason: `Declined by ${appt.doctor.name}: ${parsed.data.reason}`,
        // A client is never charged for a clinic-side decision.
        cancellationFeeInr: 0,
        slotLock: null,
      },
      select: { id: true, status: true, approvalState: true },
    });

    await audit({
      userId: owner.userId,
      action: "update",
      entity: "Appointment",
      entityId: appt.id,
      before: { approvalState: appt.approvalState, status: appt.status },
      after,
    });

    await notifyDeclined({
      to: appt.patientEmail,
      patientName: appt.patientName,
      doctorName: appt.doctor.name,
      appointmentId: appt.id,
      at: appt.scheduledAt,
      reason: parsed.data.reason,
      phone: policy.receptionPhone,
    });

    refresh();
    return { ok: true };
  });
}

/* --------------------------- Reschedule -------------------------------- */

const rescheduleSchema = z.object({
  appointmentId: z.string().trim().min(1),
  daySeed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date."),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Pick a valid time."),
  reason: z.string().trim().max(400).optional().or(z.literal("")),
});

export async function rescheduleByDoctor(
  formData: FormData
): Promise<AdminResult> {
  return runAction("rescheduleByDoctor", async () => {
    const owner = await getOwnDoctor();
    if (!owner) return { ok: false, error: "You don't have a doctor profile." };

    const parsed = parseForm(rescheduleSchema, formData);
    if (!parsed.ok) return parsed.result;
    const d = parsed.data;

    const appt = await ownAppointment(owner.doctorId, d.appointmentId);
    if (!appt) return { ok: false, error: "That appointment no longer exists." };
    if (appt.status === AppointmentStatus.CANCELLED) {
      return { ok: false, error: "That appointment has been cancelled." };
    }

    // A member's booking is exactly what the membership promises not to move
    // casually. It can still be moved — clinics have emergencies — but not
    // without saying why.
    if (appt.isPriority && !d.reason) {
      return {
        ok: false,
        error:
          "This client holds a priority membership. Give a reason for moving their appointment.",
        fields: { reason: "Required for a priority booking." },
      };
    }

    const target = slotInstant(d.daySeed, d.time);
    if (Number.isNaN(target.getTime())) {
      return { ok: false, error: "Pick a valid date and time." };
    }
    if (target.getTime() <= clinicNow()) {
      return { ok: false, error: "That time has already passed." };
    }

    // The doctor is exempt from the client's notice period and reschedule cap,
    // but not from their own diary: the new time still has to be a slot they
    // actually work, and still free.
    const slots = await getSlotsForDoctor(
      (await prisma.doctor.findUniqueOrThrow({
        where: { id: owner.doctorId },
        select: { slug: true },
      })).slug,
      d.daySeed,
      { clinicId: appt.clinicId ?? undefined, isMember: true }
    );
    const slot = slots.find((s) => s.label === d.time);
    if (!slot) {
      return { ok: false, error: "That time isn't in your schedule for that day." };
    }
    if (!slot.available && slot.blockedBy !== "members") {
      const why =
        slot.blockedBy === "taken"
          ? "You already have an appointment then."
          : slot.blockedBy === "travel"
          ? "That is too close to a booking at another clinic."
          : slot.blockedBy === "timeoff"
          ? "You are marked as away then."
          : "That slot isn't available.";
      return { ok: false, error: why };
    }

    const from = appt.scheduledAt;
    const policy = await getBookingPolicy();

    try {
      // One update, so the booking can never hold both slots or neither.
      // rescheduleCount is deliberately NOT incremented — the client's
      // allowance is theirs to spend, and the clinic moving them must not
      // quietly use it up.
      const after = await prisma.appointment.update({
        where: { id: appt.id },
        data: {
          scheduledAt: target,
          slotLock: slotLockFor(owner.doctorId, target),
          rescheduledBy: ActorKind.DOCTOR,
          rescheduledFromId: appt.id,
          reminderSentAt: null,
          ...(appt.approvalState === ApprovalState.AWAITING_DOCTOR
            ? { approvalState: ApprovalState.ACCEPTED, approvedAt: new Date() }
            : {}),
        },
        select: { id: true, scheduledAt: true },
      });

      await audit({
        userId: owner.userId,
        action: "update",
        entity: "Appointment",
        entityId: appt.id,
        before: { scheduledAt: from },
        after,
      });

      await notifyMovedByClinic({
        to: appt.patientEmail,
        patientName: appt.patientName,
        doctorName: appt.doctor.name,
        appointmentId: appt.id,
        from,
        to_: target,
        where: placeOf(appt),
        reason: d.reason || "",
        phone: policy.receptionPhone,
      });

      refresh();
      return { ok: true };
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        return { ok: false, error: "That slot was just taken. Pick another." };
      }
      throw err;
    }
  });
}

/* ----------------------------- Cancel ---------------------------------- */

const cancelSchema = z.object({
  appointmentId: z.string().trim().min(1),
  reason: z
    .string()
    .trim()
    .min(3, "Tell the client why — they see this.")
    .max(400),
});

export async function cancelByDoctor(formData: FormData): Promise<AdminResult> {
  return runAction("cancelByDoctor", async () => {
    const owner = await getOwnDoctor();
    if (!owner) return { ok: false, error: "You don't have a doctor profile." };

    const parsed = parseForm(cancelSchema, formData);
    if (!parsed.ok) return parsed.result;

    const appt = await ownAppointment(owner.doctorId, parsed.data.appointmentId);
    if (!appt) return { ok: false, error: "That appointment no longer exists." };
    if (appt.status === AppointmentStatus.CANCELLED) return { ok: true };

    const policy = await getBookingPolicy();

    // Was any of this actually paid? If so an admin owes a refund. The money
    // is NOT moved here: a refund is a person's decision, and issuing one
    // automatically from a calendar click is how you end up refunding a
    // booking that was rescheduled by phone thirty seconds later.
    const paid = await prisma.payment.findFirst({
      where: { appointmentId: appt.id, status: PaymentStatus.PAID },
      select: { id: true },
    });

    const after = await prisma.appointment.update({
      where: { id: appt.id },
      data: {
        status: AppointmentStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledBy: ActorKind.DOCTOR,
        cancelReason: parsed.data.reason,
        // Never charge a client for the clinic's own cancellation.
        cancellationFeeInr: 0,
        slotLock: null,
      },
      select: { id: true, status: true },
    });

    await audit({
      userId: owner.userId,
      action: "update",
      entity: "Appointment",
      entityId: appt.id,
      before: { status: appt.status },
      after: { ...after, refundDue: Boolean(paid) },
    });

    await notifyCancelledByClinic({
      to: appt.patientEmail,
      patientName: appt.patientName,
      doctorName: appt.doctor.name,
      appointmentId: appt.id,
      at: appt.scheduledAt,
      reason: parsed.data.reason,
      phone: policy.receptionPhone,
      refundDue: Boolean(paid),
    });

    refresh();
    revalidatePath("/admin/payments");
    return { ok: true };
  });
}

/* -------------------------- Meeting link ------------------------------- */

const meetingSchema = z.object({
  appointmentId: z.string().trim().min(1),
  meetingUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === "" || /^https:\/\/\S+$/i.test(v), {
      message: "Paste a full https:// link, or leave it blank to remove it.",
    }),
});

/**
 * Requirement D-10: the doctor creates a meeting link and shares it with the
 * client through the portal.
 *
 * https only — a meeting link is pasted from a provider and an http one is
 * either a typo or something that will not work in a modern browser anyway.
 */
export async function setMeetingLink(formData: FormData): Promise<AdminResult> {
  return runAction("setMeetingLink", async () => {
    const owner = await getOwnDoctor();
    if (!owner) return { ok: false, error: "You don't have a doctor profile." };

    const parsed = parseForm(meetingSchema, formData);
    if (!parsed.ok) return parsed.result;

    const appt = await ownAppointment(owner.doctorId, parsed.data.appointmentId);
    if (!appt) return { ok: false, error: "That appointment no longer exists." };

    const url = parsed.data.meetingUrl || null;
    const changed = url !== appt.meetingUrl;

    await prisma.appointment.update({
      where: { id: appt.id },
      data: { meetingUrl: url },
    });

    await audit({
      userId: owner.userId,
      action: "update",
      entity: "Appointment",
      entityId: appt.id,
      before: { meetingUrl: appt.meetingUrl },
      after: { meetingUrl: url },
    });

    // Only mail on a real change, so re-saving a form does not send the client
    // the same link twice.
    if (url && changed) {
      await notifyMeetingLink({
        to: appt.patientEmail,
        patientName: appt.patientName,
        doctorName: appt.doctor.name,
        appointmentId: appt.id,
        at: appt.scheduledAt,
        meetingUrl: url,
      });
    }

    refresh();
    return { ok: true };
  });
}
