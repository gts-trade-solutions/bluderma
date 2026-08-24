"use server";

import { revalidatePath } from "next/cache";
import { Prisma, VendorStatus } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { fieldErrors } from "@/lib/validation";
import { claimId, newVendorId } from "@/lib/publicId";
import type { ActionResult } from "./enquiry";

/**
 * A pharmacy or distributor applying to sell medicines through BluDerma.
 *
 * ── This is an application, not a sign-up ────────────────────────────────
 * Dispensing medicine is a licensed activity. Submitting this creates no
 * account, no listing and no ability to sell; it puts a row in front of a
 * human who will look at a drug licence. A marketplace that lets anyone list
 * medicines is not a marketplace, it is a liability.
 *
 * So there is no automatic approval path anywhere in this file, and there
 * should not be one until somebody has read a licence number against a
 * register.
 */

const vendorSchema = z.object({
  businessName: z.string().trim().min(2, "What is the business called?").max(160),
  contactName: z.string().trim().min(2, "Who should we speak to?").max(120),
  email: z.string().trim().email("That email does not look right.").max(160),
  phone: z.string().trim().min(6, "A number we can reach you on.").max(24),

  addressLine1: z.string().trim().min(3, "Where are you based?").max(160),
  addressLine2: z.string().trim().max(160).optional().default(""),
  area: z.string().trim().max(120).optional().default(""),
  city: z.string().trim().min(2, "Which city?").max(80),
  state: z.string().trim().min(2, "Which state or region?").max(80),
  pincode: z.string().trim().min(3, "Postal code.").max(16),

  // The regulatory gate. Required, and deliberately not format-checked beyond
  // being present: licence formats differ by state and by country, and
  // rejecting a valid one on a pattern guess would be worse than reading it.
  drugLicenceNo: z.string().trim().min(4, "Your drug licence number.").max(80),
  drugLicenceUrl: z.string().trim().max(600).optional().default(""),
  drugLicenceKey: z.string().trim().max(400).optional().default(""),
  gstin: z.string().trim().max(20).optional().default(""),

  categories: z.string().trim().max(600).optional().default(""),
  about: z.string().trim().max(1200).optional().default(""),
});

export async function applyAsVendor(input: unknown): Promise<ActionResult> {
  const parsed = vendorSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please check the form.",
      fields: fieldErrors(parsed.error),
    };
  }
  const d = parsed.data;

  // One open application per email. A second submission while the first is
  // being read is almost always somebody who thought it had not gone through,
  // and two rows would put the reviewer in front of the same business twice.
  const open = await prisma.medicineVendor.findFirst({
    where: {
      email: d.email,
      status: { in: [VendorStatus.SUBMITTED, VendorStatus.IN_REVIEW] },
    },
    select: { id: true },
  });
  if (open) {
    return {
      ok: false,
      error:
        "We already have an application from this email and are looking at it. We will be in touch.",
    };
  }

  try {
    await claimId(newVendorId, async (publicId) => {
      try {
        await prisma.medicineVendor.create({
          data: {
            publicId,
            businessName: d.businessName,
            contactName: d.contactName,
            email: d.email,
            phone: d.phone,
            addressLine1: d.addressLine1,
            addressLine2: d.addressLine2 || null,
            area: d.area || null,
            city: d.city,
            state: d.state,
            pincode: d.pincode,
            drugLicenceNo: d.drugLicenceNo,
            drugLicenceUrl: d.drugLicenceUrl || null,
            drugLicenceKey: d.drugLicenceKey || null,
            gstin: d.gstin || null,
            categories: d.categories || null,
            about: d.about || null,
          },
        });
        return true;
      } catch (e) {
        // The unique index is the arbiter, not a pre-flight SELECT.
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          return false;
        }
        throw e;
      }
    });

    revalidatePath("/admin/vendors");
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not send that. Please try again." };
  }
}

/**
 * A reviewer moving an application along.
 *
 * Admin only, and there is no path here that a vendor can reach. `reviewNote`
 * is written back to the applicant on rejection, so it reads as a message
 * rather than an internal remark.
 */
export async function reviewVendor(
  id: string,
  status: VendorStatus,
  reviewNote?: string
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return { ok: false, error: "Not permitted." };

  await prisma.medicineVendor.update({
    where: { id },
    data: {
      status,
      reviewNote: reviewNote?.trim() || undefined,
      // Stamped once it leaves the queue, so "how long did we take" stays
      // answerable after later edits.
      reviewedAt: status === VendorStatus.SUBMITTED ? null : new Date(),
    },
  });

  revalidatePath("/admin/vendors");
  return { ok: true };
}
