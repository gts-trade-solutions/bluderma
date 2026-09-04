import { ConsultMode } from "@prisma/client";

import type { DashboardMetrics, DashboardPeriod } from "./metrics";
import type { AssetRow, ExpenseRow } from "./financeCore";
import type { ApplicationGap } from "./gaps";

/**
 * A worked example of a busy practice, for the tour.
 *
 * ── Why this exists ──────────────────────────────────────────────────────
 * A practitioner submits their application and then waits two working days
 * looking at a screen of em dashes. Everything the portal is for — the money,
 * the week, the seats, the rates — is invisible until the moment they are
 * approved, which is the moment they have least patience for learning it. So
 * the wait is where the tour goes.
 *
 * ── Why it is the real dashboard and not a mockup ────────────────────────
 * DashboardHome takes an optional `demo` bundle and, when given one, skips
 * its queries entirely. Every panel, every chart, every sentence underneath
 * is the component the doctor will actually use, drawing exactly the shapes
 * their own numbers will draw. A separate illustrated walkthrough would teach
 * a picture and go stale the first time the dashboard changed.
 *
 * ── Why it is honest about being fake ────────────────────────────────────
 * This codebase has deleted invented figures more than once, and PendingPreview
 * still shows "—" rather than a plausible number for exactly that reason. The
 * difference is disclosure: these numbers appear only on /doctor/portal/demo,
 * behind a banner that says DEMO DATA and cannot be scrolled away from, in a
 * tour that opens by saying none of it is real. Nothing here is ever written
 * to the database, and no real screen imports this file.
 *
 * ── Why it is deterministic ──────────────────────────────────────────────
 * No Math.random. The dashboard is a server component and a random figure
 * would differ between the server's render and any later one, so a doctor
 * pressing back would find their demo practice had had a different month.
 * Everything is either a constant or derived from the date it is generated
 * for, which is passed in rather than read from the clock so a test can pin it.
 */

export interface DemoBundle {
  metrics: DashboardMetrics;
  expenses: ExpenseRow[];
  machines: AssetRow[];
  /** Medicine sales in the window. Same shape the real query selects. */
  orders: { totalInr: number }[];
  /** Other income in the window. */
  income: { amountInr: number }[];
  gaps: ApplicationGap[];
}

/** Names for the sample week. Ordinary Indian names, none of them a real patient. */
const PATIENTS = [
  "R. Prasad",
  "S. Iyer",
  "A. Khan",
  "M. Rao",
  "J. Thomas",
  "N. Balan",
  "P. Menon",
  "K. Subramanian",
];

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const MONTH = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * A small integer sequence that looks like takings and is not random.
 *
 * A flat line teaches nothing about how the chart reads, and a random one
 * changes between renders. This is a fixed shape — two quiet Sundays, a
 * midweek peak — scaled by the fee.
 */
const DAY_SHAPE = [0, 1.15, 0.9, 1.3, 1.0, 1.25, 0.75];

export function buildDemoBundle(
  now: Date,
  period: DashboardPeriod = "this-month"
): DemoBundle {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const today = now.getUTCDate();

  const windowStart = new Date(Date.UTC(year, month, 1));
  const windowEnd = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59));
  const daysInPeriod = windowEnd.getUTCDate();
  const daysElapsed = Math.min(today, daysInPeriod);

  const FEE = 1200;

  // ── The series, and the totals derived from it ───────────────────────
  // Derived rather than stated, so the chart and the headline can never
  // disagree — which is the exact failure the real dashboard's own comment
  // describes having had.
  const series: { date: string; value: number; count: number }[] = [];
  for (let d = 1; d <= daysElapsed; d++) {
    const date = new Date(Date.UTC(year, month, d));
    const shape = DAY_SHAPE[date.getUTCDay()];
    // A deterministic wobble so consecutive days are not identical.
    const wobble = 1 + ((d * 7) % 5) / 20;
    const count = Math.round(shape * 4 * wobble);
    series.push({
      date: date.toISOString().slice(0, 10),
      value: count * FEE,
      count,
    });
  }

  const bookedCount = series.reduce((n, s) => n + s.count, 0);
  const periodBooked = series.reduce((n, s) => n + s.value, 0);

  // Split across the revenue tiers the way a real month falls out: most of
  // what is behind you completed, a little unresolved, the rest still ahead.
  const realised = Math.round(periodBooked * 0.62);
  const unresolved = Math.round(periodBooked * 0.06);
  const scheduled = periodBooked - realised - unresolved;
  const lost = Math.round(periodBooked * 0.08);

  const prevPeriodBooked = Math.round(periodBooked * 0.88);
  const prevBookedCount = Math.round(bookedCount * 0.9);

  const projected =
    daysElapsed > 0
      ? Math.round((periodBooked / daysElapsed) * daysInPeriod)
      : periodBooked;

  const averageValue = bookedCount > 0 ? Math.round(periodBooked / bookedCount) : FEE;

  // ── The seven days ahead ─────────────────────────────────────────────
  const seatDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.UTC(year, month, today + i));
    const dow = d.getUTCDay();
    const seats = dow === 0 ? 0 : 14;
    const booked = dow === 0 ? 0 : Math.max(0, Math.round(seats * (0.75 - i * 0.07)));
    return {
      date: d.toISOString().slice(0, 10),
      label: `${DAY_SHORT[dow]} ${d.getUTCDate()} ${MONTH[d.getUTCMonth()]}`,
      short: DAY_SHORT[dow],
      isToday: i === 0,
      seats,
      booked,
      empty: seats - booked,
    };
  });

  const totalSeats = seatDays.reduce((n, d) => n + d.seats, 0);
  const bookedSeats = seatDays.reduce((n, d) => n + d.booked, 0);
  const emptySeats = totalSeats - bookedSeats;
  const emptiest = seatDays
    .filter((d) => d.seats > 0)
    .reduce((top, d) => (d.empty > top.empty ? d : top), seatDays[1] ?? seatDays[0]);

  // ── The working week's shape ─────────────────────────────────────────
  const byDay = [1, 2, 3, 4, 5, 6].map((day) => {
    const capacity = day === 6 ? 8 : 14;
    const rate = [0, 0.86, 0.71, 0.93, 0.64, 0.89, 0.5][day];
    const booked = Math.round(capacity * rate);
    return {
      day,
      label: DAY_LONG[day],
      capacity,
      booked,
      rate: capacity > 0 ? booked / capacity : 0,
    };
  });
  const weeklyCapacity = byDay.reduce((n, d) => n + d.capacity, 0);
  const quietest = byDay.reduce((low, d) => (d.rate < low.rate ? d : low), byDay[0]);

  const metrics: DashboardMetrics = {
    period,
    periodLabel: `${monthName(month)} ${year}`,
    windowStart,
    windowEnd,
    isComplete: false,
    daysElapsed,
    daysInPeriod,

    revenue: {
      realised,
      scheduled,
      unresolved,
      lost,
      recovered: Math.round(lost * 0.25),
      discountGiven: Math.round(periodBooked * 0.04),
    },
    periodBooked,
    prevPeriodBooked,
    periodDelta:
      prevPeriodBooked > 0 ? periodBooked / prevPeriodBooked - 1 : null,
    projected,
    averageValue,
    uplift: [1, 2, 3].map((perWeek) => ({
      perWeek,
      amount: perWeek * 4 * averageValue,
    })),

    patients: {
      thisMonth: bookedCount,
      guests: Math.round(bookedCount * 0.15),
      returning: { value: 0.42, sampleSize: bookedCount },
      returningCount: Math.round(bookedCount * 0.42),
      newCount: bookedCount - Math.round(bookedCount * 0.42),
    },
    appointments: {
      upcoming: bookedSeats,
      awaiting: 3,
      completedAllTime: bookedCount * 7,
      bookedCount,
      prevBookedCount,
      countDelta:
        prevBookedCount > 0 ? bookedCount / prevBookedCount - 1 : null,
    },

    demand: [
      { key: "acne", label: "Acne", count: Math.round(bookedCount * 0.3) },
      { key: "pigmentation", label: "Pigmentation", count: Math.round(bookedCount * 0.22) },
      { key: "hair-loss", label: "Hair loss", count: Math.round(bookedCount * 0.18) },
      { key: "ageing", label: "Ageing", count: Math.round(bookedCount * 0.12) },
      { key: "__none", label: "Not said", count: Math.round(bookedCount * 0.18) },
    ],
    clinicSplit: [
      {
        name: "Nungambakkam",
        colorKey: "blue",
        count: Math.round(bookedCount * 0.58),
        value: Math.round(periodBooked * 0.58),
      },
      {
        name: "Adyar",
        colorKey: "teal",
        count: bookedCount - Math.round(bookedCount * 0.58),
        value: periodBooked - Math.round(periodBooked * 0.58),
      },
    ],
    funnel: [
      { label: "Requested", count: Math.round(bookedCount * 1.24) },
      { label: "Accepted", count: bookedCount },
      { label: "Seen", count: Math.round(bookedCount * 0.86) },
    ],
    utilisation: {
      byDay,
      weeklyCapacity,
      emptiest: {
        label: quietest.label,
        free: quietest.capacity - quietest.booked,
      },
    },
    seats: {
      days: seatDays,
      totalSeats,
      bookedSeats,
      emptySeats,
      perSeat: averageValue,
      perSeatBasis: "bookings",
      bookedValue: bookedSeats * averageValue,
      emptyValue: emptySeats * averageValue,
      fillRate: totalSeats > 0 ? bookedSeats / totalSeats : 0,
      emptiestDay: emptiest
        ? { label: emptiest.label, empty: emptiest.empty }
        : null,
    },
    /* Today's ceiling, in the same shape the real metrics build it. The demo
       day is a working one with a few seats left, because a tour that shows
       "nothing left to fill" teaches nothing about the tile. */
    todayPotential: {
      bookedInr: (seatDays[0]?.booked ?? 0) * averageValue,
      bookedCount: seatDays[0]?.booked ?? 0,
      openSeats: seatDays[0]?.empty ?? 0,
      openValue: (seatDays[0]?.empty ?? 0) * averageValue,
      total:
        ((seatDays[0]?.booked ?? 0) + (seatDays[0]?.empty ?? 0)) * averageValue,
      isWorkingDay: (seatDays[0]?.seats ?? 0) > 0,
    },
    busiestHours: [9, 10, 11, 12, 16, 17, 18, 19].map((hour) => ({
      hour,
      label: `${String(hour).padStart(2, "0")}:00`,
      count: [6, 9, 11, 5, 7, 12, 10, 4][[9, 10, 11, 12, 16, 17, 18, 19].indexOf(hour)],
    })),

    nextToday: {
      id: "demo-next",
      at: "16:30",
      minutesAway: 42,
      patientName: PATIENTS[0],
      mode: ConsultMode.CLINIC,
      clinicName: "Nungambakkam",
      reason: "Acne review",
      isMember: true,
    },

    cancellations: {
      byPatient: 4,
      byClinic: 1,
      unattributed: 0,
      total: 5,
    },

    reviewsPending: 2,

    timeOffAhead: [],

    slug: "your-practice",

    ops: {
      noShowRate: { value: 0.06, sampleSize: bookedCount },
      cancelRate: { value: 0.09, sampleSize: bookedCount },
      medianLeadDays: { value: 3, sampleSize: bookedCount },
      medianResponseHours: { value: 2.5, sampleSize: 24 },
      memberShare: { value: 0.21, sampleSize: bookedCount },
    },

    reviews: {
      rating: 4.8,
      count: 37,
      latest: [
        {
          id: "demo-r1",
          rating: 5,
          title: "Explained everything properly",
          body: "Took the time to go through what was actually causing it rather than just prescribing something.",
          at: iso(now, -3),
        },
        {
          id: "demo-r2",
          rating: 5,
          title: "Worth the wait",
          body: "Clinic runs on time and the aftercare sheet was genuinely useful.",
          at: iso(now, -9),
        },
      ],
    },

    series,
    seriesGrain: "day",
  };

  // ── The cost side, so "what you keep" has both halves ────────────────
  const expenses: ExpenseRow[] = [
    { category: "RENT", amountInr: 85_000 },
    { category: "SALARY", amountInr: 142_000, headcount: 6 },
    { category: "CONSUMABLES", amountInr: 46_500 },
    { category: "UTILITIES", amountInr: 18_200 },
    { category: "MARKETING", amountInr: 22_000 },
    { category: "MAINTENANCE", amountInr: 9_400 },
    { category: "MEDICINES", amountInr: 31_800 },
    { category: "LAUNDRY", amountInr: 6_300 },
  ];

  const machines: AssetRow[] = [
    {
      id: "demo-laser",
      name: "Fractional CO2 laser",
      purpose: "Scar revision and resurfacing",
      costInr: 1_450_000,
      upkeepInr: 60_000,
      purchasedOn: new Date(Date.UTC(year - 1, month, 12)),
      uses: Array.from({ length: 46 }, (_, i) => ({
        chargedInr: 12_000 + (i % 4) * 1_500,
        usedOn: new Date(Date.UTC(year - 1, month, 12 + i * 7)),
      })),
    },
    {
      id: "demo-diode",
      name: "Diode laser hair removal",
      purpose: "Full-body and facial hair reduction",
      costInr: 900_000,
      upkeepInr: 24_000,
      purchasedOn: new Date(Date.UTC(year, Math.max(month - 5, 0), 3)),
      uses: Array.from({ length: 62 }, (_, i) => ({
        chargedInr: 4_500 + (i % 3) * 800,
        usedOn: new Date(Date.UTC(year, Math.max(month - 5, 0), 3 + i * 3)),
      })),
    },
  ];

  // The other two revenue streams, so the demo dashboard shows the same
  // four-part shape a real one does rather than a bookings-only version of it.
  const orders = Array.from({ length: 14 }, (_, i) => ({
    totalInr: 1_800 + (i % 5) * 640,
  }));
  const income = [
    { amountInr: 18_400 },
    { amountInr: 7_200 },
    { amountInr: 35_000 },
  ];

  return { metrics, expenses, machines, orders, income, gaps: [] };
}

function monthName(monthIndex: number): string {
  return [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ][monthIndex];
}

function iso(from: Date, dayOffset: number): string {
  const d = new Date(from.getTime() + dayOffset * 86_400_000);
  return d.toISOString();
}
