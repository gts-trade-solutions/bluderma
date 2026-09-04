"use client";

import { useEffect, useState } from "react";

/**
 * A dashboard section that can be put away.
 *
 * ── Why ──────────────────────────────────────────────────────────────────
 * The dashboard grew to fourteen panels on one scroll. Every one of them
 * earns its place — the client asked for none of them to go — but they are
 * not all wanted at once: the money and the sellable week are read daily, the
 * demand mix and the listing checklist are read monthly, and putting all five
 * sections on screen at full height meant the daily half was three scrolls
 * deep by lunchtime.
 *
 * So the monthly sections fold. Closed, each one still says what is inside it
 * in a sentence of real figures — a fold that hides the answer AND the
 * question is just a thing to click.
 *
 * ── The state is remembered ──────────────────────────────────────────────
 * Per section, in localStorage, because "I always look at my clients" is a
 * habit and re-closing a section every morning is the software arguing with
 * it. Read in an effect rather than during render: the server has no
 * localStorage, and reading it inline is a hydration mismatch.
 *
 * Storage can throw outright in private browsing. A remembered preference is
 * not worth a blank dashboard, so every access is wrapped and the default
 * stands if it fails.
 */
export default function Fold({
  title,
  sub,
  summary,
  storageKey,
  defaultOpen = false,
  children,
}: {
  title: string;
  /** The same sentence the open section would carry. */
  sub?: string;
  /** What is inside, in figures, for when it is shut. */
  summary?: string;
  /** Suffix of the localStorage key. One per section. */
  storageKey: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const key = `bd-fold-${storageKey}`;
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved === "open") setOpen(true);
      else if (saved === "shut") setOpen(false);
    } catch {
      /* no storage — the default stands */
    }
  }, [key]);

  function toggle() {
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem(key, next ? "open" : "shut");
    } catch {
      /* nothing to remember it with */
    }
  }

  return (
    <section className="mb-5">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="group flex w-full items-center gap-3 rounded-[10px] border border-graphite-200 bg-white px-4 py-3 text-left shadow-flat transition hover:border-graphite-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-azure-500 focus-visible:ring-offset-2"
      >
        <span className="min-w-0 flex-1">
          <span className="block font-portal text-xl font-extrabold tracking-[-0.03em] text-graphite-900 sm:text-2xl">
            {title}
          </span>
          <span className="mt-0.5 block text-sm leading-relaxed text-graphite-600">
            {open ? sub : (summary ?? sub)}
          </span>
        </span>
        <span
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-graphite-100 text-graphite-700 transition group-hover:bg-graphite-200 ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </button>

      {/* Unmounted rather than hidden. These panels each mount a chart, and
          recharts measures the DOM — a chart rendered inside `display: none`
          measures 0x0 and comes back empty when the section is opened. */}
      {open && <div className="mt-3.5">{children}</div>}
    </section>
  );
}
