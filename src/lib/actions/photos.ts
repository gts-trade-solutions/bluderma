"use server";

import { revalidatePath } from "next/cache";
import { PhotoAngle } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getOwnDoctor } from "@/lib/doctor/guard";
import type { ActionResult } from "./enquiry";

/**
 * Clinical photographs, and the marks a doctor makes on them.
 *
 * ── Who may see what ─────────────────────────────────────────────────────
 * A photograph belongs to the patient it is of. A doctor may see one when
 * they have actually seen that patient, which is checked against the
 * appointment table rather than assumed from a doctorId in a payload.
 *
 * Everything lives in the private `patients/` prefix and is served only
 * through a signed URL. Nothing here is public at any point.
 */

const ANGLES = ["FRONT", "LEFT", "RIGHT", "BACK", "TOP", "CLOSE_UP", "OTHER"] as const;

// A literal tuple rather than z.nativeEnum: a stale generated client makes the
// enum object undefined at import time, and the failure is a baffling runtime
// error instead of a type error.
const photoSchema = z.object({
  patientUserId: z.string().min(1).optional(),
  angle: z.enum(ANGLES).default("FRONT"),
  url: z.string().min(1),
  storageKey: z.string().min(1),
  note: z.string().trim().max(500).optional().default(""),
  capturedAt: z.string().optional().default(""),
});

/** A patient adding their own photographs. */
export async function addOwnPhoto(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in." };

  const parsed = photoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please check the form." };
  const d = parsed.data;

  const capturedAt = d.capturedAt ? new Date(d.capturedAt) : new Date();

  await prisma.patientPhoto.create({
    data: {
      // Always the signed-in user. A patientUserId in the payload is ignored
      // here entirely: this action exists for somebody adding their OWN.
      patientUserId: user.id,
      angle: d.angle as PhotoAngle,
      url: d.url,
      storageKey: d.storageKey,
      note: d.note || null,
      capturedAt: Number.isNaN(capturedAt.getTime()) ? new Date() : capturedAt,
    },
  });

  revalidatePath("/patient/profile");
  return { ok: true };
}

/** A doctor adding a photograph taken in clinic. */
export async function addClinicalPhoto(input: unknown): Promise<ActionResult> {
  const owner = await getOwnDoctor();
  if (!owner) return { ok: false, error: "Not permitted." };

  const parsed = photoSchema.safeParse(input);
  if (!parsed.success || !parsed.data.patientUserId) {
    return { ok: false, error: "Please check the form." };
  }
  const d = parsed.data;

  const seen = await mustHaveSeen(owner.doctorId, d.patientUserId!);
  if (!seen) return { ok: false, error: "That patient has not been seen at your practice." };

  const capturedAt = d.capturedAt ? new Date(d.capturedAt) : new Date();

  await prisma.patientPhoto.create({
    data: {
      patientUserId: d.patientUserId!,
      doctorId: owner.doctorId,
      angle: d.angle as PhotoAngle,
      url: d.url,
      storageKey: d.storageKey,
      note: d.note || null,
      capturedAt: Number.isNaN(capturedAt.getTime()) ? new Date() : capturedAt,
    },
  });

  revalidatePath(`/doctor/portal/patients/${d.patientUserId}`);
  return { ok: true };
}

const markupSchema = z.object({
  photoId: z.string().min(1),
  strokes: z.array(
    z.object({
      points: z.array(z.tuple([z.number(), z.number()])).max(3000),
      color: z.string().max(24),
      width: z.number().min(0.5).max(40),
    })
  ).max(300),
  note: z.string().trim().max(1000).optional().default(""),
});

/**
 * Saving a doctor's marks.
 *
 * Upserted on (photo, doctor): one layer each. A second practitioner marking
 * the same image gets their own rather than overwriting somebody else's
 * reading of it, which would quietly destroy a clinical opinion.
 */
export async function savePhotoMarkup(input: unknown): Promise<ActionResult> {
  const owner = await getOwnDoctor();
  if (!owner) return { ok: false, error: "Not permitted." };

  const parsed = markupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Those marks could not be saved." };
  const d = parsed.data;

  const photo = await prisma.patientPhoto.findUnique({
    where: { id: d.photoId },
    select: { patientUserId: true },
  });
  if (!photo) return { ok: false, error: "That photograph does not exist." };

  const seen = await mustHaveSeen(owner.doctorId, photo.patientUserId);
  if (!seen) return { ok: false, error: "That patient is not yours." };

  await prisma.photoMarkup.upsert({
    where: { photoId_doctorId: { photoId: d.photoId, doctorId: owner.doctorId } },
    create: {
      photoId: d.photoId,
      doctorId: owner.doctorId,
      strokes: d.strokes,
      note: d.note || null,
    },
    update: { strokes: d.strokes, note: d.note || null },
  });

  revalidatePath(`/doctor/portal/patients/${photo.patientUserId}`);
  return { ok: true };
}

const noteSchema = z.object({
  patientUserId: z.string().min(1),
  body: z.string().trim().min(1, "Write something.").max(8000),
});

/** A line in the patient's chart. */
export async function addPatientNote(input: unknown): Promise<ActionResult> {
  const owner = await getOwnDoctor();
  if (!owner) return { ok: false, error: "Not permitted." };

  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Write something first." };
  const d = parsed.data;

  const seen = await mustHaveSeen(owner.doctorId, d.patientUserId);
  if (!seen) return { ok: false, error: "That patient is not yours." };

  await prisma.patientNote.create({
    data: { doctorId: owner.doctorId, patientUserId: d.patientUserId, body: d.body },
  });

  revalidatePath(`/doctor/portal/patients/${d.patientUserId}`);
  return { ok: true };
}

export async function deletePatientNote(id: string): Promise<ActionResult> {
  const owner = await getOwnDoctor();
  if (!owner) return { ok: false, error: "Not permitted." };

  const res = await prisma.patientNote.deleteMany({
    where: { id, doctorId: owner.doctorId },
  });
  if (res.count === 0) return { ok: false, error: "That note is not yours." };
  return { ok: true };
}

/** A patient removing one of their own photographs. */
export async function deleteOwnPhoto(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in." };

  // Only their own, and only ones they uploaded themselves. A photograph a
  // doctor took in clinic is part of a clinical record and is not the
  // patient's to delete from the practice's copy.
  const res = await prisma.patientPhoto.deleteMany({
    where: { id, patientUserId: user.id, doctorId: null },
  });
  if (res.count === 0) {
    return {
      ok: false,
      error: "That photograph is not yours to remove. Ask the clinic if a doctor took it.",
    };
  }

  revalidatePath("/patient/profile");
  return { ok: true };
}

/**
 * Has this doctor actually seen this patient?
 *
 * The gate on every clinical read and write below. A doctorId is established
 * from the session; the PATIENT is the part a caller could otherwise assert
 * freely, so it is checked against a real appointment every time.
 */
async function mustHaveSeen(doctorId: string, patientUserId: string): Promise<boolean> {
  const seen = await prisma.appointment.findFirst({
    where: { doctorId, patientUserId },
    select: { id: true },
  });
  return Boolean(seen);
}
