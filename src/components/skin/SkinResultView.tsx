"use client";

import { useState } from "react";
import { Images, Sparkles } from "lucide-react";
import {
  concernLabel,
  concernDescription,
  scoreRating,
} from "@/lib/integrations/skinConcerns";
import { ScoreBar, ScoreLegend } from "@/components/skin/score-visuals";

type Concern = { key: string; score: number; imageUrl: string | null };

/**
 * Compact result view: a small analyzed-photo thumbnail + overall score + AI
 * summary, then the per-concern breakdown. Tapping a concern (that has an
 * overlay) swaps the thumbnail to show it on the photo.
 */
export function SkinResultView({
  baseImage,
  overall,
  skinType,
  skinAge,
  concerns,
  aiSummary,
}: {
  baseImage: string | null;
  overall: number | null;
  skinType: string | null;
  skinAge: string | null;
  concerns: Concern[];
  aiSummary: string | null;
}) {
  const [sel, setSel] = useState<string | null>(null);
  const selConcern = sel ? concerns.find((c) => c.key === sel) : null;
  const shown = selConcern?.imageUrl ?? baseImage;
  const overallPct =
    typeof overall === "number" ? Math.round(overall * 100) : null;
  const overallRating = overall != null ? scoreRating(overall) : null;

  return (
    <div>
      {/* Header — thumbnail + score + summary */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="mx-auto w-40 shrink-0 sm:mx-0">
          <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200">
            {shown ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={shown}
                alt={sel ? `${concernLabel(sel)} overlay` : "Analyzed photo"}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-ink-muted">
                No photo
              </div>
            )}
            {sel ? (
              <button
                onClick={() => setSel(null)}
                className="absolute inset-x-0 bottom-0 bg-black/55 py-1 text-[11px] font-medium text-white backdrop-blur"
              >
                {concernLabel(sel)} · tap to clear
              </button>
            ) : null}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          {overallPct != null && overallRating ? (
            <>
              <div className="flex items-end gap-3">
                <span className="text-5xl font-bold text-ink">{overallPct}</span>
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

          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            {skinType && (
              <span className="rounded-lg bg-brand-50 px-3 py-1.5 font-medium text-brand-700">
                Skin type: {skinType}
              </span>
            )}
            {skinAge && (
              <span className="rounded-lg bg-teal-50 px-3 py-1.5 font-medium text-teal-700">
                Skin age: {skinAge}
              </span>
            )}
          </div>

          {aiSummary && (
            <div className="mt-4 rounded-xl bg-gradient-to-br from-brand-50 to-teal-50 p-3.5 ring-1 ring-brand-100">
              <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-brand-600">
                <Sparkles className="h-3.5 w-3.5" /> Your summary
              </div>
              <p className="text-[13px] leading-relaxed text-ink-soft">
                {aiSummary}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Concern breakdown */}
      {concerns.length > 0 && (
        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-ink-muted">
              Concern breakdown
            </h2>
            <ScoreLegend />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {concerns.map((c) => {
              const rating = scoreRating(c.score);
              const active = sel === c.key;
              const clickable = !!c.imageUrl;
              return (
                <button
                  key={c.key}
                  disabled={!clickable}
                  onClick={() => setSel((s) => (s === c.key ? null : c.key))}
                  className={`rounded-lg border border-slate-200 p-3 text-left transition-colors ${
                    active ? "border-brand-500 ring-1 ring-brand-500" : ""
                  } ${clickable ? "hover:bg-slate-50" : "cursor-default"}`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1">
                      {c.imageUrl ? (
                        <Images
                          className={`h-3 w-3 shrink-0 ${active ? "text-brand-600" : "text-ink-muted"}`}
                        />
                      ) : null}
                      <span className="truncate text-xs font-medium text-ink">
                        {concernLabel(c.key)}
                      </span>
                    </span>
                    <span
                      className={`text-sm font-semibold tabular-nums ${rating.textClass}`}
                    >
                      {Math.round(c.score * 100)}
                    </span>
                  </div>
                  {concernDescription(c.key) ? (
                    <div className="mt-0.5 truncate text-[11px] text-ink-muted">
                      {concernDescription(c.key)}
                    </div>
                  ) : null}
                  <div className="mt-2">
                    <ScoreBar score01={c.score} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
