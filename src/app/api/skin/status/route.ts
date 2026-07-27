import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/session";
import { getAccessState } from "@/lib/integrations/skinEntitlement";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Drives the /patient/skin-analyzer entry page: logged in? scan available?
// request pending? and the last result.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ authed: false });

  const state = await getAccessState(user.id);

  const [last, pendingRequest] = await Promise.all([
    prisma.skinScan.findFirst({
      where: { userId: user.id, status: "done" },
      orderBy: { createdAt: "desc" },
      select: { id: true, createdAt: true },
    }),
    prisma.skinAccessRequest.count({
      where: { userId: user.id, status: "pending" },
    }),
  ]);

  return NextResponse.json({
    authed: true,
    state,
    lastAnalysisId: last?.id ?? null,
    pendingRequest: pendingRequest > 0,
  });
}
