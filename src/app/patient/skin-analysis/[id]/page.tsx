import Link from "next/link";
import { notFound } from "next/navigation";

import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { buildPatientMenu } from "@/lib/queries/nav";
import Navbar from "@/components/Navbar";
import { SkinResultView } from "@/components/skin/SkinResultView";
import { ViewReportButton } from "@/components/skin/ViewReportButton";
import DoctorRecommendations from "@/components/skin/DoctorRecommendations";
import { generateSkinSummary } from "@/lib/integrations/skinSummary";
import {
  type SkinSummary,
  type SkinIssueDetails,
} from "@/lib/integrations/skinConcerns";

export const metadata = { title: "Skin analysis" };
export const dynamic = "force-dynamic";

const META = new Set(["overall", "skin_type", "skin_age", "resize_image"]);

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
  const concerns = scan.issues
    .filter((i) => !META.has(i.issueType) && i.score != null)
    .sort((a, b) => (a.score ?? 1) - (b.score ?? 1))
    .map((i) => ({
      key: i.issueType,
      score: i.score ?? 0,
      imageUrl: (i.details as SkinIssueDetails | null)?.imageUrl ?? null,
    }));

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

  // Only the real imported clinic contacts (they carry the neutral clinic
  // avatar) — never the demo/seed doctors.
  const doctors = await prisma.doctor.findMany({
    where: { isActive: true, image: "/brand/clinic-avatar.svg" },
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

  const dateLabel = new Date(scan.createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <>
      <Navbar role="patient" menu={buildPatientMenu()} />
      <main className="container-page max-w-5xl py-8 sm:py-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-ink sm:text-3xl">
              Your skin analysis
            </h1>
            <p className="mt-1 text-sm text-ink-muted">{dateLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <ViewReportButton
              href={`/patient/skin-analysis/${scan.id}/report`}
            />
            <Link href="/patient/skin-analysis" className="btn-ghost text-sm">
              All
            </Link>
          </div>
        </div>

        <div className="mb-5 rounded-xl bg-slate-50 px-4 py-3 text-sm text-ink-soft ring-1 ring-slate-100">
          Tap <span className="font-semibold">View full report</span> for your
          web chart, per-concern breakdown and a downloadable PDF.
        </div>

        {/* Doctor recommendations — highlighted at the top. */}
        {doctors.length > 0 && (
          <div className="mb-6 rounded-2xl bg-gradient-to-br from-brand-50 to-teal-50 p-4 ring-1 ring-brand-100 sm:p-5">
            <DoctorRecommendations doctors={doctors} />
          </div>
        )}

        <SkinResultView
          baseImage={summary.base_image ?? null}
          overall={summary.overall ?? null}
          skinType={summary.skin_type ?? null}
          skinAge={summary.skin_age ?? null}
          concerns={concerns}
          aiSummary={aiSummary}
        />
      </main>
    </>
  );
}
