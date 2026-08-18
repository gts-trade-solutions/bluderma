"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  FileText,
  LoaderCircle,
  Paperclip,
  ScanFace,
  Star,
  Trash2,
  X,
} from "lucide-react";

import SmartImage from "@/components/SmartImage";
import {
  INTAKE_STORAGE_KEY,
  INTAKE_TERMS,
  STEPS,
  type IntakeField,
  type IntakeStep,
} from "@/data/intake";
import { BEFORE_AFTER } from "@/data/hub";
// simulateAnalysis is deliberately NOT imported. It fabricated a skin
// analysis from a hash of the visitor's typed name and labelled it
// "Pulled from your last scan" — invented medical data shown to a patient
// as their own record, for anyone, signed in or not. Real figures now come
// from /api/skin/my-latest, which answers honestly when there are none.
import type { AnalysisResult } from "@/data/skin";
import IntakeResult from "./IntakeResult";
import { submitIntake } from "@/lib/actions/intake";
import { useBackGuard } from "@/hooks/useBackToClose";

export type Answers = Record<string, string | string[]>;

/** One concern from a real analysis. `score` is null when the analyzer did
 *  not return a number — a missing score must never render as zero. */
export interface ReportConcern {
  /** The canonical concern key, when the analyzer's finding maps to one.
   *  Null means "show it, but do not match a doctor on it". */
  key: string | null;
  label: string;
  score: number | null;
  band: string | null;
}

export interface RealAnalysis {
  id: string;
  takenOn: string;
  overall: number | null;
  skinType: string | null;
  concerns: ReportConcern[];
}

export type SkinReport =
  | { kind: "none" }
  /** Fetching /api/skin/my-latest. */
  | { kind: "loading" }
  /** Not signed in — we cannot know their history, and must not guess. */
  | { kind: "signin" }
  /** Signed in, but they have never scanned. */
  | { kind: "noscan" }
  | { kind: "analysis"; result: RealAnalysis }
  | { kind: "upload"; fileName: string; sizeKb: number; previewUrl?: string };

interface Draft {
  answers: Answers;
  stepIndex: number;
  reportKind: SkinReport["kind"];
  reportFileName?: string;
}

/**
 * The skin consultation quiz.
 *
 * One question set per screen, a progress bar across the top and a fixed
 * action bar at the bottom — the shape the reference uses, and the reason it
 * finishes: nothing on screen except the thing being asked, and always a
 * visible sense of how much is left.
 *
 * Answers persist to localStorage as they are given, so leaving for the skin
 * analyzer and coming back lands on the same screen with everything intact
 * (C-36).
 *
 * Submissions ARE sent: submitIntake writes an IntakeResponse row, which the
 * doctor reads in the appointment drawer before the consultation. The old
 * "nothing is sent anywhere in this build" note here outlived that by
 * several months.
 */
export default function IntakeFlow() {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [report, setReport] = useState<SkinReport>({ kind: "none" });
  const [pendingFileName, setPendingFileName] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);
  /** The question area, for scrolling a failed field into view. */
  const bodyRef = useRef<HTMLDivElement>(null);

  const step = STEPS[index];
  const last = index === STEPS.length - 1;

  // ── Draft ────────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(INTAKE_STORAGE_KEY);
      if (raw) {
        const draft = JSON.parse(raw) as Draft;
        const saved = draft.answers ?? {};
        setAnswers(saved);
        if (typeof draft.stepIndex === "number") {
          setIndex(resumeStep(draft.stepIndex, saved));
        }
        if (draft.reportKind === "upload" && draft.reportFileName) {
          setPendingFileName(draft.reportFileName);
        }
      }
    } catch {
      /* a corrupt draft is not worth blocking the quiz for */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      const draft: Draft = {
        answers,
        stepIndex: index,
        reportKind: report.kind,
        reportFileName:
          report.kind === "upload" ? report.fileName : pendingFileName ?? undefined,
      };
      window.localStorage.setItem(INTAKE_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      /* private mode — the quiz still works, it just won't survive a reload */
    }
  }, [answers, index, report, pendingFileName, hydrated]);

  useEffect(() => {
    const url = report.kind === "upload" ? report.previewUrl : undefined;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [report]);

  const set = useCallback((id: string, value: string | string[]) => {
    setAnswers((a) => ({ ...a, [id]: value }));
    setErrors((e) => (e[id] ? { ...e, [id]: "" } : e));
  }, []);

  const goTo = useCallback((i: number) => {
    setIndex(i);
    topRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, []);

  /**
   * Back walks the steps, and leaves at the first one.
   *
   * A history entry per step forward, so the browser button does the obvious
   * thing. There is no dialog to close any more — at step 0, Back simply
   * leaves the page, which is correct.
   */
  useBackGuard(!submitted && index > 0, () => goTo(index - 1));

  /**
   * What is still missing on this step.
   *
   * Shown beside the button rather than used to disable it. A greyed-out
   * Next with no explanation is a dead end — the visitor can see they are
   * blocked but not by what, and on a step that scrolls the offending field
   * may be off-screen entirely. Naming the count, and jumping to the first
   * gap when they press it, answers the question instead of just refusing.
   */
  const outstanding = useMemo(() => {
    let missing = 0;
    let total = 0;
    if (step.kind === "goals") {
      total += 1;
      if (((answers.goals as string[]) ?? []).length === 0) missing += 1;
    }
    for (const f of step.fields ?? []) {
      if (!f.required) continue;
      total += 1;
      const v = answers[f.id];
      if (typeof v !== "string" || !v.trim()) missing += 1;
    }
    return { missing, total };
  }, [step, answers]);

  const validate = () => {
    const next: Record<string, string> = {};
    if (step.kind === "goals") {
      const chosen = (answers.goals as string[]) ?? [];
      if (chosen.length === 0) next.goals = "Pick at least one.";
    }
    for (const f of step.fields ?? []) {
      if (!f.required) continue;
      const v = answers[f.id];
      const empty = Array.isArray(v) ? v.length === 0 : !v || !String(v).trim();
      if (empty) next[f.id] = "Please answer this one.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const next = () => {
    if (!validate()) {
      // Scroll the first offending field into view inside the scrolling band,
      // so being blocked is never a mystery.
      window.requestAnimationFrame(() => {
        const el = bodyRef.current?.querySelector("[data-invalid='true']");
        el?.scrollIntoView({ block: "center", behavior: "smooth" });
      });
      return;
    }
    if (!last) goTo(index + 1);
  };

  const submit = async () => {
    if (!agreed) return;
    setSubmitting(true);
    // Persisted server-side (anonymous allowed); the local draft remains the
    // client's own copy either way, so a failed write never blocks the flow.
    try {
      await submitIntake({ answers });
    } catch {
      /* the result screen is still the right next step */
    }
    setSubmitting(false);
    setSubmitted(true);
    topRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  const restart = () => {
    setAnswers({});
    setReport({ kind: "none" });
    setPendingFileName(null);
    setAgreed(false);
    setSubmitted(false);
    setIndex(0);
    try {
      window.localStorage.removeItem(INTAKE_STORAGE_KEY);
    } catch {
      /* nothing to clear */
    }
  };

  if (submitted) {
    return (
      <div ref={topRef}>
        <IntakeResult
          answers={answers}
          report={report}
          onEdit={() => setSubmitted(false)}
          onRestart={restart}
        />
      </div>
    );
  }

  const pct = Math.round(((index + 1) / STEPS.length) * 100);
  const name = ((answers.name as string) ?? "").split(" ")[0];

  return (
    <div ref={topRef} className="scroll-mt-24">
      {/* ── Progress ─────────────────────────────────────────────────── */}
      {/* The document scrolls, so sticky is the right tool and works. In the
          old dialog the panel clipped its own overflow for rounded corners,
          which stopped sticky pinning and put the Next button below a fold
          inside a fold. That whole class of problem goes away on a page. */}
      <div className="sticky top-0 z-20 bg-[#0d1526]">
        <div className="h-1.5 w-full bg-white/10">
          <div
            className="h-full bg-gradient-to-r from-brand-500 to-teal-500 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* ── The screen ───────────────────────────────────────────────── */}
      <div ref={bodyRef} className="px-5 pb-32 pt-6 sm:px-8">
        <div className="mx-auto max-w-xl">
          <StepHead step={step} name={name} />

          {step.kind === "goals" && (
            <GoalPicker
              step={step}
              chosen={(answers.goals as string[]) ?? []}
              error={errors.goals}
              onToggle={(id) => {
                const chosen = (answers.goals as string[]) ?? [];
                set(
                  "goals",
                  chosen.includes(id)
                    ? chosen.filter((g) => g !== id)
                    : [...chosen, id]
                );
              }}
            />
          )}

          {step.kind === "questions" && (
            <div className="space-y-7">
              {step.fields?.map((f) => (
                <Field
                  key={f.id}
                  field={f}
                  value={answers[f.id]}
                  error={errors[f.id]}
                  onChange={(v) => set(f.id, v)}
                />
              ))}
            </div>
          )}

          {step.kind === "proof" && <ProofScreen />}

          {step.kind === "note" && (
            <NoteScreen
              fields={step.fields ?? []}
              answers={answers}
              onChange={set}
              report={report}
              setReport={setReport}
              pendingFileName={pendingFileName}
              clearPending={() => setPendingFileName(null)}
              name={name}
            />
          )}

          {step.kind === "finish" && (
            <FinishScreen
              answers={answers}
              report={report}
              agreed={agreed}
              setAgreed={setAgreed}
              onJump={goTo}
            />
          )}

          {step.why && (
            <div className="mt-8 rounded-2xl bg-brand-400/10 px-5 py-4">
              <p className="text-sm font-bold text-ink">Why we ask</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">
                {step.why}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Action bar ───────────────────────────────────────────────── */}
      <div className="sticky bottom-0 border-t border-white/10 bg-[#0d1526]/95 px-5 py-4 backdrop-blur sm:px-8">
        {/* What is left on this step, in words, before the buttons. */}
        {!step.skippable && outstanding.total > 0 && (
          <p
            id="intake-remaining"
            className={`mx-auto mb-2 max-w-[27rem] text-center text-[11px] font-semibold ${
              outstanding.missing > 0 ? "text-amber-300" : "text-teal-300"
            }`}
          >
            {outstanding.missing > 0
              ? `${outstanding.missing} of ${outstanding.total} still to answer on this step`
              : "All answered — you can continue"}
          </p>
        )}
        <div className="mx-auto flex max-w-[27rem] items-center justify-between gap-4">
          <button
            onClick={() => goTo(index - 1)}
            disabled={index === 0}
            aria-label="Back"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-ink-soft transition hover:bg-white/15 disabled:opacity-40"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          {last ? (
            <button
              onClick={submit}
              disabled={!agreed || submitting}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-brand-600 px-8 py-3.5 text-sm font-bold text-white transition hover:bg-brand-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
            >
              {submitting ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" /> Matching you…
                </>
              ) : (
                <>
                  See my doctors <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          ) : (
            <button
              onClick={step.skippable ? () => goTo(index + 1) : next}
              aria-describedby={
                outstanding.missing > 0 ? "intake-remaining" : undefined
              }
              className={`inline-flex flex-1 items-center justify-center gap-2 rounded-full px-8 py-3.5 text-sm font-bold text-white transition active:scale-[0.99] sm:flex-none ${
                outstanding.missing > 0 && !step.skippable
                  ? "bg-brand-600/50 hover:bg-brand-600/70"
                  : "bg-brand-600 hover:bg-brand-700"
              }`}
            >
              {step.skippable ? "Skip" : "Next"}
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── */

/** Is every required answer on this step present? */
function stepComplete(i: number, answers: Answers): boolean {
  const s = STEPS[i];
  if (s.kind === "goals") return ((answers.goals as string[]) ?? []).length > 0;
  return (s.fields ?? []).every((f) => {
    if (!f.required) return true;
    const v = answers[f.id];
    return Array.isArray(v) ? v.length > 0 : !!v && !!String(v).trim();
  });
}

/** Never reopen a draft further than the first unanswered screen. */
function resumeStep(saved: number, answers: Answers): number {
  const target = Math.min(Math.max(saved, 0), STEPS.length - 1);
  for (let i = 0; i < target; i++) {
    if (!stepComplete(i, answers)) return i;
  }
  return target;
}

function StepHead({ step, name }: { step: IntakeStep; name: string }) {
  const title =
    step.kind === "proof" && name
      ? `You're on the way to healthier skin, ${name}`
      : step.kind === "note" && name
      ? `Almost there, ${name}. Anything else your doctor should know?`
      : step.title;

  return (
    <div className="mb-9 flex items-start gap-6">
      <div className="min-w-0 flex-1">
        {step.step ? (
          <StepRail n={step.step} />
        ) : (
          <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-teal-300">
            <span className="h-px w-6 bg-teal-300/50" />
            {step.kind === "proof" ? "A moment" : "Last one"}
          </span>
        )}

        <h2 className="display mt-4 text-[1.75rem] leading-[1.1] text-white sm:text-[2.15rem]">
          {title}
        </h2>
        {step.sub && (
          <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">
            {step.sub}
          </p>
        )}
      </div>

      {/* A tall crop, because every photograph in this set is a portrait.
          Cropping one into a wide banner shows a forehead and nothing else. */}
      {step.image && (
        <div className="relative aspect-[3/4] w-24 shrink-0 overflow-hidden rounded-2xl ring-1 ring-white/10 sm:w-28">
          <SmartImage src={step.image} alt="" sizes="7rem" className="object-center" />
        </div>
      )}
    </div>
  );
}

/**
 * The step marker: a big numeral against the total, with a tick per step and
 * the current one lit. It replaces the reference's "STEP 1" pill — same
 * information, and it also shows how many are left without reading as a
 * borrowed component.
 */
function StepRail({ n }: { n: number }) {
  const total = STEPS.filter((s) => s.step).length;
  return (
    <div>
      <p className="flex items-baseline gap-1 text-teal-300">
        <span className="display text-2xl leading-none">
          {String(n).padStart(2, "0")}
        </span>
        <span className="text-xs font-semibold text-white/35">
          / {String(total).padStart(2, "0")}
        </span>
      </p>
      <div className="mt-2 flex gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={`h-0.5 w-5 rounded-full transition-colors ${
              i < n ? "bg-teal-300" : "bg-white/15"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Goals ───────────────────────────────────────────────────────────── */

function GoalPicker({
  step,
  chosen,
  error,
  onToggle,
}: {
  step: IntakeStep;
  chosen: string[];
  error?: string;
  onToggle: (id: string) => void;
}) {
  return (
    /* Same marker as Field, so the goals step is reachable the same way. */
    <div className="space-y-7" data-invalid={error ? "true" : undefined}>
      {step.groups?.map((group) => (
        <div key={group.title}>
          <h3 className="display-sm text-lg text-ink">{group.title}</h3>
          <p className="mt-0.5 text-[13px] text-ink-muted">{group.sub}</p>

          <ul className="mt-3 divide-y divide-white/10 overflow-hidden rounded-2xl ring-1 ring-white/10">
            {group.options.map((o) => {
              const on = chosen.includes(o.id);
              return (
                <li key={o.id}>
                  <button
                    onClick={() => onToggle(o.id)}
                    aria-pressed={on}
                    className={`flex w-full items-center justify-between gap-3 py-2.5 pl-4 pr-2.5 text-left transition ${
                      on ? "bg-brand-400/[12%]" : "bg-white/[0.04] hover:bg-white/[0.04]"
                    }`}
                  >
                    <span
                      className={`text-sm font-bold ${
                        on ? "text-brand-200" : "text-ink"
                      }`}
                    >
                      {o.label}
                    </span>
                    <span className="relative h-12 w-16 shrink-0 overflow-hidden rounded-xl">
                      <SmartImage src={o.image} alt="" sizes="4rem" />
                      {on && (
                        <span className="absolute inset-0 flex items-center justify-center bg-brand-600/85">
                          <Check className="h-5 w-5 text-white" strokeWidth={3} />
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {error && <p className="text-xs font-medium text-rose-600">{error}</p>}

      <p className="rounded-2xl bg-white/[0.04] px-4 py-3 text-[12px] leading-relaxed text-ink-muted">
        You&apos;ll be matched with a doctor who reviews your goals and health
        history before recommending anything. We never sell or share what you
        tell us here.
      </p>
    </div>
  );
}

/* ── Fields ──────────────────────────────────────────────────────────── */

function Field({
  field,
  value,
  error,
  onChange,
}: {
  field: IntakeField;
  value: string | string[] | undefined;
  error?: string;
  onChange: (v: string) => void;
}) {
  const current = typeof value === "string" ? value : "";

  return (
    /* Marked so a failed Next can scroll straight to the first gap. */
    <div data-invalid={error ? "true" : undefined}>
      {field.label && (
        <p className="mb-2.5 text-[15px] font-bold text-ink">{field.label}</p>
      )}

      {field.kind === "text" && (
        <input
          value={current}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-white/10 px-4 py-3 text-sm text-ink outline-none transition placeholder:text-ink-muted focus:border-brand-400 focus:ring-4 focus:ring-brand-300/40"
        />
      )}

      {field.kind === "textarea" && (
        <textarea
          rows={5}
          value={current}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-full resize-none rounded-xl border border-white/10 px-4 py-3 text-sm text-ink outline-none transition placeholder:text-ink-muted focus:border-brand-400 focus:ring-4 focus:ring-brand-300/40"
        />
      )}

      {field.kind === "choice" && (
        <ul className="divide-y divide-white/10 overflow-hidden rounded-2xl ring-1 ring-white/10">
          {field.options?.map((o) => {
            const on = current === o;
            return (
              <li key={o}>
                <button
                  onClick={() => onChange(o)}
                  aria-pressed={on}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition ${
                    on ? "bg-brand-400/[12%]" : "bg-white/[0.04] hover:bg-white/[0.04]"
                  }`}
                >
                  <span
                    className={`text-sm font-bold ${
                      on ? "text-brand-200" : "text-ink"
                    }`}
                  >
                    {o}
                  </span>
                  <Tick on={on} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {field.kind === "segmented" && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(0,1fr))] overflow-hidden rounded-2xl ring-1 ring-white/10">
          {field.options?.map((o, i) => {
            const on = current === o;
            return (
              <button
                key={o}
                onClick={() => onChange(o)}
                aria-pressed={on}
                className={`flex items-center justify-center gap-2 px-3 py-3.5 text-sm font-bold transition ${
                  i > 0 ? "border-l border-white/10" : ""
                } ${on ? "bg-brand-400/[12%] text-brand-200" : "bg-white/[0.04] text-ink hover:bg-white/[0.04]"}`}
              >
                {o}
                {on && <Tick on />}
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <p className="mt-2 text-xs font-medium text-rose-600">{error}</p>
      )}
    </div>
  );
}

function Tick({ on }: { on: boolean }) {
  if (!on) {
    return (
      <span className="h-5 w-5 shrink-0 rounded-full ring-1 ring-inset ring-white/20" />
    );
  }
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600">
      <Check className="h-3 w-3 text-white" strokeWidth={3.5} />
    </span>
  );
}

/* ── Proof interstitial ──────────────────────────────────────────────── */

function ProofScreen() {
  const cases = BEFORE_AFTER.slice(0, 3);
  return (
    <div>
      <h3 className="display-sm text-lg text-ink">Proven results</h3>
      <div className="mt-3 flex gap-3 overflow-x-auto pb-2 no-scrollbar">
        {cases.map((c) => (
          <figure key={c.slug} className="w-64 shrink-0">
            <div className="grid grid-cols-2 gap-1 overflow-hidden rounded-2xl">
              {[
                { src: c.before, tag: "Before" },
                { src: c.after, tag: `After ${c.timeframe}` },
              ].map((side) => (
                <div key={side.tag} className="relative aspect-[3/4]">
                  <SmartImage src={side.src} alt="" sizes="8rem" />
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white backdrop-blur">
                    {side.tag}
                  </span>
                </div>
              ))}
            </div>
            <figcaption className="mt-2 text-[11px] text-ink-muted">
              {c.concern} · {c.sessions}
            </figcaption>
          </figure>
        ))}
      </div>
      <p className="mt-1 text-[11px] text-ink-muted">
        Illustrative comparisons — these show the kind of change each course
        aims at. They are not photographs of BluDerma clients, and results vary.
      </p>

      <PublishedReviews />
    </div>
  );
}

/**
 * Reviews clients have actually left.
 *
 * Replaces three invented testimonials and a hardcoded five-star rating that
 * claimed to come "from clients across our clinics". Nobody had written them.
 *
 * Renders NOTHING when there are no published reviews yet. That is the point:
 * a young platform has no testimonials, and an empty space is the honest way
 * to say so. There is no fallback, deliberately — a fallback here is just the
 * fabrication again with extra steps.
 */
function PublishedReviews() {
  const [data, setData] = useState<{
    reviews: {
      id: string;
      rating: number;
      title: string | null;
      quote: string;
      name: string;
      doctor: string;
    }[];
    average: number | null;
    count: number;
  } | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/reviews/published")
      .then((r) => r.json())
      .then((d) => live && d?.ok && setData(d))
      .catch(() => {
        /* silence is correct — show nothing rather than something invented */
      });
    return () => {
      live = false;
    };
  }, []);

  if (!data || data.count === 0) return null;

  return (
    <>
      <h3 className="display-sm mt-8 text-lg text-ink">What clients said</h3>
      {data.average != null && (
        <div className="mt-1 flex items-center gap-1.5">
          <span className="flex gap-0.5 text-amber-400">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`h-3.5 w-3.5 ${
                  i < Math.round(data.average!) ? "fill-current" : "opacity-30"
                }`}
              />
            ))}
          </span>
          <span className="text-xs font-medium text-ink-muted">
            {data.average.toFixed(1)} from {data.count}{" "}
            {data.count === 1 ? "review" : "reviews"}
          </span>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {data.reviews.slice(0, 3).map((r) => (
          <figure key={r.id} className="rounded-2xl bg-brand-400/10 px-4 py-3.5">
            <blockquote className="text-[13px] leading-relaxed text-ink-soft">
              &ldquo;{r.quote}&rdquo;
            </blockquote>
            <figcaption className="mt-2 text-xs text-ink-muted">
              <span className="font-bold text-ink">{r.name}</span> · on{" "}
              {r.doctor}
            </figcaption>
          </figure>
        ))}
      </div>
    </>
  );
}

/* ── Note + optional skin report (C-36) ──────────────────────────────── */

function NoteScreen({
  fields,
  answers,
  onChange,
  report,
  setReport,
  pendingFileName,
  clearPending,
  name,
}: {
  fields: IntakeField[];
  answers: Answers;
  onChange: (id: string, v: string) => void;
  report: SkinReport;
  setReport: (r: SkinReport) => void;
  pendingFileName: string | null;
  clearPending: () => void;
  name: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  /**
   * Fetch the client's actual last analysis.
   *
   * Three honest outcomes, and the UI renders each differently: not signed in,
   * signed in with nothing to show, or real figures. What it never does is
   * make one up.
   */
  const pull = async () => {
    setReport({ kind: "loading" });
    try {
      const res = await fetch("/api/skin/my-latest", { cache: "no-store" });
      const data = await res.json();
      if (!data?.authed) return setReport({ kind: "signin" });
      if (!data.analysis) return setReport({ kind: "noscan" });
      setReport({ kind: "analysis", result: data.analysis });
    } catch {
      // A network failure is not "you have no scan" — say nothing rather than
      // something wrong, and let them try again.
      setReport({ kind: "none" });
    }
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    clearPending();
    setReport({
      kind: "upload",
      fileName: file.name,
      sizeKb: Math.max(1, Math.round(file.size / 1024)),
      previewUrl: file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : undefined,
    });
  };

  return (
    <div className="space-y-6">
      {fields.map((f) => (
        <Field
          key={f.id}
          field={f}
          value={answers[f.id]}
          onChange={(v) => onChange(f.id, v)}
        />
      ))}

      <div>
        <p className="text-[15px] font-bold text-ink">
          Have a skin report? Attach it.
        </p>
        <p className="mt-1 text-[13px] text-ink-muted">
          Optional — it makes the advice sharper.
        </p>

        {(report.kind === "none" ||
          report.kind === "signin" ||
          report.kind === "noscan") && (
          <div className="mt-3 grid gap-2">
            <AttachRow
              icon={ScanFace}
              label="Use my BluDerma skin analysis"
              onClick={pull}
            />
            <AttachRow
              icon={Paperclip}
              label="Upload a report — PDF or photo"
              onClick={() => fileRef.current?.click()}
            />
            <Link
              href="/patient/skin-analyzer#start"
              target="_blank"
              className="flex items-center justify-between gap-3 rounded-2xl px-4 py-3.5 text-left ring-1 ring-white/10 transition hover:bg-white/[0.04]"
            >
              <span className="flex items-center gap-3">
                <ScanFace className="h-4 w-4 text-brand-300" />
                <span className="text-sm font-bold text-ink">
                  Haven&apos;t scanned yet — scan now
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-ink-muted" />
            </Link>
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          onChange={onFile}
          className="hidden"
        />

        {report.kind === "loading" && (
          <p className="mt-3 rounded-xl bg-white/[0.04] px-4 py-3 text-xs text-ink-muted">
            Looking for your last scan…
          </p>
        )}

        {report.kind === "signin" && (
          <div className="mt-3 rounded-xl bg-brand-400/[12%] px-4 py-3 ring-1 ring-brand-300/30">
            <p className="text-xs text-ink-soft">
              You are not signed in, so we cannot see your scan history.
            </p>
            <div className="mt-2 flex flex-wrap gap-3">
              <Link
                href="/login?callbackUrl=/patient/know-you"
                className="text-xs font-bold text-brand-200 hover:text-brand-100"
              >
                Sign in to attach it →
              </Link>
              <Link
                href="/patient/skin-analyzer#start"
                target="_blank"
                className="text-xs font-bold text-teal-300 hover:text-teal-200"
              >
                Or scan now →
              </Link>
            </div>
            <p className="mt-2 text-[11px] text-ink-muted">
              You can carry on without it — this step is optional.
            </p>
          </div>
        )}

        {report.kind === "noscan" && (
          <div className="mt-3 rounded-xl bg-white/[0.04] px-4 py-3 ring-1 ring-white/10">
            <p className="text-xs text-ink-soft">
              There is no scan on your account yet.
            </p>
            <Link
              href="/patient/skin-analyzer#start"
              target="_blank"
              className="mt-1.5 inline-block text-xs font-bold text-teal-300 hover:text-teal-200"
            >
              Run one now — it takes about a minute →
            </Link>
          </div>
        )}

        {pendingFileName && report.kind === "none" && (
          <p className="mt-3 rounded-xl bg-amber-400/[12%] px-4 py-3 text-xs text-amber-800">
            You attached <strong>{pendingFileName}</strong> earlier. Browsers
            can&apos;t hold a file across a reload — attach it again if you
            still want the doctor to see it.
          </p>
        )}

        {report.kind === "analysis" && (
          <div className="mt-3 rounded-2xl bg-gradient-to-br from-brand-400/15 to-teal-400/15 p-4 ring-1 ring-brand-300/40">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-brand-200">
                  Your scan from {report.result.takenOn}
                </p>
                <p className="display-sm mt-1 text-lg text-ink">
                  {[
                    report.result.overall != null
                      ? `Score ${report.result.overall}`
                      : null,
                    report.result.skinType,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Attached"}
                </p>
              </div>
              <button
                onClick={() => setReport({ kind: "none" })}
                aria-label="Remove"
                className="rounded-lg p-1.5 text-ink-muted hover:bg-white/[0.04] hover:text-rose-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {report.result.concerns.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {report.result.concerns.map((c) => (
                  <span
                    key={c.label}
                    className="rounded-full bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold capitalize text-brand-200"
                  >
                    {c.label}
                    {c.score != null ? ` · ${c.score}` : ""}
                    {c.score == null && c.band ? ` · ${c.band}` : ""}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {report.kind === "upload" && (
          <div className="mt-3 flex items-start gap-3 rounded-2xl p-4 ring-1 ring-white/10">
            {report.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={report.previewUrl}
                alt=""
                className="h-14 w-14 shrink-0 rounded-xl object-cover ring-1 ring-white/10"
              />
            ) : (
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-brand-400/[12%] text-brand-300">
                <FileText className="h-6 w-6" strokeWidth={1.6} />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-ink">
                {report.fileName}
              </p>
              <p className="mt-0.5 text-xs text-ink-muted">
                {report.sizeKb} KB · bring this to your consultation
              </p>
            </div>
            <button
              onClick={() => setReport({ kind: "none" })}
              aria-label="Remove attachment"
              className="rounded-lg p-2 text-ink-muted hover:bg-rose-500/[12%] hover:text-rose-600"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function AttachRow({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof ScanFace;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-between gap-3 rounded-2xl px-4 py-3.5 text-left ring-1 ring-white/10 transition hover:bg-white/[0.04]"
    >
      <span className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-brand-300" />
        <span className="text-sm font-bold text-ink">{label}</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-ink-muted" />
    </button>
  );
}

/* ── Finish ──────────────────────────────────────────────────────────── */

function FinishScreen({
  answers,
  report,
  agreed,
  setAgreed,
  onJump,
}: {
  answers: Answers;
  report: SkinReport;
  agreed: boolean;
  setAgreed: (v: boolean) => void;
  onJump: (i: number) => void;
}) {
  const [showTerms, setShowTerms] = useState(false);

  const summary = useMemo(() => {
    const rows: { label: string; value: string; step: number }[] = [];
    STEPS.forEach((s, i) => {
      if (s.kind === "goals") {
        const chosen = (answers.goals as string[]) ?? [];
        const labels = (s.groups ?? [])
          .flatMap((g) => g.options)
          .filter((o) => chosen.includes(o.id))
          .map((o) => o.label);
        if (labels.length) {
          rows.push({ label: "Goals", value: labels.join(", "), step: i });
        }
      }
      (s.fields ?? []).forEach((f) => {
        const v = answers[f.id];
        if (typeof v === "string" && v.trim()) {
          rows.push({ label: f.label || s.title, value: v, step: i });
        }
      });
    });
    return rows;
  }, [answers]);

  return (
    <div>
      <div className="rounded-2xl bg-gradient-to-br from-brand-600 to-teal-600 p-5 text-white">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-teal-200">
          All done
        </p>
        <p className="display-sm mt-1.5 text-xl">
          We&apos;ve got what we need
        </p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-white/75">
          Next you&apos;ll see the doctors who match your goals, what they
          charge and when they&apos;re free.
        </p>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl ring-1 ring-white/10">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <p className="text-sm font-bold text-ink">Your answers</p>
        </div>
        <dl className="divide-y divide-white/10">
          {summary.map((r) => (
            <div key={r.label + r.value} className="flex gap-3 px-4 py-2.5">
              <dt className="w-2/5 shrink-0 text-[11px] font-medium text-ink-muted">
                {r.label}
              </dt>
              <dd className="flex-1 text-[12px] font-medium text-ink">
                {r.value}
              </dd>
              <button
                onClick={() => onJump(r.step)}
                className="shrink-0 text-[11px] font-bold text-brand-200 hover:underline"
              >
                Edit
              </button>
            </div>
          ))}
          <div className="flex gap-3 px-4 py-2.5">
            <dt className="w-2/5 shrink-0 text-[11px] font-medium text-ink-muted">
              Skin report
            </dt>
            <dd className="flex-1 text-[12px] font-medium text-ink">
              {report.kind === "analysis"
                ? `BluDerma analysis · score ${report.result.overall}`
                : report.kind === "upload"
                ? report.fileName
                : "Not attached"}
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-4 rounded-2xl px-4 py-4 ring-1 ring-white/10">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 text-brand-300 focus:ring-brand-400"
          />
          <span className="text-[13px] leading-relaxed text-ink-soft">
            I confirm the information above is accurate and I accept the{" "}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setShowTerms((v) => !v);
              }}
              className="font-bold text-brand-200 underline"
            >
              consultation terms
            </button>
            .
          </span>
        </label>

        {showTerms && (
          <ul className="mt-3 space-y-2 rounded-xl bg-white/[0.04] p-4">
            {INTAKE_TERMS.map((t) => (
              <li key={t} className="flex gap-2 text-[12px] leading-relaxed text-ink-muted">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-muted" />
                {t}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
