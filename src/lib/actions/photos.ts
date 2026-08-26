"use server";

import { revalidatePath } from "next/cache";
import { PhotoAngle } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getOwnDoctor } from "@/lib/doctor/guard";
import { fieldErrors } from "@/lib/validation";
import { sendEmail } from "@/lib/email";
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

/* --------------------------- Pins and prices ----------------------------- */

const pinSchema = z.object({
  photoId: z.string().min(1),
  /** Normalised 0-1, like the strokes. */
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  treatment: z.string().trim().min(2, "What would you do here?").max(160),
  note: z.string().trim().max(400).optional().default(""),
  /**
   * Blank is a real answer and means "on assessment".
   *
   * Deliberately NOT coerced through z.coerce.number(), which turns "" into
   * zero — and a pin reading "₹0" on a photograph of somebody's face says
   * the treatment is free, which is a promise about money nobody made.
   */
  priceInr: z
    .union([z.number(), z.string()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === "") return null;
      const n = Math.round(Number(v));
      return Number.isFinite(n) && n >= 0 ? n : null;
    }),
  sessions: z
    .union([z.number(), z.string()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === "") return null;
      const n = Math.round(Number(v));
      return Number.isFinite(n) && n > 0 && n <= 60 ? n : null;
    }),
});

/**
 * Marking a point on a photograph with what would be done there.
 *
 * ── Why this is separate from the freehand markup ────────────────────────
 * PhotoMarkup is a clinical reading — strokes round a lesion, kept beside the
 * image so the original is never altered, one layer per doctor. This carries
 * a PRICE and is shown to the patient, which makes it a different kind of
 * object with different care owed to it. See PhotoAnnotation in the schema.
 *
 * The label is assigned server-side, from what is already on the photograph,
 * so the numbers in the image and the numbers in the list cannot disagree —
 * and two doctors pinning the same photograph do not both create a "1".
 */
export async function addPhotoPin(input: unknown): Promise<ActionResult> {
  const owner = await getOwnDoctor();
  if (!owner) return { ok: false, error: "Not permitted." };

  const parsed = pinSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please check that.", fields: fieldErrors(parsed.error) };
  }
  const d = parsed.data;

  // The photograph must belong to a patient this doctor actually sees. Same
  // rule the markup uses: a photoId in a payload is an assertion.
  const photo = await prisma.patientPhoto.findFirst({
    where: {
      id: d.photoId,
      OR: [
        { doctorId: owner.doctorId },
        { patient: { appointments: { some: { doctorId: owner.doctorId } } } },
      ],
    },
    select: { id: true },
  });
  if (!photo) return { ok: false, error: "That photograph is not one of yours." };

  const highest = await prisma.photoAnnotation.findFirst({
    where: { photoId: d.photoId },
    orderBy: { label: "desc" },
    select: { label: true },
  });

  await prisma.photoAnnotation.create({
    data: {
      photoId: d.photoId,
      doctorId: owner.doctorId,
      x: d.x,
      y: d.y,
      label: (highest?.label ?? 0) + 1,
      treatment: d.treatment,
      note: d.note || null,
      priceInr: d.priceInr,
      sessions: d.sessions,
    },
  });

  revalidatePath("/doctor/portal/patients");
  return { ok: true };
}

/** Removing a pin. Only ever one this doctor placed. */
export async function removePhotoPin(id: string): Promise<ActionResult> {
  const owner = await getOwnDoctor();
  if (!owner) return { ok: false, error: "Not permitted." };

  const res = await prisma.photoAnnotation.deleteMany({
    where: { id, doctorId: owner.doctorId },
  });
  if (res.count === 0) return { ok: false, error: "That mark is not yours." };

  revalidatePath("/doctor/portal/patients");
  return { ok: true };
}

/* ---------------------------- Telling them ------------------------------- */

/**
 * Sending a marked-up photograph and its treatment plan to the patient.
 *
 * ── Why this is an explicit act ──────────────────────────────────────────
 * Everything a doctor draws on a photograph is working notes until they say
 * otherwise. A circle round a lesion mid-consultation, a price typed and then
 * reconsidered, a second opinion sketched over somebody else's reading — none
 * of that should reach the patient the instant it is saved. So marks are
 * private by default and this is the button that shares them.
 *
 * ── What the email carries ───────────────────────────────────────────────
 * A link, and nothing else. Not the photograph, not the treatments, not the
 * total. Email is not a private channel — it sits on a lock screen, in a
 * shared family inbox — and a picture of somebody's face annotated with what
 * is wrong with it is about as personal as this platform holds. The link goes
 * behind the login they already have.
 */
export async function sharePhotoPlan(photoId: string): Promise<ActionResult> {
  const owner = await getOwnDoctor();
  if (!owner) return { ok: false, error: "Not permitted." };

  const photo = await prisma.patientPhoto.findFirst({
    where: {
      id: photoId,
      OR: [
        { doctorId: owner.doctorId },
        { patient: { appointments: { some: { doctorId: owner.doctorId } } } },
      ],
    },
    select: {
      id: true,
      patient: { select: { id: true, name: true, email: true } },
      pins: {
        where: { doctorId: owner.doctorId },
        select: { id: true },
      },
      annotations: {
        where: { doctorId: owner.doctorId },
        select: { id: true },
      },
    },
  });
  if (!photo) return { ok: false, error: "That photograph is not one of yours." };

  if (photo.pins.length === 0 && photo.annotations.length === 0) {
    return {
      ok: false,
      error:
        "There is nothing on this photograph yet. Draw on it or add a treatment first.",
    };
  }
  if (!photo.patient.email) {
    return {
      ok: false,
      error:
        "This client has no email address on file, so there is nowhere to send it. They can still see it when they next sign in.",
    };
  }

  const doctor = await prisma.doctor.findUnique({
    where: { id: owner.doctorId },
    select: { name: true },
  });
  const base = (process.env.NEXTAUTH_URL ?? "https://bluderma.kr").replace(/\/$/, "");
  const link = `${base}/patient/photo/${photo.id}`;

  await sendEmail({
    to: photo.patient.email,
    template: "photo-plan-shared",
    relatedId: photo.id,
    subject: `${doctor?.name ?? "Your doctor"} has marked up your photograph`,
    text: `Hi ${photo.patient.name ?? "there"},\n\n${doctor?.name ?? "Your doctor"} has gone through one of your photographs and marked what they would suggest, with indicative costs.\n\nIt is here: ${link}\n\nThe figures are an estimate for planning rather than a quote — what is actually charged depends on what is found on the day. Bring any questions to your next appointment.\n\n- BluDerma`,
    html: `<p>Hi ${photo.patient.name ?? "there"},</p><p><strong>${doctor?.name ?? "Your doctor"}</strong> has gone through one of your photographs and marked what they would suggest, with indicative costs.</p><p><a href="${link}">Open it here</a></p><p>The figures are an estimate for planning rather than a quote — what is actually charged depends on what is found on the day. Bring any questions to your next appointment.</p><p>- BluDerma</p>`,
  }).catch((e) => console.error("photo plan email failed", e));

  await prisma.auditLog
    .create({
      data: {
        userId: owner.userId,
        action: "share",
        entity: "PatientPhoto",
        entityId: photo.id,
        after: { pins: photo.pins.length, marks: photo.annotations.length },
      },
    })
    .catch(() => undefined);

  revalidatePath("/patient/profile");
  return { ok: true };
}
