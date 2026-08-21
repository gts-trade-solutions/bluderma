"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { PERIOD_OPTIONS, type DashboardPeriod } from "@/lib/doctor/metrics";

/**
 * Which window the money figures cover.
 *
 * State lives in the URL rather than in React, for three reasons: the
 * dashboard is a server component and the figures have to be recomputed on the
 * server anyway; a doctor can bookmark or send "my July"; and the browser Back
 * button then does the obvious thing instead of leaving the portal.
 *
 * A plain `<select>`, not a bespoke menu. It is one of the few controls a
 * phone renders better natively than anything we could build, and this portal
 * is used on a phone between patients.
 */
export default function PeriodPicker({ value }: { value: DashboardPeriod }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function choose(next: string) {
    const q = new URLSearchParams(params.toString());
    // The default is not written to the URL — a clean /doctor/portal should
    // stay clean, and an absent param already means "this month".
    if (next === "this-month") q.delete("period");
    else q.set("period", next);
    const qs = q.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  }

  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">Show figures for</span>
      <select
        value={value}
        onChange={(e) => choose(e.target.value)}
        disabled={pending}
        className="appearance-none rounded-full border border-white/10 bg-white py-2 pl-4 pr-9 text-sm font-bold text-ink-soft transition hover:bg-white/[0.04] focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60"
      >
        {PERIOD_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span
        aria-hidden
        className="pointer-events-none absolute right-3.5 text-[10px] text-ink-muted"
      >
        ▼
      </span>
    </label>
  );
}
