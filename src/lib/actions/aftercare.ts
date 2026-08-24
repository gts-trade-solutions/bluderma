"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getOwnDoctor } from "@/lib/doctor/guard";
import { fieldErrors } from "@/lib/validation";
import { STANDARD_AFTERCARE, treatmentKey } from "@/lib/aftercare/standard";
import type { ActionResult } from "./enquiry";

/**
 * Issuing and acknowledging a post-procedure aftercare sheet.
 *
 * ── The standing-additions rule ──────────────────────────────────────────
 * The clinic's requirement, in their words: a doctor writes their own extra
 * instructions once, and the next time they issue a sheet for the same
 * treatment those points come back, ready to edit.
 *
 * So there are two stores and they do different jobs:
 *
 *   AftercareNote   one per (doctor, treatment). A DRAFT. Overwritten every
 *                   time that doctor issues for that treatment, so it always
 *                   reflects their current thinking.
 *   AftercareSheet  one per patient. A RECORD. Every word copied in at the
 *                   moment of issue.
 *
 * The separation is the whole point. A doctor refining their laser aftercare
 * in March must not change what a patient was handed in January and is still
 * following. Clinical instruction is not a living document once it is in
 * somebody's hands.
 */

const issueSchema = z.object({
  appointmentId: z.string().min(1).optional(),
  patientUserId: z.string().min(1).optional(),
  patientName: z.string().trim().min(1, "Who is this for?").max(120),
  procedure: z.string().trim().min(1, "Name the procedure.").max(160),
  procedureDate: z.string().min(1, "When was it done?"),
  reviewOn: z.string().optional().default(""),
  doctorNotes: z.string().trim().max(4000).optional().default(""),
  emergencyContact: z.string().trim().max(160).optional().default(""),
  /** Off lets a doctor make a one-off exception without changing their draft. */
  rememberNotes: z.boolean().optional().default(true),
});

/**
 * What to put in the form before the doctor types anything.
 *
 * Returns the standard content plus whatever this doctor last saved for this
 * treatment. Called from the server component that renders the form.
 */
export async function getAftercareDraft(procedure: string) {
  const owner = await getOwnDoctor();
  if (!owner) return null;

  const key = treatmentKey(procedure);
  const note = key
    ? await prisma.aftercareNote.findUnique({
        where: { doctorId_treatmentKey: { doctorId: owner.doctorId, treatmentKey: key } },
        select: { body: true, updatedAt: true, treatmentName: true },
      })
    : null;

  return {
    standard: STANDARD_AFTERCARE,
    /** Empty on the first sheet for a treatment; their own words after that. */
    doctorNotes: note?.body ?? "",
    notesSavedAt: note?.updatedAt ?? null,
    notesFor: note?.treatmentName ?? null,
  };
}

export async function issueAftercareSheet(input: unknown): Promise<ActionResult> {
  const owner = await getOwnDoctor();
  if (!owner) return { ok: false, error: "Not permitted." };

  const parsed = issueSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please check the form.",
      fields: fieldErrors(parsed.error),
    };
  }
  const d = parsed.data;

  const procedureDate = new Date(d.procedureDate);
  if (Number.isNaN(procedureDate.getTime())) {
    return { ok: false, error: "That procedure date is not a date." };
  }
  const reviewOn = d.reviewOn ? new Date(d.reviewOn) : null;
  if (reviewOn && Number.isNaN(reviewOn.getTime())) {
    return { ok: false, error: "That review date is not a date." };
  }

  // The appointment, if one was named, must be this doctor's. A server action
  // is a public endpoint: an appointmentId in the payload is an assertion.
  if (d.appointmentId) {
    const mine = await prisma.appointment.findFirst({
      where: { id: d.appointmentId, doctorId: owner.doctorId },
      select: { id: true },
    });
    if (!mine) return { ok: false, error: "That appointment is not yours." };
  }

  const [doctor, patient] = await Promise.all([
    prisma.doctor.findUnique({
      where: { id: owner.doctorId },
      select: {
        name: true,
        publicId: true,
        clinics: {
          where: { isPrimary: true },
          take: 1,
          select: { clinic: { select: { name: true, phone: true } } },
        },
      },
    }),
    d.patientUserId
      ? prisma.user.findUnique({
          where: { id: d.patientUserId },
          select: { id: true, publicId: true },
        })
      : Promise.resolve(null),
  ]);

  const clinic = doctor?.clinics[0]?.clinic ?? null;
  const notes = d.doctorNotes.trim();
  const key = treatmentKey(d.procedure);

  try {
    await prisma.$transaction(async (tx) => {
      // The sheet: every word copied, so nothing edited later can rewrite it.
      await tx.aftercareSheet.create({
        data: {
          doctorId: owner.doctorId,
          patientUserId: patient?.id ?? null,
          appointmentId: d.appointmentId ?? null,
          patientName: d.patientName,
          patientPublicId: patient?.publicId ?? null,
          doctorName: doctor?.name ?? owner.name,
          doctorPublicId: doctor?.publicId ?? owner.publicId,
          clinicName: clinic?.name ?? null,
          clinicContact: d.emergencyContact || clinic?.phone || null,
          procedure: d.procedure,
          procedureDate,
          reviewOn,
          intro: STANDARD_AFTERCARE.intro,
          dos: STANDARD_AFTERCARE.dos,
          donts: STANDARD_AFTERCARE.donts,
          warnings: STANDARD_AFTERCARE.warnings,
          doctorNotes: notes || null,
          emergencyContact: d.emergencyContact || clinic?.phone || null,
        },
      });

      // The draft for next time. Only when there is something to remember and
      // the doctor did not opt out: a one-off instruction for one patient
      // should not become this doctor's standing advice for the treatment.
      if (d.rememberNotes && notes && key) {
        await tx.aftercareNote.upsert({
          where: { doctorId_treatmentKey: { doctorId: owner.doctorId, treatmentKey: key } },
          create: {
            doctorId: owner.doctorId,
            treatmentKey: key,
            treatmentName: d.procedure,
            body: notes,
          },
          update: { body: notes, treatmentName: d.procedure },
        });
      }
    });

    revalidatePath("/doctor/portal/aftercare");
    revalidatePath("/patient/profile");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not issue that sheet. Please try again." };
  }
}

/**
 * The patient confirming the instructions were explained to them.
 *
 * The sheet's own words are "I confirm that the above instructions have been
 * explained to me and I have had the opportunity to ask questions". Only the
 * patient can say that, so it is never inferred from the page being opened.
 */
export async function acknowledgeAftercareSheet(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in." };

  const res = await prisma.aftercareSheet.updateMany({
    // Scoped by patientUserId as well as id, and only while unacknowledged:
    // re-confirming would move the timestamp and lose when they actually did.
    where: { id, patientUserId: user.id, acknowledgedAt: null },
    data: { acknowledgedAt: new Date() },
  });
  if (res.count === 0) {
    return { ok: false, error: "That sheet is not yours, or is already confirmed." };
  }

  revalidatePath("/patient/profile");
  return { ok: true };
}
