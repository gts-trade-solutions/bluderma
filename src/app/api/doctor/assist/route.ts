import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getOwnDoctor } from "@/lib/doctor/guard";
import { rateLimit } from "@/lib/rateLimit";
import {
  ABOUT_TONES,
  IMPROVE_MODES,
  aiEnabled,
  draftAboutVariants,
  draftClinicAbout,
  improveText,
  matchTreatments,
  rephraseClinical,
} from "@/lib/integrations/aiAssist";
import { getTreatmentVocabulary } from "@/lib/queries/treatmentVocabulary";

export const dynamic = "force-dynamic";

/**
 * AI help for the onboarding form.
 *
 * One route with a task discriminator rather than four routes, so the auth
 * check, the rate limit and the honesty rules live in exactly one place.
 *
 * The important invariant: **the facts come from the database, not the request
 * body.** A caller can ask for a draft; it cannot supply the qualifications
 * that draft is written from. That keeps the AI's raw material to things the
 * practitioner has actually entered and we have actually stored.
 */

// Literal arrays, never z.nativeEnum on a Prisma enum — see docs Appendix J.
const schema = z.discriminatedUnion("task", [
  z.object({ task: z.literal("draft-about") }),
  z.object({
    task: z.literal("draft-clinic-about"),
    clinicId: z.string().trim().min(1).max(40),
  }),
  z.object({
    task: z.literal("improve"),
    text: z.string().trim().min(20).max(4000),
    mode: z.enum(IMPROVE_MODES),
  }),
  z.object({
    task: z.literal("match-treatments"),
    query: z.string().trim().min(3).max(300),
  }),
  z.object({
    task: z.literal("clinical-rephrase"),
    /**
     * What the doctor dictated or typed. The one place in this route where
     * the text genuinely comes from the request body rather than the
     * database — because it is the doctor's own words about the patient in
     * front of them, and there is nowhere else it could come from. It is
     * never treated as fact about anything: it is formatted and handed
     * straight back for them to approve.
     */
    text: z.string().trim().min(10).max(4000),
    kind: z.enum(["PRE", "POST"]),
  }),
]);

export async function POST(req: Request) {
  const owner = await getOwnDoctor();
  if (!owner) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const limit = rateLimit(`assist:${owner.doctorId}`, 40, 10 * 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", retryAfterSeconds: limit.retryAfterSeconds },
      { status: 429 }
    );
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }
  const body = parsed.data;

  // ── Drafting the practitioner's own introduction ───────────────────────
  if (body.task === "draft-about") {
    const d = await prisma.doctor.findUnique({
      where: { id: owner.doctorId },
      select: {
        name: true,
        title: true,
        specialty: true,
        experienceYears: true,
        services: { orderBy: { sortOrder: "asc" }, select: { name: true } },
        languages: { orderBy: { sortOrder: "asc" }, select: { name: true } },
        clinics: {
          where: { isActive: true },
          orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
          select: { clinic: { select: { name: true, area: true } } },
        },
      },
    });
    if (!d) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    const variants = await draftAboutVariants({
      name: d.name,
      title: d.title,
      specialty: d.specialty,
      experienceYears: d.experienceYears,
      clinicNames: d.clinics.map((c) => c.clinic.name),
      areas: d.clinics.map((c) => c.clinic.area).filter(Boolean),
      services: d.services.map((s) => s.name),
      languages: d.languages.map((l) => l.name),
    });
    return NextResponse.json({ ok: true, variants, aiEnabled: aiEnabled() });
  }

  // ── Drafting a clinic description ──────────────────────────────────────
  if (body.task === "draft-clinic-about") {
    // The clinicId is a caller assertion until this proves it. Same idiom as
    // saveClinicStep — a doctor may only touch a clinic they are linked to.
    const link = await prisma.doctorClinic.findUnique({
      where: {
        doctorId_clinicId: { doctorId: owner.doctorId, clinicId: body.clinicId },
      },
      select: {
        clinic: {
          select: {
            name: true,
            area: true,
            city: true,
            facilities: { select: { name: true } },
          },
        },
      },
    });
    if (!link) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const doctor = await prisma.doctor.findUnique({
      where: { id: owner.doctorId },
      select: { specialty: true },
    });

    const result = await draftClinicAbout({
      name: link.clinic.name,
      area: link.clinic.area,
      city: link.clinic.city,
      facilities: link.clinic.facilities.map((f) => f.name),
      doctorSpecialty: doctor?.specialty ?? "",
    });
    return NextResponse.json({ ok: true, ...result });
  }

  // ── Rewriting what they already wrote ──────────────────────────────────
  if (body.task === "improve") {
    const text = await improveText(body.text, body.mode);
    if (!text) {
      // No key, or the call failed. There is no honest deterministic version
      // of "make this better", so say so rather than returning the input.
      return NextResponse.json(
        { ok: false, error: "ai_unavailable" },
        { status: 503 }
      );
    }
    return NextResponse.json({ ok: true, text, source: "ai" });
  }

  // ── A dictated note, formatted for the patient to read ─────────────────
  //
  // Returns BOTH halves. The component shows them side by side and submits
  // nothing until the doctor picks one: a rewritten clinical instruction that
  // slid into the field on its own is one nobody checked, and the patient
  // cannot tell which sentence came from their doctor.
  if (body.task === "clinical-rephrase") {
    const text = await rephraseClinical(body.text, body.kind);
    if (!text) {
      return NextResponse.json(
        { ok: false, error: "ai_unavailable" },
        { status: 503 }
      );
    }
    return NextResponse.json({
      ok: true,
      original: body.text,
      text,
      source: "ai",
    });
  }

  // ── Matching free text to real treatment names ─────────────────────────
  const vocabulary = await getTreatmentVocabulary();
  const result = await matchTreatments(body.query, vocabulary);
  return NextResponse.json({ ok: true, ...result });
}
