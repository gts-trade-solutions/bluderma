"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Hand, Images, Sparkles } from "lucide-react";
import {
  concernLabel,
  concernDescription,
  scoreRating,
} from "@/lib/integrations/skinConcerns";
import { ScoreBar, ScoreLegend } from "@/components/skin/score-visuals";

type Concern = { key: string; score: number; imageUrl: string | null };

/**
 * Image-first result view (photo stage + concern rail), matching the MadeNKorea
 * analyzer. The bottom of the photo is a contextual panel — the AI summary by
 * default, a tapped concern's detail otherwise — with a swipeable concern-score
 * strip on mobile. Product suggestions are omitted (clinics show below).
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
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const selConcern = sel ? concerns.find((c) => c.key === sel) : null;
  const shown = selConcern?.imageUrl ?? baseImage;
  const anyImages = concerns.some((c) => c.imageUrl);
  const overallRating = overall != null ? scoreRating(overall) : null;
  const toggle = (key: string) => {
    setInteracted(true);
    setSel((s) => (s === key ? null : key));
  };

  const contextual = sel ? (
    <p className="text-xs leading-relaxed text-white/90">
      <b>{concernLabel(sel)}</b>
      {concernDescription(sel) ? ` · ${concernDescription(sel)}` : ""} — tap
      again to clear
    </p>
  ) : aiSummary ? (
    summaryOpen ? (
      <div>
        <p className="flex gap-2 text-xs leading-relaxed text-white/90">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/70" />
          <span>{aiSummary}</span>
        </p>
        <button
          onClick={() => setSummaryOpen(false)}
          className="mt-1.5 flex items-center gap-0.5 text-[11px] font-medium text-white/70 hover:text-white"
        >
          Show less <ChevronDown className="h-3 w-3 rotate-180" />
        </button>
      </div>
    ) : (
      <button
        onClick={() => setSummaryOpen(true)}
        className="flex w-full items-center gap-2 text-left"
        aria-label="Expand summary"
      >
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-white/70" />
        <span className="line-clamp-1 flex-1 text-xs text-white/90">
          {aiSummary}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-white/70" />
      </button>
    )
  ) : anyImages ? (
    <p className="text-[11px] text-white/70">
      Tap a concern to see it on your photo
    </p>
  ) : null;

  return (
    <div className="lg:flex lg:items-start lg:gap-6">
      {/* Stage */}
      <div className="lg:sticky lg:top-24 lg:shrink-0 lg:self-start">
        <div className="relative mx-auto aspect-[3/4] w-full max-w-md overflow-hidden rounded-2xl bg-white/10 lg:w-[22rem]">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shown}
              alt={sel ? `${concernLabel(sel)} overlay` : "Analyzed photo"}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-ink-muted">
              No photo
            </div>
          )}

          {/* Top metrics overlay */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 bg-gradient-to-b from-black/55 to-transparent p-3 text-white">
            <div className="flex gap-2">
              {skinType ? <Pill label="Type" value={cap(skinType)} /> : null}
              {skinAge ? <Pill label="Skin age" value={String(skinAge)} /> : null}
            </div>
            {overall != null ? (
              <div className="rounded-lg bg-black/40 px-2.5 py-1 text-right leading-none backdrop-blur">
                <div className="text-xl font-semibold tabular-nums">
                  {Math.round(overall * 100)}
                </div>
                <div className="text-[9px] uppercase tracking-wide text-white/80">
                  {overallRating?.label}
                </div>
              </div>
            ) : null}
          </div>

          {/* Contextual bottom panel (+ concern chips on mobile) */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 pt-12 text-white">
            {contextual ? (
              <div className="rounded-xl bg-black/60 p-3 shadow-lg ring-1 ring-white/10 backdrop-blur-md">
                {contextual}
              </div>
            ) : null}
            <div className="mt-3 lg:hidden">
              {!interacted ? (
                <div className="mb-1.5 flex animate-pulse items-center justify-center gap-1.5 text-[10px] font-medium text-white/85">
                  <Hand className="h-3 w-3" />
                  Tap a concern to see it on your photo · swipe for more
                  <ChevronRight className="h-3 w-3" />
                </div>
              ) : null}
              <div className="relative -mx-1">
                <div
                  onScroll={() => setInteracted(true)}
                  className="flex gap-2 overflow-x-auto px-1 pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {concerns.map((c) => {
                    const active = sel === c.key;
                    const clickable = !!c.imageUrl;
                    return (
                      <button
                        key={c.key}
                        disabled={!clickable}
                        onClick={() => toggle(c.key)}
                        className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium backdrop-blur ${
                          active ? "bg-white/[0.04] text-white" : "bg-black/50 text-white"
                        } ${clickable ? "" : "opacity-75"}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${scoreRating(c.score).barClass}`}
                        />
                        {concernLabel(c.key)}
                        <span className="tabular-nums opacity-80">
                          {Math.round(c.score * 100)}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-black/50 to-transparent" />
              </div>
            </div>
          </div>
        </div>

        {/* Mobile legend */}
        <div className="mt-3 flex justify-center lg:hidden">
          <ScoreLegend />
        </div>
      </div>

      {/* Rail — desktop-only concern list (mobile uses the photo's swipe strip) */}
      <div className="hidden lg:block lg:flex-1">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-ink-muted">Concerns</h2>
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
                onClick={() => toggle(c.key)}
                className={`rounded-lg border border-white/10 p-3 text-left transition-colors ${
                  active ? "border-brand-500 ring-1 ring-brand-500" : ""
                } ${clickable ? "hover:bg-white/[0.04]" : "cursor-default"}`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1">
                    {c.imageUrl ? (
                      <Images
                        className={`h-3 w-3 shrink-0 ${active ? "text-brand-300" : "text-ink-muted"}`}
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
    </div>
  );
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-black/40 px-2.5 py-1 leading-tight backdrop-blur">
      <div className="text-[9px] uppercase tracking-wide text-white/60">
        {label}
      </div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
