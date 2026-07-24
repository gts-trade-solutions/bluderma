"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { prisma } from "@/lib/prisma";
import { analysisSchema } from "@/lib/validation";
import { getCurrentUser } from "@/lib/session";
import { rateLimit } from "@/lib/rateLimit";
import type { ActionResult } from "./enquiry";

export interface AnalysisResult extends ActionResult {
  analysisId?: string;
}

/**
 * Persists a skin analysis with all twelve metric scores.
 *
 * The old localStorage version kept only the summary and the three worst
 * concerns, which quietly made the "re-scan and compare" feature impossible.
 * Every score is stored here so progress tracking actually works.
 *
 * Anonymous runs are saved with a null userId: the analyzer is the top of the
 * funnel and those results are still worth having.
 */
export async function saveAnalysis(input: unknown): Promise<AnalysisResult> {
  const parsed = analysisSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Could not save this analysis." };
  }
  const d = parsed.data;

  const user = await getCurrentUser();

  // Anonymous and cheap to call, and each call writes an analysis + up to 40
  // score rows — throttle by IP so it can't be used to flood the table.
  const ip = headers().get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = rateLimit(`analysis:${ip}`, 20, 60 * 60 * 1000);
  if (!limit.ok) {
    // Not a hard error for the user — the result still shows, it just isn't
    // persisted this time.
    return { ok: false, error: "Too many analyses saved recently." };
  }

  const concerns = await prisma.skinConcern.findMany({
    select: { id: true, key: true },
  });
  const idByKey = new Map(concerns.map((c) => [c.key, c.id]));

  const topRank = new Map(d.topConcerns.map((key, i) => [key, i + 1]));

  const scoreRows = d.scores
    .filter((s) => idByKey.has(s.key))
    .map((s) => ({
      concernId: idByKey.get(s.key)!,
      score: s.score,
      topRank: topRank.get(s.key) ?? null,
    }));

  if (scoreRows.length === 0) {
    return { ok: false, error: "No recognised concerns in this analysis." };
  }

  try {
    const analysis = await prisma.skinAnalysis.create({
      data: {
        userId: user?.id ?? null,
        overall: d.overall,
        skinType: d.skinType,
        estimatedAge: d.estimatedAge,
        seed: d.seed ?? null,
        scores: { createMany: { data: scoreRows } },
      },
      select: { id: true },
    });

    if (user) revalidatePath("/patient/profile");
    return { ok: true, analysisId: analysis.id };
  } catch (err) {
    console.error("saveAnalysis failed", err);
    return { ok: false, error: "Could not save this analysis." };
  }
}
