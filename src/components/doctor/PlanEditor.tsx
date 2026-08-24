"use client";

import { useState, useTransition } from "react";
import { PlanItemState } from "@prisma/client";
import { Check, LoaderCircle, Plus, Sparkles, Undo2, X } from "lucide-react";

import {
  addPlanItem,
  setPlanItemState,
  sharePlan,
  unsharePlan,
} from "@/lib/actions/treatmentPlan";

export interface PlanItem {
  id: string;
  treatment: string;
  rationale: string | null;
  source: "AI" | "DOCTOR";
  state: "SUGGESTED" | "ACCEPTED" | "DECLINED";
}

/**
 * Reviewing what the analysis proposed, and deciding.
 *
 * The screen is built around one idea: a suggestion is not a recommendation
 * until this doctor says it is. So nothing arrives ticked, accepting and
 * declining are equally weighted, and the share button refuses to work until
 * something has actually been accepted.
 *
 * Declined lines stay visible rather than vanishing. A doctor coming back to
 * this a week later should be able to see what was considered and rejected,
 * which is most of what makes a plan reviewable.
 */
export default function PlanEditor({
  planId,
  items,
  sharedAt,
  aiSource,
}: {
  planId: string;
  items: PlanItem[];
  sharedAt: string | null;
  aiSource: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();

  const accepted = items.filter((i) => i.state === "ACCEPTED");
  const suggested = items.filter((i) => i.state === "SUGGESTED");
  const declined = items.filter((i) => i.state === "DECLINED");

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Something went wrong.");
      else setAdding(false);
    });
  }

  return (
    <div className="space-y-5">
      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
          {error}
        </p>
      )}

      {suggested.length > 0 && (
        <section>
          <div className="mb-2.5 flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-extrabold text-slate-900">
              Proposed from the analysis
            </h3>
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-700">
              <Sparkles className="h-3 w-3" />
              {aiSource ? "AI" : "Rule-based"}
            </span>
          </div>
          <p className="mb-3 text-xs leading-relaxed text-slate-500">
            Drawn from the treatment catalogue against this patient&apos;s measured
            scores. Nothing here reaches the patient until you accept it and
            share the plan.
          </p>
          <ul className="space-y-2">
            {suggested.map((i) => (
              <li
                key={i.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900">{i.treatment}</p>
                  {i.rationale && (
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                      {i.rationale}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => setPlanItemState(i.id, PlanItemState.ACCEPTED))}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-teal-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-teal-700 disabled:opacity-60"
                  >
                    <Check className="h-3.5 w-3.5" /> Accept
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => setPlanItemState(i.id, PlanItemState.DECLINED))}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-200 disabled:opacity-60"
                  >
                    <X className="h-3.5 w-3.5" /> Not this
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="mb-2.5 text-sm font-extrabold text-slate-900">
          The plan {accepted.length > 0 && `(${accepted.length})`}
        </h3>
        {accepted.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            Nothing accepted yet. Accept a suggestion above, or add your own.
          </p>
        ) : (
          <ul className="space-y-2">
            {accepted.map((i) => (
              <li
                key={i.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-xl border-l-[3px] border-teal-500 bg-teal-50/60 p-4 ring-1 ring-inset ring-teal-200"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900">
                    {i.treatment}
                    {i.source === "DOCTOR" && (
                      <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        Yours
                      </span>
                    )}
                  </p>
                  {i.rationale && (
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                      {i.rationale}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => setPlanItemState(i.id, PlanItemState.SUGGESTED))}
                  className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:text-slate-900 disabled:opacity-60"
                >
                  <Undo2 className="h-3.5 w-3.5" /> Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        {adding ? (
          <form
            className="mt-3 rounded-xl border border-slate-200 bg-white p-4"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              run(() =>
                addPlanItem({
                  planId,
                  treatment: String(fd.get("treatment") ?? ""),
                  rationale: String(fd.get("rationale") ?? ""),
                })
              );
            }}
          >
            {/* Free text, unlike the AI's lines. A doctor is allowed to know
                something the catalogue does not contain; a model is not. */}
            <input
              name="treatment"
              required
              placeholder="Treatment"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
            />
            <input
              name="rationale"
              placeholder="Why, in one line (optional)"
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
            />
            <div className="mt-2.5 flex gap-2">
              <button
                type="submit"
                disabled={pending}
                className="rounded-full bg-slate-900 px-4 py-1.5 text-xs font-bold text-white disabled:opacity-60"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="rounded-full px-3 py-1.5 text-xs font-semibold text-slate-500"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-full bg-slate-100 px-3.5 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-200"
          >
            <Plus className="h-3.5 w-3.5" /> Add your own
          </button>
        )}
      </section>

      {declined.length > 0 && (
        <section>
          {/* Kept, not hidden. A doctor returning to this should be able to see
              what was considered and rejected. */}
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
            Considered and set aside
          </h3>
          <ul className="flex flex-wrap gap-1.5">
            {declined.map((i) => (
              <li key={i.id}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => setPlanItemState(i.id, PlanItemState.SUGGESTED))}
                  className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500 line-through transition hover:text-slate-900 disabled:opacity-60"
                >
                  {i.treatment}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4">
        {sharedAt ? (
          <>
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700">
              <Check className="h-4 w-4" /> Shared with the patient on {sharedAt}
            </span>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => unsharePlan(planId))}
              className="text-xs font-semibold text-slate-500 underline underline-offset-2 hover:text-slate-900 disabled:opacity-60"
            >
              Withdraw it
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={pending || accepted.length === 0}
            onClick={() => run(() => sharePlan(planId))}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-gradient-to-r from-brand-600 to-teal-600 px-6 py-2.5 text-sm font-extrabold text-white transition hover:from-brand-700 hover:to-teal-700 disabled:opacity-50"
          >
            {pending && <LoaderCircle className="h-4 w-4 animate-spin" />}
            Share with the patient
          </button>
        )}
        {!sharedAt && accepted.length === 0 && (
          <span className="text-xs text-slate-400">
            Accept something first.
          </span>
        )}
      </footer>
    </div>
  );
}
