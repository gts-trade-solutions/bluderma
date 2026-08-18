import Link from "next/link";

import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { buildPatientMenu } from "@/lib/queries/nav";
import Navbar from "@/components/Navbar";
import { scoreRating, type SkinSummary } from "@/lib/integrations/skinConcerns";

export const metadata = { title: "My skin analyses" };
export const dynamic = "force-dynamic";

export default async function SkinAnalysisListPage() {
  const user = await requireUser("/patient/skin-analysis");

  const scans = await prisma.skinScan.findMany({
    where: { userId: user.id, status: "done" },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, createdAt: true, summary: true },
  });

  return (
    <>
      <Navbar role="patient" menu={buildPatientMenu()} />
      <main className="container-page max-w-3xl py-10 sm:py-14">
        <div className="mb-6 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-ink">My skin analyses</h1>
          <Link href="/patient/skin-analyzer" className="btn-primary text-sm">
            New scan
          </Link>
        </div>

        {scans.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/20 p-10 text-center">
            <p className="text-ink-muted">You haven&apos;t run a scan yet.</p>
            <Link
              href="/patient/skin-analyzer"
              className="btn-primary mt-4 inline-flex"
            >
              Analyze my skin
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {scans.map((s) => {
              const summary = (s.summary as SkinSummary | null) ?? {};
              const pct =
                typeof summary.overall === "number"
                  ? Math.round(summary.overall * 100)
                  : null;
              const rating =
                typeof summary.overall === "number"
                  ? scoreRating(summary.overall)
                  : null;
              return (
                <li key={s.id}>
                  <Link
                    href={`/patient/skin-analysis/${s.id}`}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 p-4 transition hover:border-brand-300/50 hover:shadow-soft"
                  >
                    <div>
                      <div className="font-semibold text-ink">
                        {new Date(s.createdAt).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </div>
                      {summary.skin_type && (
                        <div className="text-sm text-ink-muted">
                          Skin type: {summary.skin_type}
                        </div>
                      )}
                    </div>
                    {pct != null && rating && (
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-bold text-ink">
                          {pct}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${rating.chipClass}`}
                        >
                          {rating.label}
                        </span>
                      </div>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
