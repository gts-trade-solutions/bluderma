import Link from "next/link";
import { Sparkles } from "lucide-react";

import { scoreRating, type SkinSummary } from "@/lib/integrations/skinConcerns";

type Scan = { id: string; createdAt: Date; summary: unknown };

const DATE = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "long",
  day: "numeric",
});

/**
 * "Skin Analyzer" section for the patient profile — lists the client's camera
 * scans with their score, each opening the full result.
 */
export default function ProfileSkinSection({ scans }: { scans: Scan[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-ink">Skin Analyzer</h2>
            <p className="text-xs text-ink-muted">
              Your camera-based skin analyses
            </p>
          </div>
        </div>
        <Link href="/patient/skin-analyzer" className="btn-primary text-sm">
          {scans.length ? "New scan" : "Analyze my skin"}
        </Link>
      </div>

      {scans.length === 0 ? (
        <p className="mt-5 rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-ink-muted">
          You haven&apos;t run a skin analysis yet. Tap{" "}
          <span className="font-medium text-ink">Analyze my skin</span> to get
          your overall score and concern breakdown.
        </p>
      ) : (
        <>
          <ul className="mt-5 space-y-2.5">
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
                    className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 px-4 py-3 transition hover:border-brand-300 hover:bg-slate-50"
                  >
                    <div>
                      <div className="text-sm font-semibold text-ink">
                        {DATE.format(s.createdAt)}
                      </div>
                      {summary.skin_type && (
                        <div className="text-xs text-ink-muted">
                          Skin type: {summary.skin_type}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {pct != null && rating && (
                        <>
                          <span className="text-lg font-bold text-ink">
                            {pct}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${rating.chipClass}`}
                          >
                            {rating.label}
                          </span>
                        </>
                      )}
                      <span className="text-brand-600" aria-hidden>
                        →
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 text-center">
            <Link
              href="/patient/skin-analysis"
              className="text-sm font-semibold text-brand-600 hover:text-brand-700"
            >
              View all analyses
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
