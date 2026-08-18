"use server";

import { ReviewStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { type AdminResult, parseForm, runAction } from "@/lib/admin/form";
import { audit } from "@/lib/admin/audit";
import { requireAdminUser } from "@/lib/admin/guard";
import { recomputeDoctorRating } from "@/lib/actions/review";

/**
 * Moderating client reviews.
 *
 * Publishing or rejecting both recompute the doctor's public rating, so the
 * number on their card is always the average of exactly what is visible — a
 * rating that counts hidden reviews would be indefensible if anyone asked how
 * it was calculated.
 */

const moderateSchema = z.object({
  reviewId: z.string().trim().min(1),
  status: z.enum(["PENDING", "PUBLISHED", "REJECTED"]),
  adminNote: z.string().trim().max(1000).optional().or(z.literal("")),
});

export async function moderateReview(formData: FormData): Promise<AdminResult> {
  return runAction("moderateReview", async () => {
    const user = await requireAdminUser();
    const parsed = parseForm(moderateSchema, formData);
    if (!parsed.ok) return parsed.result;

    const d = parsed.data;
    const before = await prisma.review.findUnique({
      where: { id: d.reviewId },
      select: { id: true, doctorId: true, status: true, rating: true },
    });
    if (!before) return { ok: false, error: "That review no longer exists." };

    const next = d.status as ReviewStatus;
    const row = await prisma.review.update({
      where: { id: d.reviewId },
      data: {
        status: next,
        adminNote: d.adminNote || null,
        publishedAt: next === ReviewStatus.PUBLISHED ? new Date() : null,
      },
    });

    await recomputeDoctorRating(before.doctorId);

    await audit({
      userId: user.id,
      action: next === ReviewStatus.PUBLISHED ? "publish" : "unpublish",
      entity: "Review",
      entityId: row.id,
      before,
      after: row,
    });

    revalidatePath("/admin/reviews");
    revalidatePath("/patient/doctors");
    return { ok: true, id: row.id };
  });
}

export async function deleteReview(id: string): Promise<AdminResult> {
  return runAction("deleteReview", async () => {
    const user = await requireAdminUser();
    const before = await prisma.review.findUnique({
      where: { id },
      select: { id: true, doctorId: true, rating: true, body: true },
    });
    if (!before) return { ok: false, error: "That review no longer exists." };

    await prisma.review.delete({ where: { id } });
    await recomputeDoctorRating(before.doctorId);

    await audit({
      userId: user.id,
      action: "delete",
      entity: "Review",
      entityId: id,
      before,
    });

    revalidatePath("/admin/reviews");
    revalidatePath("/patient/doctors");
    return { ok: true };
  });
}
