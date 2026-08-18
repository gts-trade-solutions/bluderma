"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/admin/audit";
import { type AdminResult, parseForm, runAction } from "@/lib/admin/form";
import { getOwnDoctor } from "@/lib/doctor/guard";

/**
 * Diary settings a practitioner controls for themselves.
 *
 * Separate from doctorOnboarding.ts because these are ongoing preferences
 * rather than application steps — the same values are set once during signup
 * and then changed whenever working patterns change.
 */

const settingsSchema = z.object({
  travelBufferMin: z.coerce.number().int().min(0).max(240).default(0),
  priorityHoldPerDay: z.coerce.number().int().min(0).max(10).default(0),
  requiresApproval: z
    .union([z.literal("on"), z.literal("true"), z.literal(""), z.undefined()])
    .transform((v) => v === "on" || v === "true"),
});

export async function savePracticeSettings(
  formData: FormData
): Promise<AdminResult> {
  return runAction("savePracticeSettings", async () => {
    const owner = await getOwnDoctor();
    if (!owner) return { ok: false, error: "You don't have a doctor profile." };

    const parsed = parseForm(settingsSchema, formData);
    if (!parsed.ok) return parsed.result;

    const before = await prisma.doctor.findUnique({
      where: { id: owner.doctorId },
      select: {
        travelBufferMin: true,
        priorityHoldPerDay: true,
        requiresApproval: true,
      },
    });

    const after = await prisma.doctor.update({
      where: { id: owner.doctorId },
      data: parsed.data,
      select: {
        travelBufferMin: true,
        priorityHoldPerDay: true,
        requiresApproval: true,
      },
    });

    await audit({
      userId: owner.userId,
      action: "update",
      entity: "Doctor",
      entityId: owner.doctorId,
      before,
      after,
    });

    revalidatePath("/doctor/portal/practice");
    revalidatePath("/doctor/portal/calendar");
    return { ok: true };
  });
}
