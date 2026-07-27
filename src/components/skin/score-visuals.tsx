import { scoreRating } from "@/lib/integrations/skinConcerns";

// Slim 0–100 severity track with the three guidance bands (Needs care / Fair /
// Good), tick dividers at the cutoffs (50, 75) and a marker at the score.
export function ScoreBar({ score01 }: { score01: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(score01 * 100)));
  const rating = scoreRating(score01);
  return (
    <div className="relative h-1.5 w-full overflow-hidden rounded-full">
      <div className="absolute inset-0 flex">
        <div className="h-full w-1/2 bg-red-500/20" />
        <div className="h-full w-1/4 bg-amber-500/25" />
        <div className="h-full w-1/4 bg-emerald-500/25" />
      </div>
      <div className="absolute inset-y-0 left-1/2 w-px bg-white/70" />
      <div className="absolute inset-y-0 left-3/4 w-px bg-white/70" />
      <div
        className="absolute top-1/2 -translate-y-1/2"
        style={{ left: `${pct}%` }}
      >
        <div
          className={`-ml-[3px] h-2.5 w-1.5 rounded-full ring-2 ring-white ${rating.barClass} shadow-sm`}
        />
      </div>
    </div>
  );
}

// Shared cutoff legend.
export function ScoreLegend() {
  const items = [
    { c: "bg-red-500", t: "<50 Needs care" },
    { c: "bg-amber-500", t: "50–75 Fair" },
    { c: "bg-emerald-500", t: "75+ Good" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-muted">
      {items.map((i) => (
        <span key={i.t} className="inline-flex items-center gap-1">
          <span className={`h-2 w-2 rounded-full ${i.c}`} />
          {i.t}
        </span>
      ))}
    </div>
  );
}
