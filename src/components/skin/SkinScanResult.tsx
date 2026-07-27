import {
  concernDescription,
  concernLabel,
  scoreRating,
  type SkinSummary,
  type SkinIssueDetails,
} from "@/lib/integrations/skinConcerns";

type Concern = {
  key: string;
  score: number;
  imageUrl: string | null;
};

/**
 * Presentational report for one camera skin scan. Pure server component — the
 * data comes from the stored SkinScan summary + issue rows.
 */
export default function SkinScanResult({
  summary,
  concerns,
  aiSummary,
}: {
  summary: SkinSummary;
  concerns: Concern[];
  aiSummary?: string | null;
}) {
  const overallPct =
    typeof summary.overall === "number"
      ? Math.round(summary.overall * 100)
      : null;
  const overallRating =
    typeof summary.overall === "number" ? scoreRating(summary.overall) : null;

  return (
    <div className="space-y-8">
      {/* Headline */}
      <div className="grid gap-6 sm:grid-cols-[auto,1fr] sm:items-center">
        {summary.base_image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={summary.base_image}
            alt="Analyzed photo"
            className="h-40 w-40 shrink-0 rounded-2xl object-cover ring-1 ring-slate-200"
          />
        )}
        <div>
          {overallPct != null && overallRating ? (
            <>
              <div className="flex items-end gap-3">
                <span className="text-5xl font-bold text-ink">
                  {overallPct}
                </span>
                <span className="mb-1 text-lg text-ink-muted">/ 100</span>
                <span
                  className={`mb-1.5 rounded-full px-3 py-1 text-xs font-semibold ${overallRating.chipClass}`}
                >
                  {overallRating.label}
                </span>
              </div>
              <p className="mt-1 text-sm text-ink-muted">
                Overall skin health score
              </p>
            </>
          ) : (
            <p className="text-ink-muted">Analysis complete.</p>
          )}

          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            {summary.skin_type && (
              <span className="rounded-lg bg-brand-50 px-3 py-1.5 font-medium text-brand-700">
                Skin type: {summary.skin_type}
              </span>
            )}
            {summary.skin_age && (
              <span className="rounded-lg bg-teal-50 px-3 py-1.5 font-medium text-teal-700">
                Skin age: {summary.skin_age}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* AI summary */}
      {aiSummary && (
        <div className="rounded-2xl bg-gradient-to-br from-brand-50 to-teal-50 p-5 ring-1 ring-brand-100">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand-600">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
              <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z" />
            </svg>
            Your summary
          </div>
          <p className="text-[15px] leading-relaxed text-ink-soft">
            {aiSummary}
          </p>
        </div>
      )}

      {/* Concern breakdown */}
      {concerns.length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-bold text-ink">
            Concern breakdown
          </h2>
          <ul className="space-y-4">
            {concerns.map((c) => {
              const pct = Math.round(c.score * 100);
              const rating = scoreRating(c.score);
              const desc = concernDescription(c.key);
              return (
                <li
                  key={c.key}
                  className="rounded-2xl border border-slate-200 p-4"
                >
                  <div className="flex items-start gap-4">
                    {c.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.imageUrl}
                        alt={concernLabel(c.key)}
                        className="h-16 w-16 shrink-0 rounded-xl object-cover ring-1 ring-slate-200"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold text-ink">
                          {concernLabel(c.key)}
                        </span>
                        <span
                          className={`text-sm font-semibold ${rating.textClass}`}
                        >
                          {rating.label}
                        </span>
                      </div>
                      {desc && (
                        <p className="text-xs text-ink-muted">{desc}</p>
                      )}
                      <div className="mt-2 flex items-center gap-3">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full ${rating.barClass}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-10 text-right text-sm font-medium text-ink-soft">
                          {pct}
                        </span>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <p className="text-center text-xs text-ink-muted">
        For cosmetic guidance only — not a medical diagnosis. Discuss results
        with a qualified practitioner.
      </p>
    </div>
  );
}

/** Shared shape helper for pages that read stored issues. */
export function toConcerns(
  issues: {
    issueType: string;
    score: number | null;
    details: unknown;
  }[]
): Concern[] {
  const META = new Set(["overall", "skin_type", "skin_age", "resize_image"]);
  return issues
    .filter((i) => !META.has(i.issueType) && i.score != null)
    .sort((a, b) => (a.score ?? 1) - (b.score ?? 1))
    .map((i) => ({
      key: i.issueType,
      score: i.score ?? 0,
      imageUrl: (i.details as SkinIssueDetails | null)?.imageUrl ?? null,
    }));
}
