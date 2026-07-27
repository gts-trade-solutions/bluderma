import Link from "next/link";
import { notFound } from "next/navigation";

import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { buildPatientMenu } from "@/lib/queries/nav";
import Navbar from "@/components/Navbar";
import SkinScanResult, { toConcerns } from "@/components/skin/SkinScanResult";
import DoctorRecommendations from "@/components/skin/DoctorRecommendations";
import { generateSkinSummary } from "@/lib/integrations/skinSummary";
import type { SkinSummary } from "@/lib/integrations/skinConcerns";

export const metadata = { title: "Skin analysis" };
export const dynamic = "force-dynamic";

export default async function SkinAnalysisDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requireUser(`/patient/skin-analysis/${params.id}`);

  const scan = await prisma.skinScan.findFirst({
    where: { id: params.id, userId: user.id },
    include: { issues: true },
  });
  if (!scan) notFound();

  const summary = (scan.summary as SkinSummary | null) ?? {};
  const concerns = toConcerns(scan.issues);

  // AI summary — generated once, then cached on the scan's summary JSON.
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

  // Recommended clinics — all active doctors (not concern-matched, by design).
  const doctors = await prisma.doctor.findMany({
    where: { isActive: true },
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

  return (
    <>
      <Navbar role="patient" menu={buildPatientMenu()} />
      <main className="container-page max-w-4xl py-10 sm:py-14">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-ink">Your skin analysis</h1>
            <p className="mt-1 text-sm text-ink-muted">
              {new Date(scan.createdAt).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Link href="/patient/skin-analysis" className="btn-ghost text-sm">
              All results
            </Link>
            <Link href="/patient/skin-analyzer" className="btn-primary text-sm">
              New scan
            </Link>
          </div>
        </div>

        <SkinScanResult
          summary={summary}
          concerns={concerns}
          aiSummary={aiSummary}
        />

        <div className="mt-10">
          <DoctorRecommendations doctors={doctors} />
        </div>
      </main>
    </>
  );
}
