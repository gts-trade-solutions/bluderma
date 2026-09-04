"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import type {
  CalendarAppointment,
  CalendarClinic,
  CalendarView,
} from "@/lib/queries/doctorCalendar";
import { CANCELLED_SWATCH, swatchFor } from "./clinicColors";
import { LEGEND_STATES, STATE_STYLES, stateOf } from "./visitStatus";
import AppointmentDrawer from "./AppointmentDrawer";
import NewBookingDialog from "./NewBookingDialog";
import CalendarRail from "./CalendarRail";
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
 *
 * ── The 2026 rebuild ─────────────────────────────────────────────────────
 * Rebuilt to the reference product the client supplied. Four things changed,
 * and each is a decision rather than a repaint:
 *
 *   ONE BAR      The heading, the arrows, the view switch and the location
 *                filter used to be three separate rows stacked above the
 *                grid, and on a laptop that left about 380px of actual
 *                calendar. They are one sticky bar now, sitting beside the
 *                rail rather than above it, and it stays put while the grid
 *                scrolls — the reference does this and it is the difference
 *                between a page with a calendar on it and a calendar.
 *
 *   FOUR VIEWS   Month, week and day answer "when"; none of them answered
 *                "what is coming", which is the question a practitioner
 *                actually asks on a Monday. The list is every booking ahead
 *                of the anchor day — a year of horizon, rendered only where
 *                there is something to render — and it is the only view that
 *                reads on a phone without pinching.
 *
 *   LOCATION     The clinic filter lived only in the desktop rail, so below
 *                1280px — every tablet, every phone — a doctor with three
 *                clinics could not filter at all. There is a select in the
 *                bar for exactly those widths.
 *
 *   SOLID/TINT   A booking is a solid block of its clinic's colour in the
 *                time grids, where it is read from across a room, and a
 *                tinted chip in the month grid, where six of them share a
 *                cell. Same information, two densities.
 */

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** The clinic wall clock runs +5:30 of UTC — see queries/availability.ts. */
const CLINIC_OFFSET_MS = 330 * 60_000;
/*
 * The furthest the day grid will ever stretch, and the least it will ever
 * show. The window between them is worked out from the bookings on screen —
 * see `windowFor`. It used to be pinned at 07:00-21:00, and since almost
 * nobody consults at seven the grid opened with three hours of empty ruled
 * space above the first appointment on every single load.
 */
const EARLIEST_HOUR = 6;
const LATEST_HOUR = 23;
const MIN_HOURS_SHOWN = 9;
/** Pixels per minute — 1.1 gives a 30-minute booking a comfortable 33px. */
const PX_PER_MIN = 1.1;
/** Width of the time rail. Narrower on a phone, where every pixel counts. */
const GUTTER = 56;
/** How far the list view reaches. Mirrors AGENDA_DAYS in queries/doctorCalendar. */
const AGENDA_DAYS = 365;
/** What the arrows move in the list view: a month at a time. */
const AGENDA_STEP_DAYS = 30;

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
  return new Date(Date.now() + CLINIC_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * Minutes since midnight, clinic wall-clock.
 *
 * The same +330 shift todaySeed uses, for the same reason: this app pins
 * clinic time to UTC and converts nowhere, so reading the browser's local
 * hours would put the grid five and a half hours out for anybody abroad. Not
 * imported from lib/queries/availability — that module reaches the database
 * and this is a client component.
 */
function nowMinuteOfDay(): number {
  const t = new Date(Date.now() + CLINIC_OFFSET_MS);
  return t.getUTCHours() * 60 + t.getUTCMinutes();
}

function timeLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, "0")}${suffix}`;
}

/**
 * The hours a time grid should draw, given what is on it.
 *
 * An hour either side of the day's real span, clamped to 06:00-23:00, and
 * never shorter than nine hours — a lone 09:30 booking would otherwise give a
 * three-hour strip that reads as a broken calendar rather than as a quiet
 * day. With nothing booked at all it falls back to a plain 09:00-18:00.
 */
function windowFor(
  days: Date[],
  byDay: Map<string, CalendarAppointment[]>
): { startHour: number; endHour: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const d of days) {
    for (const a of byDay.get(toSeed(d)) ?? []) {
      min = Math.min(min, a.startMinute);
      max = Math.max(max, a.startMinute + a.durationMin);
    }
  }
  if (!Number.isFinite(min)) return { startHour: 9, endHour: 18 };

  let start = Math.max(EARLIEST_HOUR, Math.floor(min / 60) - 1);
  let end = Math.min(LATEST_HOUR, Math.ceil(max / 60) + 1);
  if (end - start < MIN_HOURS_SHOWN) {
    // Grow downward first: an evening clinic is likelier than a 6am one.
    end = Math.min(LATEST_HOUR, start + MIN_HOURS_SHOWN);
    start = Math.max(EARLIEST_HOUR, end - MIN_HOURS_SHOWN);
  }
  return { startHour: start, endHour: end };
}

/** "1h 30m", "45m" — for the agenda, where a block's height cannot say it. */
function durationLabel(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const r = mins % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

const VIEW_TABS: { key: CalendarView; label: string; hint: string }[] = [
  { key: "month", label: "Month", hint: "Month view (press M)" },
  { key: "week", label: "Week", hint: "Week view (press W)" },
  { key: "day", label: "Day", hint: "Day view (press D)" },
  { key: "agenda", label: "List", hint: "Everything ahead, as a list (press A)" },
];

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
        : view === "agenda"
        ? addDays(anchor, dir * AGENDA_STEP_DAYS)
        : new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + dir, 1));
    go({ date: toSeed(d) });
  };

  /* ── The keys Google Calendar trained everyone to press ────────────────
     D / W / M / A switch view, T jumps to today, and the arrows step. A
     doctor scanning next week does it dozens of times a day, and reaching for
     a mouse target each time is the difference between checking the diary and
     not bothering.

     Ignored while typing: an editable target means the person is filling in a
     field, and swallowing their "d" to change the view is the kind of bug
     that makes somebody stop using the keyboard entirely. Modifier chords are
     left alone too, so Ctrl+D still bookmarks. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (
        el &&
        (el.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))
      ) {
        return;
      }

      const key = e.key.toLowerCase();
      if (key === "d") go({ view: "day" });
      else if (key === "w") go({ view: "week" });
      else if (key === "m") go({ view: "month" });
      else if (key === "a") go({ view: "agenda" });
      else if (key === "t") go({ date: today });
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
      else return;

      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // `go` and `step` close over the current view and anchor, which is exactly
    // what these need — a stale closure here would step the wrong unit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, anchor, today, params]);

  /* How many bookings each day holds, for the mini month's dots. Built from
     the same byDay map the grid renders, so the rail can never disagree with
     what opening a day actually shows. */
  const dayCounts = useMemo(() => {
    const m = new Map<string, number>();
    byDay.forEach((list, seed) => m.set(seed, list.length));
    return m;
  }, [byDay]);

  const stepMonth = (dir: 1 | -1) => {
    const d = new Date(
      Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + dir, 1)
    );
    go({ date: toSeed(d) });
  };

  const heading =
    view === "day"
      ? `${WEEKDAYS[anchor.getUTCDay()]} ${anchor.getUTCDate()} ${MONTHS[anchor.getUTCMonth()]} ${anchor.getUTCFullYear()}`
      : view === "week"
      ? spanHeading(weekDays(anchor))
      : view === "agenda"
      ? `Everything from ${anchor.getUTCDate()} ${MONTHS[anchor.getUTCMonth()]} ${anchor.getUTCFullYear()}`
      : `${MONTHS[anchor.getUTCMonth()]} ${anchor.getUTCFullYear()}`;

  /* What this screenful holds, printed beside the heading. The count was
     only ever available by counting the blocks, and "how heavy is this week"
     is the first thing anybody asks of a calendar. Cancelled rows are left
     out: the slot came back, so it is not work. */
  const shownCount = appointments.filter((a) => a.status !== "CANCELLED").length;

  return (
    <div className="space-y-4">
      {awaitingCount > 0 && <AwaitingBanner count={awaitingCount} />}

      <div className="flex gap-5">
        <CalendarRail
          anchor={anchor}
          today={today}
          counts={dayCounts}
          clinics={clinics}
          activeClinicId={activeClinicId ?? null}
          onPick={(seed) => go({ view: "day", date: seed })}
          onStepMonth={stepMonth}
          onClinic={(id) => go({ clinic: id ?? null })}
          states={shownStates}
        />

        <div className="min-w-0 flex-1 space-y-3">
          {/* ── The bar ──────────────────────────────────────────────────
              Sticky, so the date and the view switch stay reachable through
              a fourteen-hour day. `top-0` on a phone, where the portal has
              no header of its own; the desktop header is 57px and the offset
              matches it, or the bar slides under it. */}
          <div className="sticky top-0 z-20 rounded-[10px] border border-graphite-200 bg-white p-2.5 shadow-flat lg:top-[57px]">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => go({ date: today })}
                className="rounded-lg border border-graphite-300 px-3 py-1.5 text-[13px] font-bold text-graphite-800 transition hover:border-graphite-400 hover:bg-graphite-50"
                title="Today (press T)"
              >
                Today
              </button>

              {/* One control, two halves — the reference pairs its steppers
                  rather than floating two round buttons, and a shared border
                  is what makes them read as one thing. */}
              <div className="flex items-center overflow-hidden rounded-lg border border-graphite-300">
                <button
                  onClick={() => step(-1)}
                  aria-label="Previous"
                  title="Previous (left arrow)"
                  className="grid h-8 w-8 place-items-center text-graphite-600 transition hover:bg-graphite-100 hover:text-graphite-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-azure-500"
                >
                  <Chevron dir="left" />
                </button>
                <span aria-hidden className="h-5 w-px bg-graphite-200" />
                <button
                  onClick={() => step(1)}
                  aria-label="Next"
                  title="Next (right arrow)"
                  className="grid h-8 w-8 place-items-center text-graphite-600 transition hover:bg-graphite-100 hover:text-graphite-900"
                >
                  <Chevron dir="right" />
                </button>
              </div>

              <h2 className="min-w-0 flex-1 truncate font-portal text-[15px] font-extrabold tracking-[-0.02em] text-graphite-900 sm:text-[17px]">
                {heading}
              </h2>

              {shownCount > 0 && (
                <span className="hidden shrink-0 rounded-full bg-graphite-100 px-2.5 py-1 text-[11px] font-bold tabular-nums text-graphite-700 sm:inline">
                  {shownCount} booked
                </span>
              )}

              {/* Below xl the rail is gone and this is the only way to filter
                  by location. Above it, the rail's list is better — a select
                  hides the colours, and the colours are the legend. */}
              {clinics.length > 1 && (
                <label className="shrink-0 xl:hidden">
                  <span className="sr-only">Filter by location</span>
                  <select
                    value={activeClinicId ?? ""}
                    onChange={(e) => go({ clinic: e.target.value || null })}
                    className="rounded-lg border border-graphite-300 bg-white px-2.5 py-1.5 text-[13px] font-semibold text-graphite-800"
                  >
                    <option value="">All locations</option>
                    {clinics.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {/* The one thing this toolbar could not do. A walk-in, a phone
                  booking or a follow-up agreed at the door had no way into
                  the diary at all — see createBookingByDoctor. It opens on
                  whichever day is being looked at. */}
              <NewBookingDialog
                clinics={clinics.map((c) => ({ id: c.id, name: c.name }))}
                defaultDaySeed={anchorSeed}
              />

              <div className="flex shrink-0 items-center gap-0.5 rounded-lg bg-graphite-100 p-0.5">
                {VIEW_TABS.map((t) => (
                  <button
                    key={t.key}
                    title={t.hint}
                    onClick={() => go({ view: t.key })}
                    aria-pressed={view === t.key}
                    className={`rounded-md px-2.5 py-1.5 text-[13px] font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-azure-500 sm:px-3 ${
                      view === t.key
                        ? "bg-graphite-900 text-white shadow-flat"
                        : "text-graphite-600 hover:text-graphite-900"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── What the markings mean ────────────────────────────────
                Colour on this calendar means WHICH CLINIC, which is a good
                use of it and not one to give up. State therefore rides on a
                ring and a character instead, and this row is what makes
                either legible to somebody who has not been told. It lists
                only the states actually on screen: a legend explaining "did
                not attend" to a doctor who has never had one is noise. */}
            {shownStates.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-graphite-200 pt-2 text-[11px] text-graphite-600 xl:hidden">
                <span className="font-bold uppercase tracking-wide text-graphite-500">
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
          </div>

          {view === "month" && (
            <MonthGrid
              anchor={anchor}
              byDay={byDay}
              today={today}
              onOpen={setOpenId}
              onDay={(s) => go({ view: "day", date: s })}
            />
          )}
          {view === "week" && (
            <TimeGrid days={weekDays(anchor)} byDay={byDay} today={today} onOpen={setOpenId} />
          )}
          {view === "day" && (
            <TimeGrid days={[anchor]} byDay={byDay} today={today} onOpen={setOpenId} />
          )}
          {view === "agenda" && (
            <Agenda
              days={agendaDays(anchor)}
              byDay={byDay}
              today={today}
              onOpen={setOpenId}
            />
          )}
        </div>
      </div>

      {openId && <AppointmentDrawer appointmentId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

/* ------------------------------ Furniture ------------------------------ */

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      <path d={dir === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
    </svg>
  );
}

/**
 * Bookings holding a slot until the doctor answers.
 *
 * Gold, filled, black type — the reference's own call-to-action block, and
 * the one place on this screen that gets to shout. It is a link to the
 * requests screen rather than a jump to today: answering them is a different
 * job from looking at the diary, and the screen built for it is one click
 * away.
 */
function AwaitingBanner({ count }: { count: number }) {
  return (
    <Link
      href="/doctor/portal/requests"
      className="flex items-center gap-3 rounded-[10px] bg-gold-500 px-4 py-3 text-graphite-900 shadow-flat transition hover:bg-gold-400"
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-graphite-900 text-sm font-bold text-white">
        {count}
      </span>
      <span className="min-w-0 flex-1 text-sm">
        <span className="font-bold">
          {count === 1 ? "One booking is" : `${count} bookings are`} waiting for you to
          confirm.
        </span>{" "}
        <span className="text-graphite-800">
          The {count === 1 ? "slot is" : "slots are"} held until you do.
        </span>
      </span>
      <span className="hidden shrink-0 items-center gap-1.5 text-sm font-bold sm:flex">
        Review
        <Chevron dir="right" />
      </span>
    </Link>
  );
}

function weekDays(anchor: Date): Date[] {
  const start = addDays(anchor, -anchor.getUTCDay());
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

function agendaDays(anchor: Date): Date[] {
  return Array.from({ length: AGENDA_DAYS }, (_, i) => addDays(anchor, i));
}

/** "3–9 September 2026", or "28 Aug – 10 Sep 2026" across a boundary. */
function spanHeading(days: Date[]): string {
  const a = days[0];
  const b = days[days.length - 1];
  const sameMonth = a.getUTCMonth() === b.getUTCMonth() && a.getUTCFullYear() === b.getUTCFullYear();
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
    <div className="overflow-hidden rounded-[10px] border border-graphite-200 bg-white shadow-flat">
      <div className="grid grid-cols-7 border-b border-graphite-200 bg-graphite-50">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="px-2 py-2.5 text-center text-[11px] font-bold uppercase tracking-[0.1em] text-graphite-500"
          >
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
              className={`min-h-[64px] border-b border-r border-graphite-200 p-1.5 transition-colors sm:min-h-[116px] ${
                outside ? "bg-graphite-50" : isToday ? "bg-gold-50" : "bg-white"
              } ${i % 7 === 6 ? "border-r-0" : ""} ${i >= 35 ? "border-b-0" : ""}`}
            >
              <div className="mb-1 flex items-center justify-between">
                <button
                  onClick={() => onDay(seed)}
                  title={`Open ${seed}`}
                  className={`grid h-6 min-w-6 place-items-center rounded-md px-1 text-xs font-bold transition ${
                    isToday
                      ? "bg-graphite-900 text-white"
                      : outside
                      ? "text-graphite-400 hover:bg-graphite-100"
                      : "text-graphite-800 hover:bg-graphite-100"
                  }`}
                >
                  {d.getUTCDate()}
                </button>
                {/* The load, as a number, on desktop only. In a cell holding
                    three chips and a "+2 more" the count is the only thing
                    that says how heavy the day really is. */}
                {list.length > 0 && (
                  <span className="hidden text-[10px] font-bold tabular-nums text-graphite-500 sm:inline">
                    {list.length}
                  </span>
                )}
              </div>

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
                    <span className="text-[10px] font-bold text-graphite-500">
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
                    className="w-full rounded px-1 text-left text-[11px] font-bold text-graphite-600 hover:text-graphite-900"
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
      className={`flex w-full items-center gap-1 truncate rounded-md px-1.5 py-1 text-left text-[11px] transition ${sw.chip} ${st.block}`}
    >
      <span
        aria-hidden
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${sw.dot}`}
      />
      {st.tag && (
        <span aria-hidden className="shrink-0 font-black leading-none">
          {st.tag}
        </span>
      )}
      <span className="font-bold tabular-nums">{a.time}</span>
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
  const { startHour, endHour } = useMemo(() => windowFor(days, byDay), [days, byDay]);
  const minutesShown = (endHour - startHour) * 60;

  /* Open on the current hour, not at the top. See the note at the scroller. */
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const minute = nowMinuteOfDay();
    // Put the current hour a third of the way down rather than at the very
    // top, so what is coming next is on screen alongside it.
    const target = (minute - startHour * 60) * PX_PER_MIN - el.clientHeight / 3;
    el.scrollTo({ top: Math.max(0, target) });
  }, [startHour]);

  const hours = Array.from(
    { length: endHour - startHour + 1 },
    (_, i) => startHour + i
  );

  // A day column narrower than this cannot hold a name and a time, and seven
  // of them on a phone gives about 43px each. So the week scrolls sideways
  // instead of compressing — the day view stays full-width because one column
  // always fits.
  const minColumn = days.length > 1 ? 116 : 0;
  const bodyMinWidth = minColumn ? GUTTER + days.length * minColumn : 0;

  return (
    <div className="overflow-hidden rounded-[10px] border border-graphite-200 bg-white shadow-flat">
      <div className="thin-scroll overflow-x-auto">
        <div style={bodyMinWidth ? { minWidth: bodyMinWidth } : undefined}>
          {/* Day headings */}
          <div
            className="grid border-b border-graphite-200 bg-graphite-50"
            style={{ gridTemplateColumns: `${GUTTER}px repeat(${days.length}, minmax(0,1fr))` }}
          >
            <div />
            {days.map((d) => {
              const seed = toSeed(d);
              const isToday = seed === today;
              const n = (byDay.get(seed) ?? []).filter((a) => a.status !== "CANCELLED").length;
              return (
                <div
                  key={seed}
                  className={`relative border-l border-graphite-200 px-2 py-2 text-center ${
                    isToday ? "bg-gold-50" : ""
                  }`}
                >
                  <div
                    className={`text-[10px] font-bold uppercase tracking-[0.12em] ${
                      isToday ? "text-graphite-900" : "text-graphite-500"
                    }`}
                  >
                    {WEEKDAYS[d.getUTCDay()]}
                  </div>
                  <div
                    className={`mx-auto mt-1 grid h-8 w-8 place-items-center rounded-lg font-portal text-sm font-extrabold tabular-nums ${
                      isToday ? "bg-graphite-900 text-white" : "text-graphite-900"
                    }`}
                  >
                    {d.getUTCDate()}
                  </div>
                  <div className="mt-1 h-3">
                    {n > 0 && (
                      <span className="text-[10px] font-bold text-graphite-500">
                        {n} booked
                      </span>
                    )}
                  </div>
                  {/* Today gets a gold rule along the foot of its heading —
                      the reference's own way of marking the live item, and it
                      survives being printed in greyscale as a thicker edge. */}
                  {isToday && (
                    <span
                      aria-hidden
                      className="absolute inset-x-0 bottom-0 h-[3px] bg-gold-500"
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Scrolling body — a full working day is taller than most screens.

              It opened at 07:00 every time, so a doctor looking at their
              afternoon scrolled to it on every single load. Google Calendar
              opens on the current hour and that is why it feels like it
              already knows where you are. `scrollTo` rather than
              `scrollIntoView` because the latter would also scroll the page
              under it. */}
          <div ref={scrollerRef} className="thin-scroll max-h-[70vh] overflow-y-auto">
            <div
              className="relative grid"
              style={{
                gridTemplateColumns: `${GUTTER}px repeat(${days.length}, minmax(0,1fr))`,
                height: minutesShown * PX_PER_MIN,
              }}
            >
              {/* Hour rails */}
              <div className="relative bg-graphite-50">
                {hours.map((h) => (
                  <div
                    key={h}
                    // The first label is not centred on its rule: at top: 0 the
                    // centring puts half the digits outside the scroller and
                    // the grid opens with a sliced "9am" at the top.
                    className={`absolute right-2 text-[10px] font-bold tabular-nums text-graphite-500 ${
                      h === startHour ? "translate-y-0.5" : "-translate-y-1/2"
                    }`}
                    style={{ top: (h * 60 - startHour * 60) * PX_PER_MIN }}
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
                    className={`relative border-l border-graphite-200 ${
                      seed === today ? "bg-gold-50/40" : ""
                    }`}
                  >
                    {hours.map((h) => (
                      <div key={h}>
                        {/* The hour rule is 0px tall and sits under the blocks, so
                            it can never intercept a click meant for a booking. */}
                        <div
                          className="pointer-events-none absolute inset-x-0 border-t border-graphite-200"
                          style={{ top: (h * 60 - startHour * 60) * PX_PER_MIN }}
                        />
                        {/* And the half hour, dashed and fainter.
                            Every calendar a doctor already uses draws this, and it
                            is not decoration: a 30-minute consultation is the
                            commonest length here, so without a mark at the half
                            hour the eye has to measure the gap to the next rule to
                            tell 10:00 from 10:30. */}
                        <div
                          className="pointer-events-none absolute inset-x-0 border-t border-dashed border-graphite-100"
                          style={{
                            top: (h * 60 + 30 - startHour * 60) * PX_PER_MIN,
                          }}
                        />
                      </div>
                    ))}
                    <NowLine
                      seed={seed}
                      today={today}
                      startHour={startHour}
                      minutesShown={minutesShown}
                    />
                    {layOut(list).map(({ a, lane, lanes }) => (
                      <TimeBlock
                        key={a.id}
                        a={a}
                        lane={lane}
                        lanes={lanes}
                        startHour={startHour}
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
  startHour,
  onOpen,
}: {
  a: CalendarAppointment;
  lane: number;
  lanes: number;
  startHour: number;
  onOpen: (id: string) => void;
}) {
  const state = stateOf(a);
  const st = STATE_STYLES[state];
  const sw = state === "cancelled" ? CANCELLED_SWATCH : swatchFor(a.clinicColor);

  const top = (a.startMinute - startHour * 60) * PX_PER_MIN;
  const height = Math.max(22, a.durationMin * PX_PER_MIN - 2);
  const width = 100 / lanes;

  return (
    <button
      onClick={() => onOpen(a.id)}
      title={`${a.time} · ${a.patientName} · ${durationLabel(a.durationMin)} · ${st.label}`}
      className={`absolute overflow-hidden rounded-lg border border-l-[3px] px-2 py-1 text-left shadow-flat transition hover:z-10 hover:shadow-flat-lg ${sw.block} ${sw.edge} ${st.block}`}
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
      <div className="truncate text-[11px] font-semibold leading-tight">{a.patientName}</div>
      {height > 44 && a.clinicName && (
        <div className="truncate text-[10px] leading-tight opacity-80">
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
function NowLine({
  seed,
  today,
  startHour,
  minutesShown,
}: {
  seed: string;
  today: string;
  startHour: number;
  minutesShown: number;
}) {
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

  const top = (minute - startHour * 60) * PX_PER_MIN;
  if (top < 0 || top > minutesShown * PX_PER_MIN) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
      style={{ top }}
    >
      <span className="-ml-1 h-2.5 w-2.5 shrink-0 rounded-full bg-coral-500 ring-2 ring-white" />
      <span className="h-[2px] flex-1 bg-coral-500" />
    </div>
  );
}

/* -------------------------------- Agenda -------------------------------- */

/**
 * The next fortnight as a list.
 *
 * The view the other three could not be: a time grid answers "when is my
 * three o'clock", and a practitioner on a Monday morning is asking "what is
 * coming", which is a different shape of answer. It is also the only view
 * that reads on a phone at full information — no column is 43px wide here.
 *
 * Empty days are dropped rather than printed. Fourteen headings with nothing
 * under twelve of them is a list of the days of the week.
 */
function Agenda({
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
  const filled = days
    .map((d) => ({ d, seed: toSeed(d), list: byDay.get(toSeed(d)) ?? [] }))
    .filter((x) => x.list.length > 0);

  if (filled.length === 0) {
    return (
      <div className="rounded-[10px] border border-dashed border-graphite-300 bg-white px-6 py-14 text-center">
        <p className="font-portal text-base font-bold text-graphite-900">
          Nothing booked from this day on
        </p>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-graphite-600">
          Every future booking appears here the moment a client makes it. Your
          listing has to be live and your hours set for anybody to be offered a
          slot.
        </p>
      </div>
    );
  }

  const totalAhead = filled.reduce(
    (n, x) => n + x.list.filter((a) => a.status !== "CANCELLED").length,
    0
  );

  return (
    <div className="space-y-3">
      {/* What the whole list adds up to. The view reaches a year ahead, so
          the first thing it owes the reader is the size of what follows. */}
      <p className="px-1 text-[12px] font-semibold text-graphite-600">
        <span className="font-bold text-graphite-900">{totalAhead}</span>{" "}
        appointment{totalAhead === 1 ? "" : "s"} across{" "}
        <span className="font-bold text-graphite-900">{filled.length}</span> day
        {filled.length === 1 ? "" : "s"} ahead
      </p>
      {filled.map(({ d, seed, list }) => {
        const isToday = seed === today;
        const live = list.filter((a) => a.status !== "CANCELLED");
        return (
          <section
            key={seed}
            className="overflow-hidden rounded-[10px] border border-graphite-200 bg-white shadow-flat"
          >
            <header
              className={`flex items-center gap-3 border-b border-graphite-200 px-4 py-2.5 ${
                isToday ? "bg-gold-50" : "bg-graphite-50"
              }`}
            >
              <span
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg font-portal text-sm font-extrabold tabular-nums ${
                  isToday ? "bg-graphite-900 text-white" : "bg-white text-graphite-900 ring-1 ring-graphite-200"
                }`}
              >
                {d.getUTCDate()}
              </span>
              <div className="min-w-0">
                <p className="truncate font-portal text-[14px] font-bold text-graphite-900">
                  {isToday ? "Today" : WEEKDAYS[d.getUTCDay()]}
                  <span className="font-semibold text-graphite-600">
                    {" · "}
                    {d.getUTCDate()} {MONTHS[d.getUTCMonth()]}
                  </span>
                </p>
                <p className="text-[11px] font-semibold text-graphite-500">
                  {live.length} booked
                  {list.length > live.length ? ` · ${list.length - live.length} cancelled` : ""}
                </p>
              </div>
            </header>

            <ul className="divide-y divide-graphite-100">
              {list.map((a) => (
                <AgendaRow key={a.id} a={a} onOpen={onOpen} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

const MODE_LABEL: Record<string, string> = {
  CLINIC: "In clinic",
  VIDEO: "Video",
  HOME: "Home visit",
};

function AgendaRow({
  a,
  onOpen,
}: {
  a: CalendarAppointment;
  onOpen: (id: string) => void;
}) {
  const state = stateOf(a);
  const st = STATE_STYLES[state];
  const sw = state === "cancelled" ? CANCELLED_SWATCH : swatchFor(a.clinicColor);
  const cancelled = state === "cancelled";

  return (
    <li>
      <button
        onClick={() => onOpen(a.id)}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-graphite-50 sm:px-4"
      >
        {/* The hue lives on a bar rather than behind the row: a tinted row is
            harder to read than a white one, and the bar says the same thing. */}
        <span aria-hidden className={`h-9 w-1 shrink-0 rounded-full ${sw.strip}`} />

        <span className="w-[70px] shrink-0">
          <span
            className={`block font-portal text-[13px] font-extrabold tabular-nums ${
              cancelled ? "text-graphite-400 line-through" : "text-graphite-900"
            }`}
          >
            {a.time}
          </span>
          <span className="block text-[11px] font-semibold text-graphite-500">
            {durationLabel(a.durationMin)}
          </span>
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span
              className={`truncate text-[13px] font-bold ${
                cancelled ? "text-graphite-500 line-through" : "text-graphite-900"
              }`}
            >
              {a.patientName}
            </span>
            {a.isMember && <GoldCollarBadge size="short" />}
            {a.isPriority && (
              <span className="shrink-0 rounded-full bg-coral-50 px-1.5 py-0.5 text-[10px] font-bold text-coral-700">
                Priority
              </span>
            )}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-graphite-600">
            <span className="font-semibold">{MODE_LABEL[a.mode] ?? a.mode}</span>
            {a.clinicName && (
              <span className={`rounded-full px-1.5 py-0.5 font-semibold ${sw.pill}`}>
                {a.clinicName.replace(/^BluDerma\s+/, "")}
              </span>
            )}
          </span>
        </span>

        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${st.chip}`}
        >
          {st.label}
        </span>
      </button>
    </li>
  );
}
