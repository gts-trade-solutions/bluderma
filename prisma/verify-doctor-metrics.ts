/**
 * The dashboard's arithmetic.
 *
 * Every figure a practitioner sees about their own income has to be
 * defensible, so this seeds a known set of appointments, computes, and asserts
 * the exact rupee amounts — not "looks about right".
 *
 * The two that would be easiest to get quietly wrong:
 *   - the four revenue tiers, because COMPLETED is set by hand and a single
 *     total keyed on it would under-report every untidy diary;
 *   - slot capacity, which must reproduce the inclusive `t <= end` endpoint in
 *     queries/availability.ts or the dashboard disagrees with the booking grid
 *     the same doctor can see.
 */
import { readFileSync } from "node:fs";
import { PrismaClient, AppointmentStatus, ApprovalState, VisitReason } from "@prisma/client";

import { getDashboardMetrics, parsePeriod, slotsInWindow } from "../src/lib/doctor/metrics";
import { clinicWallClock } from "../src/lib/queries/availability";

const prisma = new PrismaClient({ log: ["warn", "error"] });

let pass = 0;
const fails: string[] = [];
function check(name: string, ok: boolean, detail?: string) {
  if (ok) pass++;
  else fails.push(detail ? `${name} (${detail})` : name);
}
const read = (p: string) => readFileSync(p, "utf8");

const DAY = 86_400_000;
const TAG = "metrics-probe";

/** The same day at a chosen hour, UTC — the clinic wall clock is UTC-labelled. */
function hourAt(day: Date, hour: number): Date {
  const d = new Date(day);
  d.setUTCHours(hour, 0, 0, 0);
  return d;
}

// ── Pure: the inclusive slot endpoint ─────────────────────────────────────
// availability.ts loops `for (t = start; t <= end; t += step)`, so 09:00-10:00
// at 30 minutes yields 09:00, 09:30 AND 10:00. Three, not two.
check("09:00-10:00 @30 is 3 slots", slotsInWindow("09:00", "10:00", 30) === 3);
check("09:00-13:00 @30 is 9 slots", slotsInWindow("09:00", "13:00", 30) === 9);
check("09:00-09:30 @30 is 2 slots", slotsInWindow("09:00", "09:30", 30) === 2);
check("10:00-11:00 @15 is 5 slots", slotsInWindow("10:00", "11:00", 15) === 5);
check("an inverted window is 0", slotsInWindow("13:00", "09:00", 30) === 0);
check("a zero-length window is 0", slotsInWindow("09:00", "09:00", 30) === 0);
check("a zero step is 0", slotsInWindow("09:00", "13:00", 0) === 0);

/**
 * Appointment.doctorId has no cascade — deliberately, so a practice cannot be
 * deleted out from under its own history. The probe therefore tears its own
 * rows down in dependency order.
 */
async function cleanup(doctorIds: string[]): Promise<void> {
  if (!doctorIds.length) return;
  await prisma.appointment.deleteMany({ where: { doctorId: { in: doctorIds } } });
  await prisma.doctorAvailability.deleteMany({ where: { doctorId: { in: doctorIds } } });
  await prisma.doctorTimeOff.deleteMany({ where: { doctorId: { in: doctorIds } } });
  await prisma.doctor.deleteMany({ where: { id: { in: doctorIds } } });
}

async function main() {
  const now = clinicWallClock();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  // A day earlier this month that has already passed, and one still to come.
  const past = new Date(monthStart.getTime() + DAY);
  past.setUTCHours(10, 0, 0, 0);
  const future = new Date(Date.now() + 3 * DAY);
  future.setUTCHours(11, 0, 0, 0);

  const user = await prisma.user.findFirstOrThrow({ where: { role: "PATIENT" } });

  const doctor = await prisma.doctor.create({
    data: {
      slug: `probe-${Date.now()}`,
      name: "Probe Practitioner",
      title: "MBBS",
      specialty: "Dermatology",
      clinic: "Probe",
      location: "Chennai",
      image: "x",
      about: "probe",
      status: "APPROVED",
      availability: {
        create: [
          // 3 + 9 = 12 slots a week, by the inclusive rule.
          { dayOfWeek: 1, startTime: "09:00", endTime: "10:00", slotMinutes: 30 },
          { dayOfWeek: 3, startTime: "09:00", endTime: "13:00", slotMinutes: 30 },
        ],
      },
    },
    select: { id: true },
  });

  const appt = (
    over: Partial<{
      status: AppointmentStatus;
      approvalState: ApprovalState;
      scheduledAt: Date;
      feeAtBooking: number;
      visitFee: number;
      discountInr: number;
      cancellationFeeInr: number;
      reason: VisitReason | null;
      patientUserId: string | null;
      patientEmail: string | null;
      subscriptionId: string | null;
    }>
  ) => ({
    doctorId: doctor.id,
    scheduledAt: over.scheduledAt ?? past,
    mode: "CLINIC" as const,
    status: over.status ?? AppointmentStatus.CONFIRMED,
    approvalState: over.approvalState ?? ApprovalState.AUTO,
    feeAtBooking: over.feeAtBooking ?? 1000,
    visitFee: over.visitFee ?? 0,
    discountInr: over.discountInr ?? 0,
    cancellationFeeInr: over.cancellationFeeInr ?? 0,
    reason: over.reason === undefined ? VisitReason.ACNE : over.reason,
    patientName: "Probe",
    patientUserId: over.patientUserId === undefined ? user.id : over.patientUserId,
    patientEmail: over.patientEmail ?? null,
    notes: TAG,
  });

  await prisma.appointment.createMany({
    data: [
      // realised: 1000 + 500 visit fee = 1500
      appt({ status: AppointmentStatus.COMPLETED, visitFee: 500, discountInr: 200 }),
      // realised: 2000  → realised total 3500
      appt({ status: AppointmentStatus.COMPLETED, feeAtBooking: 2000 }),
      // scheduled: 1200 (future, confirmed)
      appt({ scheduledAt: future, feeAtBooking: 1200 }),
      // unresolved: 800 (past, confirmed, never completed)
      appt({ feeAtBooking: 800 }),
      // lost: 900, recovered 300
      appt({ status: AppointmentStatus.CANCELLED, feeAtBooking: 900, cancellationFeeInr: 300 }),
      // lost: 700 (no-show) → lost total 1600
      appt({ status: AppointmentStatus.NO_SHOW, feeAtBooking: 700 }),
      // excluded entirely: the doctor has not accepted it yet
      appt({
        scheduledAt: future,
        feeAtBooking: 5000,
        approvalState: ApprovalState.AWAITING_DOCTOR,
      }),
      // a guest booking, and a booking with no reason recorded
      appt({ patientUserId: null, patientEmail: "guest@probe.test", feeAtBooking: 0, reason: null }),
    ],
  });

  const m = await getDashboardMetrics(doctor.id);

  // ── Revenue tiers ───────────────────────────────────────────────────────
  check("realised sums completed + visit fee", m.revenue.realised === 3500, `got ${m.revenue.realised}`);
  check("scheduled is future confirmed only", m.revenue.scheduled === 1200, `got ${m.revenue.scheduled}`);
  check("unresolved is past-but-not-closed", m.revenue.unresolved === 800, `got ${m.revenue.unresolved}`);
  check("lost sums cancelled + no-show", m.revenue.lost === 1600, `got ${m.revenue.lost}`);
  check("recovered is the cancellation fee", m.revenue.recovered === 300, `got ${m.revenue.recovered}`);
  check(
    "an unaccepted request is not counted as money",
    m.periodBooked === 3500 + 1200 + 800,
    `got ${m.periodBooked}`
  );
  check("member discount is surfaced separately", m.revenue.discountGiven === 200);

  // ── Projection is arithmetic ────────────────────────────────────────────
  const expectedProjection = Math.round((m.periodBooked / m.daysElapsed) * m.daysInPeriod);
  check("projection is a straight run rate", m.projected === expectedProjection);
  check("projection never precedes the booked figure", m.projected >= m.periodBooked);
  check("uplift offers three scenarios", m.uplift.length === 3);
  check(
    "uplift is average x count x weeks left",
    m.uplift.every((u) => u.amount >= 0)
  );

  // ── Patients ────────────────────────────────────────────────────────────
  check("guests are counted separately", m.patients.guests === 1, `got ${m.patients.guests}`);
  check("distinct clients counted", m.patients.thisMonth >= 2);

  // ── Demand keeps the unrecorded bucket ──────────────────────────────────
  const none = m.demand.find((d) => d.key === "__none");
  check("a booking with no reason is shown, not dropped", Boolean(none));
  check("it is labelled honestly", none?.label === "No reason recorded");
  check("acne demand is counted", (m.demand.find((d) => d.key === "ACNE")?.count ?? 0) >= 5);

  // ── Capacity ────────────────────────────────────────────────────────────
  check("weekly capacity uses the inclusive rule", m.utilisation.weeklyCapacity === 12, `got ${m.utilisation.weeklyCapacity}`);
  const mon = m.utilisation.byDay.find((d) => d.day === 1);
  const wed = m.utilisation.byDay.find((d) => d.day === 3);
  check("Monday capacity is 3 slots x 4 weeks", mon?.capacity === 12, `got ${mon?.capacity}`);
  check("Wednesday capacity is 9 slots x 4 weeks", wed?.capacity === 36, `got ${wed?.capacity}`);
  check("days without hours are excluded from emptiest", m.utilisation.emptiest !== null);
  check(
    "utilisation never exceeds 100%",
    m.utilisation.byDay.every((d) => d.rate <= 1)
  );

  // ── Rates carry their sample ────────────────────────────────────────────
  check("every rate reports its sample", [
    m.ops.noShowRate,
    m.ops.cancelRate,
    m.ops.medianLeadDays,
    m.ops.medianResponseHours,
    m.ops.memberShare,
    m.patients.returning,
  ].every((r) => typeof r.sampleSize === "number"));
  check("no rate is NaN", [
    m.ops.noShowRate.value,
    m.ops.cancelRate.value,
    m.ops.memberShare.value,
    m.patients.returning.value,
  ].every((v) => Number.isFinite(v)));

  // ── Series ──────────────────────────────────────────────────────────────
  // It spans the SELECTED window now, not a rolling 30 days: showing a doctor
  // "Last month" beside a line covering this one was the whole reason the
  // period control could not simply be bolted on.
  check(
    "the series covers the elapsed period",
    m.series.length === m.daysElapsed,
    `${m.series.length} points for ${m.daysElapsed} days`
  );
  check("a month is bucketed by day", m.seriesGrain === "day");
  check("series dates ascend", m.series.every((d, i, a) => i === 0 || d.date > a[i - 1].date));
  check("cancelled bookings are not in the series",
    m.series.reduce((s, d) => s + d.value, 0) < 3500 + 1200 + 800 + 1600);

  // ── Busy hours are in CLOCK order, not ranked by volume ─────────────────
  // The bug: the metric returned the top four hours sorted by count, and the
  // chart plotted them on a time-labelled axis. A doctor could be shown
  // 11:00, 09:00, 16:00, 10:00 left to right and read a shape that was not in
  // their diary. The fixture below books three at 09:00 and one at 15:00
  // precisely so a volume sort and a clock sort disagree.
  await prisma.appointment.createMany({
    data: [
      appt({ scheduledAt: hourAt(past, 15), feeAtBooking: 100 }),
      appt({ scheduledAt: hourAt(new Date(past.getTime() + DAY), 9), feeAtBooking: 100 }),
      appt({ scheduledAt: hourAt(new Date(past.getTime() + 2 * DAY), 9), feeAtBooking: 100 }),
    ],
  });
  const withHours = await getDashboardMetrics(doctor.id);
  const hours = withHours.busiestHours;
  check("busy hours ascend by clock", hours.every((h, i, a) => i === 0 || h.hour > a[i - 1].hour));
  check("the labels match the hours", hours.every((h) => h.label === `${String(h.hour).padStart(2, "0")}:00`));
  // Non-vacuous: the busiest hour must NOT be first, or a volume sort would
  // pass this test by accident.
  const busiest = [...hours].sort((a, b) => b.count - a.count)[0];
  // The fixture puts the heaviest hour (10:00) AFTER the earliest one (09:00),
  // so a volume sort would put 10:00 first and this fails. It is the guard
  // that would have caught the original bug.
  check(
    "the chart is not ranked by volume",
    hours.length > 1 && hours[0].hour !== busiest.hour,
    `first ${hours[0]?.hour}, busiest ${busiest?.hour}`
  );
  check(
    "the quiet hours between are kept",
    hours.length === hours[hours.length - 1].hour - hours[0].hour + 1,
    `${hours.length} buckets spanning ${hours[0]?.hour}-${hours[hours.length - 1]?.hour}`
  );
  check("a gap hour is present and zero", hours.some((h) => h.count === 0));

  // ── The period control ──────────────────────────────────────────────────
  check("an unknown period falls back to the month", parsePeriod("nonsense") === "this-month");
  check("a known period survives", parsePeriod("last-month") === "last-month");
  check("undefined falls back", parsePeriod(undefined) === "this-month");

  const lastMonth = await getDashboardMetrics(doctor.id, "last-month");
  check("last month is a closed window", lastMonth.isComplete === true);
  // A finished period has nothing to project, so the projection IS the total
  // and there are no weeks left to fill.
  check("a closed period does not forecast", lastMonth.projected === lastMonth.periodBooked);
  check("a closed period offers no uplift", lastMonth.uplift.every((u) => u.amount === 0));
  check("the fixture's bookings are not in last month", lastMonth.periodBooked === 0);
  check("this month is still open", withHours.isComplete === false);
  check("the label names the window", /\d{4}$/.test(lastMonth.periodLabel), lastMonth.periodLabel);

  const halfYear = await getDashboardMetrics(doctor.id, "last-6");
  check("six months spans six months", halfYear.daysInPeriod > 150);
  check("a long window buckets by week", halfYear.seriesGrain === "week");
  check("it still contains this month's bookings", halfYear.periodBooked >= m.periodBooked);

  // ── Who cancelled ───────────────────────────────────────────────────────
  // cancelRate alone is not actionable: the clinic cancelling on clients and
  // clients cancelling on the clinic are opposite problems.
  await prisma.appointment.create({
    data: {
      ...appt({ status: AppointmentStatus.CANCELLED, feeAtBooking: 100 }),
      cancelledBy: "DOCTOR",
    },
  });
  const cancels = await getDashboardMetrics(doctor.id);
  check("clinic-side cancellations are attributed", cancels.cancellations.byClinic === 1, `got ${cancels.cancellations.byClinic}`);
  check("rows with no actor are their own bucket", cancels.cancellations.unattributed >= 1);
  check(
    "the split adds up to the total",
    cancels.cancellations.byClinic +
      cancels.cancellations.byPatient +
      cancels.cancellations.unattributed ===
      cancels.cancellations.total
  );

  // ── The next one in today ───────────────────────────────────────────────
  check("no booking left today reads as null, not a crash", cancels.nextToday === null || typeof cancels.nextToday.at === "string");

  // ── Reviews awaiting moderation ─────────────────────────────────────────
  check("pending reviews are counted", typeof cancels.reviewsPending === "number");
  check("an unmoderated review is not in the rating", cancels.reviews.count === 0);

  // ── Leave ahead ─────────────────────────────────────────────────────────
  await prisma.doctorTimeOff.create({
    data: {
      doctorId: doctor.id,
      startsAt: new Date(Date.now() + 5 * DAY),
      endsAt: new Date(Date.now() + 7 * DAY),
      reason: "Conference",
    },
  });
  const leave = await getDashboardMetrics(doctor.id);
  check("upcoming leave is surfaced", leave.timeOffAhead.length === 1);
  check("its length is inclusive", (leave.timeOffAhead[0]?.days ?? 0) === 2, `got ${leave.timeOffAhead[0]?.days}`);
  check("its reason is carried", leave.timeOffAhead[0]?.reason === "Conference");
  check("the public handle is returned for the share card", leave.slug.startsWith("probe-"));

  // ── A brand-new practice reads honestly, never NaN ──────────────────────
  const fresh = await prisma.doctor.create({
    data: {
      slug: `probe-empty-${Date.now()}`,
      name: "Empty Practice",
      title: "MBBS",
      specialty: "Dermatology",
      clinic: "None",
      location: "Chennai",
      image: "x",
      about: "x",
      status: "APPROVED",
    },
    select: { id: true },
  });
  const zero = await getDashboardMetrics(fresh.id);
  check("an empty practice books nothing", zero.periodBooked === 0);
  check("its projection is zero, not NaN", zero.projected === 0);
  check("its average is zero, not NaN", zero.averageValue === 0);
  check("its rates are zero, not NaN",
    Number.isFinite(zero.ops.noShowRate.value) && zero.ops.noShowRate.value === 0);
  check("it has no capacity", zero.utilisation.weeklyCapacity === 0);
  check("it reports no emptiest day", zero.utilisation.emptiest === null);
  check("it still returns a full series", zero.series.length === zero.daysElapsed);

  await cleanup([doctor.id, fresh.id]);

  // ── Wiring ──────────────────────────────────────────────────────────────
  const dash = read("src/components/doctor/dashboard/DashboardHome.tsx");
  // Every one of these guards named a component or a literal string that the
  // rebuild renamed. They were not protecting anything any more, and a suite
  // that fails for stale reasons trains people to ignore it. Each now points
  // at what the screen actually does, which is the same INTENT as before.
  //
  // The headline still must carry a noun: the screen this replaced showed
  // "₹2,91,570" under the bare word "Booked", and a practitioner could not
  // tell whether that was money received, owed, or hoped for.
  check("the dashboard says booked value, not collected", /"Booked value"/.test(dash));
  check("and never claims the money is in hand", !/label="Collected"/.test(dash));
  check("it explains the unresolved bucket", /never marked complete/.test(dash));
  // The projection must be shown as derived from the doctor's own average,
  // not presented as a forecast the system is confident about.
  check(
    "the projection names what it is derived from",
    /money\(m\.averageValue\)\} average booking/.test(dash),
    "a projection with no stated basis reads as a promise"
  );
  check(
    "the dashboard is chart-led",
    /BookingsChart|RevenueDonut|UtilisationChart|HoursChart|Gauge/.test(dash)
  );
  // The first viewport must carry a chart, not just a headline figure — the
  // charts were originally all below the fold behind four text cards.
  const chartAt = dash.indexOf("<BookingsChart");
  const stripAt = dash.indexOf("<InsightStrip");
  check("a chart precedes the AI strip", chartAt > -1 && chartAt < stripAt);
  check("the top of the page carries figures, not just a title", /<Kpi/.test(dash));
  check("month-on-month direction is shown", /periodDelta/.test(dash));
  check("the funnel is rendered", /m\.funnel\.map/.test(dash));
  check("its steps are labelled in words", /FUNNEL_LABELS/.test(dash));
  check("the location split is rendered", /clinicSplit/.test(dash));

  // …and the figures behind them hold up.
  check("delta is null with no prior month", m.prevPeriodBooked === 0 ? m.periodDelta === null : true);
  check("the funnel never grows downstream",
    m.funnel[0].count >= m.funnel[1].count && m.funnel[1].count >= m.funnel[2].count);
  check("clinic split totals match the bookings counted",
    m.clinicSplit.reduce((n, c) => n + c.count, 0) >= 0);
  check("thin samples print a dash", /"—"/.test(dash));
  check("the hero states its own text colour", /text-white/.test(dash));
  check("no hardcoded clinic offset", !/330/.test(dash));

  // RevenueSpark and DemandChart were deleted by the rebuild, so this loop was
  // throwing ENOENT and taking the rest of the suite with it. The rule it
  // encodes still matters: recharts measures the DOM, so a chart rendered on
  // the server hydrates against a mismatch unless it waits for mount.
  for (const f of [
    "src/components/doctor/dashboard/BookingsChart.tsx",
    "src/components/doctor/dashboard/Charts.tsx",
  ]) {
    const src = read(f);
    check(
      `${f.split("/").pop()} gates on mount`,
      /setMounted\(true\)/.test(src),
      "recharts measures the DOM; rendering it on the server mismatches"
    );
    check(`${f.split("/").pop()} shows a skeleton first`, /animate-pulse/.test(src));
  }

  const page = read("src/app/doctor/portal/page.tsx");
  check("the portal home renders the dashboard", /DashboardHome/.test(page));
  const today = read("src/app/doctor/portal/today/page.tsx");
  check("today has its own route", /DayList/.test(today));
  check("today uses the shared bounds", /clinicTodayBounds/.test(today));
  const layout = read("src/app/doctor/portal/layout.tsx");
  check("the rail links today", /doctor\/portal\/today/.test(layout));
}

main()
  .catch((e) => fails.push(`threw: ${(e as Error).message}`))
  .finally(async () => {
    // Belt and braces: never leave probe rows behind, whatever failed above.
    const strays = await prisma.doctor
      .findMany({ where: { slug: { startsWith: "probe-" } }, select: { id: true } })
      .catch(() => []);
    if (strays.length) await cleanup(strays.map((d) => d.id)).catch(() => {});
    await prisma.$disconnect();
    console.log(`\n${pass} passed, ${fails.length} failed`);
    if (fails.length) {
      fails.forEach((f) => console.log(`  FAIL  ${f}`));
      process.exit(1);
    }
  });
