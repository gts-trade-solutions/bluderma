"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { AdminResult } from "@/lib/admin/form";

const KINDS = [
  { value: "BEFORE_AFTER", label: "Before & after" },
  { value: "RESULT", label: "Result" },
  { value: "HOW_IT_WORKS", label: "How it works" },
  { value: "GALLERY", label: "Gallery" },
  { value: "HERO", label: "Hero (hidden from gallery)" },
];

export default function TreatmentImageForm({
  action,
}: {
  action: (formData: FormData) => Promise<AdminResult>;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const res = await action(formData);
      if (!res.ok) {
        setError(res.error ?? "Could not add the image.");
        return;
      }
      formRef.current?.reset();
      router.refresh();
    });
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
      {error && (
        <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-inset ring-rose-100">
          {error}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-ink">Type</span>
          <select
            name="kind"
            defaultValue="BEFORE_AFTER"
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          >
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-ink">
            Sort order
          </span>
          <input
            name="sortOrder"
            type="number"
            min={0}
            defaultValue={0}
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
        </label>
      </div>
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-ink">
          Image URL
        </span>
        <input
          name="url"
          required
          placeholder="https://…"
          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-ink">
          Caption <span className="font-normal text-ink-muted">(optional)</span>
        </span>
        <input
          name="caption"
          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        />
      </label>
      <button type="submit" disabled={pending} className="btn-primary !py-2 text-sm disabled:opacity-60">
        {pending ? "Adding…" : "Add image"}
      </button>
    </form>
  );
}
