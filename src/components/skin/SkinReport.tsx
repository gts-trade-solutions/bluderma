"use client";

import Link from "next/link";
import { ArrowLeft, Download, Sparkles } from "lucide-react";
import {
  concernLabel,
  concernDescription,
  scoreRating,
} from "@/lib/integrations/skinConcerns";
import { ScoreBar } from "@/components/skin/score-visuals";
import { SkinProfileDashboard } from "@/components/skin/SkinProfileDashboard";
import DoctorRecommendations, {
  type RecommendedDoctor,
} from "@/components/skin/DoctorRecommendations";

type Concern = { key: string; score: number; imageUrl: string | null };

/**
 * Printable skin analysis report. Viewable in-app; "Download PDF" uses the
 * browser's print-to-PDF (no PDF dependency). Ported from MadeNKorea; product
 * recommendations are replaced by the BluDerma clinic list.
 */
export function SkinReport({
  analysisId,
  dateLabel,
  userName,
  baseImage,
  overall,
  skinType,
  skinAge,
  aiSummary,
  concerns,
  concernSummaries,
  doctors,
  backHref,
  backLabel,
}: {
  analysisId: string;
  dateLabel: string;
  userName: string | null;
  baseImage: string | null;
  overall: number | null;
  skinType: string | null;
  skinAge: string | null;
  aiSummary: string | null;
  concerns: Concern[];
  concernSummaries?: Record<string, string>;
  doctors: RecommendedDoctor[];
  backHref?: string;
  backLabel?: string;
}) {
  const overallRating = overall != null ? scoreRating(overall) : null;

  const summaryBlock = aiSummary ? (
    <div className="rounded-lg bg-white/[0.04] p-3 text-[13px] leading-relaxed sm:text-sm print:bg-transparent print:px-0">
      <span className="mr-1.5 inline-flex items-center gap-1 align-middle text-[11px] font-semibold uppercase tracking-wide text-rose-500">
        <Sparkles className="h-3 w-3" /> Summary
      </span>
      {aiSummary}
    </div>
  ) : null;

  return (
    <div className="skin-report-doc min-h-screen bg-white/[0.04] py-6 print:bg-white print:py-0">
      {/* Toolbar — hidden when printing */}
      <div className="mx-auto mb-4 flex max-w-3xl items-center justify-between px-4 print:hidden">
        <Link
          href={backHref ?? `/patient/skin-analysis/${analysisId}`}
          className="btn-ghost inline-flex items-center text-sm"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> {backLabel ?? "Back to result"}
        </Link>
        <button
          onClick={() => window.print()}
          className="btn-primary inline-flex items-center text-sm"
        >
          <Download className="mr-2 h-4 w-4" /> Download PDF
        </button>
      </div>

      {/* Document */}
      <div className="mx-auto max-w-3xl bg-white/[0.04] p-5 shadow-sm sm:p-8 print:p-8 print:shadow-none">
        <header className="flex items-start justify-between gap-3 border-b border-white/10 pb-5 sm:gap-4">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-500">
              BluDerma
            </div>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-ink sm:text-2xl">
              Skin Analysis Report
            </h1>
            <p className="mt-1 truncate text-sm text-ink-muted">
              {userName ? `${userName} · ` : ""}
              {dateLabel}
            </p>
          </div>
          {overall != null ? (
            <div className="shrink-0 text-right">
              <div className={`text-3xl font-bold tabular-nums sm:text-4xl ${overallRating?.textClass}`}>
                {Math.round(overall * 100)}
              </div>
              <div className="text-[10px] uppercase tracking-wide text-ink-muted sm:text-[11px]">
                / 100 · {overallRating?.label}
              </div>
            </div>
          ) : null}
        </header>

        {/* At a glance */}
        <section className="mt-6 break-inside-avoid">
          <div className="flex gap-4 sm:gap-5">
            {baseImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={baseImage}
                alt="Analyzed photo"
                className="h-32 w-24 shrink-0 rounded-lg object-cover sm:h-40 sm:w-32"
              />
            ) : null}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {skinType ? <Meta label="Skin type" value={cap(skinType)} /> : null}
                {skinAge ? <Meta label="Skin age" value={String(skinAge)} /> : null}
                <Meta label="Concerns analysed" value={String(concerns.length)} />
              </div>
              {summaryBlock ? (
                <div className="mt-3 hidden sm:block">{summaryBlock}</div>
              ) : null}
            </div>
          </div>
          {summaryBlock ? (
            <div className="mt-4 sm:hidden">{summaryBlock}</div>
          ) : null}
        </section>

        {/* Skin profile — radar + gauge + insights + band cards */}
        <section className="mt-8">
          <SkinProfileDashboard overall={overall} concerns={concerns} />
        </section>

        {/* Detailed analysis — one block per concern */}
        <section className="mt-8">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-ink-muted">
            Detailed analysis
          </h2>
          <div className="divide-y divide-white/10">
            {concerns.map((c) => {
              const r = scoreRating(c.score);
              const line = concernSummaries?.[c.key];
              return (
                <div key={c.key} className="break-inside-avoid py-4">
                  <div className="flex gap-4">
                    {c.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.imageUrl}
                        alt={`${concernLabel(c.key)} detail`}
                        className="h-32 w-24 shrink-0 rounded-lg object-cover sm:h-40 sm:w-32"
                      />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-ink">
                            {concernLabel(c.key)}
                          </div>
                          {concernDescription(c.key) ? (
                            <div className="text-xs text-ink-muted">
                              {concernDescription(c.key)}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 items-baseline gap-2">
                          <span className={`text-base font-semibold tabular-nums ${r.textClass}`}>
                            {Math.round(c.score * 100)}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${r.chipClass}`}>
                            {r.label}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2">
                        <ScoreBar score01={c.score} />
                      </div>
                      {line ? (
                        <p className="mt-2.5 text-[13px] leading-relaxed text-white/75">
                          {line}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Clinics — below the report */}
        {doctors.length ? (
          <section className="mt-8 break-inside-avoid border-t border-white/10 pt-6">
            <DoctorRecommendations doctors={doctors} mode="list" />
          </section>
        ) : null}

        <footer className="mt-10 border-t border-white/10 pt-4 text-[11px] leading-relaxed text-ink-muted">
          For cosmetic guidance only, not a medical diagnosis. Generated by the
          BluDerma AI Skin Analyzer on {dateLabel}.
        </footer>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-ink-muted">
        {label}
      </div>
      <div className="text-sm font-medium text-ink">{value}</div>
    </div>
  );
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
