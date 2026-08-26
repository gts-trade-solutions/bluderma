"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import type {
  CalendarAppointment,
  CalendarClinic,
  CalendarView,
} from "@/lib/queries/doctorCalendar";
import { CANCELLED_SWATCH, swatchFor } from "./clinicColors";
import {
  LEGEND_STATES,
  STATE_STYLES,
  stateOf,
} from "./visitStatus";
import AppointmentDrawer from "./AppointmentDrawer";
import GoldCollarBadge from "@/components/GoldCollarBadge";

/**
 * The doctor's calendar.
 *
 * Hand-built rather than pulled from a library, for one concrete reason: this
 * app anchors clinic wall-clock time to UTC and converts nowhere (see the
 * contract at the top of lib/queries/availability.ts). Every calendar library
 * worth using localises times for display, which would silently shift the
 * whole grid by five and a half hours. The geometry itself is small — a month
 * is six rows of seven, a day is blocks positioned by minute offset.
 *
 * Navigation is URL-driven (?view=&date=&clinic=) so a particular week is a
 * link a doctor can bookmark, and so the data fetch stays on the server.
 */

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** The window the day and week grids draw. Outside it, nobody consults. */
/** The clinic wall clock runs +5:30 of UTC — see queries/availability.ts. */
const CLINIC_OFFSET_MS = 330 * 60_000;
const DAY_START_HOUR = 7;
const DAY_END_HOUR = 21;
const MINUTES_SHOWN = (DAY_END_HOUR - DAY_START_HOUR) * 60;
/** Pixels per minute — 1.1 gives a 30-minute booking a comfortable 33px. */
const PX_PER_MIN = 1.1;
/** Width of the time rail. Narrower on a phone, where every pixel counts. */
const GUTTER = 52;

interface Props {
  view: CalendarView;
  /** Midnight UTC of the anchor day. */
  anchorSeed: string;
  appointments: CalendarAppointment[];
  clinics: CalendarClinic[];
  awaitingCount: number;
  activeClinicId?: string;
}

function seedToDate(seed: string): Date {
  return new Date(`${seed}T00:00:00.000Z`);
}

function toSeed(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n));
}

/** Today in clinic wall-clock terms, so "today" highlights the right cell. */
function todaySeed(): string {
  return new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
}

function timeLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, "0")}${suffix}`;
}

export default function DoctorCalendar({
  view,
  anchorSeed,
  appointments,
  clinics,
  awaitingCount,
  activeClinicId,
}: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [openId, setOpenId] = useState<string | null>(null);

  // Only the states actually on this screen. A key that explains four things
  // when two are visible teaches somebody to stop reading it.
  const shownStates = LEGEND_STATES.filter((k) =>
    appointments.some((a) => stateOf(a) === k)
  );

  const anchor = seedToDate(anchorSeed);
  const today = todaySeed();

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarAppointment[]>();
    for (const a of appointments) {
      if (!map.has(a.daySeed)) map.set(a.daySeed, []);
      map.get(a.daySeed)!.push(a);
    }
    for (const list of map.values()) list.sort((x, y) => x.startMinute - y.startMinute);
    return map;
  }, [appointments]);

  const go = (next: Partial<{ view: string; date: string; clinic: string | null }>) => {
    const q = new URLSearchParams(params.toString());
    if (next.view) q.set("view", next.view);
    if (next.date) q.set("date", next.date);
    if (next.clinic === null) q.delete("clinic");
    else if (next.clinic) q.set("clinic", next.clinic);
    // replace, not push. These controls fire constantly — the arrows, the
    // view toggle, the clinic chips, clicking a day — and pushing an entry
    // each time meant a doctor who browsed a month had to press Back thirty
    // times to leave the calendar. It reads exactly like Back being broken.
    // The URL still updates, so a particular week is still linkable.
    router.replace(`/doctor/portal/calendar?${q.toString()}`);
  };

  const step = (dir: 1 | -1) => {
    const d =
      view === "day"
        ? addDays(anchor, dir)
        : view === "week"
        ? addDays(anchor, dir * 7)
        : new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + dir, 1));
    go({ date: toSeed(d) });
  };

  const heading =
    view === "day"
      ? `${WEEKDAYS[anchor.getUTCDay()]} ${anchor.getUTCDate()} ${MONTHS[anchor.getUTCMonth()]} ${anchor.getUTCFullYear()}`
      : view === "week"
      ? weekHeading(anchor)
      : `${MONTHS[anchor.getUTCMonth()]} ${anchor.getUTCFullYear()}`;

  return (
    <div className="space-y-4">
      {awaitingCount > 0 && (
        <button
          onClick={() => go({ view: "day", date: today })}
          className="flex w-full items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left transition hover:bg-amber-100"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-amber-500 text-sm font-bold text-white">
            {awaitingCount}
          </span>
          <span className="text-sm">
            <span className="font-semibold text-amber-900">
              {awaitingCount === 1 ? "One booking is" : `${awaitingCount} bookings are`} waiting
              for you to confirm.
            </span>{" "}
            <span className="text-amber-800">
              The {awaitingCount === 1 ? "slot is" : "slots are"} held until you do.
            </span>
          </span>
        </button>
      )}

      {/* ── Toolbar ─────────────────────────────────────────────────────
          Stacked on a phone. Cramming the heading, the arrows and a
          three-way toggle onto one 360px row leaves every target too small
          to hit and the date truncated to nothing. */}
      <div className="rounded-2xl bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.05)] ring-1 ring-slate-200/80 sm:p-3.5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="min-w-0 truncate font-display text-base font-bold tracking-[-0.01em] text-slate-900 sm:text-lg">
            {heading}
          </h2>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              onClick={() => step(-1)}
              aria-label="Previous"
              className="grid h-10 w-10 place-items-center rounded-xl text-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            >
              ‹
            </button>
            <button
              onClick={() => go({ date: today })}
              className="rounded-xl px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
            >
              Today
            </button>
            <button
              onClick={() => step(1)}
              aria-label="Next"
              className="grid h-10 w-10 place-items-center rounded-xl text-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            >
              ›
            </button>
          </div>
        </div>

        {/* Full-width segmented control on mobile — three equal targets that
            are actually thumb-sized. */}
        <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 sm:mt-3 sm:inline-grid sm:w-auto">
          {(["month", "week", "day"] as CalendarView[]).map((v) => (
            <button
              key={v}
              onClick={() => go({ view: v })}
              aria-pressed={view === v}
              className={`rounded-lg px-4 py-2 text-sm font-bold capitalize transition ${
                view === v
                  ? "bg-white text-slate-900 shadow-[0_1px_3px_rgba(15,23,42,0.12)]"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* ── Clinic filter ──────────────────────────────────────────────── */}
      {clinics.length > 1 && (
        // One scrolling row rather than a wrapping block: a doctor with five
        // locations was pushing the calendar itself off the first screen.
        <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 no-scrollbar">
          <button
            onClick={() => go({ clinic: null })}
            className={`shrink-0 rounded-full border px-3 py-2 text-xs font-semibold transition ${
              !activeClinicId
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            All locations
          </button>
          {clinics.map((c) => {
            const sw = swatchFor(c.colorKey);
            const on = activeClinicId === c.id;
            return (
              <button
                key={c.id}
                onClick={() => go({ clinic: c.id })}
                className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition ${
                  on
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${sw.dot}`} />
                {c.name.replace(/^BluDerma\s+/, "")}
                <span className="font-normal opacity-70">· {c.area}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── What the markings mean ─────────────────────────────────────── */}
      {/* Colour on this calendar means WHICH CLINIC, which is a good use of it
          and not one to give up. State therefore rides on a ring and a
          character instead, and this row is what makes either legible to
          somebody who has not been told. It lists only the states that are
          actually on screen: a legend explaining "did not attend" to a doctor
          who has never had one is noise. */}
      {shownStates.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-slate-500">
          <span className="font-semibold uppercase tracking-wide text-slate-400">
            Key
          </span>
          {shownStates.map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span
                className={`inline-flex h-4 min-w-4 items-center justify-center rounded px-1 text-[10px] font-black ${STATE_STYLES[k].chip}`}
              >
                {STATE_STYLES[k].tag ?? " "}
              </span>
              {STATE_STYLES[k].label}
            </span>
          ))}
        </div>
      )}

      {/* ── The grid ───────────────────────────────────────────────────── */}
      {view === "month" && (
        <MonthGrid anchor={anchor} byDay={byDay} today={today} onOpen={setOpenId} onDay={(s) => go({ view: "day", date: s })} />
      )}
      {view === "week" && <TimeGrid days={weekDays(anchor)} byDay={byDay} today={today} onOpen={setOpenId} />}
      {view === "day" && <TimeGrid days={[anchor]} byDay={byDay} today={today} onOpen={setOpenId} />}

      {openId && <AppointmentDrawer appointmentId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function weekDays(anchor: Date): Date[] {
  const start = addDays(anchor, -anchor.getUTCDay());
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

function weekHeading(anchor: Date): string {
  const days = weekDays(anchor);
  const a = days[0];
  const b = days[6];
  const sameMonth = a.getUTCMonth() === b.getUTCMonth();
  return sameMonth
    ? `${a.getUTCDate()}–${b.getUTCDate()} ${MONTHS[a.getUTCMonth()]} ${a.getUTCFullYear()}`
    : `${a.getUTCDate()} ${MONTHS[a.getUTCMonth()].slice(0, 3)} – ${b.getUTCDate()} ${MONTHS[b.getUTCMonth()].slice(0, 3)} ${b.getUTCFullYear()}`;
}

/* ------------------------------ Month ---------------------------------- */

function MonthGrid({
  anchor,
  byDay,
  today,
  onOpen,
  onDay,
}: {
  anchor: Date;
  byDay: Map<string, CalendarAppointment[]>;
  today: string;
  onOpen: (id: string) => void;
  onDay: (seed: string) => void;
}) {
  const first = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
  const start = addDays(first, -first.getUTCDay());
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const month = anchor.getUTCMonth();

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)] ring-1 ring-slate-200/80">
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80">
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-2 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-slate-500">
            <span className="hidden sm:inline">{d}</span>
            <span className="sm:hidden">{d[0]}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          const seed = toSeed(d);
          const list = byDay.get(seed) ?? [];
          const outside = d.getUTCMonth() !== month;
          const isToday = seed === today;
          return (
            <div
              key={seed}
              className={`min-h-[64px] border-b border-r border-slate-100 p-1.5 sm:min-h-[116px] ${
                outside ? "bg-slate-50/60" : "bg-white"
              } ${i % 7 === 6 ? "border-r-0" : ""}`}
            >
              <button
                onClick={() => onDay(seed)}
                className={`mb-1 grid h-6 w-6 place-items-center rounded-full text-xs font-bold transition ${
                  isToday
                    ? "bg-brand-600 text-white"
                    : outside
                    ? "text-slate-300 hover:bg-slate-100"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {d.getUTCDate()}
              </button>
              {/* A month cell on a phone is about 46px wide — too narrow for a
                  time and a name, so it shows coloured dots and the whole cell
                  opens the day. Full chips return from `sm` upward. */}
              {list.length > 0 && (
                <button
                  onClick={() => onDay(seed)}
                  aria-label={`${list.length} booking${list.length === 1 ? "" : "s"} on ${seed}`}
                  className="flex w-full flex-wrap items-center gap-1 px-0.5 py-1 sm:hidden"
                >
                  {list.slice(0, 4).map((a) => (
                    <span
                      key={a.id}
                      className={`h-1.5 w-1.5 rounded-full ${
                        a.status === "CANCELLED"
                          ? CANCELLED_SWATCH.dot
                          : swatchFor(a.clinicColor).dot
                      }`}
                    />
                  ))}
                  {list.length > 4 && (
                    <span className="text-[10px] font-bold text-slate-400">
                      +{list.length - 4}
                    </span>
                  )}
                </button>
              )}

              <div className="hidden space-y-1 sm:block">
                {list.slice(0, 3).map((a) => (
                  <MonthChip key={a.id} a={a} onOpen={onOpen} />
                ))}
                {list.length > 3 && (
                  <button
                    onClick={() => onDay(seed)}
                    className="w-full rounded px-1 text-left text-[11px] font-semibold text-slate-500 hover:text-slate-800"
                  >
                    +{list.length - 3} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthChip({ a, onOpen }: { a: CalendarAppointment; onOpen: (id: string) => void }) {
  const state = stateOf(a);
  const st = STATE_STYLES[state];
  // Clinic carries the hue; state is a ring and a character on top of it, so
  // both facts survive rather than one overwriting the other.
  const sw = state === "cancelled" ? CANCELLED_SWATCH : swatchFor(a.clinicColor);
  return (
    <button
      onClick={() => onOpen(a.id)}
      title={`${a.time} · ${a.patientName}${a.clinicName ? ` · ${a.clinicName}` : ""} · ${st.label}`}
      className={`flex w-full items-center gap-1 truncate rounded border-l-2 px-1 py-0.5 text-left text-[11px] transition ${sw.block} ${sw.edge} ${st.block}`}
    >
      {st.tag && (
        <span aria-hidden className="shrink-0 font-black leading-none">
          {st.tag}
        </span>
      )}
      <span className="font-semibold tabular-nums">{a.time}</span>
      <span className="truncate">{a.patientName}</span>
      <span className="sr-only">{st.label}</span>
    </button>
  );
}

/* --------------------------- Day and week ------------------------------ */

function TimeGrid({
  days,
  byDay,
  today,
  onOpen,
}: {
  days: Date[];
  byDay: Map<string, CalendarAppointment[]>;
  today: string;
  onOpen: (id: string) => void;
}) {
  const hours = Array.from(
    { length: DAY_END_HOUR - DAY_START_HOUR + 1 },
    (_, i) => DAY_START_HOUR + i
  );

  // A day column narrower than this cannot hold a name and a time, and seven
  // of them on a phone gives about 43px each. So the week scrolls sideways
  // instead of compressing — the day view stays full-width because one column
  // always fits.
  const minColumn = days.length > 1 ? 116 : 0;
  const bodyMinWidth = minColumn ? GUTTER + days.length * minColumn : 0;

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)] ring-1 ring-slate-200/80">
      <div className="overflow-x-auto">
      <div style={bodyMinWidth ? { minWidth: bodyMinWidth } : undefined}>
      {/* Day headings */}
      <div
        className="grid border-b border-slate-200 bg-slate-50/80"
        style={{ gridTemplateColumns: `${GUTTER}px repeat(${days.length}, minmax(0,1fr))` }}
      >
        <div />
        {days.map((d) => {
          const seed = toSeed(d);
          const isToday = seed === today;
          const n = (byDay.get(seed) ?? []).length;
          return (
            <div
              key={seed}
              className={`px-2 py-2.5 text-center ${isToday ? "bg-brand-50/60" : ""}`}
            >
              <div
                className={`text-[10px] font-bold uppercase tracking-[0.12em] ${
                  isToday ? "text-brand-700" : "text-slate-400"
                }`}
              >
                {WEEKDAYS[d.getUTCDay()]}
              </div>
              <div
                className={`mx-auto mt-1 grid h-8 w-8 place-items-center rounded-xl font-display text-sm font-bold tabular-nums ${
                  isToday
                    ? "bg-brand-600 text-white shadow-[0_4px_12px_-4px_rgba(31,111,214,0.6)]"
                    : "text-slate-800"
                }`}
              >
                {d.getUTCDate()}
              </div>
              <div className="mt-1 h-3">
                {n > 0 && (
                  <span className="text-[10px] font-bold text-slate-400">
                    {n} booked
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Scrolling body — a full working day is taller than most screens. */}
      <div className="max-h-[70vh] overflow-y-auto">
        <div
          className="relative grid"
          style={{
            gridTemplateColumns: `${GUTTER}px repeat(${days.length}, minmax(0,1fr))`,
            height: MINUTES_SHOWN * PX_PER_MIN,
          }}
        >
          {/* Hour rails */}
          <div className="relative border-r border-slate-100">
            {hours.map((h) => (
              <div
                key={h}
                className="absolute right-1.5 -translate-y-1/2 text-[10px] font-semibold text-slate-400"
                style={{ top: (h * 60 - DAY_START_HOUR * 60) * PX_PER_MIN }}
              >
                {timeLabel(h * 60)}
              </div>
            ))}
          </div>

          {days.map((d) => {
            const seed = toSeed(d);
            const list = byDay.get(seed) ?? [];
            return (
              <div
                key={seed}
                className={`relative border-r border-slate-100 last:border-r-0 ${
                  seed === today ? "bg-brand-50/30" : ""
                }`}
              >
                {hours.map((h) => (
                  <div
                    key={h}
                    // The hour rule is 0px tall and sits under the blocks, so
                    // it can never intercept a click meant for a booking.
                    className="pointer-events-none absolute inset-x-0 border-t border-slate-100"
                    style={{ top: (h * 60 - DAY_START_HOUR * 60) * PX_PER_MIN }}
                  />
                ))}
                <NowLine seed={seed} today={today} />
                {layOut(list).map(({ a, lane, lanes }) => (
                  <TimeBlock
                    key={a.id}
                    a={a}
                    lane={lane}
                    lanes={lanes}
                    onOpen={onOpen}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
      </div>
      </div>
    </div>
  );
}

/**
 * Side-by-side placement for bookings that overlap.
 *
 * Overlaps should be impossible — the slotLock unique index sees to that — but
 * an admin can create one by hand, and a booking that silently sits on top of
 * another is exactly the sort of thing a calendar exists to make visible.
 */
function layOut(list: CalendarAppointment[]) {
  const laneEnds: number[] = [];
  const placed = list.map((a) => {
    const start = a.startMinute;
    const end = start + a.durationMin;
    let lane = laneEnds.findIndex((e) => e <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }
    return { a, lane };
  });
  const lanes = Math.max(1, laneEnds.length);
  return placed.map((p) => ({ ...p, lanes }));
}

function TimeBlock({
  a,
  lane,
  lanes,
  onOpen,
}: {
  a: CalendarAppointment;
  lane: number;
  lanes: number;
  onOpen: (id: string) => void;
}) {
  const state = stateOf(a);
  const st = STATE_STYLES[state];
  const sw = state === "cancelled" ? CANCELLED_SWATCH : swatchFor(a.clinicColor);

  const top = (a.startMinute - DAY_START_HOUR * 60) * PX_PER_MIN;
  const height = Math.max(22, a.durationMin * PX_PER_MIN - 2);
  const width = 100 / lanes;

  return (
    <button
      onClick={() => onOpen(a.id)}
      title={`${a.time} · ${a.patientName} · ${st.label}`}
      className={`absolute overflow-hidden rounded-lg border border-l-[3px] px-2 py-1 text-left shadow-[0_1px_2px_rgba(15,23,42,0.06)] transition hover:z-10 hover:shadow-[0_6px_16px_-6px_rgba(15,23,42,0.35)] ${sw.block} ${sw.edge} ${st.block}`}
      style={{
        top,
        height,
        left: `calc(${lane * width}% + 2px)`,
        width: `calc(${width}% - 4px)`,
      }}
    >
      <div className="flex items-center gap-1 text-[11px] font-bold leading-tight">
        {st.tag && (
          <span aria-hidden className="shrink-0 font-black leading-none">
            {st.tag}
          </span>
        )}
        <span className="tabular-nums">{a.time}</span>
        {a.isMember && <GoldCollarBadge size="short" />}
        <span className="sr-only">{st.label}</span>
      </div>
      <div className="truncate text-[11px] leading-tight">{a.patientName}</div>
      {height > 44 && a.clinicName && (
        <div className="truncate text-[10px] leading-tight opacity-70">
          {a.clinicName.replace(/^BluDerma\s+/, "")}
        </div>
      )}
    </button>
  );
}

/**
 * A live marker for the current time, on today's column only.
 *
 * Mount-gated: the server has no idea what time it is on the client, and
 * rendering a position from Date.now() during SSR is a hydration mismatch.
 * Ticks each minute so it does not drift over a long clinic session.
 */
function NowLine({ seed, today }: { seed: string; today: string }) {
  const [minute, setMinute] = useState<number | null>(null);

  useEffect(() => {
    if (seed !== today) return;
    const read = () => {
      const now = new Date(Date.now() + CLINIC_OFFSET_MS);
      setMinute(now.getUTCHours() * 60 + now.getUTCMinutes());
    };
    read();
    const id = setInterval(read, 60_000);
    return () => clearInterval(id);
  }, [seed, today]);

  if (seed !== today || minute === null) return null;

  const top = (minute - DAY_START_HOUR * 60) * PX_PER_MIN;
  if (top < 0 || top > MINUTES_SHOWN * PX_PER_MIN) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
      style={{ top }}
    >
      <span className="-ml-1 h-2 w-2 shrink-0 rounded-full bg-rose-500" />
      <span className="h-px flex-1 bg-rose-500" />
    </div>
  );
}
