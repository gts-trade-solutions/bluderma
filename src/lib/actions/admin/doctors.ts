"use server";

import { revalidatePath } from "next/cache";
import { ConsultMode, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/admin/audit";
import { requireAdminUser } from "@/lib/admin/guard";
import {
  AdminResult,
  asArray,
  formToObject,
  revalidateContent,
  runAction,
} from "@/lib/admin/form";
import { doctorSchema } from "@/lib/admin/schemas";
import { fieldErrors } from "@/lib/validation";

export async function saveDoctor(
  id: string | null,
  formData: FormData
): Promise<AdminResult> {
  return runAction("saveDoctor", async () => {
    const user = await requireAdminUser();

    // focus and workDays are multi-value inputs; normalise before validating
    // so a single selection still arrives as an array.
    const raw = formToObject(formData);
    raw.focus = asArray(raw.focus);
    raw.workDays = asArray(raw.workDays);

    const parsed = doctorSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: "Please check the highlighted fields.",
        fields: fieldErrors(parsed.error),
      };
    }
    const d = parsed.data;

    if (!d.offersClinic && !d.offersVideo) {
      return {
        ok: false,
        error: "A doctor must offer at least one consultation type.",
        fields: { offersClinic: "Pick at least one." },
      };
    }

    // Resolve the login account to link. Blank email → unlink. The account must
    // exist, carry a clinical role, and not already belong to another doctor.
    let linkedUserId: string | null = null;
    if (d.linkedUserEmail) {
      const account = await prisma.user.findUnique({
        where: { email: d.linkedUserEmail.toLowerCase() },
        select: { id: true, role: true, doctor: { select: { id: true } } },
      });
      if (!account) {
        return {
          ok: false,
          error: "No account found with that email.",
          fields: {
            linkedUserEmail: "No account with this email. Create it first.",
          },
        };
      }
      if (account.role !== "DOCTOR" && account.role !== "ADMIN") {
        return {
          ok: false,
          error: "That account isn't a doctor.",
          fields: {
            linkedUserEmail: "Give this account the Doctor role in Users first.",
          },
        };
      }
      if (account.doctor && account.doctor.id !== id) {
        return {
          ok: false,
          error: "That account is already linked to another doctor.",
          fields: {
            linkedUserEmail: "Already linked to another doctor profile.",
          },
        };
      }
      linkedUserId = account.id;
    }

    const data = {
      slug: d.slug,
      name: d.name,
      title: d.title,
      specialty: d.specialty,
      clinic: d.clinic,
      location: d.location,
      image: d.image,
      phone: d.phone || null,
      email: d.email || null,
      website: d.website || null,
      about: d.about,
      rating: new Prisma.Decimal(d.rating.toFixed(1)),
      reviews: d.reviews,
      experienceYears: d.experienceYears,
      fee: d.fee,
      verified: d.verified,
      isGeneral: d.isGeneral,
      isActive: d.isActive,
      sortOrder: d.sortOrder,
      userId: linkedUserId,
    };

    try {
      const before = id
        ? await prisma.doctor.findUnique({
            where: { id },
            include: { focus: true, languages: true, services: true, modes: true },
          })
        : null;

      const concerns = await prisma.skinConcern.findMany({
        where: { key: { in: d.focus } },
        select: { id: true },
      });

      const row = await prisma.$transaction(async (tx) => {
        const saved = id
          ? await tx.doctor.update({ where: { id }, data })
          : await tx.doctor.create({ data });

        // Child collections are small and order-sensitive — replace them
        // rather than diffing.
        await tx.doctorConcern.deleteMany({ where: { doctorId: saved.id } });
        await tx.doctorLanguage.deleteMany({ where: { doctorId: saved.id } });
        await tx.doctorService.deleteMany({ where: { doctorId: saved.id } });
        await tx.doctorMode.deleteMany({ where: { doctorId: saved.id } });
        await tx.doctorAvailability.deleteMany({ where: { doctorId: saved.id } });

        if (concerns.length) {
          await tx.doctorConcern.createMany({
            data: concerns.map((c) => ({ doctorId: saved.id, concernId: c.id })),
          });
        }
        if (d.languages.length) {
          await tx.doctorLanguage.createMany({
            data: d.languages.map((name, sortOrder) => ({
              doctorId: saved.id,
              name,
              sortOrder,
            })),
          });
        }
        if (d.services.length) {
          await tx.doctorService.createMany({
            data: d.services.map((name, sortOrder) => ({
              doctorId: saved.id,
              name,
              sortOrder,
            })),
          });
        }

        const modes: ConsultMode[] = [];
        if (d.offersClinic) modes.push(ConsultMode.CLINIC);
        if (d.offersVideo) modes.push(ConsultMode.VIDEO);
        await tx.doctorMode.createMany({
          data: modes.map((mode) => ({ doctorId: saved.id, mode })),
        });

        if (d.workDays.length) {
          await tx.doctorAvailability.createMany({
            data: d.workDays.map((dayOfWeek) => ({
              doctorId: saved.id,
              dayOfWeek,
              startTime: d.workStart,
              endTime: d.workEnd,
              slotMinutes: d.slotMinutes,
              isActive: true,
            })),
          });
        }

        return saved;
      });

      await audit({
        userId: user.id,
        action: id ? "update" : "create",
        entity: "Doctor",
        entityId: row.id,
        before,
        after: row,
      });

      revalidateContent();
      revalidatePath("/admin/doctors");
      return { ok: true, id: row.id };
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        const target = String(err.meta?.target ?? "");
        if (target.includes("userId")) {
          const msg = "That account is already linked to another doctor.";
          return { ok: false, error: msg, fields: { linkedUserEmail: msg } };
        }
        const msg = "That slug is already taken. Pick another.";
        return { ok: false, error: msg, fields: { slug: msg } };
      }
      throw err;
    }
  });
}

export async function deleteDoctor(id: string): Promise<AdminResult> {
  return runAction("deleteDoctor", async () => {
    const user = await requireAdminUser();

    // Appointments hold a required FK to Doctor, so a doctor with history
    // can't be deleted without destroying that history. Deactivate instead —
    // it hides them from the site and keeps the records intact.
    const appointments = await prisma.appointment.count({ where: { doctorId: id } });
    if (appointments > 0) {
      return {
        ok: false,
        error: `This doctor has ${appointments} appointment${
          appointments === 1 ? "" : "s"
        } on record. Deactivate them instead of deleting.`,
      };
    }

    const before = await prisma.doctor.findUnique({ where: { id } });
    if (!before) return { ok: false, error: "Doctor not found." };

    await prisma.doctor.delete({ where: { id } });
    await audit({
      userId: user.id,
      action: "delete",
      entity: "Doctor",
      entityId: id,
      before,
    });

    revalidateContent();
    revalidatePath("/admin/doctors");
    return { ok: true };
  });
}

export async function setDoctorActive(
  id: string,
  isActive: boolean
): Promise<AdminResult> {
  return runAction("setDoctorActive", async () => {
    const user = await requireAdminUser();
    const row = await prisma.doctor.update({
      where: { id },
      data: { isActive },
      select: { id: true, isActive: true },
    });

    await audit({
      userId: user.id,
      action: isActive ? "publish" : "unpublish",
      entity: "Doctor",
      entityId: id,
      after: row,
    });

    revalidateContent();
    revalidatePath("/admin/doctors");
    return { ok: true };
  });
}
