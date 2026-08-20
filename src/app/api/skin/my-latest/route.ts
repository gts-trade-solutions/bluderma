import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/session";
import { getMyAnalyses } from "@/lib/queries/patient";
import { prisma } from "@/lib/prisma";

/**
 * The caller's most recent skin analysis — the real one.
 *
 * This exists because the intake questionnaire used to offer "Use my BluDerma
 * skin analysis" and then FABRICATE one, deterministically hashed from the
 * name the visitor had just typed into the form. It was labelled "Pulled from
 * your last scan", it worked for people who had never scanned and were not
 * even signed in, and the invented concern scores were then fed into doctor
 * matching and submitted to the clinic. That was invented medical data
 * presented to a patient as their own record.
 *
 * Three honest answers now, and the UI says which:
 *   authed: false          -> ask them to sign in
 *   authed: true, no scan  -> offer to run one
 *   authed: true, analysis -> their actual figures
 *
 * Covers both analysis systems: the legacy SkinAnalysis simulator rows and the
 * camera analyzer's SkinScan rows, newest of either.
 */
export const dynamic = "force-dynamic";

/**
 * Camera-analyzer issue types mapped onto the concern vocabulary the rest of
 * the app matches doctors on. Anything unrecognised maps to null and is shown
 * to the client but not used for matching — better to leave a concern out of
 * the match than to guess it into the wrong bucket.
 */
const ISSUE_TO_CONCERN: Record<string, string> = {
  acne: "acne",
  acne_mark: "acne",
  blackhead: "pores",
  pore: "pores",
  enlarged_pore: "pores",
  wrinkle: "wrinkles",
  forehead_wrinkle: "wrinkles",
  crows_feet: "wrinkles",
  nasolabial_fold: "wrinkles",
  dark_circle: "darkCircles",
  eye_pouch: "eyeBags",
  skin_spot: "ageSpots",
  melasma: "ageSpots",
  pigmentation: "ageSpots",
  redness: "redness",
  sensitivity: "redness",
  oiliness: "oiliness",
  moisture: "hydration",
  roughness: "texture",
  texture: "texture",
  firmness: "firmness",
  radiance: "radiance",
};

const concernKeyFor = (issueType: string): string | null =>
  ISSUE_TO_CONCERN[issueType.toLowerCase()] ?? null;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: true, authed: false, analysis: null });
  }

  const [analyses, scan] = await Promise.all([
    getMyAnalyses(user.id, 1),
    prisma.skinScan.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        summary: true,
        issues: {
          orderBy: { score: "desc" },
          take: 4,
          select: { issueType: true, score: true, severityBand: true },
        },
      },
    }),
  ]);

  const legacy = analyses[0] ?? null;

  // Whichever is newer. A client who used the camera analyzer last month and
  // the older tool last week should get last week's.
  const useScan =
    scan && (!legacy || scan.createdAt.toISOString() > legacy.createdAt);

  if (useScan && scan) {
    const summary = (scan.summary ?? {}) as Record<string, unknown>;
    return NextResponse.json({
      ok: true,
      authed: true,
      analysis: {
        id: scan.id,
        // Which table the id belongs to. Without this the booking form cannot
        // attach it — the two analysis systems have separate foreign keys.
        source: "scan" as const,
        takenOn: scan.createdAt.toISOString().slice(0, 10),
        // The camera analyzer does not always return an overall score, so this
        // is null rather than 0 — a missing score must not read as a bad one.
        overall: typeof summary.overall === "number" ? summary.overall : null,
        skinType: typeof summary.skinType === "string" ? summary.skinType : null,
        concerns: scan.issues.map((i) => ({
          key: concernKeyFor(i.issueType),
          label: i.issueType.replace(/_/g, " "),
          score: i.score != null ? Math.round(i.score) : null,
          band: i.severityBand,
        })),
      },
    });
  }

  if (!legacy) {
    return NextResponse.json({ ok: true, authed: true, analysis: null });
  }

  return NextResponse.json({
    ok: true,
    authed: true,
    analysis: {
      id: legacy.id,
      source: "analysis" as const,
      takenOn: legacy.createdAt.slice(0, 10),
      overall: legacy.overall,
      skinType: legacy.skinType,
      concerns: legacy.topConcerns.map((c) => ({
        // Already the canonical concern key — SkinConcern.key and MetricKey
        // share the same vocabulary.
        key: c.key,
        label: c.label,
        score: c.score,
        band: null,
      })),
    },
  });
}
