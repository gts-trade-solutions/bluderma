import { notFound } from "next/navigation";

import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PUBLIC_DOCTOR_WHERE } from "@/lib/queries/doctorAccess";
import { SkinReport } from "@/components/skin/SkinReport";
import { generateSkinSummary } from "@/lib/integrations/skinSummary";
import {
  type SkinSummary,
  type SkinIssueDetails,
} from "@/lib/integrations/skinConcerns";

export const metadata = { title: "Skin analysis report" };
export const dynamic = "force-dynamic";

const META = new Set(["overall", "skin_type", "skin_age", "resize_image"]);

export default async function SkinReportPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requireUser(`/patient/skin-analysis/${params.id}/report`);

  const scan = await prisma.skinScan.findFirst({
    where: { id: params.id, userId: user.id },
    include: { issues: true },
  });
  if (!scan) notFound();

  const summary = (scan.summary as SkinSummary | null) ?? {};
  const concerns = scan.issues
    .filter((i) => !META.has(i.issueType) && i.score != null)
    .sort((a, b) => (a.score ?? 1) - (b.score ?? 1))
    .map((i) => ({
      key: i.issueType,
      score: i.score ?? 0,
      imageUrl: (i.details as SkinIssueDetails | null)?.imageUrl ?? null,
    }));

  let aiSummary = summary.ai_summary ?? null;
  if (!aiSummary) {
    aiSummary = await generateSkinSummary({
      overall: summary.overall ?? null,
      skinType: summary.skin_type ?? null,
      skinAge: summary.skin_age ?? null,
      concerns: concerns.map((c) => ({ key: c.key, score: c.score })),
    });
    await prisma.skinScan
      .update({
        where: { id: scan.id },
        data: { summary: { ...summary, ai_summary: aiSummary } as object },
      })
      .catch(() => {});
  }

  // Every approved practitioner — see the note on the analysis page.
  const doctors = await prisma.doctor.findMany({
    where: PUBLIC_DOCTOR_WHERE,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      slug: true,
      name: true,
      title: true,
      specialty: true,
      clinic: true,
      location: true,
      image: true,
      phone: true,
      email: true,
      website: true,
    },
  });

  const dateLabel = new Date(scan.createdAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <SkinReport
      analysisId={scan.id}
      dateLabel={dateLabel}
      userName={user.name ?? null}
      baseImage={summary.base_image ?? null}
      overall={summary.overall ?? null}
      skinType={summary.skin_type ?? null}
      skinAge={summary.skin_age ?? null}
      aiSummary={aiSummary}
      concerns={concerns}
      doctors={doctors}
    />
  );
}
