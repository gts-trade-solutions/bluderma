"use client";

import { useEffect, useRef, useState } from "react";

import { useTheme } from "@/hooks/useTheme";
import { THEME_META, type ThemePreference } from "@/lib/theme";

/**
 * Picking a theme.
 *
 * ── Why a menu and not a row of four ─────────────────────────────────────
 * Four options plus "system" is five, and five pills do not fit a navbar
 * beside an account button on a phone. More importantly, each one needs a
 * sentence: "sepia" means nothing on its own, and "high contrast" is chosen
 * by somebody who needs to be told it exists rather than somebody browsing
 * swatches. A menu has room for the sentence.
 *
 * ── Why it renders a neutral icon until it is ready ──────────────────────
 * The preference lives in the browser, so the server cannot know it. Painting
 * the wrong option as selected and correcting it a frame later is a control
 * that visibly lies about its own state.
 */

const SYSTEM: { value: ThemePreference; label: string; hint: string } = {
  value: "system",
  label: "Match my device",
  hint: "Follows your phone or computer, and keeps following it if you change it.",
};

export default function ThemeToggle({
  /** "compact" is the navbar button; "panel" is the inline list. */
  variant = "compact",
  className = "",
}: {
  variant?: "compact" | "labelled" | "floating" | "panel";
  className?: string;
}) {
  const { preference, theme, setTheme, ready } = useTheme();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const options = [SYSTEM, ...THEME_META];

  if (variant === "panel") {
    return (
      <div role="radiogroup" aria-label="Appearance" className={className}>
        <ul className="space-y-1.5">
          {options.map((o) => {
            const on = ready && preference === o.value;
            const meta = THEME_META.find((m) => m.value === o.value);
            return (
              <li key={o.value}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setTheme(o.value as ThemePreference)}
                  className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                    on
                      ? "bg-white/10 ring-1 ring-inset ring-white/20"
                      : "hover:bg-white/[0.06]"
                  }`}
                >
                  <Swatch meta={meta} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-ink">
                      {o.label}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-ink-muted">
                      {o.hint}
                    </span>
                  </span>
                  {on && <Tick />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <div ref={box} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Appearance"
        title="Appearance"
        className={
          variant === "floating"
            ? // Its own control, so it looks like one: a real surface, a real
              // edge, and a shadow that lifts it off whatever it is over.
              "flex h-12 items-center gap-2 rounded-full border border-[var(--hairline)] bg-[var(--sheet)] px-4 text-ink shadow-[0_10px_30px_-10px_rgba(0,0,0,0.45)] transition hover:-translate-y-0.5 hover:border-[var(--highlight-text)] hover:shadow-[0_14px_36px_-10px_rgba(0,0,0,0.5)] active:translate-y-0"
            : variant === "labelled"
            ? // A bare 9px glyph in a row of other glyphs is not a control
              // anybody finds. This is the one thing on the bar a reader is
              // meant to discover, so it gets an edge, a word, and a swatch
              // of the theme it is currently on — which doubles as the only
              // honest preview of what the button does.
              "flex h-9 items-center gap-2 rounded-full border border-[var(--hairline)] px-3 text-ink-soft transition hover:border-[var(--accent-text)] hover:bg-white/10 hover:text-ink"
            : "grid h-9 w-9 place-items-center rounded-full text-ink-soft transition hover:bg-white/10 hover:text-ink"
        }
      >
        <PaletteIcon />
        {(variant === "labelled" || variant === "floating") && (
          <>
            <span
              className={
                variant === "floating"
                  ? "text-[13px] font-bold"
                  : "hidden text-[13px] font-semibold sm:inline"
              }
            >
              Theme
            </span>
            <span
              aria-hidden
              className="h-3.5 w-3.5 shrink-0 rounded-full border border-[var(--hairline)]"
              style={{
                background: ready
                  ? `linear-gradient(135deg, var(--surface) 0 50%, var(--highlight-text) 50% 100%)`
                  : "transparent",
              }}
            />
          </>
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Appearance"
          className={`absolute z-50 w-[17rem] animate-scale-in overflow-hidden rounded-2xl sheet p-2 ${
            variant === "floating"
              ? "bottom-full left-0 mb-2"
              : "right-0 top-full mt-2"
          }`}
        >
          <p className="px-3 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
            Appearance
          </p>
          <ul>
            {options.map((o) => {
              const on = ready && preference === o.value;
              const meta = THEME_META.find((m) => m.value === o.value);
              return (
                <li key={o.value}>
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={on}
                    onClick={() => {
                      setTheme(o.value as ThemePreference);
                      setOpen(false);
                    }}
                    className={`flex w-full items-start gap-2.5 rounded-xl px-3 py-2 text-left transition ${
                      on ? "bg-white/10" : "hover:bg-white/[0.06]"
                    }`}
                  >
                    <Swatch meta={meta} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-bold text-ink">
                        {o.label}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-ink-muted">
                        {o.hint}
                      </span>
                    </span>
                    {on && <Tick />}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="px-3 pb-1 pt-2 text-[10px] leading-snug text-ink-muted">
            Saved in this browser. Currently showing{" "}
            <strong className="font-bold text-ink-soft">
              {THEME_META.find((m) => m.value === theme)?.label ?? "Midnight"}
            </strong>
            .
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Two colours: the ground and the text on it.
 *
 * Literal hexes from THEME_META rather than tokens, deliberately — the point
 * of a swatch is to show what a theme looks like from inside a different one.
 */
function Swatch({ meta }: { meta?: { swatch: [string, string] } }) {
  if (!meta) {
    // "Match my device" has no colours of its own.
    return (
      <span
        aria-hidden
        className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg text-ink-muted ring-1 ring-inset ring-white/20"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
          <rect x="3" y="4" width="18" height="12" rx="2" />
          <path d="M8 20h8" />
        </svg>
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg text-[11px] font-black ring-1 ring-inset ring-white/20"
      style={{ background: meta.swatch[0], color: meta.swatch[1] }}
    >
      Aa
    </span>
  );
}

function Tick() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="mt-1 h-3.5 w-3.5 shrink-0 text-teal-300"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function PaletteIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="h-4 w-4"
    >
      <path d="M12 3a9 9 0 1 0 0 18c.9 0 1.5-.7 1.5-1.5 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.8.7-1.5 1.5-1.5H16a5 5 0 0 0 5-5c0-4.4-4-8-9-8Z" />
      <circle cx="7.5" cy="11.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="11" cy="7.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="9" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}
