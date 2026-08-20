"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Attaches the patient's own skin report to a booking.
 *
 * The version of this in the questionnaire sat behind a button and only
 * revealed what it knew once you pressed it — so a patient with no scan
 * pressed "use my analysis" and got, as far as they could tell, nothing. The
 * empty state was there, but it arrived after a click that looked like it had
 * failed.
 *
 * This one asks the question on mount and then states the answer plainly:
 * you have a report and here it is, or you do not and here is how to get one.
 * Nothing is invented in any branch — see the note in /api/skin/my-latest for
 * why that matters here specifically.
 */

export interface AttachedReport {
  id: string;
  source: "analysis" | "scan";
  takenOn: string;
  overall: number | null;
  skinType: string | null;
  concerns: { key: string | null; label: string; score: number | null }[];
}

type State =
  | { kind: "loading" }
  | { kind: "signin" }
  | { kind: "none" }
  | { kind: "error" }
  | { kind: "have"; report: AttachedReport };

export default function SkinReportAttach({
  value,
  onChange,
}: {
  value: AttachedReport | null;
  onChange: (r: AttachedReport | null) => void;
}) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/skin/my-latest", { cache: "no-store" });
        const data = await res.json();
        if (!alive) return;
        if (!data?.authed) return setState({ kind: "signin" });
        if (!data.analysis) return setState({ kind: "none" });
        const report: AttachedReport = data.analysis;
        setState({ kind: "have", report });
        // Attached by default. Somebody who has taken the trouble to scan
        // almost always wants the doctor to see it, and it is one tap to
        // remove — whereas a report nobody remembered to attach is a report
        // the doctor never sees.
        onChange(report);
      } catch {
        // A network failure is not "you have no scan". Saying so would be a
        // lie with clinical consequences.
        if (alive) setState({ kind: "error" });
      }
    })();
    return () => {
      alive = false;
    };
    // Deliberately once: re-running on every onChange identity would refetch
    // the report each time the parent re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10">
      <p className="text-sm font-bold text-ink">Your skin report</p>

      {state.kind === "loading" && (
        <p className="mt-2 text-sm text-ink-muted">Checking your account…</p>
      )}

      {state.kind === "error" && (
        <p className="mt-2 text-sm text-amber-300">
          We could not check for your report just now. You can still book — the
          doctor can pull it up during the consultation.
        </p>
      )}

      {state.kind === "signin" && (
        <div className="mt-2">
          <p className="text-sm text-ink-muted">
            Sign in and we can attach your analysis automatically.
          </p>
          <Link
            href="/login"
            className="mt-2 inline-block text-sm font-bold text-brand-200 hover:underline"
          >
            Sign in →
          </Link>
        </div>
      )}

      {state.kind === "none" && (
        <div className="mt-2">
          <p className="text-sm text-ink-muted">
            You don&apos;t have a skin analysis yet. It is free, takes about a
            minute, and gives your doctor a measured starting point instead of
            a description from memory.
          </p>
          <Link
            href="/patient/skin-analyzer#start"
            target="_blank"
            className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-700"
          >
            Run a free analysis
          </Link>
          <p className="mt-2 text-xs text-ink-muted">
            Opens in a new tab — your booking stays as it is.
          </p>
        </div>
      )}

      {state.kind === "have" && (
        <div className="mt-2">
          <div className="flex items-start justify-between gap-3 rounded-xl bg-brand-500/[12%] px-4 py-3 ring-1 ring-brand-400/30">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wide text-brand-200">
                {value ? "Attached" : "Not attached"} · scanned{" "}
                {state.report.takenOn}
              </p>
              <p className="mt-0.5 text-sm font-bold text-ink">
                {[
                  state.report.overall != null
                    ? `Score ${state.report.overall}`
                    : null,
                  state.report.skinType,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Your latest analysis"}
              </p>
              {state.report.concerns.length > 0 && (
                <p className="mt-1 text-xs text-ink-muted">
                  {state.report.concerns
                    .slice(0, 4)
                    .map((c) => c.label)
                    .join(", ")}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onChange(value ? null : state.report)}
              className="shrink-0 rounded-full px-3 py-1.5 text-xs font-bold text-ink-muted transition hover:bg-white/10 hover:text-ink"
            >
              {value ? "Remove" : "Attach"}
            </button>
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            {value
              ? "Your doctor will see this alongside the appointment."
              : "The doctor will not see your analysis for this visit."}
          </p>
        </div>
      )}
    </div>
  );
}
