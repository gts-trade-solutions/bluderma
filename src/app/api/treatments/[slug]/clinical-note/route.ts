import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser, isClinician } from "@/lib/session";

/**
 * Clinical notes are fetched rather than server-rendered so that
 * /treatments/[slug] can stay statically generated without baking
 * practitioner-only content into the public HTML.
 */
export async function GET(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  const user = await getCurrentUser();

  if (!isClinician(user)) {
    return NextResponse.json(
      { allowed: false, reason: user ? "role" : "anonymous" },
      { status: 200 }
    );
  }

  const treatment = await prisma.treatment.findUnique({
    where: { slug: params.slug },
    select: { clinicalNote: true, isPublished: true },
  });

  if (!treatment || !treatment.isPublished) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    allowed: true,
    clinicalNote: treatment.clinicalNote,
  });
}
