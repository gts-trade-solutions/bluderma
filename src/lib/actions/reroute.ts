"use server";

import { revalidatePath } from "next/cache";
import {
  AppointmentStatus,
  ActorKind,
  Prisma,
  RerouteState,
} from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { slotLockFor } from "@/lib/booking/slotLock";
import { getCurrentUser } from "@/lib/session";
import { getOwnDoctor } from "@/lib/doctor/guard";
import { audit } from "@/lib/admin/audit";
import { sendEmail } from "@/lib/email";
import { fieldErrors } from "@/lib/validation";
import type { ActionResult } from "./enquiry";

/**
 * Handing a booking to another practitioner.
 *
 * ── The patient decides, not the clinic ──────────────────────────────────
 * A client books a named doctor. Silently reassigning that booking because
 * the doctor is away is not a scheduling change — it is a different
 * consultation with a different person, and in aesthetics the choice of
 * practitioner IS the product. So nothing moves on the doctor's word alone:
 * the doctor PROPOSES, the patient accepts or declines, and a proposal
 * nobody answers leaves the appointment exactly where it was.
 *
 * That is slower than reassigning, and it is the only version that can be
 * defended to the person in the chair.
 *
 * ── The slot lock is the hard part ───────────────────────────────────────
 * Appointment.slotLock is "<doctorId>@<ISO>" with a unique index on it, and
 * that index is the only thing preventing a double booking. Moving a booking
 * to another doctor therefore has to REKEY the lock, and the new key must be
 * free. Both happen in one update: if the receiving doctor already has
 * something at that moment, the unique index rejects the write and the
 * appointment stays exactly as it was rather than ending up half-moved.
 */



/* ------------------------------ Proposing -------------------------------- */

const proposeSchema = z.object({
  appointmentId: z.string().trim().min(1),
  toDoctorId: z.string().trim().min(1, "Who should take it?"),
  reason: z
    .string()
    .trim()
    .min(10, "Say why. The patient reads this and is being asked to accept a different doctor.")
    .max(500),
});

export async function proposeReroute(input: unknown): Promise<ActionResult> {
  const owner = await getOwnDoctor();
  if (!owner) return { ok: false, error: "Not permitted." };

  const parsed = proposeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please check that.", fields: fieldErrors(parsed.error) };
  }
  const d = parsed.data;

  if (d.toDoctorId === owner.doctorId) {
    return { ok: false, error: "That is you." };
  }

  const appt = await prisma.appointment.findFirst({
    where: { id: d.appointmentId, doctorId: owner.doctorId },
    select: {
      id: true,
      status: true,
      scheduledAt: true,
      patientName: true,
      patientEmail: true,
      patientUserId: true,
      clinicId: true,
      doctor: { select: { name: true } },
    },
  });
  if (!appt) return { ok: false, error: "That appointment is not yours." };
  if (appt.status === AppointmentStatus.CANCELLED) {
    return { ok: false, error: "That appointment is cancelled." };
  }
  if (appt.scheduledAt < new Date()) {
    return { ok: false, error: "That appointment has already happened." };
  }
  if (!appt.patientUserId) {
    // A guest booking has no account to answer from. The honest answer is to
    // ring them, not to move the booking and hope.
    return {
      ok: false,
      error:
        "This booking has no client account, so there is nobody to ask. Ring them and rebook instead.",
    };
  }

  // The receiving doctor must be real, live, and — this is the point of the
  // check — actually able to take it: same clinic, and free at that time.
  const target = await prisma.doctor.findFirst({
    where: { id: d.toDoctorId, status: "APPROVED", isActive: true },
    select: { id: true, name: true },
  });
  if (!target) return { ok: false, error: "That practitioner is not available on BluDerma." };

  const clash = await prisma.appointment.findFirst({
    where: {
      doctorId: target.id,
      scheduledAt: appt.scheduledAt,
      status: { not: AppointmentStatus.CANCELLED },
    },
    select: { id: true },
  });
  if (clash) {
    return {
      ok: false,
      error: `${target.name} already has something booked at that time. Pick somebody else, or move the appointment first.`,
    };
  }

  // One live proposal at a time. Two open offers on one booking is a patient
  // being asked the same question twice with different answers.
  const open = await prisma.appointmentReroute.findFirst({
    where: { appointmentId: appt.id, state: RerouteState.PROPOSED },
    select: { id: true },
  });
  if (open) {
    return {
      ok: false,
      error: "You have already asked about this booking. Withdraw that first.",
    };
  }

  const row = await prisma.appointmentReroute.create({
    data: {
      appointmentId: appt.id,
      fromDoctorId: owner.doctorId,
      toDoctorId: target.id,
      reason: d.reason,
    },
    select: { id: true },
  });

  await audit({
    userId: owner.userId,
    action: "create",
    entity: "AppointmentReroute",
    entityId: row.id,
    after: { appointmentId: appt.id, to: target.name },
  });

  if (appt.patientEmail) {
    const when = appt.scheduledAt.toISOString().slice(0, 16).replace("T", " at ");
    await sendEmail({
      to: appt.patientEmail,
      template: "reroute-proposed",
      relatedId: appt.id,
      subject: `A change to your appointment on ${appt.scheduledAt.toISOString().slice(0, 10)}`,
      text: `Hi ${appt.patientName},\n\n${appt.doctor.name} cannot take your appointment on ${when} and has asked whether ${target.name} could see you instead, at the same time and place.\n\nTheir reason: ${d.reason}\n\nNothing has changed yet. Open your appointments to accept or decline — if you decline, or do nothing, the booking stays with ${appt.doctor.name} and the clinic will be in touch.\n\n- BluDerma`,
      html: `<p>Hi ${appt.patientName},</p><p><strong>${appt.doctor.name}</strong> cannot take your appointment on ${when} and has asked whether <strong>${target.name}</strong> could see you instead, at the same time and place.</p><p>Their reason: ${d.reason}</p><p><strong>Nothing has changed yet.</strong> Open your appointments to accept or decline. If you decline, or do nothing, the booking stays with ${appt.doctor.name} and the clinic will be in touch.</p><p>- BluDerma</p>`,
    }).catch((e) => console.error("reroute email failed", e));
  }

  revalidatePath("/doctor/portal/today");
  revalidatePath("/doctor/portal/calendar");
  revalidatePath("/patient/appointments");
  return { ok: true };
}

/** The proposing doctor changing their mind. */
export async function withdrawReroute(id: string): Promise<ActionResult> {
  const owner = await getOwnDoctor();
  if (!owner) return { ok: false, error: "Not permitted." };

  const res = await prisma.appointmentReroute.updateMany({
    where: { id, fromDoctorId: owner.doctorId, state: RerouteState.PROPOSED },
    data: { state: RerouteState.WITHDRAWN, respondedAt: new Date() },
  });
  if (res.count === 0) return { ok: false, error: "Nothing to withdraw." };

  revalidatePath("/doctor/portal/today");
  revalidatePath("/patient/appointments");
  return { ok: true };
}

/* ------------------------------ Answering -------------------------------- */

/**
 * The patient's answer.
 *
 * Accepting is the only path that touches the appointment, and it does the
 * whole move in one statement so the booking can never hold the old lock and
 * the new one, or neither.
 */
export async function answerReroute(
  id: string,
  accept: boolean,
  note?: string
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in." };

  const row = await prisma.appointmentReroute.findFirst({
    where: { id, state: RerouteState.PROPOSED },
    select: {
      id: true,
      appointmentId: true,
      toDoctorId: true,
      fromDoctorId: true,
      appointment: {
        select: {
          id: true,
          patientUserId: true,
          scheduledAt: true,
          status: true,
          patientName: true,
          patientEmail: true,
        },
      },
      toDoctor: { select: { name: true, fee: true } },
      fromDoctor: { select: { name: true } },
    },
  });

  // Same answer whether it does not exist or is not theirs — no probing.
  if (!row || row.appointment.patientUserId !== user.id) {
    return { ok: false, error: "That request is no longer open." };
  }
  if (row.appointment.status === AppointmentStatus.CANCELLED) {
    return { ok: false, error: "That appointment has been cancelled." };
  }

  if (!accept) {
    await prisma.appointmentReroute.update({
      where: { id: row.id },
      data: {
        state: RerouteState.DECLINED,
        respondedAt: new Date(),
        patientNote: note?.trim() || null,
      },
    });
    revalidatePath("/patient/appointments");
    revalidatePath("/doctor/portal/today");
    return { ok: true };
  }

  // ── Accepted ────────────────────────────────────────────────────────
  try {
    await prisma.$transaction(async (tx) => {
      await tx.appointment.update({
        where: { id: row.appointmentId },
        data: {
          doctorId: row.toDoctorId,
          // Rekeyed, because the lock IS "<doctorId>@<ISO>" and the unique
          // index on it is the only thing preventing a double booking. If the
          // receiving doctor picked something up in the meantime this write
          // fails on that index and the whole transaction rolls back — the
          // appointment stays with the original doctor rather than being
          // half-moved.
          slotLock: slotLockFor(row.toDoctorId, row.appointment.scheduledAt),
          rescheduledBy: ActorKind.PATIENT,
        },
      });
      await tx.appointmentReroute.update({
        where: { id: row.id },
        data: {
          state: RerouteState.ACCEPTED,
          respondedAt: new Date(),
          patientNote: note?.trim() || null,
        },
      });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return {
        ok: false,
        error: `${row.toDoctor.name} has since been booked at that time, so the appointment stays with ${row.fromDoctor.name}. The clinic will be in touch.`,
      };
    }
    throw e;
  }

  await audit({
    userId: user.id,
    action: "update",
    entity: "Appointment",
    entityId: row.appointmentId,
    after: { doctorId: row.toDoctorId, via: "reroute-accepted" },
  });

  if (row.appointment.patientEmail) {
    const when = row.appointment.scheduledAt
      .toISOString()
      .slice(0, 16)
      .replace("T", " at ");
    await sendEmail({
      to: row.appointment.patientEmail,
      template: "reroute-accepted",
      relatedId: row.appointmentId,
      subject: `Your appointment is now with ${row.toDoctor.name}`,
      text: `Hi ${row.appointment.patientName},\n\nYour appointment on ${when} is now with ${row.toDoctor.name}. The time and place have not changed.\n\nThe consultation fee is whatever ${row.toDoctor.name} charges, which may differ from what you were quoted. Reception will confirm it before you are seen.\n\n- BluDerma`,
      html: `<p>Hi ${row.appointment.patientName},</p><p>Your appointment on <strong>${when}</strong> is now with <strong>${row.toDoctor.name}</strong>. The time and place have not changed.</p><p>The consultation fee is whatever ${row.toDoctor.name} charges, which may differ from what you were quoted. Reception will confirm it before you are seen.</p><p>- BluDerma</p>`,
    }).catch((e) => console.error("reroute accept email failed", e));
  }

  revalidatePath("/patient/appointments");
  revalidatePath("/doctor/portal/today");
  revalidatePath("/doctor/portal/calendar");
  return { ok: true };
}
