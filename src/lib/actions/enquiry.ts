"use server";

import { headers } from "next/headers";
import { EnquiryAudience } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { enquirySchema, fieldErrors } from "@/lib/validation";
import { rateLimit } from "@/lib/rateLimit";
import { getCurrentUser } from "@/lib/session";

export interface ActionResult {
  ok: boolean;
  error?: string;
  fields?: Record<string, string>;
}

/**
 * Captures a product enquiry as a lead. Replaces the console.log that the
 * frontend MVP used as a stand-in.
 */
export async function submitEnquiry(input: unknown): Promise<ActionResult> {
  const ip = headers().get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = rateLimit(`enquiry:${ip}`, 10, 60 * 60 * 1000);
  if (!limit.ok) {
    return { ok: false, error: "Too many enquiries. Please try again later." };
  }

  const parsed = enquirySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please check the form.",
      fields: fieldErrors(parsed.error),
    };
  }

  const d = parsed.data;

  // Resolve the treatment so the lead is linked, but never fail the enquiry
  // just because the slug went stale — productName is kept as a snapshot.
  const treatment = d.treatmentSlug
    ? await prisma.treatment.findUnique({
        where: { slug: d.treatmentSlug },
        select: { id: true },
      })
    : null;

  const user = await getCurrentUser();

  try {
    await prisma.enquiry.create({
      data: {
        audience:
          d.audience === "doctor"
            ? EnquiryAudience.DOCTOR
            : EnquiryAudience.PATIENT,
        name: d.name,
        email: d.email,
        phone: d.phone || null,
        organisation: d.organisation || null,
        // Quantity is a clinician-only field on the form.
        quantity: d.audience === "doctor" ? d.quantity ?? null : null,
        message: d.message || null,
        treatmentId: treatment?.id ?? null,
        productName: d.productName || null,
        source: user ? "web:authenticated" : "web",
      },
    });

    return { ok: true };
  } catch (err) {
    console.error("enquiry failed", err);
    return {
      ok: false,
      error: "Could not send your enquiry. Please try again.",
    };
  }
}
