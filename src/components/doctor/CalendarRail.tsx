"use client";

import { swatchFor } from "./clinicColors";

/**
 * The left rail: a mini month, and the clinics.
 *
 * ── Why a rail at all ────────────────────────────────────────────────────
 * Every calendar a doctor already uses — Google, Outlook, Apple — puts a
 * small month beside the grid, and it is not decoration. The grid answers
 * "what is happening now"; the mini month answers "where am I in the month,
 * and which days have anything on them", which is the question somebody asks
 * before they jump. Without it, moving three weeks out means pressing an
 * arrow three times and reading the heading each time to check.
 *
 * ── The dots are the point ───────────────────────────────────────────────
 * A month grid with no load on it is a date picker. The dot under a day says
 * that day has bookings, so the eye can find a busy week without opening it.
 *
 * ── Desktop only ─────────────────────────────────────────────────────────
 * On a phone the grid needs every pixel of width, and a 7x6 mini month beside
 * it would leave neither readable. The month VIEW already answers the same
 * question there, one tap away.
 */

const MINI_WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export default function CalendarRail({
  anchor,
  today,
  counts,
  clinics,
  activeClinicId,
  onPick,
  onStepMonth,
  onClinic,
}: {
  /** The date the grid is showing. Drives which month the mini shows. */
  anchor: Date;
  today: string;
  /** seed -> how many bookings that day holds. */
  counts: Map<string, number>;
  clinics: { id: string; name: string; colorKey: string | null }[];
  activeClinicId: string | null;
  onPick: (seed: string) => void;
  onStepMonth: (dir: 1 | -1) => void;
  onClinic: (id: string | null) => void;
}) {
  const year = anchor.getUTCFullYear();
  const month = anchor.getUTCMonth();
  const first = new Date(Date.UTC(year, month, 1));
  // Sunday-first, matching the main grid and every calendar this sits beside.
  const lead = first.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  const cells: (Date | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(Date.UTC(year, month, i + 1))),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const seedOf = (d: Date) => d.toISOString().slice(0, 10);
  const anchorSeed = seedOf(anchor);
  const monthName = first.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <aside className="hidden w-[15rem] shrink-0 space-y-4 xl:block">
      {/* ── Mini month ──────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.05)] ring-1 ring-slate-200/80">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[13px] font-bold text-slate-900">{monthName}</p>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => onStepMonth(-1)}
              aria-label="Previous month"
              className="grid h-6 w-6 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => onStepMonth(1)}
              aria-label="Next month"
              className="grid h-6 w-6 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            >
              ›
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-y-0.5 text-center">
          {MINI_WEEKDAYS.map((d, i) => (
            <span
              key={i}
              className="pb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400"
            >
              {d}
            </span>
          ))}

          {cells.map((d, i) => {
            if (!d) return <span key={i} />;
            const seed = seedOf(d);
            const isToday = seed === today;
            const isAnchor = seed === anchorSeed;
            const load = counts.get(seed) ?? 0;
            return (
              <button
                key={i}
                type="button"
                onClick={() => onPick(seed)}
                aria-current={isAnchor ? "date" : undefined}
                title={load ? `${load} booked` : "Nothing booked"}
                className={`relative mx-auto grid h-7 w-7 place-items-center rounded-full text-[12px] font-semibold transition ${
                  isAnchor
                    ? "bg-blue-600 text-white"
                    : isToday
                      ? "bg-blue-50 text-blue-700 ring-1 ring-blue-300"
                      : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {d.getUTCDate()}
                {/* Load, not selection. A day with bookings is worth finding
                    even when it is neither today nor where you are. */}
                {load > 0 && !isAnchor && (
                  <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-blue-500" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Clinics ─────────────────────────────────────────────────────
          A checkbox list rather than the chip row the grid used to carry, so
          the filter stops competing with the toolbar for the top of the page
          and the colours sit beside the thing they label. */}
      {clinics.length > 1 && (
        <div className="rounded-2xl bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.05)] ring-1 ring-slate-200/80">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">
            Locations
          </p>
          <ul className="space-y-0.5">
            <li>
              <button
                type="button"
                onClick={() => onClinic(null)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] font-semibold transition ${
                  activeClinicId === null
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm bg-slate-400" />
                All locations
              </button>
            </li>
            {clinics.map((c) => {
              const on = activeClinicId === c.id;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onClinic(c.id)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] font-semibold transition ${
                      on ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-sm ${swatchFor(c.colorKey).strip}`}
                    />
                    <span className="truncate">{c.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </aside>
  );
}
