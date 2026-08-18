"use server";

import { revalidatePath } from "next/cache";
import { DoctorStatus } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/admin/audit";
import { type AdminResult, parseForm, runAction, revalidateContent } from "@/lib/admin/form";
import { requireAdminUser } from "@/lib/admin/guard";
import { sendEmail } from "@/lib/email";

/**
 * Approving practitioners.
 *
 * This is the gate that makes the directory mean something: a self-serve
 * signup puts a DRAFT row in the table, and nothing but this file can turn it
 * into somebody clients can find and book.
 *
 * Approval does two things, and both matter. It sets status APPROVED, which
 * PUBLIC_DOCTOR_WHERE reads. It also sets isActive and switches on the
 * practitioner's clinics — which start life inactive precisely so an
 * unapproved application cannot leak a real address into clinic search.
 */

async function notify(
  to: string | null,
  name: string,
  subject: string,
  lines: string[]
) {
  if (!to) return;
  await sendEmail({
    to,
    template: "enquiry-notification",
    subject,
    text: `Hi ${name},\n\n${lines.join("\n\n")}\n\n— BluDerma`,
    html: `<p>Hi ${name},</p>${lines
      .map((l) => `<p>${l}</p>`)
      .join("")}<p>— BluDerma</p>`,
  }).catch((e) => console.error("application decision email failed", e));
}

export async function approveDoctor(doctorId: string): Promise<AdminResult> {
  return runAction("approveDoctor", async () => {
    const admin = await requireAdminUser();

    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        regCouncil: true,
        regNumber: true,
        clinics: { select: { clinicId: true } },
        user: { select: { email: true } },
      },
    });
    if (!doctor) return { ok: false, error: "That application no longer exists." };
    if (doctor.status === DoctorStatus.APPROVED) return { ok: true };

    // Refusing here rather than warning: a "verified" practitioner whose
    // registration was never recorded is the one thing this queue exists to
    // prevent, and an approval is easy to click by accident.
    if (!doctor.regCouncil?.trim() || !doctor.regNumber?.trim()) {
      return {
        ok: false,
        error:
          "No registration details on file. Ask them to add their council and registration number before approving.",
      };
    }

    await prisma.$transaction([
      prisma.doctor.update({
        where: { id: doctorId },
        data: {
          status: DoctorStatus.APPROVED,
          isActive: true,
          reviewedAt: new Date(),
          reviewedById: admin.id,
          rejectionReason: null,
        },
      }),
      // Their locations go live with them.
      prisma.clinic.updateMany({
        where: { id: { in: doctor.clinics.map((c) => c.clinicId) } },
        data: { isActive: true },
      }),
    ]);

    await audit({
      userId: admin.id,
      action: "publish",
      entity: "Doctor",
      entityId: doctorId,
      before: { status: doctor.status },
      after: { status: DoctorStatus.APPROVED },
    });

    await notify(
      doctor.user?.email ?? doctor.email,
      doctor.name,
      "You are live on BluDerma",
      [
        "Your practice has been approved. Clients can now find you in search and book your available slots.",
        "Your calendar is at /doctor/portal/calendar. Bookings appear there as they come in, and we email you each one.",
      ]
    );

    revalidateContent(["/patient/doctors"]);
    revalidatePath("/admin/doctor-applications");
    revalidatePath("/admin/doctors");
    return { ok: true };
  });
}

const rejectSchema = z.object({
  doctorId: z.string().trim().min(1),
  reason: z
    .string()
    .trim()
    .min(10, "Say what needs changing — they see this and act on it.")
    .max(1000),
});

/**
 * Sends an application back.
 *
 * Deliberately REJECTED rather than deleted: the practitioner keeps their
 * login and everything they typed, fixes what we asked for, and resubmits.
 * Making someone re-enter a nine-field form because one number was wrong is
 * how you lose them.
 */
export async function rejectDoctor(formData: FormData): Promise<AdminResult> {
  return runAction("rejectDoctor", async () => {
    const admin = await requireAdminUser();
    const parsed = parseForm(rejectSchema, formData);
    if (!parsed.ok) return parsed.result;

    const doctor = await prisma.doctor.findUnique({
      where: { id: parsed.data.doctorId },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        clinics: { select: { clinicId: true } },
        user: { select: { email: true } },
      },
    });
    if (!doctor) return { ok: false, error: "That application no longer exists." };

    await prisma.$transaction([
      prisma.doctor.update({
        where: { id: doctor.id },
        data: {
          status: DoctorStatus.REJECTED,
          isActive: false,
          reviewedAt: new Date(),
          reviewedById: admin.id,
          rejectionReason: parsed.data.reason,
        },
      }),
      prisma.clinic.updateMany({
        where: { id: { in: doctor.clinics.map((c) => c.clinicId) } },
        data: { isActive: false },
      }),
    ]);

    await audit({
      userId: admin.id,
      action: "unpublish",
      entity: "Doctor",
      entityId: doctor.id,
      before: { status: doctor.status },
      after: { status: DoctorStatus.REJECTED, reason: parsed.data.reason },
    });

    await notify(
      doctor.user?.email ?? doctor.email,
      doctor.name,
      "Your BluDerma application needs a change",
      [
        "We have looked at your application and need something adjusted before we can list you:",
        `<strong>${parsed.data.reason}</strong>`,
        "Sign in and open your profile to make the change — everything you entered is still there — then submit it again.",
      ]
    );

    revalidateContent(["/patient/doctors"]);
    revalidatePath("/admin/doctor-applications");
    return { ok: true };
  });
}

/**
 * Takes an approved practitioner off the site without deleting them.
 *
 * deleteDoctor refuses once appointments exist (the FK is required), so this
 * is the only safe way to remove somebody who has been trading.
 */
export async function suspendDoctor(doctorId: string): Promise<AdminResult> {
  return runAction("suspendDoctor", async () => {
    const admin = await requireAdminUser();

    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      select: { status: true, clinics: { select: { clinicId: true } } },
    });
    if (!doctor) return { ok: false, error: "That practitioner no longer exists." };

    await prisma.$transaction([
      prisma.doctor.update({
        where: { id: doctorId },
        data: {
          status: DoctorStatus.SUSPENDED,
          isActive: false,
          reviewedAt: new Date(),
          reviewedById: admin.id,
        },
      }),
      prisma.clinic.updateMany({
        where: { id: { in: doctor.clinics.map((c) => c.clinicId) } },
        data: { isActive: false },
      }),
    ]);

    await audit({
      userId: admin.id,
      action: "unpublish",
      entity: "Doctor",
      entityId: doctorId,
      before: { status: doctor.status },
      after: { status: DoctorStatus.SUSPENDED },
    });

    revalidateContent(["/patient/doctors"]);
    revalidatePath("/admin/doctor-applications");
    revalidatePath("/admin/doctors");
    return { ok: true };
  });
}
