"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { AdminResult } from "@/lib/admin/form";

export default function NoteForm({
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
        setError(res.error ?? "Could not save the note.");
        return;
      }
      formRef.current?.reset();
      router.refresh();
    });
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-2">
      <textarea
        name="body"
        rows={3}
        required
        placeholder="Add a note — a call summary, next step, anything the team should see."
        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
      />
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <button type="submit" disabled={pending} className="btn-primary !py-2 text-sm disabled:opacity-60">
        {pending ? "Saving…" : "Add note"}
      </button>
    </form>
  );
}
