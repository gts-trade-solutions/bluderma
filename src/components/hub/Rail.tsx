"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Horizontal snap-scrolling rail with desktop arrows. Used for the concern
 * chips, the deal cards and the before/after cases so every rail on the hub
 * behaves identically.
 */
export default function Rail({
  children,
  ariaLabel,
  className = "",
  arrows = "overlay",
  bleed = "page",
}: {
  children: React.ReactNode;
  ariaLabel: string;
  className?: string;
  /**
   * How far the track is allowed to run past its own box.
   *
   * "page" bleeds by exactly container-page's padding, so the first card lines
   * up with the text while the scroll surface reaches the edge of the screen.
   * That is right when the rail's parent IS the padded container.
   *
   * "column" stops bleeding at `lg`, and is right when the rail sits in a grid
   * COLUMN instead. On the explore page the content column has a sticky
   * analyser panel beside it, and a rail bleeding 32px to the right ran
   * underneath that panel: the treatment cards looked cut off, because they
   * were being painted over. The bleed is still correct below `lg`, where the
   * grid collapses to one column inside container-page.
   */
  bleed?: "page" | "column";
  /**
   * "overlay" floats the arrows over the ends of the track — right for deal
   * cards and photographs, where a disc on top of an image reads as a
   * control. "inline" puts them in a row above it instead, which is what a
   * compact row of labels needs: an overlaid arrow sits squarely on top of
   * the first and last label and hides the very thing you are choosing from.
   */
  arrows?: "overlay" | "inline";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    measure();
    const el = ref.current;
    if (!el) return;
    // ResizeObserver catches the case where images finish loading and widen
    // the track after the first measure.
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  const nudge = (dir: -1 | 1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.8), behavior: "smooth" });
  };

  const track = (
    <div
      ref={ref}
      onScroll={measure}
      aria-label={ariaLabel}
      className={`no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2 ${
        arrows === "overlay"
          ? bleed === "column"
            ? "-mx-5 px-5 sm:-mx-8 sm:px-8 lg:mx-0 lg:px-0"
            : "-mx-5 px-5 sm:-mx-8 sm:px-8"
          : ""
      } ${className}`}
    >
      {children}
    </div>
  );

  if (arrows === "inline") {
    // Only worth showing when there is somewhere to go.
    const scrollable = !(atStart && atEnd);
    return (
      <div>
        {scrollable && (
          <div className="mb-1 hidden justify-end gap-2 lg:flex">
            <InlineArrow
              side="left"
              disabled={atStart}
              onClick={() => nudge(-1)}
            />
            <InlineArrow
              side="right"
              disabled={atEnd}
              onClick={() => nudge(1)}
            />
          </div>
        )}
        {track}
      </div>
    );
  }

  return (
    <div className="group/rail relative">
      {track}
      <Arrow side="left" hidden={atStart} onClick={() => nudge(-1)} />
      <Arrow side="right" hidden={atEnd} onClick={() => nudge(1)} />
    </div>
  );
}

function InlineArrow({
  side,
  disabled,
  onClick,
}: {
  side: "left" | "right";
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={side === "left" ? "Scroll left" : "Scroll right"}
      className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.04] text-ink ring-1 ring-white/10 transition hover:bg-brand-400/[12%] hover:text-brand-200 disabled:cursor-default disabled:opacity-35 disabled:hover:bg-white/[0.04] disabled:hover:text-ink"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function Arrow({
  side,
  hidden,
  onClick,
}: {
  side: "left" | "right";
  hidden: boolean;
  onClick: () => void;
}) {
  if (hidden) return null;
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      onClick={onClick}
      aria-label={side === "left" ? "Scroll left" : "Scroll right"}
      className={`absolute top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/[0.04] text-ink shadow-card ring-1 ring-black/5 transition hover:bg-brand-400/[12%] hover:text-brand-200 lg:flex ${
        side === "left" ? "-left-4" : "-right-4"
      }`}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}
