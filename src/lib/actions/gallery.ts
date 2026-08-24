"use server";

import { revalidatePath } from "next/cache";
import { GalleryStatus } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getOwnDoctor } from "@/lib/doctor/guard";
import { fieldErrors } from "@/lib/validation";
import type { ActionResult } from "./enquiry";

/**
 * Before-and-after cases a doctor shows publicly.
 *
 * ── Consent is a row with a timestamp, not a belief ──────────────────────
 * These are photographs of a patient's face. The question is never whether the
 * doctor thinks they have permission; it is whether the patient gave it, when,
 * and having seen which images. So the patient is shown the actual pair and
 * agrees in the app, and `consentGivenAt` is the record.
 *
 * A case cannot be published without it. MySQL cannot express that as a
 * constraint, so it lives in `publishCase` below and is the single rule this
 * module exists to hold.
 *
 * ── Why withdrawal actually works here ───────────────────────────────────
 * The images live in a PRIVATE bucket prefix and are served by a route that
 * re-checks consent on every request. Had they been public objects, a
 * withdrawn photograph would stay reachable forever to anyone who kept the
 * URL, and "you can change your mind" would be a promise the storage layer
 * quietly broke.
 */

const caseSchema = z.object({
  patientUserId: z.string().min(1, "Whose case is this?"),
  treatmentName: z.string().trim().min(2, "Name the treatment.").max(160),
  caption: z.string().trim().max(400).optional().default(""),
  detail: z.string().trim().max(400).optional().default(""),
  beforeUrl: z.string().min(1),
  beforeKey: z.string().min(1),
  afterUrl: z.string().min(1),
  afterKey: z.string().min(1),
});

/**
 * Prepare a case and ask the patient.
 *
 * Created DRAFT with no consent. Nothing about this call makes anything
 * visible to anybody except the doctor and the patient being asked.
 */
export async function createGalleryCase(input: unknown): Promise<ActionResult> {
  const owner = await getOwnDoctor();
  if (!owner) return { ok: false, error: "Not permitted." };

  const parsed = caseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please check the form.", fields: fieldErrors(parsed.error) };
  }
  const d = parsed.data;

  // Only a patient this doctor has actually seen. Otherwise a doctor could
  // name any user id and put a consent request in a stranger's profile.
  const seen = await prisma.appointment.findFirst({
    where: { doctorId: owner.doctorId, patientUserId: d.patientUserId },
    select: { id: true },
  });
  if (!seen) return { ok: false, error: "That patient has not been seen at your practice." };

  const count = await prisma.doctorGalleryCase.count({ where: { doctorId: owner.doctorId } });

  await prisma.doctorGalleryCase.create({
    data: {
      doctorId: owner.doctorId,
      patientUserId: d.patientUserId,
      treatmentName: d.treatmentName,
      caption: d.caption || null,
      detail: d.detail || null,
      beforeUrl: d.beforeUrl,
      beforeKey: d.beforeKey,
      afterUrl: d.afterUrl,
      afterKey: d.afterKey,
      status: GalleryStatus.DRAFT,
      sortOrder: count,
    },
  });

  revalidatePath("/doctor/portal/gallery");
  revalidatePath("/patient/profile");
  return { ok: true };
}

/**
 * The patient agreeing that these images may be shown publicly.
 *
 * Recorded only for their own case, and only once: re-consenting would move
 * the timestamp and lose when they actually agreed.
 */
export async function giveGalleryConsent(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in." };

  const res = await prisma.doctorGalleryCase.updateMany({
    where: { id, patientUserId: user.id, consentGivenAt: null },
    data: { consentGivenAt: new Date(), consentWithdrawnAt: null },
  });
  if (res.count === 0) {
    return { ok: false, error: "That case is not yours, or you have already answered." };
  }

  revalidatePath("/patient/profile");
  revalidatePath("/doctor/portal/gallery");
  return { ok: true };
}

/**
 * Changing their mind.
 *
 * Stamps a withdrawal and hides the case in the same breath. The row is kept
 * rather than deleted: the clinic needs to be able to show that consent was
 * given and later withdrawn, and the patient needs the images down. Both are
 * true at once, and deleting would only serve one of them.
 */
export async function withdrawGalleryConsent(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in." };

  const res = await prisma.doctorGalleryCase.updateMany({
    where: { id, patientUserId: user.id },
    data: { consentWithdrawnAt: new Date(), status: GalleryStatus.HIDDEN },
  });
  if (res.count === 0) return { ok: false, error: "That case is not yours." };

  revalidatePath("/patient/profile");
  revalidatePath("/doctor/portal/gallery");
  return { ok: true };
}

/**
 * Publishing. The one place the consent rule is enforced.
 */
export async function publishCase(id: string): Promise<ActionResult> {
  const owner = await getOwnDoctor();
  if (!owner) return { ok: false, error: "Not permitted." };

  const row = await prisma.doctorGalleryCase.findFirst({
    where: { id, doctorId: owner.doctorId },
    select: { id: true, consentGivenAt: true, consentWithdrawnAt: true },
  });
  if (!row) return { ok: false, error: "That case is not yours." };

  if (!row.consentGivenAt) {
    return { ok: false, error: "The patient has not agreed to this being shown yet." };
  }
  if (row.consentWithdrawnAt) {
    return { ok: false, error: "The patient has withdrawn their consent for this case." };
  }

  await prisma.doctorGalleryCase.update({
    where: { id },
    data: { status: GalleryStatus.PUBLISHED },
  });

  revalidatePath("/doctor/portal/gallery");
  return { ok: true };
}

/** Take a case down without touching the consent record. */
export async function hideCase(id: string): Promise<ActionResult> {
  const owner = await getOwnDoctor();
  if (!owner) return { ok: false, error: "Not permitted." };

  const res = await prisma.doctorGalleryCase.updateMany({
    where: { id, doctorId: owner.doctorId },
    data: { status: GalleryStatus.HIDDEN },
  });
  if (res.count === 0) return { ok: false, error: "That case is not yours." };

  revalidatePath("/doctor/portal/gallery");
  return { ok: true };
}

export async function deleteCase(id: string): Promise<ActionResult> {
  const owner = await getOwnDoctor();
  if (!owner) return { ok: false, error: "Not permitted." };

  const res = await prisma.doctorGalleryCase.deleteMany({
    where: { id, doctorId: owner.doctorId },
  });
  if (res.count === 0) return { ok: false, error: "That case is not yours." };

  revalidatePath("/doctor/portal/gallery");
  revalidatePath("/patient/profile");
  return { ok: true };
}
