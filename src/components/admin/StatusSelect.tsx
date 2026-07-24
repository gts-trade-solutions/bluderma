"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { AdminResult } from "@/lib/admin/form";

/**
 * Inline dropdown that fires a server action on change. Optimistic label with a
 * revert if the action fails, so a rejected status change doesn't leave the UI
 * lying about the stored value.
 */
export default function StatusSelect({
  value,
  options,
  action,
  className = "",
}: {
  value: string;
  options: { value: string; label: string }[];
  action: (next: string) => Promise<AdminResult>;
  className?: string;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(value);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onChange(next: string) {
    const previous = current;
    setCurrent(next);
    setError(null);
    startTransition(async () => {
      const res = await action(next);
      if (!res.ok) {
        setCurrent(previous);
        setError(res.error ?? "Could not update.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <select
        value={current}
        disabled={pending}
        onChange={(e) => onChange(e.target.value)}
        className={`rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-ink outline-none transition focus:border-brand-400 disabled:opacity-60 ${className}`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <span className="text-[11px] text-rose-600">{error}</span>}
    </span>
  );
}
