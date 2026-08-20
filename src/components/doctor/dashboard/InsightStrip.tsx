import { Tag } from "@/components/doctor/portalUi";
import { getDailyInsights } from "@/lib/doctor/insightCache";
import type { DashboardMetrics } from "@/lib/doctor/metrics";

/**
 * Three or four things worth doing, under the revenue band.
 *
 * The figures quoted here were computed by the server; the sentences around
 * them were written once this morning. When a model wrote them the strip says
 * so, and when it did not it simply says "practice pointers" — the label is
 * not decoration, it is the difference between a suggestion a doctor can weigh
 * and one they think came from somewhere cleverer than it did.
 */
export default async function InsightStrip({
  doctorId,
  metrics,
}: {
  doctorId: string;
  metrics: DashboardMetrics;
}) {
  const { items, source } = await getDailyInsights(doctorId, metrics);
  if (!items.length) return null;

  return (
    <section className="mb-7">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="font-display text-base font-bold text-slate-900">
          Worth a look
        </h2>
        <Tag tone={source === "ai" ? "teal" : "slate"}>
          {source === "ai" ? "AI suggestions" : "Practice pointers"}
        </Tag>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <li
            key={item.title}
            className="flex items-start gap-3 rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)] ring-1 ring-slate-200/80"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
              <InsightGlyph kind={item.kind} />
            </span>
            <div className="min-w-0 flex-1">
              {item.metric && (
                <p className="font-display text-xl font-bold leading-none tabular-nums text-slate-900">
                  {item.metric}
                </p>
              )}
              <p
                className={`text-sm font-bold leading-snug text-slate-900 ${
                  item.metric ? "mt-1" : ""
                }`}
              >
                {item.title}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                {item.body}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Shown while today's set is being written. */
export function InsightStripSkeleton() {
  return (
    <section className="mb-7">
      <div className="mb-3 h-5 w-32 animate-pulse rounded bg-slate-200" />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <li key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </ul>
    </section>
  );
}

/** Small hand-rolled glyphs — the portal does not use lucide. */
function InsightGlyph({ kind }: { kind?: string }) {
  const d =
    kind === "calendar"
      ? "M7 3v3m10-3v3M4 9h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z"
      : kind === "money"
        ? "M12 3v18M8 7h6a3 3 0 0 1 0 6H8m0 0l6 8"
        : kind === "people"
          ? "M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 7.5a3 3 0 1 0 0 .01M21 19v-1a4 4 0 0 0-3-3.87"
          : kind === "star"
            ? "M12 3l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 18.3 5.9 21.6l1.4-6.8L2.2 10.1l6.9-.8z"
            : kind === "clock"
              ? "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"
              : "M13 2L4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5z";

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4.5 w-4.5"
      style={{ width: 18, height: 18 }}
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}
