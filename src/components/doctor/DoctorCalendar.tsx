"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import type {
  CalendarAppointment,
  CalendarClinic,
  CalendarView,
} from "@/lib/queries/doctorCalendar";
import { CANCELLED_SWATCH, swatchFor } from "./clinicColors";
import AppointmentDrawer from "./AppointmentDrawer";

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
const DAY_START_HOUR = 7;
const DAY_END_HOUR = 21;
const MINUTES_SHOWN = (DAY_END_HOUR - DAY_START_HOUR) * 60;
/** Pixels per minute — 1.1 gives a 30-minute booking a comfortable 33px. */
const PX_PER_MIN = 1.1;

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

      {/* ── Toolbar ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => step(-1)}
            aria-label="Previous"
            className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
          >
            ‹
          </button>
          <button
            onClick={() => step(1)}
            aria-label="Next"
            className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
          >
            ›
          </button>
          <button
            onClick={() => go({ date: today })}
            className="ml-1 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Today
          </button>
        </div>

        <h2 className="text-lg font-bold text-slate-900">{heading}</h2>

        <div className="ml-auto flex rounded-full border border-slate-200 bg-white p-0.5">
          {(["month", "week", "day"] as CalendarView[]).map((v) => (
            <button
              key={v}
              onClick={() => go({ view: v })}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold capitalize transition ${
                view === v ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* ── Clinic filter ──────────────────────────────────────────────── */}
      {clinics.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => go({ clinic: null })}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
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
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
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
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
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
              className={`min-h-[92px] border-b border-r border-slate-100 p-1.5 sm:min-h-[116px] ${
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
              <div className="space-y-1">
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
  const cancelled = a.status === "CANCELLED";
  const sw = cancelled ? CANCELLED_SWATCH : swatchFor(a.clinicColor);
  const awaiting = a.approvalState === "AWAITING_DOCTOR" && !cancelled;
  return (
    <button
      onClick={() => onOpen(a.id)}
      title={`${a.time} · ${a.patientName}${a.clinicName ? ` · ${a.clinicName}` : ""}`}
      className={`flex w-full items-center gap-1 truncate rounded border-l-2 px-1 py-0.5 text-left text-[11px] transition ${sw.block} ${sw.edge}`}
    >
      {awaiting && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />}
      <span className="font-semibold tabular-nums">{a.time}</span>
      <span className="truncate">{a.patientName}</span>
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

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {/* Day headings */}
      <div
        className="grid border-b border-slate-200 bg-slate-50"
        style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0,1fr))` }}
      >
        <div />
        {days.map((d) => {
          const seed = toSeed(d);
          const isToday = seed === today;
          const n = (byDay.get(seed) ?? []).length;
          return (
            <div key={seed} className="px-2 py-2 text-center">
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                {WEEKDAYS[d.getUTCDay()]}
              </div>
              <div
                className={`mx-auto mt-0.5 grid h-7 w-7 place-items-center rounded-full text-sm font-bold ${
                  isToday ? "bg-brand-600 text-white" : "text-slate-800"
                }`}
              >
                {d.getUTCDate()}
              </div>
              {n > 0 && (
                <div className="mt-0.5 text-[10px] font-semibold text-slate-400">
                  {n} booked
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Scrolling body — a full working day is taller than most screens. */}
      <div className="max-h-[70vh] overflow-y-auto">
        <div
          className="relative grid"
          style={{
            gridTemplateColumns: `56px repeat(${days.length}, minmax(0,1fr))`,
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
              <div key={seed} className="relative border-r border-slate-100 last:border-r-0">
                {hours.map((h) => (
                  <div
                    key={h}
                    className="absolute inset-x-0 border-t border-slate-100"
                    style={{ top: (h * 60 - DAY_START_HOUR * 60) * PX_PER_MIN }}
                  />
                ))}
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
  const cancelled = a.status === "CANCELLED";
  const sw = cancelled ? CANCELLED_SWATCH : swatchFor(a.clinicColor);
  const awaiting = a.approvalState === "AWAITING_DOCTOR" && !cancelled;

  const top = (a.startMinute - DAY_START_HOUR * 60) * PX_PER_MIN;
  const height = Math.max(22, a.durationMin * PX_PER_MIN - 2);
  const width = 100 / lanes;

  return (
    <button
      onClick={() => onOpen(a.id)}
      className={`absolute overflow-hidden rounded-md border border-l-[3px] px-1.5 py-0.5 text-left transition ${sw.block} ${sw.edge}`}
      style={{
        top,
        height,
        left: `calc(${lane * width}% + 2px)`,
        width: `calc(${width}% - 4px)`,
      }}
    >
      <div className="flex items-center gap-1 text-[11px] font-bold leading-tight">
        {awaiting && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />}
        <span className="tabular-nums">{a.time}</span>
        {a.isMember && <span className="text-[9px] font-black tracking-wider">WC</span>}
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
