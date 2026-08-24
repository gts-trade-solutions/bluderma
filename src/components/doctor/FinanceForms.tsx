"use client";

import { useState, useTransition } from "react";
import { LoaderCircle, Trash2 } from "lucide-react";

import { deleteExpense, saveAsset, saveExpense } from "@/lib/actions/finance";
import { categoryLabel } from "@/lib/doctor/financeCore";

export interface ClinicOption {
  id: string;
  name: string;
}

export interface ExpenseRow {
  id: string;
  category: string;
  label: string;
  amountInr: number;
  spentOn: string;
  clinicName: string | null;
}

const CATEGORIES = [
  "RENT",
  "SALARY",
  "CONSUMABLES",
  "MARKETING",
  "UTILITIES",
  "MAINTENANCE",
  "TAX",
  "OTHER",
] as const;

const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const field =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-brand-400 focus:outline-none";
const labelClass =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500";

/** Recording a running cost. */
export function ExpenseForm({ clinics }: { clinics: ClinicOption[] }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const form = e.currentTarget;
        const fd = new FormData(form);
        start(async () => {
          const res = await saveExpense({
            category: String(fd.get("category") ?? "OTHER"),
            label: String(fd.get("label") ?? ""),
            amountInr: String(fd.get("amountInr") ?? ""),
            spentOn: String(fd.get("spentOn") ?? ""),
            clinicId: String(fd.get("clinicId") ?? ""),
            note: String(fd.get("note") ?? ""),
          });
          if (!res.ok) setError(res.error ?? "Could not save that.");
          else form.reset();
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>What was it for</span>
          <input name="label" required placeholder="Clinic rent, August" className={field} />
        </label>
        <label className="block">
          <span className={labelClass}>Amount</span>
          <input name="amountInr" required inputMode="numeric" placeholder="60000" className={field} />
        </label>
        <label className="block">
          <span className={labelClass}>Category</span>
          <select name="category" defaultValue="OTHER" className={field}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {categoryLabel(c)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelClass}>Spent on</span>
          <input name="spentOn" type="date" required defaultValue={today} className={field} />
        </label>
        {clinics.length > 1 && (
          <label className="block sm:col-span-2">
            <span className={labelClass}>
              Which location{" "}
              <span className="normal-case tracking-normal">(optional)</span>
            </span>
            <select name="clinicId" defaultValue="" className={field}>
              <option value="">Across the practice</option>
              {clinics.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

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

/** Registering a machine, so its recovery can be tracked. */
export function AssetForm({ clinics }: { clinics: ClinicOption[] }) {
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
          const res = await saveAsset({
            name: String(fd.get("name") ?? ""),
            purpose: String(fd.get("purpose") ?? ""),
            costInr: String(fd.get("costInr") ?? ""),
            upkeepInr: String(fd.get("upkeepInr") ?? ""),
            purchasedOn: String(fd.get("purchasedOn") ?? ""),
            clinicId: String(fd.get("clinicId") ?? ""),
          });
          if (!res.ok) setError(res.error ?? "Could not save that.");
          else form.reset();
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Machine</span>
          <input name="name" required placeholder="Fractional CO2 laser" className={field} />
        </label>
        <label className="block">
          <span className={labelClass}>
            What it is for{" "}
            <span className="normal-case tracking-normal">(optional)</span>
          </span>
          <input name="purpose" placeholder="Resurfacing, scar revision" className={field} />
        </label>
        <label className="block">
          <span className={labelClass}>What it cost</span>
          <input name="costInr" required inputMode="numeric" placeholder="500000" className={field} />
        </label>
        <label className="block">
          <span className={labelClass}>
            Yearly upkeep{" "}
            <span className="normal-case tracking-normal">(optional)</span>
          </span>
          {/* Counted into what has to be recovered, because a service contract
              is money the machine has to earn back too. */}
          <input name="upkeepInr" inputMode="numeric" placeholder="40000" className={field} />
        </label>
        <label className="block">
          <span className={labelClass}>Bought on</span>
          <input name="purchasedOn" type="date" required className={field} />
        </label>
        {clinics.length > 1 && (
          <label className="block">
            <span className={labelClass}>
              Where it lives{" "}
              <span className="normal-case tracking-normal">(optional)</span>
            </span>
            <select name="clinicId" defaultValue="" className={field}>
              <option value="">Not tied to one</option>
              {clinics.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

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
        Add the machine
      </button>
    </form>
  );
}

/** One recorded cost, with the means to remove a mistyped one. */
export function ExpenseRowItem({ row }: { row: ExpenseRow }) {
  const [pending, start] = useTransition();

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-900">{row.label}</p>
        <p className="text-xs text-slate-500">
          {categoryLabel(row.category)} · {row.spentOn}
          {row.clinicName ? ` · ${row.clinicName}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="text-sm font-bold tabular-nums text-slate-900">
          {money(row.amountInr)}
        </span>
        <button
          type="button"
          aria-label="Remove this entry"
          disabled={pending}
          onClick={() => start(async () => void (await deleteExpense(row.id)))}
          className="text-slate-300 transition hover:text-rose-600 disabled:opacity-60"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}
