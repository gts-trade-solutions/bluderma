import Link from "next/link";
import { Suspense } from "react";

import { Empty, Tag, portalBtnQuiet } from "@/components/doctor/portalUi";
import { getDashboardMetrics, type DashboardPeriod } from "@/lib/doctor/metrics";
import type { DemoBundle } from "@/lib/doctor/demoMetrics";
import { advisoryGaps, getApplicationGaps } from "@/lib/doctor/gaps";
import { clinicWallClock } from "@/lib/queries/availability";
import { hexFor, swatchFor } from "@/components/doctor/clinicColors";
import { MedicineOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  machineStatus,
  netFor,
  recoveryFor,
  revenueFor,
  type RevenueSummary,
} from "@/lib/doctor/financeCore";
import ProfitPanel from "./ProfitPanel";
import BookingsChart from "./BookingsChart";
import ShareLink from "./ShareLink";
import PeriodPicker from "./PeriodPicker";
import InsightStrip, { InsightStripSkeleton } from "./InsightStrip";
import {
  HoursChart,
  RankedBars,
  RevenueDonut,
  SeatWeekChart,
  UpliftChart,
  UtilisationChart,
} from "./Charts";
import {
  ChartPanel,
  Kpi,
  MoneyCard,
  RateRow,
  SectionHead,
  Summary,
  money,
  moneyShort,
} from "./kit";

/**
 * The practitioner's dashboard.
 *
 * ── What the client asked for, and what changed ──────────────────────────
 *
 * The note back from the practice was blunt: a doctor opening this could not
 * work out what most of it meant. Four things were wrong, and all four are
 * about comprehension rather than data — every figure on the old screen was
 * correct.
 *
 *  1. THE HEADLINE HAD NO NOUN. "₹2,91,570" sat under the word "Booked" with
 *     four pills beneath it — Completed, Still to come, Awaiting outcome,
 *     Lost. Nobody could say whether that was money received, money owed or
 *     money hoped for. Each state now carries the sentence that defines it,
 *     printed rather than hidden in a tooltip, because the reader who needs
 *     the explanation is exactly the reader who will not hover for it.
 *
 *  2. TWO TOTALS FOR ONE MONTH. The hero read ₹2,91,570 and the donut beside
 *     it read ₹3,09,730, because the ring counted cancelled visits and the
 *     headline did not. Both were right; together they were unusable. The
 *     ring now holds only what the total holds, and lost money is shown
 *     beside it where it cannot change what the total means.
 *
 *  3. THE CHART WAS A SHAPE, NOT A READING. A smoothed area sparkline with no
 *     axes at all, interpolating through days that had no bookings. Replaced
 *     with dated bars — see BookingsChart.tsx.
 *
 *  4. NOTHING PRICED AN EMPTY SLOT. "60% of 77 slots" was the closest the
 *     screen came, and a doctor cannot act on a percentage. The seats section
 *     says how many are open in the week ahead, what one is worth and what
 *     the gap adds up to.
 *
 * The layout follows the reference decks the client sent: a KPI row across
 * the top, then titled panels each carrying one chart and one plain-English
 * finding underneath, then a summary row closing the page. The dark hero band
 * is gone — the references are light, and a navy slab was carrying one number
 * that now sits in a tile with three others.
 *
 * Every figure here is computed in lib/doctor/metrics.ts. Nothing on this
 * screen is estimated by a model, including the projections — those are
 * arithmetic, and they say so.
 */

/** A rate is only printed once enough bookings exist to mean anything. */
const MIN_SAMPLE = 5;

/**
 * "3 of the 18 people you saw were booking with you for the first time."
 *
 * One sentence carrying the count, the total, and what the count means, so
 * neither client tile depends on the other having been read first. Singular
 * and plural are spelled out: "1 of 1 people" is the kind of thing that makes
 * a dashboard look unfinished.
 */
function clientSplit(
  count: number,
  total: number,
  kind: "new" | "returning"
): string {
  if (total === 0) return "Nobody booked with you this period.";

  const people = total === 1 ? "person" : "people";
  const verb = count === 1 ? "was" : "were";
  const tail =
    kind === "new"
      ? `${verb} booking with you for the first time.`
      : "had been to you before.";

  if (count === total) {
    return total === 1
      ? `The one person you saw this period ${tail}`
      : `All ${total} ${people} you saw this period ${tail}`;
  }
  if (count === 0) {
    return kind === "new"
      ? `None of the ${total} ${people} you saw this period were new to you.`
      : `None of the ${total} ${people} you saw this period had been before.`;
  }
  return `${count} of the ${total} ${people} you saw this period ${tail}`;
}

export default async function DashboardHome({
  doctorId,
  doctorName,
  period = "this-month",
  demo,
}: {
  doctorId: string;
  doctorName: string;
  /** Which window the money figures cover. Comes from ?period=. */
  period?: DashboardPeriod;
  /**
   * A worked example, for the tour a practitioner sees while they wait to be
   * approved. When present, EVERY query below is skipped and the figures come
   * from lib/doctor/demoMetrics.ts instead.
   *
   * Deliberately a prop on the real component rather than a parallel demo
   * screen: a separate mock would teach a practitioner a layout that drifts
   * out of step with this one the first week either changes, and the whole
   * point of the tour is that they arrive already knowing where things are.
   *
   * Only /doctor/portal/demo passes it, and that page is wrapped in a banner
   * that says so.
   */
  demo?: DemoBundle;
}) {
  // The listing checklist was shown all through onboarding and then never
  // again — yet "no photo, no languages, no links" is exactly what costs an
  // APPROVED doctor the bookings this page is measuring.
  const [m, gaps] = demo
    ? [demo.metrics, demo.gaps]
    : await Promise.all([
        getDashboardMetrics(doctorId, period),
        getApplicationGaps(doctorId),
      ]);

  // Costs over the SAME window the takings cover, so the two halves of "what
  // you keep" are measuring the same period. Machines are read whole rather
  // than windowed: recovery is a lifetime figure, and a machine that earned
  // nothing this month has not become less recovered.
  const [periodExpenses, machines, periodOrders, periodIncome] = demo
    ? [demo.expenses, demo.machines, demo.orders, demo.income]
    : await Promise.all([
        prisma.practiceExpense.findMany({
          where: { doctorId, spentOn: { gte: m.windowStart, lte: m.windowEnd } },
          select: { category: true, amountInr: true, headcount: true },
        }),
        prisma.practiceAsset.findMany({
          where: { doctorId, isActive: true },
          orderBy: { purchasedOn: "desc" },
          select: {
            id: true,
            name: true,
            purpose: true,
            costInr: true,
            upkeepInr: true,
            purchasedOn: true,
            uses: { select: { chargedInr: true, usedOn: true } },
          },
        }),
        // Medicine sales and other income, over the SAME window as the
        // bookings. This dashboard and /doctor/portal/finance have to agree
        // on what "revenue" means or the practitioner has two numbers for one
        // month and no way to tell which is the real one — which is precisely
        // the failure the comment at the top of this file describes having
        // had once already, between the hero figure and the donut.
        prisma.medicineOrder.findMany({
          where: {
            doctorId,
            createdAt: { gte: m.windowStart, lte: m.windowEnd },
            status: { not: MedicineOrderStatus.CANCELLED },
          },
          select: { totalInr: true },
        }),
        prisma.practiceIncome.findMany({
          where: { doctorId, receivedOn: { gte: m.windowStart, lte: m.windowEnd } },
          select: { amountInr: true },
        }),
      ]);

  // Machine charges inside the window only. `machines` above carries every use
  // ever recorded, which is right for payback — a lifetime question — and
  // wrong for revenue, which is a monthly one.
  const windowUses = machines.flatMap((a) =>
    a.uses.filter((u) => u.usedOn >= m.windowStart && u.usedOn <= m.windowEnd)
  );

  const revenue: RevenueSummary = revenueFor({
    bookingsInr: m.periodBooked,
    bookingCount: m.appointments.bookedCount,
    medicinesInr: periodOrders.reduce((n, o) => n + o.totalInr, 0),
    medicineOrderCount: periodOrders.length,
    proceduresInr: windowUses.reduce((n, u) => n + Math.max(u.chargedInr, 0), 0),
    procedureCount: windowUses.length,
    otherInr: periodIncome.reduce((n, i) => n + i.amountInr, 0),
    otherCount: periodIncome.length,
  });

  const net = netFor(revenue.totalInr, periodExpenses);
  const recoveries = machines.map((a) => recoveryFor(a, new Date()));
  const listingGaps = advisoryGaps(gaps);
  // "Dr. Nithya": a practitioner is addressed by title, and the greeting
  // read as first-name familiarity without it. Any existing "Dr." is
  // stripped first so it can never double up.
  const salutation = `Dr. ${doctorName.replace(/^Dr[. ]+/i, "").split(" ")[0]}`;
  const todayIso = clinicWallClock().toISOString().slice(0, 10);
  const since = comparisonLabel(m.period);

  const share = (n: number) =>
    m.periodBooked > 0 ? Math.round((n / m.periodBooked) * 100) : 0;

  const best = m.series.reduce(
    (top, d) => (d.value > top.value ? d : top),
    { date: "", value: 0, count: 0 }
  );
  const topReason = m.demand.find((d) => d.key !== "__none") ?? null;

  return (
    <>
      {/* ── The header ─────────────────────────────────────────────────
          One row, and everything that used to sit under it as a full-width
          banner is now a chip inside it. Two stacked banners — held requests,
          next patient — cost about 180px above the fold, which pushed every
          chart on the page below it: a doctor opened their dashboard and the
          first thing they could see was no data at all. Neither fact is
          dropped; both are one tap away in the same colours, at a tenth of
          the height. */}
      <header className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-brand-600">
            <span
              aria-hidden
              className="h-[3px] w-6 rounded-full bg-gradient-to-r from-brand-500 to-teal-400"
            />
            {m.periodLabel}
          </p>
          <h1 className="mt-1.5 font-display text-[22px] font-extrabold leading-tight tracking-[-0.035em] text-slate-900 sm:text-[28px]">
            {greeting()}, {salutation}
          </h1>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {m.appointments.awaiting > 0 && (
            <Link
              href="/doctor/portal/requests"
              className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 py-1.5 pl-1.5 pr-3.5 text-xs font-bold text-amber-900 transition hover:bg-amber-100"
            >
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-amber-500 text-[11px] font-bold text-white">
                {m.appointments.awaiting}
              </span>
              <span>
                need{m.appointments.awaiting === 1 ? "s" : ""} your confirmation
              </span>
            </Link>
          )}

          {m.nextToday && (
            <Link
              href="/doctor/portal/today"
              className="inline-flex min-w-0 items-center gap-2 rounded-full border border-teal-200 bg-teal-50 py-1.5 pl-3 pr-3.5 text-xs font-bold text-teal-900 transition hover:bg-teal-100"
            >
              <span className="tabular-nums">{m.nextToday.at}</span>
              <span className="h-3 w-px bg-teal-300" aria-hidden />
              <span className="max-w-[9rem] truncate font-semibold">
                {m.nextToday.patientName}
              </span>
              <span className="font-semibold text-teal-700">
                {countdown(m.nextToday.minutesAway)}
              </span>
            </Link>
          )}

          <PeriodPicker value={m.period} />
        </div>
      </header>

      {/* ── The four headline figures ──────────────────────────────────── */}
      {/* Two across on a phone rather than one: four full-width tiles is four
          screens of scrolling before the first chart. */}
      <div className="mb-5 grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        {/* The labels are the plainest words that are still true.
            "Booked value" and "Visits booked" both lead on a word doing
            grammatical work rather than naming a thing, and a reader has to
            finish the phrase before they know what they are looking at.
            "Returning" was the worst of them: returning what?

            "Revenue" is the word a practitioner already uses for the first
            one. "Booked" stays in the hint rather than the label, because it
            is the caveat, not the subject. */}
        <Kpi
          data-tour="kpis"
          label="Revenue booked"
          value={money(m.periodBooked)}
          delta={m.periodDelta}
          since={since}
          tone="brand"
          icon="rupee"
          hint="What clients agreed to pay. Not what has reached you yet, and cancelled visits are left out."
        />
        <Kpi
          label="Appointments"
          value={String(m.appointments.bookedCount)}
          delta={m.appointments.countDelta}
          since={since}
          tone="teal"
          icon="calendar"
          hint={
            m.appointments.upcoming === 1
              ? "Booked in this period. 1 is still ahead of you."
              : `Booked in this period. ${m.appointments.upcoming} are still ahead of you.`
          }
        />
        {/* These two are halves of one number and were not written that way.
            "Returning 15" over "100% of your clients had been before" made a
            reader work out for themselves that the 0 beside it was the other
            half. Both carry the same denominator in words now, so neither
            depends on the other having been read first. */}
        <Kpi
          label="First-time clients"
          value={String(m.patients.newCount)}
          tone="violet"
          icon="users"
          hint={clientSplit(m.patients.newCount, m.patients.thisMonth, "new")}
          href="/doctor/portal/calendar"
        />
        <Kpi
          label="Repeat clients"
          value={String(m.patients.returningCount)}
          tone="amber"
          icon="repeat"
          hint={clientSplit(
            m.patients.returningCount,
            m.patients.thisMonth,
            "returning"
          )}
        />
      </div>

      {/* ── The money: over time, and where it sits ────────────────────── */}
      <SectionHead
        data-tour="money"
        title="Your money"
        sub="What was booked, when it was booked, and which part of it you have actually earned."
      />
      <div className="mb-5 grid gap-3.5 lg:grid-cols-3">
        <ChartPanel
          className="lg:col-span-2"
          index={0}
          tone="brand"
          icon="trend"
          title="Revenue booked over time"
          sub={`${m.seriesGrain === "week" ? "Week by week" : "Day by day"} across ${m.periodLabel}`}
          action={
            !m.isComplete && m.projected > 0 ? (
              <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-600 ring-1 ring-slate-200">
                At this rate:{" "}
                <span className="tabular-nums text-slate-900">
                  {money(m.projected)}
                </span>{" "}
                <span className="font-semibold text-slate-400">by month end</span>
              </span>
            ) : undefined
          }
          note={
            best.value > 0 ? (
              <>
                <strong className="font-bold text-slate-900">
                  Your best {m.seriesGrain === "week" ? "week" : "day"}
                  {m.seriesGrain === "week" ? " started " : " was "}
                  {prettyDay(best.date)}
                </strong>{" "}
                — {money(best.value)} from {best.count} booking
                {best.count === 1 ? "" : "s"}. Each bar is one{" "}
                {m.seriesGrain === "week" ? "week" : "day"} of bookings; the
                green line is the running average, which is the part worth
                watching.
                {!m.isComplete && m.projected > 0 && (
                  <>
                    {" "}
                    {/* Show the sum, do not just assert the total. It is
                        booked-so-far ÷ days-so-far × days-in-period, which is
                        three numbers a doctor can check against their own
                        diary in a few seconds. Without them "on track for"
                        reads as a forecast the system is confident about,
                        and it is not one: it assumes the rest of the period
                        looks like the part already gone. */}
                    That projection is arithmetic, not a forecast:{" "}
                    <strong className="font-bold text-slate-900">
                      {money(m.periodBooked)}
                    </strong>{" "}
                    booked over {m.daysElapsed} day
                    {m.daysElapsed === 1 ? "" : "s"} is{" "}
                    <strong className="font-bold text-slate-900">
                      {money(Math.round(m.periodBooked / Math.max(m.daysElapsed, 1)))}
                    </strong>{" "}
                    a day, and {m.daysInPeriod} days at that rate comes to{" "}
                    <strong className="font-bold text-slate-900">
                      {money(m.projected)}
                    </strong>
                    . It assumes the {m.daysInPeriod - m.daysElapsed} day
                    {m.daysInPeriod - m.daysElapsed === 1 ? "" : "s"} left look
                    like the ones already gone.
                  </>
                )}
              </>
            ) : (
              "Nothing booked in this period yet. Your booking link is at the bottom of this page."
            )
          }
        >
          <BookingsChart
            data={m.series}
            grain={m.seriesGrain}
            todayIso={todayIso}
          />
        </ChartPanel>

        <ChartPanel
          index={1}
          tone="teal"
          icon="wallet"
          title="Where your money is"
          sub={
            m.periodBooked > 0
              ? `The ${money(m.periodBooked)} above, split three ways`
              : "Nothing booked in this period yet"
          }
          note={
            m.revenue.lost > 0
              ? `Cancelled visits are worth ${money(m.revenue.lost)} and are not in this ring — that money was never earned.`
              : "Nothing was cancelled in this period."
          }
        >
          <RevenueDonut
            realised={m.revenue.realised}
            scheduled={m.revenue.scheduled}
            unresolved={m.revenue.unresolved}
          />

          <ul className="mt-3 space-y-1.5">
            <DonutKey
              dot="bg-teal-500"
              label="Money earned"
              amount={money(m.revenue.realised)}
            />
            <DonutKey
              dot="bg-brand-600"
              label="Money coming in"
              amount={money(m.revenue.scheduled)}
            />
            {m.revenue.unresolved > 0 && (
              <DonutKey
                dot="bg-amber-500"
                label="Not closed off"
                amount={money(m.revenue.unresolved)}
              />
            )}
          </ul>
        </ChartPanel>
      </div>

      {/* ── What each of those four words means ────────────────────────── */}
      {/* Their own row, four across. Stacked down the side of the donut they
          made that panel 949px tall, which stretched the chart beside it to
          match and left 600px of nothing beneath a 260px chart. */}
      <div className="mb-5 grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        <MoneyCard
          dot="bg-teal-500"
          label="Money earned"
          amount={money(m.revenue.realised)}
          share={share(m.revenue.realised)}
          body="Visits that have happened and that you marked complete in your calendar."
        />
        <MoneyCard
          dot="bg-brand-600"
          label="Money coming in"
          amount={money(m.revenue.scheduled)}
          share={share(m.revenue.scheduled)}
          body="Visits that are booked and confirmed but have not happened yet."
        />
        <MoneyCard
          dot="bg-amber-500"
          label="Not closed off"
          amount={money(m.revenue.unresolved)}
          share={share(m.revenue.unresolved)}
          body="The visit date has passed but it was never marked complete. Close these off and the money moves into earned."
          action={
            m.revenue.unresolved > 0 ? (
              <Link
                href="/doctor/portal/calendar"
                className="text-[11px] font-bold text-brand-600 hover:text-brand-700"
              >
                Tidy these up →
              </Link>
            ) : undefined
          }
        />
        <MoneyCard
          dot="bg-rose-600"
          label="Money lost"
          amount={money(m.revenue.lost)}
          body="Cancelled, or the client did not turn up. This is not part of the total above."
          action={
            m.revenue.recovered > 0 ? (
              <span className="text-[11px] font-semibold text-slate-500">
                You kept {money(m.revenue.recovered)} in cancellation fees
              </span>
            ) : undefined
          }
        />
      </div>

      {/* ── Empty seats ────────────────────────────────────────────────── */}
      <SectionHead
        data-tour="seats"
        title="Your empty seats"
        sub="One seat is one appointment slot in your working hours. This is the next seven days, so it is the part you can still do something about."
      />
      <div className="mb-5">
        <ChartPanel
          index={2}
          tone="amber"
          icon="seat"
          title="Seats in the next 7 days"
          sub={
            m.seats.totalSeats > 0
              ? `${m.seats.totalSeats} seats in total · ${Math.round(m.seats.fillRate * 100)}% already taken`
              : "No working hours set for the week ahead"
          }
          note={
            m.seats.emptiestDay ? (
              <>
                <strong className="font-bold text-slate-900">
                  {m.seats.emptiestDay.label} has the most room
                </strong>{" "}
                — {m.seats.emptiestDay.empty} seat
                {m.seats.emptiestDay.empty === 1 ? "" : "s"} nobody has taken,
                worth about{" "}
                <strong className="font-bold text-slate-900">
                  {money(m.seats.emptiestDay.empty * m.seats.perSeat)}
                </strong>
                . The value of a seat is{" "}
                {m.seats.perSeatBasis === "bookings"
                  ? "your own average booking over the last 90 days"
                  : "your listed fee, because there are not yet enough bookings to average"}
                , so treat it as a guide rather than a promise.
              </>
            ) : m.seats.totalSeats > 0 ? (
              "Every seat in the next seven days is taken. Nothing to fill."
            ) : (
              "Set your working hours under Practice and your seats will appear here."
            )
          }
        >
          <div className="mb-4 grid grid-cols-2 gap-2.5 xl:grid-cols-4">
            <SeatStat
              tone="rose"
              label="Seats still open"
              value={String(m.seats.emptySeats)}
              money={money(m.seats.emptyValue)}
              hint="What you would earn if every one of them was booked"
            />
            <SeatStat
              tone="teal"
              label="Seats already taken"
              value={String(m.seats.bookedSeats)}
              money={money(m.seats.bookedValue)}
              hint="Clients are booked into these"
            />
            <SeatStat
              tone="brand"
              label="One seat is worth"
              value={money(m.seats.perSeat)}
              hint={
                m.seats.perSeatBasis === "bookings"
                  ? "Your average booking, last 90 days"
                  : "Your listed fee — too few bookings to average yet"
              }
            />
            <SeatStat
              tone="violet"
              label="Week filled"
              value={
                m.seats.totalSeats > 0
                  ? `${Math.round(m.seats.fillRate * 100)}%`
                  : "—"
              }
              hint={
                m.seats.totalSeats > 0
                  ? `${m.seats.bookedSeats} of ${m.seats.totalSeats} seats`
                  : "No hours set"
              }
            />
          </div>

          <SeatWeekChart data={m.seats.days} perSeat={m.seats.perSeat} />

          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-semibold text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-teal-500" />
              Booked
            </span>
            <span className="flex items-center gap-1.5">
              {/* Amber, matching the bar. It was slate-200 — the same
                  near-white as the grid lines — so the legend agreed with a
                  chart nobody could read. */}
              <span className="h-2.5 w-2.5 rounded-sm bg-amber-300" />
              Still open
            </span>
            <span className="text-slate-400">
              The number above each bar is that day&apos;s total seats
            </span>
          </div>
        </ChartPanel>
      </div>

      {/* Suspended so the dashboard paints before the first generation of the
          day finishes — the numbers above are the point, this is commentary. */}
      {/* Not on the demo path. getDailyInsights CACHES what it produces
          against the doctorId, so running it over invented figures would
          write a demo month's suggestions into this practitioner's real
          insight cache — and they would still be sitting there on the
          dashboard the week after approval, quoting a revenue figure that
          never existed. */}
      {!demo && (
        <Suspense fallback={<InsightStripSkeleton />}>
          <InsightStrip doctorId={doctorId} metrics={m} />
        </Suspense>
      )}

      {/* ── Growth, as arithmetic ─────────────────────────────────────── */}
      {/* A projection of a period that has already ended is not a projection.
          `uplift` computes to zero for a closed window, and three cards each
          reading "+₹0" would read as a broken dashboard rather than as a
          question that does not apply. */}
      {m.averageValue > 0 && !m.isComplete && (
        <div className="mb-5">
          <ChartPanel
            index={3}
            tone="teal"
            icon="trend"
            title="What a few more clients a week would be worth"
            sub={`Your ${money(m.averageValue)} average booking × the weeks left in ${m.periodLabel}`}
            note={
              <>
                {m.periodLabel} is on track for{" "}
                <strong className="font-bold text-slate-900">
                  {money(m.projected)}
                </strong>{" "}
                at your current rate. Each bar is what that figure would grow by
                — seeing one more client a week for the{" "}
                {Math.max(m.daysInPeriod - m.daysElapsed, 0)} days left is worth{" "}
                <strong className="font-bold text-slate-900">
                  {money(m.uplift[0]?.amount ?? 0)}
                </strong>
                . This is multiplication, not a forecast: it assumes those
                clients book at your average and that nothing else changes.
              </>
            }
          >
            <UpliftChart projected={m.projected} uplift={m.uplift} />
          </ChartPanel>
        </div>
      )}

      {/* ── What is left ───────────────────────────────────────────────── */}
      <div data-tour="profit">
        <ProfitPanel
          net={net}
          revenue={revenue}
          recoveries={recoveries}
          statusFor={machineStatus}
          periodLabel={m.periodLabel}
        />
      </div>

      {/* ── The diary ──────────────────────────────────────────────────── */}
      <SectionHead
        data-tour="diary"
        title="Your diary"
        sub="Which days and which hours actually fill. Both cover the pattern behind you, not the week ahead."
      />
      <div className="mb-5 grid gap-3.5 lg:grid-cols-2">
        <ChartPanel
          index={3}
          tone="brand"
          icon="calendar"
          title="Which weekdays fill up"
          sub={`Last 4 weeks · ${m.utilisation.weeklyCapacity} seats in a normal week`}
          note={
            m.utilisation.emptiest && m.utilisation.emptiest.free > 0 ? (
              <>
                <strong className="font-bold text-slate-900">
                  {m.utilisation.emptiest.label}
                </strong>{" "}
                has been your quietest day — about {m.utilisation.emptiest.free}{" "}
                seats went unbooked over four weeks. Each bar is one weekday:
                the blue part was booked, the grey part nobody took.
              </>
            ) : (
              "Each bar is one weekday. The blue part was booked, the grey part nobody took."
            )
          }
        >
          <UtilisationChart data={m.utilisation.byDay} />
        </ChartPanel>

        <ChartPanel
          index={4}
          tone="violet"
          icon="clock"
          title="What time of day clients book"
          sub="Every hour you see work, last 90 days"
          note="One bar is one hour of the day, in clock order. A dip in the middle is your quiet hour — the one worth moving or trimming."
        >
          <HoursChart data={m.busiestHours} />
        </ChartPanel>
      </div>

      {/* ── Clients ────────────────────────────────────────────────────── */}
      <SectionHead
        title="Your clients"
        sub="What brings them in, and how reliably the bookings turn into visits."
      />
      <div className="mb-5 grid gap-3.5 lg:grid-cols-2">
        <ChartPanel
          index={5}
          tone="violet"
          icon="pulse"
          title="What clients come to you for"
          sub="From what each of them chose when booking, last 90 days"
          note={
            topReason
              ? `Most common: ${topReason.label}, ${topReason.count} booking${topReason.count === 1 ? "" : "s"} in 90 days.`
              : undefined
          }
        >
          <RankedBars
            data={m.demand.map((d) => ({
              key: d.key,
              label: d.label,
              value: d.count,
              muted: d.key === "__none",
            }))}
            emptyNote="Once clients start booking, this shows which concerns bring them to you."
          />
        </ChartPanel>

        <ChartPanel
          index={6}
          tone="teal"
          icon="chart"
          title="How reliably bookings turn into visits"
          sub="Last 90 days"
          note="A rate needs at least five visits behind it before it means anything, so anything thinner is left blank rather than guessed."
        >
          <div className="grid gap-2.5 sm:grid-cols-2">
            <RateRow
              label="Cancelled"
              value={m.ops.cancelRate.value}
              sampleSize={m.ops.cancelRate.sampleSize}
              tone="amber"
              goodWhenUp={false}
              sentence={(p) =>
                `About ${p} in every 100 booked visits were cancelled.`
              }
            />
            <RateRow
              label="Did not turn up"
              value={m.ops.noShowRate.value}
              sampleSize={m.ops.noShowRate.sampleSize}
              tone="rose"
              goodWhenUp={false}
              sentence={(p) =>
                `About ${p} in every 100 clients never arrived for their visit.`
              }
            />
            <RateRow
              label="Came back"
              value={m.patients.returning.value}
              sampleSize={m.patients.returning.sampleSize}
              tone="teal"
              sentence={(p) =>
                p >= 100
                  ? "Every client you saw this period had been to you before."
                  : `${p} of every 100 clients had seen you before.`
              }
            />
            <RateRow
              label="Gold Collar members"
              value={m.ops.memberShare.value}
              sampleSize={m.ops.memberShare.sampleSize}
              tone="brand"
              sentence={(p) => `${p} of every 100 bookings came from a member.`}
            />
          </div>

          <dl className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
            <MiniStat
              label="Clients book ahead by"
              value={
                m.ops.medianLeadDays.sampleSize >= MIN_SAMPLE
                  ? `${Math.round(m.ops.medianLeadDays.value)} days`
                  : "—"
              }
              hint="The typical gap between someone booking and the visit itself"
            />
            <MiniStat
              label="You reply in"
              value={
                m.ops.medianResponseHours.sampleSize >= MIN_SAMPLE
                  ? m.ops.medianResponseHours.value < 1
                    ? "under an hour"
                    : `${Math.round(m.ops.medianResponseHours.value)} hrs`
                  : "—"
              }
              hint="How long a booking request usually waits for your answer"
            />
          </dl>

          {/* A cancel rate on its own is not actionable. Whether the clinic
              cancelled on clients or clients cancelled on the clinic are
              opposite problems, and `cancelledBy` was already being written
              on every one of them. */}
          {m.cancellations.total > 0 && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Who called the cancellations off
              </p>
              <div className="mt-2.5 flex h-2.5 overflow-hidden rounded-full bg-slate-100">
                <span
                  className="bg-slate-400"
                  style={{
                    width: `${(m.cancellations.byPatient / m.cancellations.total) * 100}%`,
                  }}
                />
                <span
                  className="bg-rose-400"
                  style={{
                    width: `${(m.cancellations.byClinic / m.cancellations.total) * 100}%`,
                  }}
                />
              </div>
              <ul className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5">
                <CancelKey
                  dot="bg-slate-400"
                  label="The client cancelled"
                  count={m.cancellations.byPatient}
                />
                <CancelKey
                  dot="bg-rose-400"
                  label="You or our team cancelled"
                  count={m.cancellations.byClinic}
                />
                {m.cancellations.unattributed > 0 && (
                  <CancelKey
                    dot="bg-slate-200"
                    label="Not recorded"
                    count={m.cancellations.unattributed}
                  />
                )}
              </ul>
              {m.cancellations.byClinic > m.cancellations.byPatient && (
                <p className="mt-2.5 text-xs leading-relaxed text-slate-500">
                  More of these came from your side than the client&apos;s.
                  Trimming the hours you rarely keep is usually a smaller cost
                  than cancelling on someone who booked.
                </p>
              )}
            </div>
          )}
        </ChartPanel>
      </div>

      {/* ── Pipeline and locations ─────────────────────────────────────── */}
      <div className="mb-5 grid gap-3.5 lg:grid-cols-2">
        <ChartPanel
          index={7}
          tone="brand"
          icon="inbox"
          title="From request to completed visit"
          sub="Last 90 days · where bookings drop out"
          note="&ldquo;Visit completed&rdquo; counts only visits you marked complete, so it lags behind until your calendar is tidied."
        >
          <ul className="space-y-3.5">
            {m.funnel.map((step, i) => {
              const top = m.funnel[0].count || 1;
              const width = Math.round((step.count / top) * 100);
              const lost = i > 0 ? m.funnel[i - 1].count - step.count : 0;
              return (
                <li key={step.label}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-semibold text-slate-700">
                      {FUNNEL_LABELS[i] ?? step.label}
                    </span>
                    <span className="font-display text-base font-bold tabular-nums text-slate-900">
                      {step.count}
                      {lost > 0 && (
                        <span className="ml-2 text-xs font-semibold text-rose-600">
                          −{lost} lost here
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${
                        i === 0 ? "bg-brand-300" : i === 1 ? "bg-brand-500" : "bg-teal-500"
                      }`}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </ChartPanel>

        <ChartPanel
          index={8}
          tone="amber"
          icon="clinic"
          title={m.clinicSplit.length > 1 ? "Across your locations" : "Your location"}
          sub="Revenue booked by place, last 90 days"
          note={
            m.clinicSplit.length > 1
              ? `${m.clinicSplit[0].name.replace(/^BluDerma\s+/, "")} brings you the most work — ${m.clinicSplit[0].count} bookings.`
              : undefined
          }
        >
          {m.clinicSplit.length > 0 ? (
            <>
              <RankedBars
                unit="money"
                data={[...m.clinicSplit]
                  // Sorted by the figure the bars actually draw. clinicSplit
                  // arrives ranked by booking count, and a ranked chart whose
                  // longest bar is not at the top reads as a rendering fault.
                  .sort((a, b) => b.value - a.value)
                  .map((c) => ({
                    key: c.name,
                    label: c.name.replace(/^BluDerma\s+/, ""),
                    value: c.value,
                    secondary: `${c.count} booking${c.count === 1 ? "" : "s"}`,
                    fill: hexFor(c.colorKey),
                  }))}
              />
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                {m.clinicSplit.map((c) => (
                  <li
                    key={c.name}
                    className="flex items-center gap-2 text-xs text-slate-600"
                  >
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${swatchFor(c.colorKey).dot}`}
                    />
                    <span className="truncate">
                      {c.name.replace(/^BluDerma\s+/, "")}
                    </span>
                    <span className="font-bold tabular-nums text-slate-900">
                      {c.count}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <Empty
              icon="clinic"
              title="No bookings to split yet"
              body="Once clients book, this shows which of your locations they choose."
            />
          )}
        </ChartPanel>
      </div>

      {/* ── The closing summary row ────────────────────────────────────── */}
      {/* The reference decks end a page this way, and it earns its place: a
          reader who scrolled past the charts still leaves with the totals. */}
      <div className="mb-5 grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        <Summary
          tone="brand"
          icon="rupee"
          label={`Booked, ${m.periodLabel}`}
          value={moneyShort(m.periodBooked)}
          hint={money(m.periodBooked)}
        />
        <Summary
          tone="teal"
          icon="chart"
          label="Average per visit"
          value={m.averageValue > 0 ? money(m.averageValue) : "—"}
          hint={
            m.averageValue > 0
              ? `Across ${m.appointments.bookedCount} bookings`
              : "No bookings to average yet"
          }
        />
        <Summary
          tone="violet"
          icon="check"
          label="Visits completed"
          value={String(m.appointments.completedAllTime)}
          hint="Since you joined BluDerma"
        />
        <Summary
          tone="amber"
          icon="star"
          label="Your rating"
          value={m.reviews.count > 0 ? m.reviews.rating.toFixed(1) : "—"}
          hint={
            m.reviews.count > 0
              ? `From ${m.reviews.count} published review${m.reviews.count === 1 ? "" : "s"}`
              : "No published reviews yet"
          }
        />
      </div>

      {/* ── Your listing, your leave, your link ────────────────────────── */}
      {/* Three things a doctor can act on in the next minute, kept together
          and away from the figures — the rest of this page is a readout, and
          mixing "here is a number" with "do this" makes both easier to skip. */}
      <SectionHead
        title="Things you can do now"
        sub="Nothing here is a number to read. Each one is a small job that brings more bookings in."
      />
      <div className="mb-5 grid gap-3.5 lg:grid-cols-3">
        <ChartPanel
          index={9}
          tone="amber"
          icon="user"
          title="Your listing"
          sub={
            listingGaps.length
              ? "What a client notices is missing"
              : "Nothing missing"
          }
          action={
            <Link href="/doctor/portal/profile" className={portalBtnQuiet}>
              Edit
            </Link>
          }
        >
          {listingGaps.length > 0 ? (
            <ul className="space-y-2">
              {listingGaps.map((g) => (
                <li key={g.key}>
                  <Link
                    href="/doctor/portal/profile"
                    className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50"
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                    <span className="min-w-0 flex-1 truncate">{g.label}</span>
                    <span className="shrink-0 text-xs font-bold text-brand-600">
                      Add
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty
              icon="user"
              title="Your listing is complete"
              body="Photo, biography, languages and links are all in place. Clients see the full picture."
            />
          )}
        </ChartPanel>

        <ChartPanel
          index={10}
          tone="slate"
          icon="calendar"
          title="Time off ahead"
          sub="Days already blocked out"
          action={
            <Link href="/doctor/portal/practice" className={portalBtnQuiet}>
              Manage
            </Link>
          }
        >
          {m.timeOffAhead.length > 0 ? (
            <ul className="space-y-2.5">
              {m.timeOffAhead.map((t) => (
                <li
                  key={`${t.startsAt}-${t.endsAt}`}
                  className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-slate-900">
                      {prettyRange(t.startsAt, t.endsAt)}
                    </span>
                    {t.reason && (
                      <span className="mt-0.5 block truncate text-xs text-slate-500">
                        {t.reason}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs font-bold tabular-nums text-slate-500">
                    {t.days} {t.days === 1 ? "day" : "days"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty
              icon="calendar"
              title="No leave booked"
              body="Blocking a date here removes its slots from the booking page, so nobody can book you into a day you are away."
            />
          )}
        </ChartPanel>

        <ChartPanel
          index={11}
          tone="teal"
          icon="link"
          title="Your booking link"
          sub="Send it to anyone — it books straight into this calendar"
        >
          {m.slug ? (
            <ShareLink slug={m.slug} name={doctorName} />
          ) : (
            <Empty
              icon="user"
              title="No public page yet"
              body="Your listing needs to be live before it has an address to share."
            />
          )}
        </ChartPanel>
      </div>

      {/* ── Reviews ────────────────────────────────────────────────────── */}
      <ChartPanel
        index={12}
        tone="rose"
        icon="star"
        title="What clients say"
        sub={
          m.reviews.count > 0
            ? `${m.reviews.rating.toFixed(1)} out of 5, from ${m.reviews.count} published review${
                m.reviews.count === 1 ? "" : "s"
              }`
            : "No published reviews yet"
        }
        action={
          m.reviewsPending > 0 ? (
            <Tag tone="amber">{m.reviewsPending} with our team</Tag>
          ) : undefined
        }
      >
        {/* A client leaves a review, and until it clears moderation the doctor
            sees nothing at all — which reads as the review never arriving. It
            is deliberately not shown in full: an unchecked rating on a named
            clinician is exactly what moderation exists for. */}
        {m.reviewsPending > 0 && (
          <p className="mb-3 rounded-xl bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900 ring-1 ring-inset ring-amber-200">
            <strong className="font-bold">
              {m.reviewsPending === 1
                ? "One review is"
                : `${m.reviewsPending} reviews are`}{" "}
              waiting to be checked.
            </strong>{" "}
            We read every one before it goes public, so it is not on your
            profile yet and does not count toward your rating.
          </p>
        )}

        {m.reviews.latest.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-3">
            {m.reviews.latest.map((r) => (
              <li key={r.id} className="rounded-xl bg-slate-50 px-4 py-3.5">
                <div className="flex items-center justify-between gap-3">
                  <Stars rating={r.rating} />
                  <span className="text-xs text-slate-400">{prettyDate(r.at)}</span>
                </div>
                {r.title && (
                  <p className="mt-1.5 text-sm font-bold text-slate-900">{r.title}</p>
                )}
                {r.body && (
                  <p className="mt-1 text-sm leading-relaxed text-slate-700">{r.body}</p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <Empty
            icon="user"
            title="No published reviews yet"
            body="Clients can review you after a completed visit. Our team publishes them once checked, and only published reviews count toward your rating."
          />
        )}
      </ChartPanel>
    </>
  );
}

/** One line of the donut's key: colour, name, amount. */
function DonutKey({
  dot,
  label,
  amount,
}: {
  dot: string;
  label: string;
  amount: string;
}) {
  return (
    <li className="flex items-center gap-2 text-sm">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} />
      <span className="min-w-0 flex-1 truncate text-slate-600">{label}</span>
      <span className="shrink-0 font-semibold tabular-nums text-slate-900">
        {amount}
      </span>
    </li>
  );
}

/** Plainer than the metric's own labels, which read like a database. */
const FUNNEL_LABELS = [
  "Clients asked to book",
  "You accepted",
  "Visit completed",
];

/**
 * One seat figure, with its money underneath.
 *
 * The count and the value are deliberately in one tile rather than two. "17
 * seats open" and "₹30,600" on opposite sides of a row are two facts the
 * reader has to join up themselves, and the joining is the whole insight.
 */
function SeatStat({
  label,
  value,
  money: amount,
  hint,
  tone,
}: {
  label: string;
  value: string;
  money?: string;
  hint: string;
  tone: "rose" | "teal" | "brand" | "violet";
}) {
  // Full class strings — Tailwind never sees an interpolated one.
  const skin =
    tone === "rose"
      ? "bg-rose-50 text-rose-700 ring-rose-100"
      : tone === "teal"
        ? "bg-teal-50 text-teal-700 ring-teal-100"
        : tone === "violet"
          ? "bg-violet-50 text-violet-700 ring-violet-100"
          : "bg-brand-50 text-brand-700 ring-brand-100";

  return (
    <div className={`rounded-xl px-4 py-3 ring-1 ring-inset ${skin}`}>
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] opacity-80">
        {label}
      </p>
      <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
        <span className="font-display text-2xl font-bold leading-none tabular-nums">
          {value}
        </span>
        {amount && (
          <span className="font-display text-sm font-bold tabular-nums opacity-80">
            {amount}
          </span>
        )}
      </p>
      <p className="mt-1.5 text-[11px] leading-snug text-slate-500">{hint}</p>
    </div>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex gap-0.5" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg
          key={n}
          viewBox="0 0 24 24"
          className={`h-3.5 w-3.5 ${n <= rating ? "text-amber-400" : "text-slate-200"}`}
          fill="currentColor"
        >
          <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z" />
        </svg>
      ))}
    </span>
  );
}

/** "vs last month" — what the KPI arrows are comparing against. */
function comparisonLabel(period: DashboardPeriod): string {
  switch (period) {
    case "last-month":
      return "vs the month before";
    case "last-3":
      return "vs the 3 months before";
    case "last-6":
      return "vs the 6 months before";
    case "this-year":
      return "vs last year";
    default:
      return "vs last month";
  }
}

/** "28 Aug 2026" — a date somebody would say out loud. */
function prettyDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "Thu 14 Aug". */
function prettyDay(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/**
 * "in 25m" / "in 2h 10m" / "now".
 *
 * Anything already under way reads "now" rather than a negative number: the
 * appointment is happening, and by how many minutes it started is not a thing
 * a doctor standing in the room needs quantified.
 */
function countdown(minutes: number): string {
  if (minutes <= 0) return "now";
  if (minutes < 60) return `in ${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `in ${h}h ${m}m` : `in ${h}h`;
}

/** "12 – 16 Sep" for a range, "12 Sep" for a single day. */
function prettyRange(startsAt: string, endsAt: string): string {
  const fmt = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
  return startsAt === endsAt ? fmt(startsAt) : `${fmt(startsAt)} – ${fmt(endsAt)}`;
}

/** One row of the cancellation key. */
function CancelKey({
  dot,
  label,
  count,
}: {
  dot: string;
  label: string;
  count: number;
}) {
  return (
    <li className="flex items-center gap-2 text-xs text-slate-600">
      <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
      <span>{label}</span>
      <span className="font-bold tabular-nums text-slate-900">{count}</span>
    </li>
  );
}

function modeLabel(mode: string): string {
  if (mode === "VIDEO") return "Video";
  if (mode === "HOME") return "Home visit";
  return "At the clinic";
}

/** Reads the clinic wall clock, not the server's. */
function greeting(): string {
  const h = clinicWallClock().getUTCHours();
  if (h < 12) return "Good morning";
  return h < 17 ? "Good afternoon" : "Good evening";
}

/** A labelled figure for places a bar would be overkill. */
function MiniStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3">
      <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="mt-1 font-display text-lg font-bold tabular-nums text-slate-900">
        {value}
      </dd>
      <p className="mt-0.5 text-xs text-slate-500">{hint}</p>
    </div>
  );
}
