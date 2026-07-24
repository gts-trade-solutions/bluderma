"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AppointmentStatus, EnquiryStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/admin/audit";
import { requireAdminUser } from "@/lib/admin/guard";
import { AdminResult, runAction } from "@/lib/admin/form";

/* ------------------------------ Enquiries ------------------------------- */

const ENQUIRY_STATUSES = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "CONVERTED",
  "CLOSED",
] as const;

export async function setEnquiryStatus(
  id: string,
  status: string
): Promise<AdminResult> {
  return runAction("setEnquiryStatus", async () => {
    const user = await requireAdminUser();

    const parsed = z.enum(ENQUIRY_STATUSES).safeParse(status);
    if (!parsed.success) return { ok: false, error: "Unknown status." };

    const before = await prisma.enquiry.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!before) return { ok: false, error: "Enquiry not found." };

    await prisma.enquiry.update({
      where: { id },
      data: { status: parsed.data as EnquiryStatus },
    });
    await audit({
      userId: user.id,
      action: "update",
      entity: "Enquiry",
      entityId: id,
      before: { status: before.status },
      after: { status: parsed.data },
    });

    revalidatePath("/admin/enquiries");
    revalidatePath(`/admin/enquiries/${id}`);
    return { ok: true };
  });
}

export async function assignEnquiry(
  id: string,
  assignToId: string | null
): Promise<AdminResult> {
  return runAction("assignEnquiry", async () => {
    const user = await requireAdminUser();

    // An empty selection clears the assignment; anything else must be a real
    // staff account (admin or doctor), never an arbitrary user id.
    if (assignToId) {
      const staff = await prisma.user.findFirst({
        where: { id: assignToId, role: { in: ["ADMIN", "DOCTOR"] } },
        select: { id: true },
      });
      if (!staff) return { ok: false, error: "That person can't own leads." };
    }

    await prisma.enquiry.update({
      where: { id },
      data: { assignedToId: assignToId },
    });
    await audit({
      userId: user.id,
      action: "update",
      entity: "Enquiry",
      entityId: id,
      after: { assignedToId: assignToId },
    });

    revalidatePath("/admin/enquiries");
    revalidatePath(`/admin/enquiries/${id}`);
    return { ok: true };
  });
}

export async function addEnquiryNote(
  id: string,
  formData: FormData
): Promise<AdminResult> {
  return runAction("addEnquiryNote", async () => {
    const user = await requireAdminUser();

    const body = z
      .string()
      .trim()
      .min(1, "Write something first.")
      .max(2000)
      .safeParse(formData.get("body"));
    if (!body.success) {
      return { ok: false, error: body.error.issues[0]?.message ?? "Invalid note." };
    }

    const enquiry = await prisma.enquiry.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!enquiry) return { ok: false, error: "Enquiry not found." };

    await prisma.enquiryNote.create({
      data: { enquiryId: id, authorId: user.id, body: body.data },
    });

    revalidatePath(`/admin/enquiries/${id}`);
    return { ok: true };
  });
}

/* ----------------------------- Appointments ----------------------------- */

const ADMIN_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "CANCELLED",
  "COMPLETED",
  "NO_SHOW",
] as const;

/**
 * Admin appointment status change. Cancelling must release the slotLock so the
 * time frees up — that invariant lives here, not just in the patient flow.
 */
export async function setAppointmentStatus(
  id: string,
  status: string,
  reason?: string
): Promise<AdminResult> {
  return runAction("setAppointmentStatus", async () => {
    const user = await requireAdminUser();

    const parsed = z.enum(ADMIN_STATUSES).safeParse(status);
    if (!parsed.success) return { ok: false, error: "Unknown status." };
    const next = parsed.data as AppointmentStatus;

    const before = await prisma.appointment.findUnique({
      where: { id },
      select: { status: true, doctorId: true },
    });
    if (!before) return { ok: false, error: "Appointment not found." };

    const cancelling = next === AppointmentStatus.CANCELLED;

    await prisma.appointment.update({
      where: { id },
      data: {
        status: next,
        // Free the slot on cancel; re-confirming a cancelled one can't
        // reclaim the lock safely (someone may have taken it), so we leave it
        // null and rely on availability to surface a real conflict.
        ...(cancelling
          ? {
              slotLock: null,
              cancelledAt: new Date(),
              cancelReason: reason?.slice(0, 500) || "Cancelled by admin",
            }
          : {}),
      },
    });

    await audit({
      userId: user.id,
      action: "update",
      entity: "Appointment",
      entityId: id,
      before: { status: before.status },
      after: { status: next },
    });

    revalidatePath("/admin/appointments");
    revalidatePath("/patient/appointments");
    return { ok: true };
  });
}
