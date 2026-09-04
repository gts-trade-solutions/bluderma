"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import Link from "next/link";

/**
 * A guided walk through the dashboard, over demo figures.
 *
 * ── Coach marks, not a slideshow ─────────────────────────────────────────
 * Each step scrolls the real section into view, cuts a hole in the dimming
 * layer around it and puts one short paragraph beside it. The practitioner is
 * reading the actual dashboard the whole time — the same panels, the same
 * charts, the same sentences under them — so what they learn is where things
 * are, not what a picture of them looked like.
 *
 * ── The hole is a box-shadow, not a clip-path ────────────────────────────
 * A giant spread on a transparent element paints everything except the box:
 * one element, no SVG mask, no second stacking context, and it animates
 * smoothly between steps because only the position changes. `pointer-events:
 * none` on it means the dimmed dashboard underneath is still scrollable and
 * still readable, which matters — a doctor should be able to look around
 * mid-step.
 *
 * ── Why it can always be left ────────────────────────────────────────────
 * Escape, the X, a click on the dimmer, and a Skip link on every step. A tour
 * somebody cannot get out of is a modal, and this is shown to a person who
 * came here to check on their application.
 */

export interface TourStep {
  /** Matches a `data-tour` attribute on the dashboard. */
  anchor: string;
  title: string;
  body: string;
}

const PADDING = 10;

export default function DemoTour({
  steps,
  /** Where "I have seen enough" goes. */
  exitHref,
}: {
  steps: TourStep[];
  exitHref: string;
}) {
  const [running, setRunning] = useState(false);
  const [i, setI] = useState(0);
  const [box, setBox] = useState<DOMRect | null>(null);

  const step = steps[i];

  const measure = useCallback(() => {
    if (!running || !step) return;
    const el = document.querySelector<HTMLElement>(
      `[data-tour="${step.anchor}"]`
    );
    if (!el) {
      setBox(null);
      return;
    }
    setBox(el.getBoundingClientRect());
  }, [running, step]);

  // Scroll first, then measure — measuring before the scroll settles puts the
  // hole where the section used to be.
  useEffect(() => {
    if (!running || !step) return;
    const el = document.querySelector<HTMLElement>(
      `[data-tour="${step.anchor}"]`
    );
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = window.setTimeout(measure, 420);
    return () => window.clearTimeout(t);
  }, [running, step, measure]);

  // Re-measure on anything that can move the target under it.
  useLayoutEffect(() => {
    if (!running) return;
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [running, measure]);

  useEffect(() => {
    if (!running) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setRunning(false);
      if (e.key === "ArrowRight") setI((n) => Math.min(n + 1, steps.length - 1));
      if (e.key === "ArrowLeft") setI((n) => Math.max(n - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [running, steps.length]);

  if (!running) {
    return (
      <button
        type="button"
        onClick={() => {
          setI(0);
          setRunning(true);
        }}
        className="rounded-full bg-azure-600 px-4 py-2 text-sm font-bold text-white shadow-[0_6px_18px_-6px_rgba(31,111,214,0.7)] transition hover:bg-azure-700"
      >
        Show me around
      </button>
    );
  }

  const last = i === steps.length - 1;

  // Above or below the highlight, whichever has room. Clamped into the
  // viewport so a card near an edge is never half off-screen.
  const cardTop =
    box && box.top > 260
      ? box.top - PADDING - 8
      : (box?.bottom ?? 120) + PADDING + 8;
  const placeAbove = Boolean(box && box.top > 260);

  return (
    <>
      {/* The dimmer with a hole in it. */}
      <div
        aria-hidden
        onClick={() => setRunning(false)}
        className="pointer-events-none fixed inset-0 z-[80] transition-all duration-300"
        style={
          box
            ? {
                top: box.top - PADDING,
                left: box.left - PADDING,
                width: box.width + PADDING * 2,
                height: box.height + PADDING * 2,
                borderRadius: 18,
                boxShadow:
                  "0 0 0 9999px rgba(7, 13, 28, 0.62), 0 0 0 2px rgba(255,255,255,0.85) inset",
              }
            : { background: "rgba(7, 13, 28, 0.62)" }
        }
      />

      {/* The card. */}
      <div
        role="dialog"
        aria-modal="false"
        aria-label={`Tour step ${i + 1} of ${steps.length}`}
        className="fixed z-[81] w-[min(92vw,22rem)] rounded-[10px] bg-white p-4 shadow-[0_24px_60px_-20px_rgba(7,13,28,0.6)] ring-1 ring-graphite-900/10"
        style={{
          top: Math.max(
            12,
            Math.min(
              placeAbove ? cardTop - 190 : cardTop,
              (typeof window !== "undefined" ? window.innerHeight : 800) - 210
            )
          ),
          left: Math.max(
            12,
            Math.min(
              (box ? box.left : 24),
              (typeof window !== "undefined" ? window.innerWidth : 1200) - 372
            )
          ),
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-azure-600">
            {i + 1} of {steps.length}
          </p>
          <button
            type="button"
            onClick={() => setRunning(false)}
            aria-label="Close the tour"
            className="-mt-1 -mr-1 grid h-7 w-7 place-items-center rounded-lg text-graphite-500 transition hover:bg-graphite-100 hover:text-graphite-700"
          >
            ×
          </button>
        </div>

        <h3 className="mt-1 font-display text-lg font-extrabold tracking-[-0.02em] text-graphite-900">
          {step.title}
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-graphite-600">
          {step.body}
        </p>

        <div className="mt-4 flex items-center gap-2">
          {i > 0 && (
            <button
              type="button"
              onClick={() => setI(i - 1)}
              className="rounded-full border border-graphite-200 px-3 py-1.5 text-xs font-bold text-graphite-600 transition hover:bg-graphite-50"
            >
              Back
            </button>
          )}
          {last ? (
            <Link
              href={exitHref}
              className="rounded-full bg-azure-600 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-azure-700"
            >
              Done
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setI(i + 1)}
              className="rounded-full bg-azure-600 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-azure-700"
            >
              Next
            </button>
          )}
          <button
            type="button"
            onClick={() => setRunning(false)}
            className="ml-auto text-xs font-semibold text-graphite-500 transition hover:text-graphite-700"
          >
            Skip
          </button>
        </div>

        {/* Dots, so the length of the thing is visible from step one. */}
        <div className="mt-3 flex gap-1">
          {steps.map((s, n) => (
            <span
              key={s.anchor}
              className={`h-1 flex-1 rounded-full transition ${
                n <= i ? "bg-azure-500" : "bg-graphite-200"
              }`}
            />
          ))}
        </div>
      </div>
    </>
  );
}
