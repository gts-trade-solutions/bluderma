import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { verifyCallback } from "@/lib/integrations/skinAnalyzer";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Signed server-to-server post-back from the analyzer. Verifies the HMAC over
 * the EXACT raw body, is idempotent on analyzer_analysis_id, validates +
 * consumes the reservation, and stores the canonical result.
 */

type IssueIn = {
  issue_type: string;
  score: number | null;
  confidence: number | null;
  severity_band: string | null;
  details: unknown;
};
type CallbackBody = {
  analyzer_analysis_id: string;
  grant_id: string;
  user_id: string;
  kind: string;
  summary: unknown;
  issues: IssueIn[];
};

const asJson = (v: unknown): Prisma.InputJsonValue | undefined =>
  v == null ? undefined : (v as Prisma.InputJsonValue);

export async function POST(req: NextRequest) {
  // 1. Verify signature over the EXACT raw body (must read text, not json).
  const rawBody = await req.text();
  if (!verifyCallback(rawBody, req.headers.get("x-analyzer-signature"))) {
    return NextResponse.json({ error: "bad_signature" }, { status: 401 });
  }

  let body: CallbackBody;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "bad_body" }, { status: 400 });
  }
  const { analyzer_analysis_id, grant_id, user_id } = body;
  if (!analyzer_analysis_id || !grant_id || !user_id) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  // 2. Idempotency — a retried post-back returns the already-stored row.
  const existing = await prisma.skinScan.findUnique({
    where: { analyzerAnalysisId: analyzer_analysis_id },
  });
  if (existing) return NextResponse.json({ analysisId: existing.id });

  // 3. Validate the grant belongs to this user and is still reservable.
  const ent = await prisma.skinEntitlement.findUnique({
    where: { id: grant_id },
  });
  if (!ent || ent.userId !== user_id) {
    return NextResponse.json({ error: "invalid_grant" }, { status: 409 });
  }
  if (ent.state === "released") {
    return NextResponse.json({ error: "grant_expired" }, { status: 410 });
  }
  if (ent.state === "consumed") {
    if (ent.analysisId) {
      const a = await prisma.skinScan.findUnique({
        where: { id: ent.analysisId },
      });
      if (a) return NextResponse.json({ analysisId: a.id });
    }
    return NextResponse.json({ error: "grant_consumed" }, { status: 409 });
  }
  if (ent.state !== "reserved") {
    return NextResponse.json({ error: "grant_not_reserved" }, { status: 409 });
  }
  // Accept a reservation even if its TTL just passed but it wasn't released yet
  // — the analysis is real; don't lose the result.

  // 4. Store result + consume the reservation atomically.
  try {
    const created = await prisma.$transaction(async (tx) => {
      const a = await tx.skinScan.create({
        data: {
          userId: user_id,
          analyzerAnalysisId: analyzer_analysis_id,
          grantId: grant_id,
          status: "done",
          kind: body.kind || "face",
          summary: asJson(body.summary),
          completedAt: new Date(),
          issues: {
            create: (body.issues ?? []).map((i) => ({
              issueType: i.issue_type,
              score: i.score ?? undefined,
              confidence: i.confidence ?? undefined,
              severityBand: i.severity_band ?? undefined,
              details: asJson(i.details),
            })),
          },
        },
      });
      // CAS: only consume if still reserved (guards a concurrent callback).
      const consumed = await tx.skinEntitlement.updateMany({
        where: { id: grant_id, state: "reserved" },
        data: { state: "consumed", consumedAt: new Date(), analysisId: a.id },
      });
      if (consumed.count === 0) throw new Error("cas_lost");
      return a;
    });
    return NextResponse.json({ analysisId: created.id });
  } catch {
    const dup = await prisma.skinScan.findUnique({
      where: { analyzerAnalysisId: analyzer_analysis_id },
    });
    if (dup) return NextResponse.json({ analysisId: dup.id });
    return NextResponse.json({ error: "store_failed" }, { status: 500 });
  }
}
