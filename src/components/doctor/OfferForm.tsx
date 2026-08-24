"use client";

import { useState, useTransition } from "react";
import { OfferStatus } from "@prisma/client";
import { LoaderCircle, Send } from "lucide-react";

import { saveOffer, submitOffer, withdrawOffer } from "@/lib/actions/giftCards";

const field =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none";
const labelClass =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500";

const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export default function OfferForm({
  clinics,
}: {
  clinics: { id: string; name: string }[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const form = e.currentTarget;
        const fd = new FormData(form);
        start(async () => {
          const res = await saveOffer({
            title: String(fd.get("title") ?? ""),
            description: String(fd.get("description") ?? ""),
            valueInr: String(fd.get("valueInr") ?? ""),
            priceInr: String(fd.get("priceInr") ?? ""),
            terms: String(fd.get("terms") ?? ""),
            validMonths: String(fd.get("validMonths") ?? "12"),
            clinicId: String(fd.get("clinicId") ?? ""),
          });
          if (!res.ok) setError(res.error ?? "Could not save that.");
          else form.reset();
        });
      }}
    >
      <label className="block">
        <span className={labelClass}>What the card is called</span>
        <input name="title" required placeholder="₹5,000 treatment credit" className={field} />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Worth</span>
          <input name="valueInr" required inputMode="numeric" placeholder="5000" className={field} />
        </label>
        <label className="block">
          <span className={labelClass}>Sold for</span>
          {/* Separate figures so a clinic can discount. Never the other way
              round: the server refuses a price above the value, because a card
              that costs more than it is worth is not a gift. */}
          <input name="priceInr" required inputMode="numeric" placeholder="4500" className={field} />
        </label>
        <label className="block">
          <span className={labelClass}>Valid for (months)</span>
          <input name="validMonths" inputMode="numeric" defaultValue="12" className={field} />
        </label>
        {clinics.length > 1 && (
          <label className="block">
            <span className={labelClass}>
              Location <span className="normal-case tracking-normal">(optional)</span>
            </span>
            <select name="clinicId" defaultValue="" className={field}>
              <option value="">Any of yours</option>
              {clinics.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <label className="block">
        <span className={labelClass}>Description</span>
        <input name="description" placeholder="What it can be spent on" className={field} />
      </label>
      <label className="block">
        <span className={labelClass}>
          Terms <span className="normal-case tracking-normal">(optional)</span>
        </span>
        <textarea name="terms" rows={2} placeholder="Anything a buyer should know before paying." className={field} />
      </label>

      <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900 ring-1 ring-inset ring-amber-200">
        Saved as a draft. Nothing reaches patients until you send it for review
        and BluDerma approves it.
      </p>

      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-slate-900 px-6 py-2.5 text-sm font-extrabold text-white transition hover:bg-slate-700 disabled:opacity-60"
      >
        {pending && <LoaderCircle className="h-4 w-4 animate-spin" />}
        Save as draft
      </button>
    </form>
  );
}

const STATUS_TONE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-teal-100 text-teal-800",
  REJECTED: "bg-rose-100 text-rose-700",
  WITHDRAWN: "bg-slate-100 text-slate-500",
};

export function OfferRow({
  id,
  title,
  valueInr,
  priceInr,
  validMonths,
  status,
  reviewNote,
  sold,
}: {
  id: string;
  title: string;
  valueInr: number;
  priceInr: number;
  validMonths: number;
  status: OfferStatus;
  reviewNote: string | null;
  sold: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const canSubmit =
    status === OfferStatus.DRAFT ||
    status === OfferStatus.REJECTED ||
    status === OfferStatus.WITHDRAWN;

  return (
    <li className="px-4 py-3.5 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-slate-900">{title}</p>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STATUS_TONE[status]}`}
            >
              {status.toLowerCase()}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Worth {money(valueInr)}, sold for {money(priceInr)} · valid{" "}
            {validMonths} months
            {sold > 0 && ` · ${sold} sold`}
          </p>
          {/* The reviewer's words, shown to the clinic. "Rejected" with no
              reason generates three emails and a phone call. */}
          {reviewNote && (
            <p className="mt-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              {reviewNote}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {canSubmit && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await submitOffer(id);
                  if (!res.ok) setError(res.error ?? "Could not submit that.");
                })
              }
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-slate-700 disabled:opacity-60"
            >
              <Send className="h-3.5 w-3.5" /> Send for review
            </button>
          )}
          {status === OfferStatus.APPROVED && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await withdrawOffer(id);
                  if (!res.ok) setError(res.error ?? "Could not withdraw that.");
                })
              }
              className="text-xs font-semibold text-slate-400 transition hover:text-rose-600 disabled:opacity-60"
            >
              Take off sale
            </button>
          )}
        </div>
      </div>
      {error && <p className="mt-2 text-xs font-semibold text-rose-600">{error}</p>}
    </li>
  );
}
