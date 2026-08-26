"use client";

import { useState, useTransition } from "react";
import { Archive, LoaderCircle, Plus } from "lucide-react";

import { recordUsage, retireAsset } from "@/lib/actions/finance";
import type { MachineStatus, Recovery } from "@/lib/doctor/financeCore";
import { useFormValidation } from "@/hooks/useFormValidation";

const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/**
 * One machine, and how far it has paid for itself.
 *
 * The bar is the honest part: it is recovered over outlay, capped at whole,
 * and the sentence beneath says what the remainder means in the unit a
 * practitioner thinks in, which is uses rather than rupees.
 *
 * Recording a use is on this card rather than behind a menu because it is the
 * thing that has to happen after every single treatment. A workflow that costs
 * three clicks to log ten seconds of work does not get used, and a recovery
 * figure built on half the uses is worse than none.
 *
 * ── The colour ───────────────────────────────────────────────────────────
 * Every card used to carry the same violet edge, so a practitioner with six
 * machines had to read six paragraphs to answer the one question the section
 * exists for: which of these is not earning its keep. The top edge and the
 * pill now carry the tier from machineStatus() — and the tier is computed
 * from the RATE of recovery against how long the machine has been owned, not
 * from the raw percentage. 12% recovered is doing well after a month and a
 * write-off after four years, and colouring both the same would be worse than
 * no colour at all.
 */
export default function MachineCard({
  recovery,
  status,
}: {
  recovery: Recovery;
  /** Omitted only where a caller has no reading yet; the card stays neutral. */
  status?: MachineStatus;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const formCheck = useFormValidation();

  const r = recovery;
  const pct = Math.round(r.progress * 100);
  const today = new Date().toISOString().slice(0, 10);

  // Full literal strings: Tailwind scans source text, so an interpolated
  // class compiles to nothing and the colour silently goes missing.
  const skin = status
    ? {
        blue: { edge: "border-blue-500", pill: "bg-blue-100 text-blue-900", bar: "from-blue-500 to-teal-400" },
        teal: { edge: "border-teal-500", pill: "bg-teal-100 text-teal-900", bar: "from-teal-500 to-emerald-400" },
        amber: { edge: "border-amber-500", pill: "bg-amber-100 text-amber-900", bar: "from-amber-400 to-orange-500" },
        rose: { edge: "border-rose-500", pill: "bg-rose-100 text-rose-900", bar: "from-rose-400 to-rose-600" },
        slate: { edge: "border-slate-300", pill: "bg-slate-100 text-slate-600", bar: "from-slate-300 to-slate-400" },
      }[status.tone]
    : { edge: "border-violet-500", pill: "bg-slate-100 text-slate-600", bar: "from-violet-500 to-teal-500" };

  return (
    <li
      className={`rounded-2xl border-t-[3px] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_12px_32px_-24px_rgba(15,23,42,0.35)] ring-1 ring-slate-200/80 ${skin.edge}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-extrabold text-slate-900">{r.name}</p>
            {status && (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${skin.pill}`}
              >
                {status.label}
              </span>
            )}
          </div>
          {r.purpose && <p className="text-xs text-slate-500">{r.purpose}</p>}
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display text-2xl font-extrabold tabular-nums text-slate-900">
            {pct}%
          </p>
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            recovered
          </p>
        </div>
      </div>

      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full bg-gradient-to-r transition-[width] duration-500 ${skin.bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* What the colour means, in a sentence. A tier with no explanation is
          a traffic light nobody can act on. */}
      {status && (
        <p className="mt-2.5 text-[11px] leading-relaxed text-slate-600">
          {status.meaning}
        </p>
      )}

      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Fig label="Cost" value={money(r.outlayInr)} />
        <Fig label="Earned back" value={money(r.recoveredInr)} tone="teal" />
        <Fig label="To go" value={money(r.remainingInr)} />
      </dl>

      {/* The sentence is the feature. Every figure in it is measured, and the
          one projection says what it assumes. */}
      <p className="mt-3 rounded-xl bg-slate-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-slate-600">
        {r.guidance}
      </p>

      {error && <p className="mt-2 text-xs font-semibold text-rose-600">{error}</p>}

      {open ? (
        <form
          ref={formCheck.formRef}
          noValidate
          className="mt-3 rounded-xl border border-slate-200 p-3"
          onSubmit={formCheck.guard((fd, form) => {
            setError(null);
            start(async () => {
              const res = await recordUsage({
                assetId: r.id,
                usedOn: String(fd.get("usedOn") ?? ""),
                chargedInr: String(fd.get("chargedInr") ?? ""),
                treatment: String(fd.get("treatment") ?? ""),
              });
              if (!res.ok) setError(res.error ?? "Could not record that.");
              else setOpen(false);
            });
          })}
        >
          {formCheck.summary}
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">
                Used on
              </span>
              <input
                name="usedOn"
                type="date"
                defaultValue={today}
                required
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:border-brand-400 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">
                Charged
              </span>
              {/* Zero is allowed on purpose: an included touch-up still wears
                  the machine, and dropping it would overstate the earn rate. */}
              <input
                name="chargedInr"
                inputMode="numeric"
                placeholder="8000"
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:border-brand-400 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">
                Treatment
              </span>
              <input
                name="treatment"
                placeholder="Laser resurfacing"
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:border-brand-400 focus:outline-none"
              />
            </label>
          </div>
          <div className="mt-2.5 flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-1.5 text-xs font-bold text-white disabled:opacity-60"
            >
              {pending && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
              Record
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full px-3 py-1.5 text-xs font-semibold text-slate-500"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-slate-900 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-slate-700"
          >
            <Plus className="h-3.5 w-3.5" /> Record a use
          </button>
          <span className="text-xs text-slate-400">
            {r.useCount} use{r.useCount === 1 ? "" : "s"} logged
            {r.averageChargeInr !== null && ` · ${money(r.averageChargeInr)} average`}
          </span>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await retireAsset(r.id);
                if (!res.ok) setError(res.error ?? "Could not retire that.");
              })
            }
            className="ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-slate-400 transition hover:text-slate-700 disabled:opacity-60"
          >
            <Archive className="h-3.5 w-3.5" /> Retire
          </button>
        </div>
      )}
    </li>
  );
}

function Fig({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "teal";
}) {
  return (
    <div className="rounded-lg bg-slate-50 px-2 py-2">
      <dt className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd
        className={`mt-0.5 text-sm font-extrabold tabular-nums ${
          tone === "teal" ? "text-teal-700" : "text-slate-900"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
