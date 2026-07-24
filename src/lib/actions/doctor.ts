"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AppointmentStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { audit } from "@/lib/admin/audit";
import { AdminResult, runAction } from "@/lib/admin/form";
import { fieldErrors } from "@/lib/validation";

/**
 * Resolves the Doctor record owned by the signed-in user. Returns null when
 * the caller isn't a doctor, or has no linked directory record. Callers must
 * treat null as "not permitted".
 */
async function requireOwnDoctor() {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  if (!user?.id || (user.role !== "DOCTOR" && user.role !== "ADMIN")) {
    return null;
  }
  const doctor = await prisma.doctor.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  return doctor ? { userId: user.id, doctorId: doctor.id } : null;
}

const profileSchema = z.object({
  title: z.string().trim().min(1).max(160),
  specialty: z.string().trim().min(1).max(160),
  clinic: z.string().trim().min(1).max(160),
  location: z.string().trim().min(1).max(160),
  about: z.string().trim().min(1).max(2000),
  image: z.string().trim().min(1).max(2000),
  languages: z
    .string()
    .default("")
    .transform((v) => v.split("\n").map((s) => s.trim()).filter(Boolean)),
  services: z
    .string()
    .default("")
    .transform((v) => v.split("\n").map((s) => s.trim()).filter(Boolean)),
});

/**
 * A doctor edits their own presentation fields — name, fee, verification and
 * ratings stay admin-controlled so a practitioner can't inflate their own
 * standing or undercut clinic pricing.
 */
export async function updateOwnProfile(
  formData: FormData
): Promise<AdminResult> {
  return runAction("updateOwnProfile", async () => {
    const owner = await requireOwnDoctor();
    if (!owner) return { ok: false, error: "You don't have a doctor profile." };

    const raw = Object.fromEntries(formData.entries());
    const parsed = profileSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: "Please check the form.",
        fields: fieldErrors(parsed.error),
      };
    }
    const d = parsed.data;

    await prisma.$transaction(async (tx) => {
      await tx.doctor.update({
        where: { id: owner.doctorId },
        data: {
          title: d.title,
          specialty: d.specialty,
          clinic: d.clinic,
          location: d.location,
          about: d.about,
          image: d.image,
        },
      });
      await tx.doctorLanguage.deleteMany({ where: { doctorId: owner.doctorId } });
      await tx.doctorService.deleteMany({ where: { doctorId: owner.doctorId } });
      if (d.languages.length) {
        await tx.doctorLanguage.createMany({
          data: d.languages.map((name, sortOrder) => ({
            doctorId: owner.doctorId,
            name,
            sortOrder,
          })),
        });
      }
      if (d.services.length) {
        await tx.doctorService.createMany({
          data: d.services.map((name, sortOrder) => ({
            doctorId: owner.doctorId,
            name,
            sortOrder,
          })),
        });
      }
    });

    await audit({
      userId: owner.userId,
      action: "update",
      entity: "Doctor",
      entityId: owner.doctorId,
      after: { self_edit: true },
    });

    revalidatePath("/doctor/portal/profile");
    revalidatePath("/patient/skin-analyzer");
    return { ok: true };
  });
}

const availabilitySchema = z.object({
  workDays: z
    .array(z.coerce.number().int().min(0).max(6))
    .default([]),
  workStart: z.string().regex(/^\d{2}:\d{2}$/),
  workEnd: z.string().regex(/^\d{2}:\d{2}$/),
  slotMinutes: z.coerce.number().int().min(5).max(240),
});

export async function updateOwnAvailability(
  formData: FormData
): Promise<AdminResult> {
  return runAction("updateOwnAvailability", async () => {
    const owner = await requireOwnDoctor();
    if (!owner) return { ok: false, error: "You don't have a doctor profile." };

    const days = formData.getAll("workDays");
    const parsed = availabilitySchema.safeParse({
      workDays: days,
      workStart: formData.get("workStart"),
      workEnd: formData.get("workEnd"),
      slotMinutes: formData.get("slotMinutes"),
    });
    if (!parsed.success) {
      return { ok: false, error: "Please check the working hours." };
    }
    const d = parsed.data;

    if (d.workStart >= d.workEnd) {
      return { ok: false, error: "The end time must be after the start time." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.doctorAvailability.deleteMany({
        where: { doctorId: owner.doctorId },
      });
      if (d.workDays.length) {
        await tx.doctorAvailability.createMany({
          data: d.workDays.map((dayOfWeek) => ({
            doctorId: owner.doctorId,
            dayOfWeek,
            startTime: d.workStart,
            endTime: d.workEnd,
            slotMinutes: d.slotMinutes,
            isActive: true,
          })),
        });
      }
    });

    revalidatePath("/doctor/portal");
    revalidatePath("/patient/skin-analyzer");
    return { ok: true };
  });
}

const APPOINTMENT_ACTIONS = ["COMPLETED", "NO_SHOW", "CANCELLED"] as const;

/**
 * A doctor updates the status of one of THEIR OWN appointments. The where-clause
 * pins both the appointment id and this doctor's id, so a forged id belonging
 * to another doctor simply matches nothing.
 */
export async function updateOwnAppointmentStatus(
  appointmentId: string,
  status: string
): Promise<AdminResult> {
  return runAction("updateOwnAppointmentStatus", async () => {
    const owner = await requireOwnDoctor();
    if (!owner) return { ok: false, error: "Not permitted." };

    const parsed = z.enum(APPOINTMENT_ACTIONS).safeParse(status);
    if (!parsed.success) return { ok: false, error: "Unknown status." };
    const next = parsed.data as AppointmentStatus;

    const result = await prisma.appointment.updateMany({
      where: { id: appointmentId, doctorId: owner.doctorId },
      data: {
        status: next,
        ...(next === AppointmentStatus.CANCELLED
          ? {
              slotLock: null,
              cancelledAt: new Date(),
              cancelReason: "Cancelled by doctor",
            }
          : {}),
      },
    });

    if (result.count === 0) {
      return { ok: false, error: "Appointment not found." };
    }

    await audit({
      userId: owner.userId,
      action: "update",
      entity: "Appointment",
      entityId: appointmentId,
      after: { status: next, by: "doctor" },
    });

    revalidatePath("/doctor/portal");
    revalidatePath("/patient/appointments");
    return { ok: true };
  });
}
