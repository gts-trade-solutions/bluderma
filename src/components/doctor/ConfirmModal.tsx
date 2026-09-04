"use client";

import { useEffect, useRef } from "react";

/**
 * The last look before something reaches a patient.
 *
 * ── Why a modal and not an inline confirm ────────────────────────────────
 * The things this guards — issuing a sheet of clinical instructions, sending
 * a prescription — are one-way. They land in somebody's record and, in most
 * cases, in their inbox, and there is no unsend. A button that does that
 * straight from a long form is a button pressed by somebody who has been
 * scrolling for two minutes and has stopped reading.
 *
 * So the form is covered, the details are restated on their own, and the
 * confirmation is a separate deliberate act with the patient's name in it.
 *
 * ── The behaviour it is careful about ────────────────────────────────────
 *  - Escape and a click on the backdrop both close it. A dialog somebody
 *    cannot leave is a trap, and this one is shown mid-clinic.
 *  - Focus moves into the panel on open and returns to whatever opened it on
 *    close, so a keyboard user is not dropped back at the top of the page.
 *  - The page behind it stops scrolling, because a modal over a moving page
 *    on a phone is how a doctor loses their place in a form.
 *  - The confirm button is NOT autofocused. Enter is the most-pressed key on
 *    a form and this is the one place it must not fire by momentum.
 */

export default function ConfirmModal({
  open,
  title,
  /** One line: what is about to happen, and to whom. */
  lead,
  /** The details being confirmed. Restated here rather than referred to. */
  children,
  confirmLabel,
  cancelLabel = "Go back",
  tone = "brand",
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  lead?: string;
  children?: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** `danger` for anything that cannot be undone AND removes something. */
  tone?: "brand" | "danger";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    returnTo.current = document.activeElement as HTMLElement | null;
    // The panel itself, not the confirm button: see the note above about
    // Enter being pressed by momentum.
    panel.current?.focus();

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      returnTo.current?.focus?.();
    };
  }, [open, busy, onCancel]);

  if (!open) return null;

  const confirmClass =
    tone === "danger"
      ? "bg-coral-600 hover:bg-coral-700 shadow-[0_6px_18px_-6px_rgba(225,29,72,0.7)]"
      : "bg-azure-600 hover:bg-azure-700 shadow-[0_6px_18px_-6px_rgba(31,111,214,0.7)]";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-graphite-900/60 backdrop-blur-sm"
        onClick={() => !busy && onCancel()}
        aria-hidden
      />

      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="theme-light relative z-10 w-full max-w-lg animate-scale-in overflow-hidden rounded-[10px] bg-white shadow-flat outline-none ring-1 ring-graphite-900/10"
      >
        <div className="flex items-start justify-between gap-4 border-b border-graphite-100 px-5 py-4">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-extrabold tracking-[-0.02em] text-graphite-900">
              {title}
            </h2>
            {lead && (
              <p className="mt-0.5 text-sm leading-relaxed text-graphite-600">{lead}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            aria-label="Close"
            className="-mr-1 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-graphite-500 transition hover:bg-graphite-100 hover:text-graphite-700 disabled:opacity-50"
          >
            ×
          </button>
        </div>

        {children && (
          <div className="max-h-[55vh] overflow-y-auto px-5 py-4">{children}</div>
        )}

        <div className="flex flex-wrap items-center gap-2.5 border-t border-graphite-100 bg-graphite-50/70 px-5 py-3.5">
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`inline-flex min-h-10 items-center gap-2 rounded-full px-5 py-2 text-sm font-extrabold text-white transition disabled:opacity-60 ${confirmClass}`}
          >
            {busy && (
              <span
                aria-hidden
                className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"
              />
            )}
            {busy ? "Sending…" : confirmLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-full px-4 py-2 text-sm font-bold text-graphite-600 transition hover:bg-graphite-100 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** A label/value line, for the details inside a confirmation. */
export function ConfirmRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5 border-b border-graphite-100 py-2 last:border-0">
      <dt className="w-32 shrink-0 text-xs font-bold uppercase tracking-wide text-graphite-500">
        {label}
      </dt>
      <dd className="min-w-0 flex-1 text-sm text-graphite-800">{children}</dd>
    </div>
  );
}
