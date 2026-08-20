"use client";

import { useRef, useState } from "react";

import { useFieldError } from "@/components/admin/formContext";

/**
 * A textarea that can write a first draft.
 *
 * The doctor is never handed prose without being told where it came from, and
 * nothing is inserted without them choosing it: the drafts appear as options,
 * and "Use this" is a click. What gets saved is whatever is in the textarea
 * when they submit — which they can edit freely, and usually should.
 *
 * With no API key the toolbar is not rendered at all. A disabled button that
 * explains it needs configuration is a worse experience than a plain textarea,
 * and the field works perfectly well as one.
 */

interface Variant {
  tone: string;
  text: string;
  source: "ai" | "template";
}

const TONE_LABEL: Record<string, string> = {
  warm: "Warm",
  professional: "Professional",
  concise: "Concise",
};

export default function AssistTextArea({
  name,
  label,
  defaultValue = "",
  rows = 7,
  hint,
  required,
  aiEnabled,
  draftTask,
  clinicId,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  rows?: number;
  hint?: string;
  required?: boolean;
  aiEnabled: boolean;
  /** Which draft to ask for. Omit for improve-only. */
  draftTask?: "draft-about" | "draft-clinic-about";
  clinicId?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const error = useFieldError(name);

  const [busy, setBusy] = useState<string | null>(null);
  const [variants, setVariants] = useState<Variant[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  /** Writes into the uncontrolled textarea — it is the field that submits. */
  const put = (text: string) => {
    if (!ref.current) return;
    ref.current.value = text;
    ref.current.focus();
  };

  async function post(body: Record<string, unknown>) {
    const res = await fetch("/api/doctor/assist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { res, data: await res.json().catch(() => ({})) };
  }

  async function draft() {
    if (!draftTask) return;
    setBusy("draft");
    setProblem(null);
    setVariants(null);
    try {
      const { res, data } = await post(
        draftTask === "draft-clinic-about"
          ? { task: draftTask, clinicId }
          : { task: draftTask }
      );
      if (!res.ok || !data?.ok) {
        setProblem("Could not write a draft just now. Type what you like instead.");
        return;
      }
      if (Array.isArray(data.variants)) setVariants(data.variants as Variant[]);
      else if (typeof data.text === "string") {
        setVariants([{ tone: "professional", text: data.text, source: data.source }]);
      }
    } catch {
      setProblem("Could not write a draft just now. Type what you like instead.");
    } finally {
      setBusy(null);
    }
  }

  async function improve(mode: "improve" | "shorten" | "expand") {
    const text = ref.current?.value.trim() ?? "";
    if (text.length < 20) {
      setProblem("Write a sentence or two first, then I can tidy it.");
      return;
    }
    setBusy(mode);
    setProblem(null);
    try {
      const { res, data } = await post({ task: "improve", text, mode });
      if (!res.ok || !data?.ok) {
        setProblem("Could not rewrite that just now. Your text is untouched.");
        return;
      }
      put(data.text as string);
    } catch {
      setProblem("Could not rewrite that just now. Your text is untouched.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-end justify-between gap-2">
        <label className="text-sm font-semibold text-ink">
          {label}
          {required && <span className="text-brand-500"> *</span>}
        </label>

        {aiEnabled && (
          <div className="flex flex-wrap items-center gap-1.5">
            {draftTask && (
              <button
                type="button"
                onClick={draft}
                disabled={busy !== null}
                className="rounded-full bg-brand-50 px-3 py-1 text-[11px] font-bold text-brand-800 ring-1 ring-brand-200 transition hover:bg-brand-100 disabled:opacity-50"
              >
                {busy === "draft" ? "Writing…" : "Write a draft"}
              </button>
            )}
            <button
              type="button"
              onClick={() => improve("improve")}
              disabled={busy !== null}
              className="rounded-full px-2.5 py-1 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:opacity-50"
            >
              {busy === "improve" ? "…" : "Tidy up"}
            </button>
            <button
              type="button"
              onClick={() => improve("shorten")}
              disabled={busy !== null}
              className="rounded-full px-2.5 py-1 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:opacity-50"
            >
              {busy === "shorten" ? "…" : "Shorten"}
            </button>
          </div>
        )}
      </div>

      <textarea
        ref={ref}
        name={name}
        rows={rows}
        required={required}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 ${
          error ? "border-rose-300" : "border-slate-200"
        }`}
      />

      {busy === "draft" && (
        <div className="mt-2 space-y-2" aria-live="polite">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      )}

      {variants && variants.length > 0 && (
        <div className="mt-3 space-y-2" aria-live="polite">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
            Pick one and edit it. Nothing is saved until you submit
          </p>
          {variants.map((v) => (
            <div
              key={v.tone}
              className="rounded-xl bg-slate-50 p-3.5 ring-1 ring-slate-200"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  {TONE_LABEL[v.tone] ?? v.tone}
                  {/* Said plainly: a template draft is not an AI draft. */}
                  {v.source === "template" && " · from your details"}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    put(v.text);
                    setVariants(null);
                  }}
                  className="shrink-0 rounded-lg bg-white px-2.5 py-1 text-[11px] font-bold text-brand-700 ring-1 ring-slate-200 transition hover:bg-brand-50"
                >
                  Use this
                </button>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-700">
                {v.text}
              </p>
            </div>
          ))}
        </div>
      )}

      {problem && <p className="mt-2 text-xs text-amber-700">{problem}</p>}

      {error ? (
        <p className="mt-1.5 text-xs font-medium text-rose-600">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}
