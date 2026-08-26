"use client";

import { useId } from "react";

/**
 * A hover-and-focus explanation for a control.
 *
 * ── Why not `title=""` ───────────────────────────────────────────────────
 * The native tooltip takes about a second to appear, cannot be styled, never
 * shows on touch, and is invisible to keyboard users on most platforms. For
 * onboarding — where the whole point is that somebody is meeting these
 * buttons for the first time — a delay that long means the explanation
 * arrives after the click.
 *
 * ── Why CSS rather than state ────────────────────────────────────────────
 * `group-hover` and `group-focus-within` cover mouse and keyboard with no
 * JavaScript, no portal and no re-render, which matters because these wrap
 * buttons inside forms that re-render on every keystroke. `aria-describedby`
 * carries the same sentence to a screen reader, so the explanation is not
 * only available to people who can hover.
 *
 * On touch there is no hover, so the bubble is shown on focus — which a tap
 * produces — and the text is short enough to also work as the button's own
 * accessible description if it never appears at all.
 */
export default function Hint({
  text,
  /** Which side of the control the bubble sits on. */
  side = "top",
  className = "",
  children,
}: {
  text: string;
  side?: "top" | "bottom" | "right";
  className?: string;
  children: React.ReactNode;
}) {
  const id = useId();

  const place = {
    top: "bottom-full left-1/2 mb-2 -translate-x-1/2",
    bottom: "top-full left-1/2 mt-2 -translate-x-1/2",
    right: "left-full top-1/2 ml-2 -translate-y-1/2",
  }[side];

  return (
    <span className={`group relative inline-flex ${className}`}>
      {/* aria-describedby is set on the wrapper rather than threaded into the
          child, so this works with a <button>, a <Link> or anything else
          without needing to clone the element. */}
      <span aria-describedby={id} className="contents">
        {children}
      </span>

      <span
        id={id}
        role="tooltip"
        className={`pointer-events-none absolute z-50 w-max max-w-[15rem] rounded-lg on-dark bg-slate-900 px-2.5 py-1.5 text-center text-[11px] font-medium leading-snug text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 ${place}`}
      >
        {text}
      </span>
    </span>
  );
}
