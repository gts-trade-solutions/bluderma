"use server";

import { AppointmentStatus, ReviewStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { rateLimit } from "@/lib/rateLimit";
import { fieldErrors } from "@/lib/validation";
import type { ActionResult } from "./enquiry";

/**
 * A client rating the doctor they saw.
 *
 * Anchored to an appointment rather than to a doctor, which is what makes the
 * rating worth anything: you can only review a consultation you actually
 * attended, and the unique index on appointmentId means only once. That is
 * also why there is no "write a review" button anywhere except against a past
 * appointment.
 *
 * Reviews are held for moderation. A public star rating attached to a named
 * clinician is not something to publish unread — both for the doctor and
 * because a review naming other patients or medical detail should never go up.
 */

const reviewSchema = z.object({
  appointmentId: z.string().trim().min(1),
  rating: z.coerce.number().int().min(1, "Pick a rating.").max(5),
  title: z.string().trim().max(120).optional().or(z.literal("")),
  body: z.string().trim().max(2000).optional().or(z.literal("")),
});

export async function submitReview(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in to leave a review." };

  const limit = rateLimit(`review:${user.id}`, 10, 60 * 60 * 1000);
  if (!limit.ok) {
    return { ok: false, error: "Too many reviews just now. Try again later." };
  }

  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please check the form.",
      fields: fieldErrors(parsed.error),
    };
  }
  const d = parsed.data;

  const appointment = await prisma.appointment.findUnique({
    where: { id: d.appointmentId },
    select: {
      id: true,
      patientUserId: true,
      doctorId: true,
      status: true,
      scheduledAt: true,
    },
  });

  if (!appointment || appointment.patientUserId !== user.id) {
    return { ok: false, error: "Appointment not found." };
  }
  if (appointment.status === AppointmentStatus.CANCELLED) {
    return { ok: false, error: "You can't review a cancelled appointment." };
  }
  // A consultation that has not happened yet cannot be reviewed, whatever its
  // status says.
  if (appointment.scheduledAt.getTime() > Date.now()) {
    return {
      ok: false,
      error: "You can leave a review once the appointment has taken place.",
    };
  }

  const existing = await prisma.review.findUnique({
    where: { appointmentId: appointment.id },
    select: { id: true },
  });
  if (existing) {
    return { ok: false, error: "You've already reviewed this appointment." };
  }

  await prisma.review.create({
    data: {
      appointmentId: appointment.id,
      userId: user.id,
      doctorId: appointment.doctorId,
      rating: d.rating,
      title: d.title || null,
      body: d.body || null,
      status: ReviewStatus.PENDING,
    },
  });

  revalidatePath("/patient/appointments");
  return { ok: true };
}

/**
 * Recomputes a doctor's public rating from their published reviews.
 *
 * Called after any moderation change rather than computed on read: the
 * directory lists dozens of doctors at once, and averaging their reviews on
 * every page load would be a query per card for a number that changes a few
 * times a week.
 */
export async function recomputeDoctorRating(doctorId: string): Promise<void> {
  const agg = await prisma.review.aggregate({
    where: { doctorId, status: ReviewStatus.PUBLISHED },
    _avg: { rating: true },
    _count: { _all: true },
  });

  await prisma.doctor.update({
    where: { id: doctorId },
    data: {
      // One decimal place is what the card shows; storing more implies a
      // precision a handful of reviews does not have.
      rating: Math.round((agg._avg.rating ?? 0) * 10) / 10,
      reviews: agg._count._all,
    },
  });
}
