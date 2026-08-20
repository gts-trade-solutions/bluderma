"use client";

import { useCallback, useRef, useState } from "react";
import { MoveHorizontal } from "lucide-react";

import type { BeforeAfterCase } from "@/data/hub";
import SmartImage from "@/components/SmartImage";
import Rail from "./Rail";

/**
 * Draggable before/after comparison. The pairs shipped today are illustrative
 * (see the note under the rail); real consented client photographs replace
 * them via Admin → Treatments → Images. Nothing here quotes a price or names
 * a clinic.
 */
export default function BeforeAfter({ cases }: { cases: BeforeAfterCase[] }) {
  return (
    <>
      <Rail ariaLabel="Before and after results" bleed="column">
        {cases.map((c) => (
          <CaseCard key={c.slug} data={c} />
        ))}
      </Rail>
      <p className="mt-4 text-xs leading-relaxed text-ink-muted">
        <span className="font-semibold text-ink-soft">
          Illustrative comparisons.
        </span>{" "}
        These show the kind of change each course is aimed at; they are not
        photographs of BluDerma clients and will be replaced by consented
        client images. Results vary: the session counts and timeframes shown
        are typical, not a promise.
      </p>
    </>
  );
}

function CaseCard({ data }: { data: BeforeAfterCase }) {
  const [pos, setPos] = useState(50);
  const frame = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const setFromClientX = useCallback((clientX: number) => {
    const el = frame.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const next = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.min(100, Math.max(0, next)));
  }, []);

  return (
    <figure className="card-soft w-[17rem] shrink-0 snap-start overflow-hidden sm:w-[20rem]">
      <div
        ref={frame}
        className="relative aspect-[4/5] cursor-ew-resize select-none touch-none"
        onPointerDown={(e) => {
          // The keyboard range input handles itself.
          if ((e.target as HTMLElement).tagName === "INPUT") return;
          // A mousedown on a photograph starts the browser's native
          // image-drag, which swallows every pointermove after it — the
          // slider then only ever jumps on click. Claim the gesture instead.
          e.preventDefault();
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          setFromClientX(e.clientX);
        }}
        onPointerMove={(e) => dragging.current && setFromClientX(e.clientX)}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
        onDragStart={(e) => e.preventDefault()}
      >
        {/* After sits underneath; the before layer is clipped over it. */}
        <SmartImage src={data.after} alt={`${data.concern}: after`} sizes="340px" />

        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        >
          <SmartImage
            src={data.before}
            alt={`${data.concern}: before`}
            sizes="340px"
          />
        </div>

        {/* Handle */}
        <div
          className="pointer-events-none absolute inset-y-0 w-0.5 bg-white/90 shadow-[0_0_10px_rgba(0,0,0,0.35)]"
          style={{ left: `${pos}%` }}
        >
          <span className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/[0.04] text-brand-200 shadow-lg">
            <MoveHorizontal className="h-4 w-4" />
          </span>
        </div>

        <span className="pointer-events-none absolute left-2.5 top-2.5 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur">
          Before
        </span>
        <span className="pointer-events-none absolute right-2.5 top-2.5 rounded-full bg-teal-500/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur">
          After
        </span>

        {/* Screen-reader / keyboard equivalent of the drag handle. */}
        <label className="sr-only" htmlFor={`ba-${data.slug}`}>
          Reveal before or after for {data.concern}
        </label>
        <input
          id={`ba-${data.slug}`}
          type="range"
          min={0}
          max={100}
          value={pos}
          onChange={(e) => setPos(Number(e.target.value))}
          className="absolute inset-x-0 bottom-0 h-8 w-full cursor-ew-resize opacity-0"
        />
      </div>

      <figcaption className="p-4">
        <p className="display-sm text-[15px] text-ink">{data.concern}</p>
        <p className="mt-0.5 text-xs text-ink-muted">{data.treatment}</p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <Tag>{data.sessions}</Tag>
          <Tag>{data.timeframe}</Tag>
        </div>

        {/* The client quote was removed on 19 Aug 2026. The disclaimer above
            says these are not photographs of BluDerma clients — but each card
            also carried an invented testimonial attributed to invented
            initials and an invented age, which a reader would reasonably take
            as a real person even after reading it. Facts about the course
            (concern, sessions, timeframe) stay; the fictional person does
            not. Real quotes belong to real, consented clients. */}
      </figcaption>
    </figure>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-brand-400/[12%] px-2.5 py-1 text-[11px] font-semibold text-brand-200">
      {children}
    </span>
  );
}
