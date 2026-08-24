"use client";

import { useState, useTransition } from "react";
import { Check, LoaderCircle, MessageSquare, X } from "lucide-react";

import {
  requestFinancing,
  withdrawFinancingRequest,
} from "@/lib/actions/financing";

export interface FinancingRow {
  id: string;
  treatment: string;
  estimatedInr: number | null;
  status: "NEW" | "CONTACTED" | "CLOSED";
  createdAt: string;
  staffNote: string | null;
}

const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const STATUS: Record<FinancingRow["status"], { label: string; className: string }> = {
  NEW: {
    label: "Sent",
    className: "bg-amber-400/[14%] text-amber-200",
  },
  CONTACTED: {
    label: "Clinic replied",
    className: "bg-teal-400/[14%] text-teal-200",
  },
  CLOSED: {
    label: "Closed",
    className: "bg-white/10 text-ink-muted",
  },
};

/**
 * Asking the clinic about paying for a treatment over time.
 *
 * This is deliberately an enquiry rather than a checkout. What stood here
 * quoted an approved credit limit through a lender that does not exist and
 * listed EMI options, which made the platform look like a finance company. It
 * is not one, so nothing here quotes a rate, computes an approval, or names a
 * provider.
 *
 * The client's own estimate is asked for and clearly labelled as theirs. It is
 * useful triage, and putting OUR number next to a treatment would be the exact
 * move that made the old panel indefensible.
 */
export default function FinancingPanel({ rows }: { rows: FinancingRow[] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();

  return (
    <div>
      {rows.length > 0 && (
        <ul className="mb-3 grid gap-3 sm:grid-cols-2">
          {rows.map((r) => (
            <li key={r.id} className="card-soft p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="min-w-0 text-sm font-bold text-ink">{r.treatment}</p>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STATUS[r.status].className}`}
                >
                  {STATUS[r.status].label}
                </span>
              </div>
              <p className="mt-1 text-xs text-ink-muted">
                Asked {r.createdAt}
                {r.estimatedInr !== null && ` · you estimated ${money(r.estimatedInr)}`}
              </p>
              {r.staffNote && (
                <p className="mt-2.5 rounded-xl bg-white/[0.06] px-3.5 py-2.5 text-[13px] leading-relaxed text-ink-soft">
                  {r.staffNote}
                </p>
              )}
              {/* Withdrawable only while nobody has picked it up. Once staff
                  have replied, the record of that exchange is not the
                  client's to delete. */}
              {r.status === "NEW" && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const res = await withdrawFinancingRequest(r.id);
                      if (!res.ok) setError(res.error ?? "Could not withdraw that.");
                    })
                  }
                  className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-ink-muted transition hover:text-ink disabled:opacity-60"
                >
                  <X className="h-3.5 w-3.5" /> Withdraw
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {sent ? (
        <p className="inline-flex items-center gap-2 rounded-xl border border-teal-400/25 bg-teal-500/10 px-4 py-3 text-sm font-semibold text-teal-100">
          <Check className="h-4 w-4" /> Sent. The clinic will come back to you.
        </p>
      ) : open ? (
        <form
          className="card-soft p-5"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            const fd = new FormData(e.currentTarget);
            start(async () => {
              const res = await requestFinancing({
                treatment: String(fd.get("treatment") ?? ""),
                estimatedInr: String(fd.get("estimatedInr") ?? ""),
                note: String(fd.get("note") ?? ""),
              });
              if (!res.ok) setError(res.error ?? "Something went wrong.");
              else {
                setSent(true);
                setOpen(false);
              }
            });
          }}
        >
          <p className="text-sm font-bold text-ink">Ask about paying over time</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">
            Tell us what you are considering. The clinic will tell you what is
            possible and who provides it. Nothing is applied for here.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                Which treatment
              </span>
              <input
                name="treatment"
                required
                placeholder="Acne scar resurfacing, a course of 4"
                className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted/60 focus:border-brand-400 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                What you think it costs{" "}
                <span className="normal-case tracking-normal">(optional)</span>
              </span>
              <input
                name="estimatedInr"
                inputMode="numeric"
                placeholder="e.g. 24000"
                className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted/60 focus:border-brand-400 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                Anything else{" "}
                <span className="normal-case tracking-normal">(optional)</span>
              </span>
              <input
                name="note"
                placeholder="Timing, budget, questions"
                className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted/60 focus:border-brand-400 focus:outline-none"
              />
            </label>
          </div>

          {error && (
            <p className="mt-3 rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-100">
              {error}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="submit" disabled={pending} className="btn-primary !py-2 text-sm disabled:opacity-60">
              {pending && <LoaderCircle className="h-4 w-4 animate-spin" />}
              Send the enquiry
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn-ghost !py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="btn-primary !py-2.5 text-sm"
        >
          <MessageSquare className="h-4 w-4" /> Ask about paying over time
        </button>
      )}

      {error && !open && (
        <p className="mt-3 rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-100">
          {error}
        </p>
      )}
    </div>
  );
}
