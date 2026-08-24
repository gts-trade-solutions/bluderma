"use client";

import { useState, useTransition } from "react";
import { LoaderCircle, Trash2 } from "lucide-react";

import { retireMedicine, saveMedicine } from "@/lib/actions/medicines";

const field =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none";
const labelClass =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500";

const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export default function MedicineForm() {
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
          const res = await saveMedicine({
            name: String(fd.get("name") ?? ""),
            brand: String(fd.get("brand") ?? ""),
            form: String(fd.get("form") ?? ""),
            strength: String(fd.get("strength") ?? ""),
            priceInr: String(fd.get("priceInr") ?? ""),
            mrpInr: String(fd.get("mrpInr") ?? ""),
            stock: String(fd.get("stock") ?? ""),
            about: String(fd.get("about") ?? ""),
            prescriptionOnly: fd.get("prescriptionOnly") === "on",
          });
          if (!res.ok) setError(res.error ?? "Could not save that.");
          else form.reset();
        });
      }}
    >
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
    prescriptionOnly: boolean;
  };
}) {
  const [pending, start] = useTransition();

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
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
              differently. */}
          <p className="text-[11px] text-slate-400">
            {row.stock === null ? "stock untracked" : `${row.stock} left`}
          </p>
        </div>
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
    </li>
  );
}
