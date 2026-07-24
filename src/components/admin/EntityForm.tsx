"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { AdminResult } from "@/lib/admin/form";
import { FieldErrorContext } from "./formContext";
import { Alert } from "./ui";

export default function EntityForm({
  action,
  submitLabel = "Save changes",
  cancelHref,
  redirectTo,
  children,
}: {
  action: (formData: FormData) => Promise<AdminResult>;
  submitLabel?: string;
  cancelHref: string;
  /** Where to go after a successful save. Stays put when omitted. */
  redirectTo?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    setFields({});
    setSaved(false);

    startTransition(async () => {
      const res = await action(formData);
      if (!res.ok) {
        setError(res.error ?? "Could not save.");
        setFields(res.fields ?? {});
        // Send focus back to the top so the message isn't missed on a long form.
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      setSaved(true);
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    });
  }

  return (
    <FieldErrorContext.Provider value={fields}>
      <form onSubmit={onSubmit} className="space-y-6">
        {error && <Alert>{error}</Alert>}
        {saved && !error && <Alert tone="success">Saved.</Alert>}

        {children}

        <div className="flex items-center gap-3 border-t border-slate-100 pt-5">
          <button
            type="submit"
            disabled={pending}
            className="btn-primary disabled:opacity-60"
          >
            {pending ? "Saving…" : submitLabel}
          </button>
          <Link href={cancelHref} className="btn-ghost">
            Cancel
          </Link>
        </div>
      </form>
    </FieldErrorContext.Provider>
  );
}
