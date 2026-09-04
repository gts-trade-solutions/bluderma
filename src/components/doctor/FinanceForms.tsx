"use client";

import { useState, useTransition } from "react";
import { LoaderCircle, Trash2 } from "lucide-react";

import {
  deleteExpense,
  removeIncome,
  saveAsset,
  saveExpense,
  saveIncome,
} from "@/lib/actions/finance";
import { categoryLabel } from "@/lib/doctor/financeCore";
import { useFormValidation } from "@/hooks/useFormValidation";

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

/**
 * The cost categories, grouped the way the money page reads them.
 *
 * A flat list of ten is a list somebody scrolls; four labelled groups of two
 * or three is a list somebody chooses from. The groups match
 * COST_GROUP_LABEL in financeCore.ts, so what a practitioner picks here lands
 * in the line they will later read it on.
 */
const CATEGORY_GROUPS: { label: string; items: string[] }[] = [
  { label: "Infrastructure", items: ["RENT", "UTILITIES", "LAUNDRY", "MAINTENANCE"] },
  { label: "People", items: ["SALARY"] },
  { label: "Supplies", items: ["CONSUMABLES", "MEDICINES"] },
  { label: "Everything else", items: ["MARKETING", "TAX", "OTHER"] },
];

/** One line under the dropdown, so a category is chosen knowingly. */
const CATEGORY_HINT: Record<string, string> = {
  RENT: "The premises, or your share of them.",
  UTILITIES: "Electricity, water, internet, phone.",
  LAUNDRY: "Linen, gowns, towels — small and relentless.",
  MAINTENANCE: "Repairs, service contracts, AMC.",
  SALARY: "Wages and everything that goes with employing somebody.",
  CONSUMABLES: "Gloves, needles, gauze — what a procedure uses up.",
  MEDICINES: "Stock bought FOR the dispensary. This is the other half of your medicine sales: without it a practice looks like it makes pure profit on them.",
  MARKETING: "Advertising, listings, photography, print.",
  TAX: "GST, professional tax, statutory dues.",
  OTHER: "Anything that fits nowhere above.",
};

const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const field =
  "w-full rounded-xl border border-graphite-200 bg-white px-3.5 py-2.5 text-sm text-graphite-900 focus:border-azure-400 focus:outline-none";
const labelClass =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-graphite-500";

/** Recording a running cost. */
export function ExpenseForm({ clinics }: { clinics: ClinicOption[] }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const today = new Date().toISOString().slice(0, 10);
  const v = useFormValidation();
  // Watched so the headcount field can appear only where it means something.
  const [category, setCategory] = useState("RENT");

  return (
    <form
      ref={v.formRef}
      noValidate
      className="space-y-3"
      onSubmit={v.guard((fd, form) => {
        setError(null);
        start(async () => {
          const res = await saveExpense({
            category: String(fd.get("category") ?? "OTHER"),
            label: String(fd.get("label") ?? ""),
            amountInr: String(fd.get("amountInr") ?? ""),
            spentOn: String(fd.get("spentOn") ?? ""),
            clinicId: String(fd.get("clinicId") ?? ""),
            note: String(fd.get("note") ?? ""),
            headcount: String(fd.get("headcount") ?? ""),
          });
          if (!res.ok) setError(res.error ?? "Could not save that.");
          else form.reset();
        });
      })}
    >
      {v.summary}
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
          <select
            name="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={field}
          >
            {CATEGORY_GROUPS.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.items.map((c) => (
                  <option key={c} value={c}>
                    {categoryLabel(c)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {CATEGORY_HINT[category] && (
            <span className="mt-1.5 block text-xs leading-snug text-graphite-500">
              {CATEGORY_HINT[category]}
            </span>
          )}
        </label>
        <label className="block">
          <span className={labelClass}>Spent on</span>
          <input name="spentOn" type="date" required defaultValue={today} className={field} />
        </label>

        {/*
          Only on a salary row, and only because "₹1,42,000 on salaries" is a
          number nobody can act on. "Across 6 people" is the same fact with the
          comparison attached — what those six are billing — which is the
          question a practitioner actually has about their wage bill.
        */}
        {category === "SALARY" && (
          <label className="block sm:col-span-2">
            <span className={labelClass}>
              How many people does this cover{" "}
              <span className="normal-case tracking-normal">(if you want the per-head figure)</span>
            </span>
            <input
              name="headcount"
              inputMode="numeric"
              placeholder="6"
              className={field}
            />
            <span className="mt-1.5 block text-xs text-graphite-500">
              Receptionist, nurses, technicians, housekeeping — whoever this
              payment is for.
            </span>
          </label>
        )}
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
        <p className="rounded-xl border border-coral-200 bg-coral-50 px-4 py-2.5 text-sm text-coral-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-gold-500 px-6 py-2.5 text-sm font-extrabold text-graphite-900 shadow-flat transition hover:bg-gold-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-graphite-900 focus-visible:ring-offset-2"
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
  const v = useFormValidation();

  return (
    <form
      ref={v.formRef}
      noValidate
      className="space-y-3"
      onSubmit={v.guard((fd, form) => {
        setError(null);
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
      })}
    >
      {v.summary}
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
        <p className="rounded-xl border border-coral-200 bg-coral-50 px-4 py-2.5 text-sm text-coral-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-graphite-900 px-6 py-2.5 text-sm font-extrabold text-white transition hover:bg-graphite-700 disabled:opacity-60"
      >
        {pending && <LoaderCircle className="h-4 w-4 animate-spin" />}
        Add the machine
      </button>
    </form>
  );
}

/* ------------------------------- Income ---------------------------------- */

const INCOME_SOURCES = [
  "PRODUCT",
  "PACKAGE",
  "RENTAL",
  "PROFESSIONAL",
  "MISCELLANEOUS",
] as const;

const INCOME_LABEL: Record<string, string> = {
  PRODUCT: "Retail products",
  PACKAGE: "Treatment package",
  RENTAL: "Room or chair rental",
  PROFESSIONAL: "Professional work",
  MISCELLANEOUS: "Miscellaneous",
};

const INCOME_HINT: Record<string, string> = {
  PRODUCT: "Sunscreen, cleansers, supplements sold over the counter.",
  PACKAGE: "A course paid for up front, where the sessions have not happened yet.",
  RENTAL: "A room, a chair or a machine let to another practitioner.",
  PROFESSIONAL: "Talks, training, medico-legal work, second opinions.",
  MISCELLANEOUS: "Anything that fits nowhere above.",
};

export interface IncomeRow {
  id: string;
  source: string;
  label: string;
  amountInr: number;
  receivedOn: string;
  clinicName: string | null;
}

/**
 * Money in that was not a consultation.
 *
 * The warning is the important part of this form. Bookings, medicine orders
 * and machine charges are already counted from their own records, so anything
 * entered here that duplicates one of them makes the revenue figure quietly
 * too high — which is worse than one that is honestly too low, because it is
 * the version nobody checks.
 */
export function IncomeForm({ clinics }: { clinics: ClinicOption[] }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [source, setSource] = useState("PRODUCT");
  const today = new Date().toISOString().slice(0, 10);
  const v = useFormValidation();

  return (
    <form
      ref={v.formRef}
      noValidate
      className="space-y-3"
      onSubmit={v.guard((fd, form) => {
        setError(null);
        start(async () => {
          const res = await saveIncome({
            source: String(fd.get("source") ?? "MISCELLANEOUS"),
            label: String(fd.get("label") ?? ""),
            amountInr: String(fd.get("amountInr") ?? ""),
            receivedOn: String(fd.get("receivedOn") ?? ""),
            clinicId: String(fd.get("clinicId") ?? ""),
            note: String(fd.get("note") ?? ""),
          });
          if (!res.ok) setError(res.error ?? "Could not save that.");
          else form.reset();
        });
      })}
    >
      {v.summary}

      <p className="rounded-xl border border-gold-200 bg-gold-50 px-3.5 py-2.5 text-xs leading-relaxed text-gold-900">
        <strong className="font-bold">Only what is not counted already.</strong>{" "}
        Consultations come from your bookings, medicine sales from your orders,
        and procedure charges from the machine they were done on. Putting one of
        those here counts it twice.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>What was it for</span>
          <input name="label" required placeholder="Sunscreen and cleanser, retail" className={field} />
        </label>
        <label className="block">
          <span className={labelClass}>Amount</span>
          <input name="amountInr" required inputMode="numeric" placeholder="4500" className={field} />
        </label>
        <label className="block">
          <span className={labelClass}>Kind</span>
          <select
            name="source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className={field}
          >
            {INCOME_SOURCES.map((k) => (
              <option key={k} value={k}>
                {INCOME_LABEL[k]}
              </option>
            ))}
          </select>
          {INCOME_HINT[source] && (
            <span className="mt-1.5 block text-xs leading-snug text-graphite-500">
              {INCOME_HINT[source]}
            </span>
          )}
        </label>
        <label className="block">
          <span className={labelClass}>Received on</span>
          <input name="receivedOn" type="date" required defaultValue={today} className={field} />
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
        <p className="rounded-xl border border-coral-200 bg-coral-50 px-4 py-2.5 text-sm text-coral-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-graphite-900 px-6 py-2.5 text-sm font-extrabold text-white transition hover:bg-graphite-700 disabled:opacity-60"
      >
        {pending && <LoaderCircle className="h-4 w-4 animate-spin" />}
        Record it
      </button>
    </form>
  );
}

/** One recorded income entry. */
export function IncomeRowItem({ row }: { row: IncomeRow }) {
  const [pending, start] = useTransition();

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-graphite-900">{row.label}</p>
        <p className="text-xs text-graphite-500">
          {INCOME_LABEL[row.source] ?? row.source} · {row.receivedOn}
          {row.clinicName ? ` · ${row.clinicName}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="text-sm font-bold tabular-nums text-mint-800">
          {money(row.amountInr)}
        </span>
        <button
          type="button"
          aria-label="Remove this entry"
          disabled={pending}
          onClick={() => start(async () => void (await removeIncome(row.id)))}
          className="text-graphite-400 transition hover:text-coral-600 disabled:opacity-60"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}

/** One recorded cost, with the means to remove a mistyped one. */
export function ExpenseRowItem({ row }: { row: ExpenseRow }) {
  const [pending, start] = useTransition();

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-graphite-900">{row.label}</p>
        <p className="text-xs text-graphite-500">
          {categoryLabel(row.category)} · {row.spentOn}
          {row.clinicName ? ` · ${row.clinicName}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="text-sm font-bold tabular-nums text-graphite-900">
          {money(row.amountInr)}
        </span>
        <button
          type="button"
          aria-label="Remove this entry"
          disabled={pending}
          onClick={() => start(async () => void (await deleteExpense(row.id)))}
          className="text-graphite-400 transition hover:text-coral-600 disabled:opacity-60"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}
