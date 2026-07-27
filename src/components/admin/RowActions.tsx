"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { AdminResult } from "@/lib/admin/form";

export function DeleteButton({
  action,
  label = "Delete",
  confirmText,
}: {
  action: () => Promise<AdminResult>;
  label?: string;
  /** What the user is about to lose — shown in the confirm step. */
  confirmText: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) {
        setError(res.error ?? "Could not delete.");
        setConfirming(false);
        return;
      }
      router.refresh();
    });
  }

  if (error) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="text-xs font-medium text-rose-600">{error}</span>
        <button
          onClick={() => setError(null)}
          className="text-xs font-semibold text-ink-muted hover:text-ink"
        >
          Dismiss
        </button>
      </span>
    );
  }

  // Two-step rather than window.confirm — no native dialog, and the row shows
  // exactly what is about to go.
  if (confirming) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="text-xs text-ink-muted">Delete {confirmText}?</span>
        <button
          onClick={run}
          disabled={pending}
          className="rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
        >
          {pending ? "Deleting…" : "Yes, delete"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs font-semibold text-ink-muted hover:text-ink"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-xs font-semibold text-rose-600 hover:text-rose-700"
    >
      {label}
    </button>
  );
}

export function ToggleButton({
  action,
  active,
  activeLabel = "Published",
  inactiveLabel = "Draft",
}: {
  action: (next: boolean) => Promise<AdminResult>;
  active: boolean;
  activeLabel?: string;
  inactiveLabel?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await action(!active);
          router.refresh();
        })
      }
      title={active ? "Click to unpublish" : "Click to publish"}
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold transition disabled:opacity-50 ${
        active
          ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      }`}
    >
      {active ? activeLabel : inactiveLabel}
    </button>
  );
}

/**
 * Generic two-step confirm button for an arbitrary server action (approve,
 * reject, …). Same confirm-then-run pattern as DeleteButton, with a tone.
 */
export function ConfirmButton({
  action,
  label,
  confirmText,
  tone = "primary",
}: {
  action: () => Promise<AdminResult>;
  label: string;
  confirmText: string;
  tone?: "primary" | "danger";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const solid =
    tone === "danger"
      ? "bg-rose-600 hover:bg-rose-700"
      : "bg-brand-600 hover:bg-brand-700";
  const text = tone === "danger" ? "text-rose-600 hover:text-rose-700" : "text-brand-600 hover:text-brand-700";

  function run() {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) {
        setError(res.error ?? "Could not complete.");
        setConfirming(false);
        return;
      }
      router.refresh();
    });
  }

  if (error) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="text-xs font-medium text-rose-600">{error}</span>
        <button
          onClick={() => setError(null)}
          className="text-xs font-semibold text-ink-muted hover:text-ink"
        >
          Dismiss
        </button>
      </span>
    );
  }

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="text-xs text-ink-muted">{confirmText}?</span>
        <button
          onClick={run}
          disabled={pending}
          className={`rounded-full px-3 py-1 text-xs font-semibold text-white disabled:opacity-60 ${solid}`}
        >
          {pending ? "…" : "Confirm"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs font-semibold text-ink-muted hover:text-ink"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className={`text-xs font-semibold ${text}`}
    >
      {label}
    </button>
  );
}

export function EditLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="text-xs font-semibold text-brand-600 hover:text-brand-700"
    >
      Edit
    </Link>
  );
}
