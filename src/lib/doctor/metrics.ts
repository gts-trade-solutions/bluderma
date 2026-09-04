import {
  AppointmentStatus,
  ApprovalState,
  type ConsultMode,
  type VisitReason,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { clinicWallClock } from "@/lib/queries/availability";
import { reasonLabel } from "@/lib/booking/visitIntake";

/**
 * Everything the doctor dashboard shows, computed here so it can be defended.
 *
 * Three rules this file works under:
 *
 * 1. **Appointment-derived, not payment-derived.** The Payment table has no
 *    doctorId and, with Razorpay unconfigured, no rows at all. Revenue comes
 *    from what was booked, and the UI says "booked value" rather than
 *    "collected" because that is what it is.
 *
 * 2. **COMPLETED is set by hand.** Nothing marks an appointment complete
 *    automatically, so a single "revenue" figure keyed on it would quietly
 *    under-report every practice that does not tidy up its diary. Hence four
 *    tiers, including an `unresolved` bucket for visits that happened and were
 *    never closed — which is a nudge, not a hidden fudge.
 *
 * 3. **Wall-clock is UTC-labelled.** A 10:30 slot is stored as 10:30Z. So day
 *    and hour are read with getUTC* accessors, and "today" comes from
 *    clinicWallClock(). Using local accessors on the server would shift every
 *    bucket by the server's offset.
 *
 * Every rate carries the sample it came from, so the UI can refuse to print a
 * percentage derived from two appointments.
 */

const DAY_MS = 86_400_000;

/**
 * The window the money figures are computed over.
 *
 * The dashboard was hard-wired to the calendar month, which meant a
 * practitioner could see what they had booked this month and had no way at all
 * to see what they had booked last month — the single most common thing anyone
 * asks of a revenue screen. Everything explicitly labelled "last 90 days"
 * (the rates, the demand mix, the busy hours) is a rolling window and stays
 * put: those answer "how does my practice behave", not "how did that month go".
 */
export type DashboardPeriod =
  | "this-month"
  | "last-month"
  | "last-3"
  | "last-6"
  | "this-year";

export const PERIOD_OPTIONS: { value: DashboardPeriod; label: string }[] = [
  { value: "this-month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "last-3", label: "Last 3 months" },
  { value: "last-6", label: "Last 6 months" },
  { value: "this-year", label: "This year" },
];

/** Anything unrecognised falls back to the month, never throws. */
export function parsePeriod(raw: unknown): DashboardPeriod {
  return PERIOD_OPTIONS.some((o) => o.value === raw)
    ? (raw as DashboardPeriod)
    : "this-month";
}

/**
 * Month boundaries for a period, plus the comparable window before it.
 *
 * Every period starts on the first of a month so the comparison is like for
 * like: "last 3 months" against the 3 months before those, not against a
 * rolling 90 days that overlaps them.
 */
function periodWindow(now: Date, period: DashboardPeriod) {
  const y = now.getUTCFullYear();
  const mo = now.getUTCMonth();
  const at = (yy: number, mm: number) => new Date(Date.UTC(yy, mm, 1));

  switch (period) {
    case "last-month":
      // The only closed period: it has finished, so there is nothing to
      // project and no weeks left to fill.
      return { start: at(y, mo - 1), end: at(y, mo), prevStart: at(y, mo - 2), complete: true };
    case "last-3":
      return { start: at(y, mo - 2), end: at(y, mo + 1), prevStart: at(y, mo - 5), complete: false };
    case "last-6":
      return { start: at(y, mo - 5), end: at(y, mo + 1), prevStart: at(y, mo - 11), complete: false };
    case "this-year":
      return { start: at(y, 0), end: at(y, mo + 1), prevStart: at(y - 1, 0), complete: false };
    default:
      return { start: at(y, mo), end: at(y, mo + 1), prevStart: at(y, mo - 1), complete: false };
  }
}

/** "August 2026", "Jun – Aug 2026", "2026". */
function labelFor(start: Date, end: Date, period: DashboardPeriod): string {
  if (period === "this-year") return String(start.getUTCFullYear());

  const last = new Date(end.getTime() - DAY_MS);
  const long = (d: Date) =>
    d.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
  const short = (d: Date) =>
    d.toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" });

  if (
    start.getUTCFullYear() === last.getUTCFullYear() &&
    start.getUTCMonth() === last.getUTCMonth()
  ) {
    return long(start);
  }
  // Short at both ends: "Jun – August 2026" reads like a typo.
  return `${short(start)} – ${short(last)} ${last.getUTCFullYear()}`;
}

/** What one booking is worth. Matches the calendar's existing convention. */
const valueOf = (a: { feeAtBooking: number; visitFee: number }) =>
  a.feeAtBooking + a.visitFee;

export interface Measured<T> {
  value: T;
  /** How many rows produced it. The UI hides thin numbers rather than lying. */
  sampleSize: number;
}

export interface RevenueTiers {
  /** Visits the doctor marked completed. */
  realised: number;
  /** Confirmed or payment-pending, still in the future. */
  scheduled: number;
  /** Past, not cancelled, never marked completed. */
  unresolved: number;
  /** Cancelled or no-show. */
  lost: number;
  /** Cancellation fees actually charged on those. */
  recovered: number;
  /** Given away to Gold Collar members in this period. */
  discountGiven: number;
}

/**
 * The seats in the week ahead, and what the empty ones are worth.
 *
 * A doctor reading "60% filled" cannot do anything with it. "23 seats still
 * open, worth about ₹41,000" is the same fact with the consequence attached,
 * and the consequence is the only part that changes a decision.
 *
 * Forward-looking on purpose. Utilisation over the last four weeks says how
 * the practice has been running; it cannot be acted on. These seven days can.
 */
export interface SeatOutlook {
  /** Today and the six days after it. */
  days: {
    /** ISO date, for React keys. */
    date: string;
    /** "Thu 21 Aug". */
    label: string;
    /** "Thu", for the chart axis. */
    short: string;
    isToday: boolean;
    seats: number;
    booked: number;
    empty: number;
  }[];
  totalSeats: number;
  bookedSeats: number;
  emptySeats: number;
  /** What one seat is worth: the average value of a booking. */
  perSeat: number;
  /**
   * Where `perSeat` came from — an average of real bookings, or the doctor's
   * own listed fee when there are not enough bookings to average.
   */
  perSeatBasis: "bookings" | "list-fee";
  /** perSeat × bookedSeats, and perSeat × emptySeats. */
  bookedValue: number;
  emptyValue: number;
  /** 0–1. Zero seats means zero, never a divide by nothing. */
  fillRate: number;
  /** The day ahead with the most room, for the one-line prompt. */
  emptiestDay: { label: string; empty: number } | null;
}

export interface DashboardMetrics {
  /** Which window was asked for. Echoed so the control can show its state. */
  period: DashboardPeriod;
  /** "August 2026" · "Jun – Aug 2026" · "2026". */
  periodLabel: string;
  /**
   * The window the money figures cover.
   *
   * Exposed so anything measuring alongside them (running costs, for one) can
   * use the SAME dates rather than deriving its own. Two derivations of "this
   * month" eventually disagree, and a net-profit figure built from takings in
   * one window and costs in another is worse than no figure.
   */
  windowStart: Date;
  windowEnd: Date;
  /** True when the window has already ended — no projection, no uplift. */
  isComplete: boolean;
  daysElapsed: number;
  daysInPeriod: number;

  revenue: RevenueTiers;
  /** realised + unresolved + scheduled — the period's booked value. */
  periodBooked: number;
  /** The same figure for the window before it, so the header shows direction. */
  prevPeriodBooked: number;
  /** Change on the previous window, -1..n. Null when there is no comparison. */
  periodDelta: number | null;
  /** Straight-line run rate. Arithmetic, never a model's guess. */
  projected: number;
  averageValue: number;
  /** "One more patient a week is worth about X by the end." */
  uplift: { perWeek: number; amount: number }[];

  patients: {
    thisMonth: number;
    guests: number;
    returning: Measured<number>;
    /** Seen before this period, and never seen before. They sum to thisMonth. */
    returningCount: number;
    newCount: number;
  };
  appointments: {
    upcoming: number;
    awaiting: number;
    completedAllTime: number;
    /** Live bookings in the period, and in the window before it. */
    bookedCount: number;
    prevBookedCount: number;
    /** Change on the previous window, -1..n. Null when there is nothing to compare. */
    countDelta: number | null;
  };

  demand: { key: string; label: string; count: number }[];
  /** Where the work happens, when a practitioner runs more than one place. */
  clinicSplit: { name: string; colorKey: string; count: number; value: number }[];
  /** Requests in, accepted, seen — where bookings fall out of the pipe. */
  funnel: { label: string; count: number }[];
  utilisation: {
    byDay: { day: number; label: string; capacity: number; booked: number; rate: number }[];
    weeklyCapacity: number;
    emptiest: { label: string; free: number } | null;
  };
  /** Seats open in the next seven days, and what they are worth. */
  seats: SeatOutlook;

  /**
   * What today comes to if every remaining seat fills.
   *
   * The one forward figure on a page otherwise made of periods. See the note
   * where it is computed for why the booked and open halves stay separate.
   */
  todayPotential: {
    /** Real fees on today's diary, cancellations excluded. */
    bookedInr: number;
    bookedCount: number;
    /** Seats still on sale today. */
    openSeats: number;
    /** openSeats x the average booking value. */
    openValue: number;
    total: number;
    /** False on a day the practice does not work — nothing to fill. */
    isWorkingDay: boolean;
  };
  /**
   * Bookings by start hour, in CLOCK order across the whole working span.
   *
   * This used to be the top four hours sorted by volume, plotted on an axis
   * labelled with times — so a doctor could be shown 11:00, 09:00, 16:00,
   * 10:00 left to right and read a shape that did not exist. An hours-of-day
   * chart whose axis is not chronological is worse than no chart.
   */
  busiestHours: { hour: number; label: string; count: number }[];

  /**
   * The next booking still ahead today. The first question a practitioner
   * opening this mid-clinic actually has, and the dashboard could not answer
   * it — they had to leave for the day list.
   */
  nextToday: {
    id: string;
    /** "14:30", clinic wall clock. */
    at: string;
    /** Negative once it has started; the UI says "in progress". */
    minutesAway: number;
    patientName: string;
    mode: ConsultMode;
    clinicName: string | null;
    reason: string | null;
    isMember: boolean;
  } | null;

  /**
   * Who called the cancellations off.
   *
   * A cancel rate on its own is a number the doctor can do nothing with: the
   * clinic cancelling on clients and clients cancelling on the clinic are
   * opposite problems with opposite fixes. `cancelledBy` was already stored
   * and never read.
   */
  cancellations: {
    byPatient: number;
    byClinic: number;
    /** Rows predating cancelledBy, or cancelled by a job. */
    unattributed: number;
    total: number;
  };

  /** Reviews written but not yet published — invisible to the doctor until now. */
  reviewsPending: number;

  /** Leave already booked, so nobody is surprised by their own diary. */
  timeOffAhead: {
    startsAt: string;
    endsAt: string;
    reason: string | null;
    days: number;
  }[];

  /** Public handle, for the share card. */
  slug: string;

  ops: {
    noShowRate: Measured<number>;
    cancelRate: Measured<number>;
    medianLeadDays: Measured<number>;
    medianResponseHours: Measured<number>;
    memberShare: Measured<number>;
  };

  reviews: {
    rating: number;
    count: number;
    latest: { id: string; rating: number; title: string | null; body: string | null; at: string }[];
  };

  /** The period's booked value over time, for the sparkline. */
  series: { date: string; value: number; count: number }[];
  /** How the series is bucketed, so the chart can label itself honestly. */
  seriesGrain: "day" | "week";
}

const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Bookings needed before a seat is priced from history rather than list fee.
 *
 * Below this an average is one or two consults wide, and a single ₹9,000
 * procedure would price every empty slot in the week as if it were another
 * one.
 */
const MIN_SEAT_SAMPLE = 5;

/**
 * Slots in one availability window.
 *
 * The `+ 1` is not a rounding choice — it reproduces the `t <= end` loop in
 * queries/availability.ts, which generates a slot AT the end time. That is
 * long-standing behaviour every seeded doctor depends on, so a capacity
 * denominator computed any other way would disagree with the booking grid the
 * doctor can see.
 */
export function slotsInWindow(
  startTime: string,
  endTime: string,
  slotMinutes: number
): number {
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const start = toMin(startTime);
  const end = toMin(endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  if (end <= start || slotMinutes <= 0) return 0;
  return Math.floor((end - start) / slotMinutes) + 1;
}

/** "09:30" → 570. NaN-safe: an unparseable time contributes no slots. */
function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/**
 * The bookable seats on one date, counting only ones that can still be sold.
 *
 * Three subtractions the naive version gets wrong, and each of them would
 * overstate the money sitting in an empty diary:
 *
 *  - Slots earlier today are gone. 09:00 is not an opportunity at half past
 *    three, and counting it inflates "worth ₹x" with time that has passed.
 *  - Slots inside a booked leave block are not seats. Checked per slot rather
 *    than per day, so blocking one afternoon does not wipe out the morning.
 *  - The `t <= end` loop matches slotsInWindow and queries/availability.ts, so
 *    this denominator agrees with the grid the client actually books from.
 */
function seatsOnDate(
  seed: string,
  dayOfWeek: number,
  windows: { dayOfWeek: number; startTime: string; endTime: string; slotMinutes: number }[],
  timeOff: { startsAt: Date; endsAt: Date }[],
  notBeforeMs: number
): number {
  let seats = 0;
  for (const w of windows) {
    if (w.dayOfWeek !== dayOfWeek || w.slotMinutes <= 0) continue;
    const start = toMinutes(w.startTime);
    const end = toMinutes(w.endTime);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;

    for (let t = start; t <= end; t += w.slotMinutes) {
      const at = Date.parse(
        `${seed}T${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}:00.000Z`
      );
      if (!Number.isFinite(at) || at < notBeforeMs) continue;
      if (timeOff.some((o) => at >= o.startsAt.getTime() && at < o.endsAt.getTime())) {
        continue;
      }
      seats += 1;
    }
  }
  return seats;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Who a booking belongs to, including guests with no account. */
function identityOf(a: {
  patientUserId: string | null;
  patientEmail: string | null;
  patientPhone: string | null;
  id: string;
}): string {
  return (
    a.patientUserId ??
    a.patientEmail?.toLowerCase() ??
    a.patientPhone ??
    `appt:${a.id}`
  );
}

export async function getDashboardMetrics(
  doctorId: string,
  period: DashboardPeriod = "this-month"
): Promise<DashboardMetrics> {
  const now = clinicWallClock();
  const nowMs = Date.now();

  const win = periodWindow(now, period);
  const monthStart = win.start;
  const monthEnd = win.end;
  const prevStart = win.prevStart;
  const periodLabel = labelFor(monthStart, monthEnd, period);

  const daysInPeriod = Math.round(
    (monthEnd.getTime() - monthStart.getTime()) / DAY_MS
  );
  // A finished period is fully elapsed by definition; a running one is however
  // far into it the clinic's own clock has got.
  const daysElapsed = win.complete
    ? daysInPeriod
    : Math.min(
        Math.max(Math.ceil((now.getTime() - monthStart.getTime()) / DAY_MS), 1),
        daysInPeriod
      );

  const since90 = new Date(nowMs - 90 * DAY_MS);
  const since28 = new Date(nowMs - 28 * DAY_MS);

  // The seat window: midnight today, clinic time, and the seven days from it.
  // It starts at midnight rather than now so today's already-taken bookings
  // still count as filled — a morning clinic should not read as an empty day
  // by lunchtime.
  const weekFrom = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const weekTo = new Date(weekFrom.getTime() + 7 * DAY_MS);

  const [
    monthRows,
    prevRows,
    recent,
    priorIdentities,
    availability,
    timeOff,
    doctor,
    reviewRows,
    awaiting,
    upcoming,
    completedAllTime,
    nextTodayRow,
    cancelledRows,
    reviewsPending,
    timeOffAheadRows,
    weekAheadRows,
    weekAheadTimeOff,
  ] = await Promise.all([
      prisma.appointment.findMany({
        where: { doctorId, scheduledAt: { gte: monthStart, lt: monthEnd } },
        select: {
          id: true,
          scheduledAt: true,
          status: true,
          approvalState: true,
          feeAtBooking: true,
          visitFee: true,
          discountInr: true,
          cancellationFeeInr: true,
          subscriptionId: true,
          patientUserId: true,
          patientEmail: true,
          patientPhone: true,
        },
      }),
      prisma.appointment.findMany({
        where: { doctorId, scheduledAt: { gte: prevStart, lt: monthStart } },
        select: {
          status: true,
          approvalState: true,
          feeAtBooking: true,
          visitFee: true,
        },
      }),
      prisma.appointment.findMany({
        where: { doctorId, scheduledAt: { gte: since90 } },
        select: {
          id: true,
          scheduledAt: true,
          createdAt: true,
          approvedAt: true,
          status: true,
          approvalState: true,
          reason: true,
          feeAtBooking: true,
          visitFee: true,
          clinic: { select: { name: true, colorKey: true } },
        },
      }),
      prisma.appointment.findMany({
        where: { doctorId, scheduledAt: { lt: monthStart } },
        select: {
          id: true,
          patientUserId: true,
          patientEmail: true,
          patientPhone: true,
        },
      }),
      prisma.doctorAvailability.findMany({
        where: { doctorId, isActive: true },
        select: { dayOfWeek: true, startTime: true, endTime: true, slotMinutes: true },
      }),
      prisma.doctorTimeOff.findMany({
        where: { doctorId, endsAt: { gte: since28 } },
        select: { startsAt: true, endsAt: true },
      }),
      prisma.doctor.findUnique({
        where: { id: doctorId },
        select: { rating: true, reviews: true, slug: true, fee: true },
      }),
      prisma.review.findMany({
        where: { doctorId, status: "PUBLISHED" },
        orderBy: { publishedAt: "desc" },
        take: 3,
        select: { id: true, rating: true, title: true, body: true, publishedAt: true, createdAt: true },
      }),
      prisma.appointment.count({
        where: {
          doctorId,
          approvalState: ApprovalState.AWAITING_DOCTOR,
          status: { not: AppointmentStatus.CANCELLED },
          scheduledAt: { gte: new Date() },
        },
      }),
      prisma.appointment.count({
        where: {
          doctorId,
          status: { in: [AppointmentStatus.CONFIRMED, AppointmentStatus.PENDING] },
          scheduledAt: { gte: new Date() },
        },
      }),
      prisma.appointment.count({
        where: { doctorId, status: AppointmentStatus.COMPLETED },
      }),

      // The next booking left today. Ordered ascending and taken one at a
      // time rather than filtered out of monthRows, because monthRows carries
      // no patient name or clinic and this needs both.
      prisma.appointment.findFirst({
        where: {
          doctorId,
          scheduledAt: { gte: new Date(), lt: new Date(nowMs + DAY_MS) },
          status: {
            in: [AppointmentStatus.CONFIRMED, AppointmentStatus.PENDING],
          },
          approvalState: { not: ApprovalState.AWAITING_DOCTOR },
        },
        orderBy: { scheduledAt: "asc" },
        select: {
          id: true,
          scheduledAt: true,
          patientName: true,
          mode: true,
          reason: true,
          subscriptionId: true,
          clinic: { select: { name: true } },
        },
      }),

      // Who called off the cancellations. 90 days, matching every other rate
      // on the page.
      prisma.appointment.findMany({
        where: {
          doctorId,
          scheduledAt: { gte: since90 },
          status: {
            in: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW],
          },
        },
        select: { cancelledBy: true },
      }),

      // Written, checked by nobody yet. A doctor whose client left them a
      // review saw absolutely nothing until it was published.
      prisma.review.count({ where: { doctorId, status: "PENDING" } }),

      prisma.doctorTimeOff.findMany({
        where: { doctorId, endsAt: { gte: new Date() } },
        orderBy: { startsAt: "asc" },
        take: 3,
        select: { startsAt: true, endsAt: true, reason: true },
      }),

      // ── The week ahead, for the empty-seat figures ────────────────────
      // Held requests count as taken: the slot is not on sale while the
      // doctor decides, so calling it empty would invite double-booking.
      prisma.appointment.findMany({
        where: {
          doctorId,
          scheduledAt: { gte: weekFrom, lt: weekTo },
          status: {
            notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW],
          },
        },
        // The fees ride along for today's potential — see `todayPotential`.
        select: { scheduledAt: true, feeAtBooking: true, visitFee: true },
      }),
      prisma.doctorTimeOff.findMany({
        // Any block that overlaps the window at all, including one that
        // started last week and runs into it.
        where: { doctorId, startsAt: { lt: weekTo }, endsAt: { gt: weekFrom } },
        select: { startsAt: true, endsAt: true },
      }),
    ]);

  // ── Revenue, in four honest tiers ───────────────────────────────────────
  const revenue: RevenueTiers = {
    realised: 0,
    scheduled: 0,
    unresolved: 0,
    lost: 0,
    recovered: 0,
    discountGiven: 0,
  };

  for (const a of monthRows) {
    const v = valueOf(a);
    const past = a.scheduledAt.getTime() < nowMs;

    if (a.status === AppointmentStatus.CANCELLED || a.status === AppointmentStatus.NO_SHOW) {
      revenue.lost += v;
      revenue.recovered += a.cancellationFeeInr;
      continue;
    }
    if (a.status === AppointmentStatus.COMPLETED) {
      revenue.realised += v;
      revenue.discountGiven += a.discountInr;
      continue;
    }
    // A request the doctor has not accepted is not money yet.
    if (a.approvalState === ApprovalState.AWAITING_DOCTOR) continue;

    if (past) revenue.unresolved += v;
    else revenue.scheduled += v;
    revenue.discountGiven += a.discountInr;
  }

  const monthBooked = revenue.realised + revenue.unresolved + revenue.scheduled;
  const bookedCount = monthRows.filter(
    (a) =>
      a.status !== AppointmentStatus.CANCELLED &&
      a.status !== AppointmentStatus.NO_SHOW &&
      a.approvalState !== ApprovalState.AWAITING_DOCTOR
  ).length;

  const averageValue = bookedCount > 0 ? Math.round(monthBooked / bookedCount) : 0;
  // A closed period has nothing to project: the run rate IS the total.
  const projected = win.complete
    ? monthBooked
    : daysElapsed > 0
      ? Math.round((monthBooked / daysElapsed) * daysInPeriod)
      : 0;

  const daysLeft = win.complete ? 0 : Math.max(daysInPeriod - daysElapsed, 0);
  const weeksLeft = daysLeft / 7;
  const uplift = [1, 2, 5].map((perWeek) => ({
    perWeek,
    amount: Math.round(perWeek * averageValue * weeksLeft),
  }));

  // ── Patients ────────────────────────────────────────────────────────────
  const live = monthRows.filter((a) => a.status !== AppointmentStatus.CANCELLED);
  const thisMonthIds = new Set(live.map(identityOf));
  const guests = new Set(
    live.filter((a) => !a.patientUserId).map(identityOf)
  ).size;
  const priorIds = new Set(priorIdentities.map(identityOf));
  const returningCount = [...thisMonthIds].filter((id) => priorIds.has(id)).length;

  // ── Demand ──────────────────────────────────────────────────────────────
  const demandMap = new Map<string, number>();
  for (const a of recent) {
    if (a.status === AppointmentStatus.CANCELLED) continue;
    const key = a.reason ?? "__none";
    demandMap.set(key, (demandMap.get(key) ?? 0) + 1);
  }
  const demand = [...demandMap.entries()]
    .map(([key, count]) => ({
      key,
      // A booking with no reason is shown as such, never dropped — pre-intake
      // rows exist and hiding them would overstate the ones that remain.
      label:
        key === "__none"
          ? "No reason recorded"
          : reasonLabel(key as VisitReason) ?? key,
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 7);

  // ── Capacity and utilisation ────────────────────────────────────────────
  const capacityByDay = new Array(7).fill(0);
  for (const w of availability) {
    capacityByDay[w.dayOfWeek] += slotsInWindow(w.startTime, w.endTime, w.slotMinutes);
  }

  // Whole days off in the trailing 4 weeks reduce the denominator.
  const offDays = new Array(7).fill(0);
  for (const t of timeOff) {
    const from = Math.max(t.startsAt.getTime(), since28.getTime());
    const to = Math.min(t.endsAt.getTime(), nowMs);
    for (let d = from; d < to; d += DAY_MS) {
      offDays[new Date(d).getUTCDay()] += 1;
    }
  }

  const bookedByDay = new Array(7).fill(0);
  for (const a of recent) {
    if (a.status === AppointmentStatus.CANCELLED) continue;
    if (a.scheduledAt < since28 || a.scheduledAt.getTime() > nowMs) continue;
    bookedByDay[a.scheduledAt.getUTCDay()] += 1;
  }

  const byDay = capacityByDay.map((cap, day) => {
    const weeks = Math.max(4 - offDays[day] / 7, 0);
    const capacity = Math.round(cap * weeks);
    const booked = bookedByDay[day];
    return {
      day,
      label: WEEKDAY[day],
      capacity,
      booked,
      rate: capacity > 0 ? Math.min(booked / capacity, 1) : 0,
    };
  });

  const working = byDay.filter((d) => d.capacity > 0);
  const emptiest =
    working.length > 0
      ? working.reduce((a, b) => (a.rate <= b.rate ? a : b))
      : null;

  // ── Seats in the week ahead, and what the empty ones are worth ──────────
  // What one seat is worth, taken from what bookings have actually been worth
  // over 90 days rather than from the list price — a practice giving member
  // discounts or running long consults does not earn its headline fee, and a
  // per-seat figure that ignores that overstates every empty slot on screen.
  const seatSample = recent.filter(
    (a) =>
      a.status !== AppointmentStatus.CANCELLED &&
      a.status !== AppointmentStatus.NO_SHOW
  );
  const perSeat =
    seatSample.length >= MIN_SEAT_SAMPLE
      ? Math.round(
          seatSample.reduce((s, a) => s + valueOf(a), 0) / seatSample.length
        )
      : (doctor?.fee ?? 0);
  const perSeatBasis: "bookings" | "list-fee" =
    seatSample.length >= MIN_SEAT_SAMPLE ? "bookings" : "list-fee";

  const bookedAheadByDate = new Map<string, number>();
  for (const a of weekAheadRows) {
    const key = a.scheduledAt.toISOString().slice(0, 10);
    bookedAheadByDate.set(key, (bookedAheadByDate.get(key) ?? 0) + 1);
  }

  const seatDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekFrom.getTime() + i * DAY_MS);
    const seed = date.toISOString().slice(0, 10);
    const booked = bookedAheadByDate.get(seed) ?? 0;
    // Only today loses its past slots; every later day is bookable in full.
    const seats = seatsOnDate(
      seed,
      date.getUTCDay(),
      availability,
      weekAheadTimeOff,
      i === 0 ? nowMs : 0
    );
    return {
      date: seed,
      label: date.toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      }),
      short: WEEKDAY[date.getUTCDay()].slice(0, 3),
      isToday: i === 0,
      // A day can hold more bookings than it has open seats — an overbooked
      // or manually added visit. Clamping keeps "empty" at zero rather than
      // letting it go negative and print a refund.
      seats: Math.max(seats, booked),
      booked,
      empty: Math.max(seats - booked, 0),
    };
  });

  const totalSeats = seatDays.reduce((s, d) => s + d.seats, 0);
  const bookedSeats = seatDays.reduce((s, d) => s + d.booked, 0);
  const emptySeats = seatDays.reduce((s, d) => s + d.empty, 0);
  const workingAhead = seatDays.filter((d) => d.seats > 0);
  const emptiestAhead = workingAhead.length
    ? workingAhead.reduce((a, b) => (a.empty >= b.empty ? a : b))
    : null;

  const seats: SeatOutlook = {
    days: seatDays,
    totalSeats,
    bookedSeats,
    emptySeats,
    perSeat,
    perSeatBasis,
    bookedValue: bookedSeats * perSeat,
    emptyValue: emptySeats * perSeat,
    fillRate: totalSeats > 0 ? bookedSeats / totalSeats : 0,
    emptiestDay:
      emptiestAhead && emptiestAhead.empty > 0
        ? { label: emptiestAhead.label, empty: emptiestAhead.empty }
        : null,
  };

  /* ── What today is worth ─────────────────────────────────────────────
     Everything else on this page is a period: this month, last quarter, the
     week ahead. None of them answer the question a practitioner opening the
     dashboard at nine in the morning actually has, which is what today comes
     to if the rest of it fills.

     Three parts, and each is printed rather than blended, because a single
     number would hide which half is already certain:

       booked   the real fee on every visit in today's diary, cancellations
                and no-shows excluded. Already agreed, not yet all earned.
       open     seats still on sale today, priced at `perSeat` — the average
                of real bookings, not the list fee (see above).
       total    the two added: the ceiling for today.

     The whole day counts, not the remainder of it: a morning already seen is
     still today's money, and a figure that shrank as the day went on would
     read as the practice losing income by opening. */
  const todaySeed = weekFrom.toISOString().slice(0, 10);
  const todayRows = weekAheadRows.filter(
    (a) => a.scheduledAt.toISOString().slice(0, 10) === todaySeed
  );
  const todayBookedInr = todayRows.reduce((sum, a) => sum + valueOf(a), 0);
  const todayOpenSeats = seatDays[0]?.empty ?? 0;
  const todayOpenValue = todayOpenSeats * perSeat;

  const todayPotential = {
    bookedInr: todayBookedInr,
    bookedCount: todayRows.length,
    openSeats: todayOpenSeats,
    openValue: todayOpenValue,
    total: todayBookedInr + todayOpenValue,
    isWorkingDay: (seatDays[0]?.seats ?? 0) > 0,
  };

  // ── Busiest hours ───────────────────────────────────────────────────────
  const hourMap = new Map<number, number>();
  for (const a of recent) {
    if (a.status === AppointmentStatus.CANCELLED) continue;
    const h = a.scheduledAt.getUTCHours();
    hourMap.set(h, (hourMap.get(h) ?? 0) + 1);
  }
  // Sorted by HOUR, and covering every hour between the first and the last —
  // including the quiet ones, which are the whole point. Ranking the top four
  // by volume and plotting them on a time axis drew a shape that was not in
  // the data; a gap at 13:00 is information, and dropping it hid the lunch
  // hour the doctor might want to reclaim.
  const activeHours = [...hourMap.keys()].sort((a, b) => a - b);
  const busiestHours: { hour: number; label: string; count: number }[] = [];
  if (activeHours.length) {
    const from = activeHours[0];
    const to = activeHours[activeHours.length - 1];
    for (let h = from; h <= to; h++) {
      busiestHours.push({
        hour: h,
        label: `${String(h).padStart(2, "0")}:00`,
        count: hourMap.get(h) ?? 0,
      });
    }
  }

  // ── Operational rates ───────────────────────────────────────────────────
  const resolved = recent.filter((a) => a.scheduledAt.getTime() < nowMs);
  const noShows = resolved.filter((a) => a.status === AppointmentStatus.NO_SHOW).length;
  const cancels = resolved.filter((a) => a.status === AppointmentStatus.CANCELLED).length;

  const leadDays = recent.map(
    (a) => (a.scheduledAt.getTime() - a.createdAt.getTime()) / DAY_MS
  );
  const responses = recent
    .filter((a) => a.approvedAt)
    .map((a) => (a.approvedAt!.getTime() - a.createdAt.getTime()) / 3_600_000);

  const memberBookings = live.filter((a) => a.subscriptionId).length;

  // ── The window before, for a direction rather than a bare figure ────────
  // Same rule as the selected period: an unaccepted request is not money.
  let prevMonthBooked = 0;
  let prevBookedCount = 0;
  for (const a of prevRows) {
    if (
      a.status === AppointmentStatus.CANCELLED ||
      a.status === AppointmentStatus.NO_SHOW ||
      a.approvalState === ApprovalState.AWAITING_DOCTOR
    ) {
      continue;
    }
    prevMonthBooked += valueOf(a);
    prevBookedCount += 1;
  }
  // Null rather than +100% when there is nothing to compare against — a first
  // month is not infinite growth.
  const periodDelta =
    prevMonthBooked > 0 ? (monthBooked - prevMonthBooked) / prevMonthBooked : null;

  // ── Where the work happens ──────────────────────────────────────────────
  const clinicMap = new Map<string, { colorKey: string; count: number; value: number }>();
  for (const a of recent) {
    if (a.status === AppointmentStatus.CANCELLED) continue;
    const name = a.clinic?.name ?? "Not recorded";
    const entry = clinicMap.get(name) ?? {
      colorKey: a.clinic?.colorKey ?? "slate",
      count: 0,
      value: 0,
    };
    entry.count += 1;
    entry.value += valueOf(a);
    clinicMap.set(name, entry);
  }
  const clinicSplit = [...clinicMap.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.count - a.count);

  // ── Where bookings fall out of the pipe ─────────────────────────────────
  const requested = recent.length;
  const accepted = recent.filter(
    (a) =>
      a.status !== AppointmentStatus.CANCELLED &&
      a.approvalState !== ApprovalState.AWAITING_DOCTOR &&
      a.approvalState !== ApprovalState.DECLINED
  ).length;
  const seen = recent.filter((a) => a.status === AppointmentStatus.COMPLETED).length;
  const funnel = [
    { label: "Requested", count: requested },
    { label: "Accepted", count: accepted },
    { label: "Seen", count: seen },
  ];

  // ── Who cancels ─────────────────────────────────────────────────────────
  const cancellations = {
    byPatient: cancelledRows.filter((c) => c.cancelledBy === "PATIENT").length,
    byClinic: cancelledRows.filter(
      (c) => c.cancelledBy === "DOCTOR" || c.cancelledBy === "ADMIN"
    ).length,
    unattributed: cancelledRows.filter((c) => !c.cancelledBy).length,
    total: cancelledRows.length,
  };

  // ── The next one in ─────────────────────────────────────────────────────
  const nextToday = nextTodayRow
    ? {
        id: nextTodayRow.id,
        at: `${String(nextTodayRow.scheduledAt.getUTCHours()).padStart(2, "0")}:${String(
          nextTodayRow.scheduledAt.getUTCMinutes()
        ).padStart(2, "0")}`,
        minutesAway: Math.round(
          (nextTodayRow.scheduledAt.getTime() - nowMs) / 60_000
        ),
        patientName: nextTodayRow.patientName,
        mode: nextTodayRow.mode,
        clinicName: nextTodayRow.clinic?.name ?? null,
        reason: nextTodayRow.reason
          ? (reasonLabel(nextTodayRow.reason) ?? null)
          : null,
        isMember: Boolean(nextTodayRow.subscriptionId),
      }
    : null;

  // ── Leave already booked ────────────────────────────────────────────────
  const timeOffAhead = timeOffAheadRows.map((t) => ({
    startsAt: t.startsAt.toISOString().slice(0, 10),
    endsAt: t.endsAt.toISOString().slice(0, 10),
    reason: t.reason,
    // Inclusive of both ends: a single-day block reads "1 day", not "0".
    days: Math.max(
      1,
      Math.round((t.endsAt.getTime() - t.startsAt.getTime()) / DAY_MS)
    ),
  }));

  // The spark follows the selected window rather than a fixed 30 days, or a
  // doctor reading "Last month" would be shown a line covering this one.
  const seriesEnd = Math.min(monthEnd.getTime() - 1, nowMs);
  const seriesGrain: "day" | "week" = daysInPeriod > 70 ? "week" : "day";

  return {
    period,
    periodLabel,
    windowStart: monthStart,
    windowEnd: monthEnd,
    isComplete: win.complete,
    daysElapsed,
    daysInPeriod,

    revenue,
    periodBooked: monthBooked,
    prevPeriodBooked: prevMonthBooked,
    periodDelta,
    projected,
    averageValue,
    uplift,

    patients: {
      thisMonth: thisMonthIds.size,
      guests,
      returning: {
        value: thisMonthIds.size > 0 ? returningCount / thisMonthIds.size : 0,
        sampleSize: thisMonthIds.size,
      },
      returningCount,
      newCount: Math.max(thisMonthIds.size - returningCount, 0),
    },
    appointments: {
      upcoming,
      awaiting,
      completedAllTime,
      bookedCount,
      prevBookedCount,
      // Null rather than +100%: a first month is not infinite growth.
      countDelta:
        prevBookedCount > 0
          ? (bookedCount - prevBookedCount) / prevBookedCount
          : null,
    },

    demand,
    clinicSplit,
    funnel,
    utilisation: {
      byDay,
      weeklyCapacity: capacityByDay.reduce((a, b) => a + b, 0),
      emptiest: emptiest
        ? { label: emptiest.label, free: Math.max(emptiest.capacity - emptiest.booked, 0) }
        : null,
    },
    seats,
    todayPotential,
    busiestHours,
    nextToday,
    cancellations,
    reviewsPending,
    timeOffAhead,
    slug: doctor?.slug ?? "",

    ops: {
      noShowRate: {
        value: resolved.length ? noShows / resolved.length : 0,
        sampleSize: resolved.length,
      },
      cancelRate: {
        value: resolved.length ? cancels / resolved.length : 0,
        sampleSize: resolved.length,
      },
      medianLeadDays: { value: median(leadDays), sampleSize: leadDays.length },
      medianResponseHours: {
        value: median(responses),
        sampleSize: responses.length,
      },
      memberShare: {
        value: live.length ? memberBookings / live.length : 0,
        sampleSize: live.length,
      },
    },

    reviews: {
      rating: Number(doctor?.rating ?? 0),
      count: doctor?.reviews ?? 0,
      latest: reviewRows.map((r) => ({
        id: r.id,
        rating: r.rating,
        title: r.title,
        body: r.body,
        at: (r.publishedAt ?? r.createdAt).toISOString().slice(0, 10),
      })),
    },

    series: buildSeries(monthRows, monthStart, seriesEnd, seriesGrain),
    seriesGrain,
  };
}

/**
 * Zero-filled buckets across the window, so the chart has no gaps.
 *
 * Six months of daily points is 180 slivers one pixel wide on a phone, which
 * is noise rather than a trend, so anything past ten weeks buckets by week.
 * The grain is returned alongside the data — a chart that silently changes
 * what a point means is a chart that lies quietly.
 */
function buildSeries(
  rows: {
    scheduledAt: Date;
    status: AppointmentStatus;
    feeAtBooking: number;
    visitFee: number;
  }[],
  from: Date,
  toMs: number,
  grain: "day" | "week"
): { date: string; value: number; count: number }[] {
  const step = grain === "week" ? 7 * DAY_MS : DAY_MS;
  const startMs = from.getTime();
  const keyOf = (ms: number) => {
    const offset = Math.floor((ms - startMs) / step);
    return new Date(startMs + offset * step).toISOString().slice(0, 10);
  };

  const buckets = new Map<string, { value: number; count: number }>();
  for (let t = startMs; t <= toMs; t += step) {
    buckets.set(new Date(t).toISOString().slice(0, 10), { value: 0, count: 0 });
  }
  for (const a of rows) {
    if (a.status === AppointmentStatus.CANCELLED) continue;
    const b = buckets.get(keyOf(a.scheduledAt.getTime()));
    if (!b) continue;
    b.value += valueOf(a);
    b.count += 1;
  }
  return [...buckets.entries()].map(([date, b]) => ({ date, ...b }));
}
