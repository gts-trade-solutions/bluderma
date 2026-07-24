"use server";

import { revalidatePath } from "next/cache";
import { Gender } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { profileSchema, fieldErrors } from "@/lib/validation";
import { getCurrentUser } from "@/lib/session";
import type { ActionResult } from "./enquiry";

export async function saveProfile(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in." };

  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please check the form.",
      fields: fieldErrors(parsed.error),
    };
  }
  const d = parsed.data;

  const data = {
    fullName: d.fullName || null,
    phone: d.phone || null,
    age: d.age ?? null,
    gender: d.gender ? (d.gender as Gender) : null,
    city: d.city || null,
  };

  try {
    await prisma.patientProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...data },
      update: data,
    });

    // Keep the account's display name in step with the profile.
    if (d.fullName) {
      await prisma.user.update({
        where: { id: user.id },
        data: { name: d.fullName },
      });
    }

    revalidatePath("/patient/profile");
    return { ok: true };
  } catch (err) {
    console.error("saveProfile failed", err);
    return { ok: false, error: "Could not save your profile." };
  }
}
