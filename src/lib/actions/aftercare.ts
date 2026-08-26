"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getOwnDoctor } from "@/lib/doctor/guard";
import { fieldErrors } from "@/lib/validation";
import { SheetKind } from "@prisma/client";

import { STANDARD_AFTERCARE, standardFor, treatmentKey } from "@/lib/aftercare/standard";
import { notifySheetIssued } from "@/lib/doctor/notify";
import type { ActionResult } from "./enquiry";

/**
 * Issuing and acknowledging a treatment sheet — before, or after.
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
 *
 * ── Before as well as after ──────────────────────────────────────────────
 * The same machinery now issues a PRE sheet. The platform used to send
 * aftercare and nothing beforehand, which is the wrong way round for the
 * things that actually go wrong: a patient who took ibuprofen that morning
 * bruises, one who arrives with a fresh tan cannot be lasered at all, one who
 * did not stop their retinoid gets a chemical burn. Each of those is a wasted
 * appointment prevented by a message two days earlier, not by a leaflet
 * afterwards.
 *
 * `kind` runs through everything: the standard content, the doctor's standing
 * notes (which are per kind, because "stop retinol a week before" and "no
 * retinol for a week after" are different instructions), and the sheet.
 */

// A literal tuple rather than z.nativeEnum on the Prisma enum — see the note
// in lib/actions/finance.ts.
const issueSchema = z.object({
  kind: z.enum(["PRE", "POST"]).default("POST"),
  appointmentId: z.string().min(1).optional(),
  patientUserId: z.string().min(1).optional(),
  patientName: z.string().trim().min(1, "Who is this for?").max(120),
  procedure: z.string().trim().min(1, "Name the procedure.").max(160),
  procedureDate: z.string().min(1, "When was it done?"),
  reviewOn: z.string().optional().default(""),
  /** PRE only: what time to be at the clinic, when it is not the slot time. */
  arriveAt: z.string().trim().max(40).optional().default(""),
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
export async function getAftercareDraft(
  procedure: string,
  kind: "PRE" | "POST" = "POST"
) {
  const owner = await getOwnDoctor();
  if (!owner) return null;

  const key = treatmentKey(procedure);
  const note = key
    ? await prisma.aftercareNote.findUnique({
        where: {
          doctorId_treatmentKey_kind: {
            doctorId: owner.doctorId,
            treatmentKey: key,
            kind: kind as SheetKind,
          },
        },
        select: { body: true, updatedAt: true, treatmentName: true },
      })
    : null;

  return {
    standard: standardFor(kind),
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

  // A PRE sheet issued for a date that has already passed is a sheet nobody
  // can act on, and it is a very easy thing to do from a date picker that
  // opens on today. Said plainly rather than silently accepted — the doctor
  // meant one of the two things and only they know which.
  const isPre = d.kind === "PRE";
  if (isPre) {
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    if (procedureDate < endOfToday && procedureDate.toDateString() !== new Date().toDateString()) {
      return {
        ok: false,
        error:
          "That date has already passed, so a before-treatment sheet would arrive too late to be followed. Check the date, or issue an aftercare sheet instead.",
      };
    }
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
          // The email address as well: a pre-treatment sheet whose whole value
          // is arriving two days early cannot only live in a portal.
          select: { id: true, publicId: true, email: true },
        })
      : Promise.resolve(null),
  ]);

  const clinic = doctor?.clinics[0]?.clinic ?? null;
  const notes = d.doctorNotes.trim();
  const key = treatmentKey(d.procedure);
  // Snapshotted below, so a later revision of the standard wording never
  // rewrites a sheet somebody is already holding.
  const standard = standardFor(d.kind);

  try {
    const issued = await prisma.$transaction(async (tx) => {
      // The sheet: every word copied, so nothing edited later can rewrite it.
      const sheet = await tx.aftercareSheet.create({
        data: {
          kind: d.kind as SheetKind,
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
          // Each belongs to exactly one side: a review date is meaningless
          // before the procedure, an arrival time meaningless after it.
          reviewOn: isPre ? null : reviewOn,
          arriveAt: isPre ? d.arriveAt || null : null,
          intro: standard.intro,
          dos: standard.dos,
          donts: standard.donts,
          warnings: standard.warnings,
          doctorNotes: notes || null,
          emergencyContact: d.emergencyContact || clinic?.phone || null,
        },
        select: { id: true },
      });

      // The draft for next time. Only when there is something to remember and
      // the doctor did not opt out: a one-off instruction for one patient
      // should not become this doctor's standing advice for the treatment.
      if (d.rememberNotes && notes && key) {
        await tx.aftercareNote.upsert({
          where: {
            doctorId_treatmentKey_kind: {
              doctorId: owner.doctorId,
              treatmentKey: key,
              kind: d.kind as SheetKind,
            },
          },
          create: {
            doctorId: owner.doctorId,
            treatmentKey: key,
            kind: d.kind as SheetKind,
            treatmentName: d.procedure,
            body: notes,
          },
          update: { body: notes, treatmentName: d.procedure },
        });
      }

      return sheet;
    });

    // Outside the transaction and deliberately not awaited into it: a mail
    // outage must not roll back a sheet the doctor has already issued and can
    // see in their list. The email carries no instructions, only a link — see
    // notifySheetIssued.
    if (patient?.email) {
      await notifySheetIssued({
        to: patient.email,
        patientName: d.patientName,
        doctorName: doctor?.name ?? owner.name,
        kind: d.kind,
        procedure: d.procedure,
        procedureDate,
        arriveAt: isPre ? d.arriveAt : null,
        sheetId: issued.id,
        baseUrl: process.env.NEXTAUTH_URL ?? "https://bluderma.kr",
      });
    }

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
