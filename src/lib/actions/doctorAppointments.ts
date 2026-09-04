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
    : "Clinic: details to follow";
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
    .min(3, "Tell the client why. They see this.")
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
    .min(3, "Tell the client why. They see this.")
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

/* ------------------------- Booking one in yourself --------------------- */

const createSchema = z.object({
  /** An existing client of this practice, or blank for somebody with no account. */
  patientUserId: z.string().trim().optional(),
  patientName: z.string().trim().min(2, "Who is it for?").max(120),
  patientPhone: z.string().trim().max(20).optional(),
  clinicId: z.string().trim().optional(),
  /** "2026-09-08" and "14:30", clinic wall clock. */
  daySeed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date."),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Pick a time."),
  durationMin: z.coerce.number().int().min(5).max(240),
  mode: z.enum(["CLINIC", "VIDEO", "HOME"]),
  feeInr: z.coerce.number().int().min(0).max(1_000_000),
  notes: z.string().trim().max(600).optional(),
});

/**
 * A booking the practice takes itself: a walk-in, or somebody who rang.
 *
 * ── Why this had to exist ────────────────────────────────────────────────
 * Every appointment in this system arrived through the client's booking flow.
 * A doctor could confirm, move, cancel and complete one, but could not create
 * one — so a walk-in, a phone booking or a follow-up agreed at the end of a
 * consultation had no way into the calendar at all. That is most of a real
 * clinic day.
 *
 * ── What it enforces, and what it deliberately does not ──────────────────
 * ENFORCED: no double-booking. The slotLock unique index catches an identical
 * start time, and the overlap check below catches the case it cannot — a
 * 30-minute visit at 10:00 and another at 10:15 do not share a lock but do
 * share the doctor. Both are checked against every location, because slotLock
 * is doctor-scoped by design: one practitioner cannot be in two clinics at
 * once.
 *
 * NOT ENFORCED: published hours. A walk-in at eight in the evening is exactly
 * the booking this exists for, and refusing it because the diary says the
 * clinic shut at seven would be the software arguing with the person standing
 * in the room. The travel buffer is not applied either, for the same reason —
 * the doctor knows where they are.
 *
 * ── It is already accepted ───────────────────────────────────────────────
 * `AWAITING_DOCTOR` means a slot is held while the doctor decides. They are
 * the one creating it, so there is nothing to decide and no email to send: the
 * client is standing there, or is on the phone being told the time.
 */
export async function createBookingByDoctor(
  formData: FormData
): Promise<AdminResult> {
  return runAction("create booking", async () => {
    const owner = await getOwnDoctor();
    if (!owner) return { ok: false, error: "No practice linked to this account." };

    const parsed = parseForm(createSchema, formData);
    if (!parsed.ok) return parsed.result;
    const d = parsed.data;

    // Clinic wall-clock time is stored labelled as UTC and converted nowhere.
    // See the contract in queries/availability.ts.
    const scheduledAt = new Date(`${d.daySeed}T${d.time}:00.000Z`);
    if (Number.isNaN(scheduledAt.getTime())) {
      return { ok: false, error: "That is not a real date and time." };
    }

    // A location has to be one of this practice's own.
    let clinicId: string | null = null;
    if (d.clinicId) {
      const mine = await prisma.doctorClinic.findFirst({
        where: { doctorId: owner.doctorId, clinicId: d.clinicId, isActive: true },
        select: { clinicId: true },
      });
      if (!mine) return { ok: false, error: "That is not one of your locations." };
      clinicId = mine.clinicId;
    }
    if (d.mode === "CLINIC" && !clinicId) {
      return { ok: false, error: "Pick which location they are coming to." };
    }

    // An account, if one was chosen, and only if this practice has seen them.
    let patientUserId: string | null = null;
    let patientEmail: string | null = null;
    if (d.patientUserId) {
      const seen = await prisma.appointment.findFirst({
        where: { doctorId: owner.doctorId, patientUserId: d.patientUserId },
        select: { patientUserId: true },
      });
      if (!seen) {
        return { ok: false, error: "That client is not one of yours." };
      }
      patientUserId = d.patientUserId;
      const u = await prisma.user.findUnique({
        where: { id: patientUserId },
        select: { email: true },
      });
      patientEmail = u?.email ?? null;
    }

    /* ── Nothing may overlap ──────────────────────────────────────────
       The lock catches an identical start; this catches everything else.
       Scoped to the day and read in JavaScript because the end of an
       appointment is start + durationMin, which SQL here cannot express. */
    const dayStart = new Date(`${d.daySeed}T00:00:00.000Z`);
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);
    const sameDay = await prisma.appointment.findMany({
      where: {
        doctorId: owner.doctorId,
        scheduledAt: { gte: dayStart, lt: dayEnd },
        status: {
          notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW],
        },
      },
      select: {
        scheduledAt: true,
        durationMin: true,
        patientName: true,
        clinic: { select: { name: true } },
      },
    });
    const start = scheduledAt.getTime();
    const end = start + d.durationMin * 60_000;
    const clash = sameDay.find((a) => {
      const s = a.scheduledAt.getTime();
      return s < end && s + (a.durationMin || 30) * 60_000 > start;
    });
    if (clash) {
      const at = clash.scheduledAt.toISOString().slice(11, 16);
      return {
        ok: false,
        error: `That runs into ${clash.patientName} at ${at}${
          clash.clinic ? ` (${clash.clinic.name})` : ""
        }.`,
      };
    }

    // First visit is a fact about them and this practice, not a checkbox.
    const before = patientUserId
      ? await prisma.appointment.count({
          where: { doctorId: owner.doctorId, patientUserId },
        })
      : 0;

    try {
      const created = await prisma.appointment.create({
        data: {
          doctorId: owner.doctorId,
          patientUserId,
          clinicId,
          scheduledAt,
          durationMin: d.durationMin,
          mode: d.mode,
          status: AppointmentStatus.CONFIRMED,
          // Booked by the practice, so there is nothing awaiting the practice.
          approvalState: ApprovalState.ACCEPTED,
          feeAtBooking: d.feeInr,
          visitFee: 0,
          discountInr: 0,
          patientName: d.patientName,
          patientPhone: d.patientPhone || null,
          patientEmail: patientEmail ?? undefined,
          notes: d.notes || null,
          isFirstVisit: before === 0,
          photoConsent: false,
          slotLock: slotLockFor(owner.doctorId, scheduledAt),
        },
        select: { id: true },
      });

      await audit({
        userId: owner.userId,
        action: "create",
        entity: "Appointment",
        entityId: created.id,
        after: {
          patientName: d.patientName,
          at: `${d.daySeed} ${d.time}`,
          durationMin: d.durationMin,
          mode: d.mode,
          clinicId,
          bookedBy: "doctor",
        },
      });

      refresh();
      revalidatePath("/doctor/portal/today");
      revalidatePath("/doctor/portal/patients");
      return { ok: true };
    } catch (e) {
      // P2002 on slotLock: something took that exact minute between the
      // overlap check above and this write.
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        return { ok: false, error: "That time was taken a moment ago. Pick another." };
      }
      throw e;
    }
  });
}
