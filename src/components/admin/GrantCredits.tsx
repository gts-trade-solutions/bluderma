"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { AdminResult } from "@/lib/admin/form";

/** Granting scan credits to a client, with the reason it took. */
export default function GrantCredits({
  clients,
  action,
}: {
  clients: { id: string; name: string | null; email: string }[];
  action: (formData: FormData) => Promise<AdminResult>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(formData) => {
        setError(null);
        setDone(false);
        startTransition(async () => {
          const res = await action(formData);
          if (!res.ok) {
            setError(res.error ?? "Could not grant that credit.");
            return;
          }
          setDone(true);
          router.refresh();
        });
      }}
      className="flex flex-wrap items-end gap-3"
    >
      <label className="min-w-[16rem] flex-1">
        <span className="mb-1 block text-xs font-semibold text-slate-600">
          Client
        </span>
        <select
          name="userId"
          required
          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
        >
          <option value="">Pick a client…</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name ? `${c.name} — ${c.email}` : c.email}
            </option>
          ))}
        </select>
      </label>

      <label className="w-24">
        <span className="mb-1 block text-xs font-semibold text-slate-600">
          How many
        </span>
        <input
          type="number"
          name="count"
          min={1}
          max={20}
          defaultValue={1}
          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
        />
      </label>

      <label className="min-w-[14rem] flex-1">
        <span className="mb-1 block text-xs font-semibold text-slate-600">
          Reason
        </span>
        <input
          type="text"
          name="reason"
          required
          placeholder="Scan failed on 12 Aug — re-issued"
          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
      >
        {pending ? "Granting…" : "Grant"}
      </button>

      {error && (
        <p className="w-full text-xs font-medium text-rose-700">{error}</p>
      )}
      {done && !error && (
        <p className="w-full text-xs font-medium text-teal-700">
          Credit granted — the client can start an analysis now.
        </p>
      )}
    </form>
  );
}
