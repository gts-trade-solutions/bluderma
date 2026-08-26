"use client";

import { useState, useTransition } from "react";
import { LoaderCircle, Trash2 } from "lucide-react";

import { adjustStock, retireMedicine, saveMedicine } from "@/lib/actions/medicines";
import { useFormValidation } from "@/hooks/useFormValidation";

const field =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none";
const labelClass =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500";

const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export default function MedicineForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const v = useFormValidation();

  return (
    <form
      ref={v.formRef}
      noValidate
      className="space-y-3"
      onSubmit={v.guard((fd, form) => {
        setError(null);
        start(async () => {
          const res = await saveMedicine({
            name: String(fd.get("name") ?? ""),
            brand: String(fd.get("brand") ?? ""),
            form: String(fd.get("form") ?? ""),
            strength: String(fd.get("strength") ?? ""),
            priceInr: String(fd.get("priceInr") ?? ""),
            mrpInr: String(fd.get("mrpInr") ?? ""),
            stock: String(fd.get("stock") ?? ""),
            lowStockAt: String(fd.get("lowStockAt") ?? ""),
            about: String(fd.get("about") ?? ""),
            prescriptionOnly: fd.get("prescriptionOnly") === "on",
          });
          if (!res.ok) setError(res.error ?? "Could not save that.");
          else form.reset();
        });
      })}
    >
      {v.summary}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block">
            <span className={labelClass}>Medicine</span>
            <input name="name" required placeholder="Tretinoin cream" className={field} />
          </label>
        </div>
        <label className="block">
          <span className={labelClass}>Brand</span>
          <input name="brand" placeholder="Optional" className={field} />
        </label>
        <label className="block">
          <span className={labelClass}>Form</span>
          <input name="form" placeholder="Cream, tablet" className={field} />
        </label>
        <label className="block">
          <span className={labelClass}>Strength</span>
          <input name="strength" placeholder="0.025%" className={field} />
        </label>
        <label className="block">
          <span className={labelClass}>Price</span>
          <input name="priceInr" required inputMode="numeric" placeholder="420" className={field} />
        </label>
        <label className="block">
          <span className={labelClass}>MRP</span>
          <input name="mrpInr" inputMode="numeric" placeholder="Optional" className={field} />
        </label>
        <label className="block">
          <span className={labelClass}>
            Stock <span className="normal-case tracking-normal">(optional)</span>
          </span>
          {/* Left blank means the practice does not count this one, which is
              different from having none of it. */}
          <input name="stock" inputMode="numeric" placeholder="Leave blank if untracked" className={field} />
        </label>
        <label className="block">
          <span className={labelClass}>
            Warn me at{" "}
            <span className="normal-case tracking-normal">(optional)</span>
          </span>
          <input name="lowStockAt" inputMode="numeric" placeholder="e.g. 5" className={field} />
          <span className="mt-1.5 block text-xs text-slate-500">
            The list flags it at or below this. Set it to however many days of
            dispensing it takes to reorder.
          </span>
        </label>
        <div className="sm:col-span-2">
          <label className="block">
            <span className={labelClass}>
              Notes for the patient{" "}
              <span className="normal-case tracking-normal">(optional)</span>
            </span>
            <input name="about" placeholder="Apply at night, avoid sun" className={field} />
          </label>
        </div>
      </div>

      <label className="flex items-center gap-2.5 text-sm text-slate-600">
        <input
          type="checkbox"
          name="prescriptionOnly"
          defaultChecked
          className="h-4 w-4 rounded border-slate-300"
        />
        {/* Default on, deliberately. It changes what the patient is asked for
            at checkout, and the safe default is to ask. */}
        Needs a prescription
      </label>

      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-gradient-to-r from-brand-600 to-teal-600 px-6 py-2.5 text-sm font-extrabold text-white transition hover:from-brand-700 hover:to-teal-700 disabled:opacity-60"
      >
        {pending && <LoaderCircle className="h-4 w-4 animate-spin" />}
        Add it
      </button>
    </form>
  );
}

/** The reasons a practitioner picks from. ORDER and ORDER_CANCELLED are
 *  written by the order flow itself and are deliberately not offered here. */
const ADJUST_REASONS: { value: string; label: string; sign: 1 | -1 }[] = [
  { value: "RECEIVED", label: "Delivery received", sign: 1 },
  { value: "DISPENSED", label: "Dispensed in clinic", sign: -1 },
  { value: "EXPIRED", label: "Expired", sign: -1 },
  { value: "DAMAGED", label: "Damaged or lost", sign: -1 },
  { value: "CORRECTION", label: "Counted and corrected", sign: 1 },
];

export function MedicineRow({
  row,
}: {
  row: {
    id: string;
    name: string;
    brand: string | null;
    form: string | null;
    strength: string | null;
    priceInr: number;
    mrpInr: number | null;
    stock: number | null;
    lowStockAt: number | null;
    prescriptionOnly: boolean;
  };
}) {
  const [pending, start] = useTransition();
  const [adjusting, setAdjusting] = useState(false);
  const [reason, setReason] = useState("RECEIVED");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const low =
    row.stock !== null && row.lowStockAt !== null && row.stock <= row.lowStockAt;
  const out = row.stock === 0;

  const sign = ADJUST_REASONS.find((r) => r.value === reason)?.sign ?? 1;
  // A correction can go either way, so it is the one reason that takes a
  // signed number. Everything else has an obvious direction and asking for a
  // minus sign on "dispensed 2" is a way to get "-2" typed as "2".
  const signed = reason === "CORRECTION";

  function submit() {
    setError(null);
    const n = Math.round(Number(qty));
    if (!Number.isFinite(n) || n === 0) {
      setError("How many?");
      return;
    }
    start(async () => {
      const res = await adjustStock({
        medicineId: row.id,
        delta: signed ? n : Math.abs(n) * sign,
        reason,
        note,
      });
      if (res.ok) {
        setAdjusting(false);
        setQty("");
        setNote("");
      } else {
        setError(res.error ?? "Could not record that.");
      }
    });
  }

  return (
    <li className="px-4 py-3.5 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900">
            {row.name}
            {row.strength && (
              <span className="ml-1.5 font-medium text-slate-500">{row.strength}</span>
            )}
          </p>
          <p className="text-xs text-slate-500">
            {[row.brand, row.form].filter(Boolean).join(" · ") || "No brand given"}
            {row.prescriptionOnly && (
              <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                Rx
              </span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-bold tabular-nums text-slate-900">
              {money(row.priceInr)}
            </p>
            {/* "Not tracked" and "none left" are different facts and are said
                differently. The warning only appears where the practitioner
                asked for one by setting a level. */}
            <p
              className={`text-[11px] font-semibold ${
                out
                  ? "text-rose-600"
                  : low
                    ? "text-amber-700"
                    : "text-slate-400"
              }`}
            >
              {row.stock === null
                ? "stock untracked"
                : out
                  ? "none left"
                  : `${row.stock} left${low ? " · running low" : ""}`}
            </p>
          </div>
          {row.stock !== null && (
            <button
              type="button"
              onClick={() => setAdjusting((v) => !v)}
              className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-600 transition hover:border-brand-300 hover:text-brand-700"
            >
              Stock
            </button>
          )}
          <button
            type="button"
            aria-label={`Delist ${row.name}`}
            disabled={pending}
            onClick={() => start(async () => void (await retireMedicine(row.id)))}
            className="text-slate-300 transition hover:text-rose-600 disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {adjusting && row.stock !== null && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_7rem]">
            <label className="block">
              <span className={labelClass}>What happened</span>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className={field}
              >
                {ADJUST_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={labelClass}>{signed ? "Change by" : "How many"}</span>
              <input
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                inputMode="numeric"
                placeholder={signed ? "-2 or 5" : "12"}
                className={field}
              />
            </label>
          </div>

          {/* A correction is the one reason that means "the software and the
              shelf disagreed". Without a note it is the row that makes the
              whole ledger untrustworthy six months later, so the action
              refuses one and the form says so before it is pressed. */}
          {reason === "CORRECTION" && (
            <label className="mt-2 block">
              <span className={labelClass}>Why the count changed</span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Monthly count — two tubes unaccounted for"
                className={field}
              />
            </label>
          )}

          {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}

          <div className="mt-2.5 flex items-center gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-slate-700 disabled:opacity-60"
            >
              {pending && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
              Record it
            </button>
            <button
              type="button"
              onClick={() => setAdjusting(false)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800"
            >
              Cancel
            </button>
            <span className="ml-auto text-[11px] text-slate-400">
              Every change is logged, with who and when.
            </span>
          </div>
        </div>
      )}
    </li>
  );
}
