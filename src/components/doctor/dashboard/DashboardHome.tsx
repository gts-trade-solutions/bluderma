import Link from "next/link";
import { Suspense } from "react";

import {
  Empty,
  PageHead,
  Panel,
  Tag,
  portalBtnQuiet,
} from "@/components/doctor/portalUi";
import {
  getDashboardMetrics,
  type DashboardMetrics,
  type DashboardPeriod,
} from "@/lib/doctor/metrics";
import { advisoryGaps, getApplicationGaps } from "@/lib/doctor/gaps";
import { clinicWallClock } from "@/lib/queries/availability";
import { swatchFor } from "@/components/doctor/clinicColors";
import RevenueSpark from "./RevenueSpark";
import ShareLink from "./ShareLink";
import PeriodPicker from "./PeriodPicker";
import DemandChart from "./DemandChart";
import InsightStrip, { InsightStripSkeleton } from "./InsightStrip";
import {
  Gauge,
  HoursChart,
  RevenueDonut,
  UtilisationChart,
} from "./Charts";

/**
 * The practitioner's dashboard.
 *
 * The design brief was "premium, not a generic dashboard", and the thing that
 * makes a numbers screen feel expensive is restraint rather than decoration:
 * one dark band carrying the figure that matters, in the display face at a
 * size nothing else competes with, and everything else quiet around it. The
 * band is the rail's own navy, which ties the chrome to the canvas instead of
 * leaving a light page floating beside a dark sidebar.
 *
 * Every figure here is computed in lib/doctor/metrics.ts. Nothing on this
 * screen is estimated by a model, including the projections — those are
 * arithmetic, and they say so.
 */

const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/** A rate is only printed once enough bookings exist to mean anything. */
const MIN_SAMPLE = 5;

export default async function DashboardHome({
  doctorId,
  doctorName,
  period = "this-month",
}: {
  doctorId: string;
  doctorName: string;
  /** Which window the money figures cover. Comes from ?period=. */
  period?: DashboardPeriod;
}) {
  // The listing checklist was shown all through onboarding and then never
  // again — yet "no photo, no languages, no links" is exactly what costs an
  // APPROVED doctor the bookings this page is measuring.
  const [m, gaps] = await Promise.all([
    getDashboardMetrics(doctorId, period),
    getApplicationGaps(doctorId),
  ]);
  const listingGaps = advisoryGaps(gaps);
  const first = doctorName.replace(/^Dr\.?\s+/i, "").split(" ")[0];
  const pct = (v: number) => `${Math.round(v * 100)}%`;

  return (
    <>
      <PageHead
        eyebrow={m.periodLabel}
        title={`${greeting()}, ${first}`}
        sub="Your practice at a glance. Every figure here comes from your own bookings."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <PeriodPicker value={m.period} />
            <Link href="/doctor/portal/today" className={portalBtnQuiet}>
              Today&apos;s list
            </Link>
          </div>
        }
      />

      {m.appointments.awaiting > 0 && (
        <Link
          href="/doctor/portal/requests"
          className="mb-6 flex items-center gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 transition hover:bg-amber-100"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-500 text-sm font-bold text-white">
            {m.appointments.awaiting}
          </span>
          <span className="min-w-0 flex-1 text-sm text-amber-900">
            <strong className="font-bold">
              {m.appointments.awaiting === 1
                ? "One booking needs"
                : `${m.appointments.awaiting} bookings need`}{" "}
              your confirmation.
            </strong>{" "}
            Their slots are held until you decide.
          </span>
          <span className="shrink-0 text-sm font-bold text-amber-800">Review →</span>
        </Link>
      )}

      {/* ── Who is next ────────────────────────────────────────────────── */}
      {/* Above the revenue band on purpose. A practitioner opening this
          between two patients wants one thing, and it is not their monthly
          run rate. It sits under the confirmation banner rather than over it,
          because a held slot expires and this one does not. */}
      {m.nextToday && (
        <Link
          href="/doctor/portal/today"
          className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-teal-200 bg-teal-50 px-5 py-4 transition hover:bg-teal-100/70"
        >
          <span className="flex shrink-0 flex-col items-center rounded-xl bg-white px-3 py-1.5 ring-1 ring-teal-200">
            <span className="font-display text-lg font-bold leading-none tabular-nums text-teal-900">
              {m.nextToday.at}
            </span>
            <span className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-teal-700">
              {countdown(m.nextToday.minutesAway)}
            </span>
          </span>

          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-bold text-teal-950">
                {m.nextToday.patientName}
              </span>
              {m.nextToday.isMember && <Tag tone="amber">White Collar</Tag>}
            </span>
            <span className="mt-0.5 block truncate text-xs text-teal-800">
              {[
                modeLabel(m.nextToday.mode),
                m.nextToday.clinicName?.replace(/^BluDerma\s+/, ""),
                m.nextToday.reason,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </span>

          <span className="shrink-0 text-sm font-bold text-teal-800">
            Open the list →
          </span>
        </Link>
      )}

      {/* ── The hero band ──────────────────────────────────────────────── */}
      <section className="on-dark relative mb-7 overflow-hidden rounded-3xl bg-[#0b1220] p-6 ring-1 ring-white/[0.06] sm:p-8">
        {/* A single soft bloom behind the figure. Enough to give the band
            depth; not enough to compete with the number sitting on it. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 -top-32 h-72 w-72 rounded-full bg-teal-400/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 right-0 h-72 w-72 rounded-full bg-brand-500/10 blur-3xl"
        />
        <div className="relative">
        <div className="grid gap-7 lg:grid-cols-[1fr_1.1fr] lg:items-end">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-teal-300">
              {m.isComplete ? "Booked in" : "Booked"} {m.periodLabel}
            </p>
            {/* Sora numerals at a size nothing else on the page reaches. */}
            <div className="mt-2 flex flex-wrap items-baseline gap-3">
              <p className="font-display text-4xl font-bold tracking-[-0.03em] text-white tabular-nums sm:text-5xl">
                {money(m.periodBooked)}
              </p>
              {m.periodDelta !== null && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                    m.periodDelta >= 0
                      ? "bg-teal-400/15 text-teal-300"
                      : "bg-rose-400/15 text-rose-300"
                  }`}
                >
                  {m.periodDelta >= 0 ? "▲" : "▼"}
                  {Math.abs(Math.round(m.periodDelta * 100))}%
                  <span className="font-semibold opacity-70">
                    on the {m.period === "this-year" ? "year" : "period"} before
                  </span>
                </span>
              )}
            </div>

            {m.periodBooked === 0 ? (
              <p className="mt-3 max-w-md text-sm leading-relaxed text-white/55">
                {m.isComplete
                  ? "Nothing was booked in this period."
                  : "Nothing booked yet."}{" "}
                Your listing is live, so this fills in as clients find you,
                and your booking link is at the bottom of this page.
              </p>
            ) : (
            <div className="mt-4 flex flex-wrap gap-1.5">
              <HeroChip label="Completed" value={money(m.revenue.realised)} tone="teal" />
              <HeroChip label="Still to come" value={money(m.revenue.scheduled)} tone="plain" />
              {m.revenue.unresolved > 0 && (
                <HeroChip
                  label="Awaiting outcome"
                  value={money(m.revenue.unresolved)}
                  tone="amber"
                />
              )}
              {m.revenue.lost > 0 && (
                <HeroChip label="Lost" value={money(m.revenue.lost)} tone="rose" />
              )}
            </div>
            )}

            {m.revenue.unresolved > 0 && (
              <p className="mt-3 max-w-md text-xs leading-relaxed text-white/50">
                Visits that have happened but were never marked complete. Closing
                them off in your calendar is what moves them into completed.
              </p>
            )}
          </div>

          <div>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/40">
                {m.seriesGrain === "week" ? "By week" : "By day"}
              </p>
              {!m.isComplete && (
                <p className="text-xs font-semibold text-white/50">
                  On track for{" "}
                  <span className="font-bold text-white/80 tabular-nums">
                    {money(m.projected)}
                  </span>
                </p>
              )}
            </div>
            <div className="mt-3">
              <RevenueSpark data={m.series} grain={m.seriesGrain} />
            </div>
          </div>
        </div>

        {/* Four figures inside the band, so the first thing on screen carries
            the practice rather than one number and a lot of navy. */}
        <dl className="relative mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/[0.08] sm:grid-cols-4">
          <HeroStat
            label="Clients"
            value={String(m.patients.thisMonth)}
            sub={m.isComplete ? "in this period" : "so far"}
          />
          <HeroStat label="Upcoming" value={String(m.appointments.upcoming)} sub="confirmed" />
          <HeroStat
            label="Week filled"
            value={weekFill(m)}
            sub={`of ${m.utilisation.weeklyCapacity} slots`}
          />
          <HeroStat
            label="Rating"
            value={m.reviews.count > 0 ? m.reviews.rating.toFixed(1) : "—"}
            sub={m.reviews.count > 0 ? `${m.reviews.count} reviews` : "no reviews yet"}
          />
        </dl>
        </div>
      </section>

      {/* ── Where the money sits, and where the week has room ────────── */}
      <div className="mb-7 grid gap-5 lg:grid-cols-3">
        <Panel
          title={m.periodLabel}
          sub="Booked value by state."
          accent="brand"
          icon="chart"
          index={0}
        >
          <RevenueDonut
            realised={m.revenue.realised}
            scheduled={m.revenue.scheduled}
            unresolved={m.revenue.unresolved}
            lost={m.revenue.lost}
          />
          <ul className="mt-3 space-y-1.5">
            <Legend colour="bg-teal-500" label="Completed" value={money(m.revenue.realised)} />
            <Legend colour="bg-brand-600" label="Still to come" value={money(m.revenue.scheduled)} />
            {m.revenue.unresolved > 0 && (
              <Legend colour="bg-amber-500" label="Awaiting outcome" value={money(m.revenue.unresolved)} />
            )}
            {m.revenue.lost > 0 && (
              <Legend colour="bg-rose-600" label="Lost" value={money(m.revenue.lost)} />
            )}
          </ul>
        </Panel>

        <Panel
          className="lg:col-span-2"
          accent="teal"
          icon="calendar"
          index={1}
          title="Your week"
          sub={`${m.utilisation.weeklyCapacity} slots a week. Filled portion is booked.`}
        >
          <UtilisationChart data={m.utilisation.byDay} />
          {m.utilisation.emptiest && m.utilisation.emptiest.free > 0 && (
            <p className="mt-3 rounded-xl bg-slate-50 px-4 py-2.5 text-sm text-slate-700">
              <strong className="font-bold">{m.utilisation.emptiest.label}</strong> has
              the most room, about {m.utilisation.emptiest.free} slots unbooked
              over four weeks.
            </p>
          )}
        </Panel>
      </div>

      {/* Suspended so the dashboard paints before the first generation of the
          day finishes — the numbers above are the point, this is commentary. */}
      <Suspense fallback={<InsightStripSkeleton />}>
        <InsightStrip doctorId={doctorId} metrics={m} />
      </Suspense>

      {/* ── Growth, as arithmetic ─────────────────────────────────────── */}
      {/* A projection of a period that has already ended is not a projection.
          `uplift` computes to zero for a closed window, and three cards each
          reading "+₹0" would read as a broken dashboard rather than as a
          question that does not apply. */}
      {m.averageValue > 0 && !m.isComplete && (
        <div className="mb-7 grid gap-3 sm:grid-cols-3">
          {m.uplift.map((u) => (
            <div
              key={u.perWeek}
              className="rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)] ring-1 ring-slate-200/80"
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                +{u.perWeek} client{u.perWeek === 1 ? "" : "s"} a week
              </p>
              <p className="mt-2 font-display text-2xl font-bold tabular-nums text-teal-700">
                +{money(u.amount)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                by the end of {m.periodLabel}, at your {money(m.averageValue)}{" "}
                average
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="mb-7 grid gap-5 lg:grid-cols-2">
        {/* ── Demand ───────────────────────────────────────────────────── */}
        <Panel
          accent="violet"
          icon="pulse"
          index={2}
          title="What clients come to you for"
          sub="From what each of them chose when booking, over 90 days."
        >
          {m.demand.length > 0 ? (
            <DemandChart data={m.demand} />
          ) : (
            <Empty
              title="Nothing booked yet"
              body="Once clients start booking, this shows which concerns bring them to you."
            />
          )}
        </Panel>

        {/* ── Practice health, as gauges ───────────────────────────────── */}
        <Panel
          accent="teal"
          icon="chart"
          index={3} title="How your practice runs" sub="Last 90 days.">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Gauge
              label="Cancelled"
              value={m.ops.cancelRate.value}
              sampleSize={m.ops.cancelRate.sampleSize}
              tone="amber"
              invert
            />
            <Gauge
              label="No-shows"
              value={m.ops.noShowRate.value}
              sampleSize={m.ops.noShowRate.sampleSize}
              tone="rose"
              invert
            />
            <Gauge
              label="Returning"
              value={m.patients.returning.value}
              sampleSize={m.patients.returning.sampleSize}
              tone="teal"
            />
            <Gauge
              label="Members"
              value={m.ops.memberShare.value}
              sampleSize={m.ops.memberShare.sampleSize}
              tone="brand"
            />
          </div>

          <dl className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
            <MiniStat
              label="Booked ahead"
              value={
                m.ops.medianLeadDays.sampleSize >= MIN_SAMPLE
                  ? `${Math.round(m.ops.medianLeadDays.value)} days`
                  : "—"
              }
              hint="Typical gap from booking to visit"
            />
            <MiniStat
              label="Your response time"
              value={
                m.ops.medianResponseHours.sampleSize >= MIN_SAMPLE
                  ? m.ops.medianResponseHours.value < 1
                    ? "under an hour"
                    : `${Math.round(m.ops.medianResponseHours.value)} hrs`
                  : "—"
              }
              hint="How long a request waits for you"
            />
          </dl>

          {/* A cancel rate on its own is not actionable. Whether the clinic
              cancelled on clients or clients cancelled on the clinic are
              opposite problems, and `cancelledBy` was already being written
              on every one of them. */}
          {m.cancellations.total > 0 && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Who called them off
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
                  label="The client"
                  count={m.cancellations.byPatient}
                />
                <CancelKey
                  dot="bg-rose-400"
                  label="You or our team"
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
        </Panel>
      </div>

      {/* ── Pipeline and locations ─────────────────────────────────────── */}
      <div className="mb-7 grid gap-5 lg:grid-cols-2">
        <Panel
          accent="brand"
          icon="inbox"
          index={4}
          title="From request to seen"
          sub="Last 90 days. Where bookings drop out."
        >
          <ul className="space-y-3">
            {m.funnel.map((step, i) => {
              const top = m.funnel[0].count || 1;
              const width = Math.round((step.count / top) * 100);
              const lost = i > 0 ? m.funnel[i - 1].count - step.count : 0;
              return (
                <li key={step.label}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-semibold text-slate-700">
                      {step.label}
                    </span>
                    <span className="font-display text-base font-bold tabular-nums text-slate-900">
                      {step.count}
                      {lost > 0 && (
                        <span className="ml-2 text-xs font-semibold text-rose-600">
                          −{lost}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-100">
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
          <p className="mt-4 text-xs text-slate-500">
            &ldquo;Seen&rdquo; counts visits you marked completed, so it lags
            until your diary is tidied.
          </p>
        </Panel>

        <Panel
          accent="amber"
          icon="clinic"
          index={5}
          title={m.clinicSplit.length > 1 ? "Across your locations" : "Your location"}
          sub="Bookings and booked value, last 90 days."
        >
          {m.clinicSplit.length > 0 ? (
            <ul className="space-y-3">
              {m.clinicSplit.map((c) => {
                const top = m.clinicSplit[0].count || 1;
                return (
                  <li key={c.name}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${swatchFor(c.colorKey).dot}`} />
                        <span className="truncate text-sm font-semibold text-slate-700">
                          {c.name.replace(/^BluDerma\s+/, "")}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm tabular-nums text-slate-500">
                        {c.count} · {money(c.value)}
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${swatchFor(c.colorKey).dot}`}
                        style={{ width: `${Math.round((c.count / top) * 100)}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty
              icon="clinic"
              title="No bookings to split yet"
              body="Once clients book, this shows which of your locations they choose."
            />
          )}
        </Panel>
      </div>

      {/* ── Your listing, your leave, your link ────────────────────────── */}
      {/* Three things a doctor can act on in the next minute, kept together
          and away from the figures — the rest of this page is a readout, and
          mixing "here is a number" with "do this" makes both easier to skip. */}
      <div className="mb-7 grid gap-5 lg:grid-cols-3">
        <Panel
          accent="amber"
          icon="user"
          index={6}
          title="Your listing"
          sub={
            listingGaps.length
              ? "What a client notices is missing."
              : "Nothing missing."
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
        </Panel>

        <Panel
          accent="slate"
          icon="calendar"
          index={7}
          title="Time off ahead"
          sub="Days already blocked out."
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
        </Panel>

        <Panel
          accent="teal"
          icon="link"
          index={8}
          title="Your booking link"
          sub="Send it to anyone. It books straight into this calendar."
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
        </Panel>
      </div>

      {/* ── When the day fills ─────────────────────────────────────────── */}
      <div className="mb-7">
        <Panel
          accent="violet"
          icon="clock"
          index={9}
          title="When your day fills"
          sub="Bookings by start hour, in clock order, last 90 days."
        >
          <HoursChart data={m.busiestHours} />
        </Panel>
      </div>

      {/* ── Reviews ────────────────────────────────────────────────────── */}
      <Panel
        accent="rose"
        icon="star"
        index={10}
        title="What clients say"
        sub={
          m.reviews.count > 0
            ? `${m.reviews.rating.toFixed(1)} from ${m.reviews.count} published review${
                m.reviews.count === 1 ? "" : "s"
              }.`
            : undefined
        }
        action={
          m.reviewsPending > 0 ? (
            <Tag tone="amber">
              {m.reviewsPending} with our team
            </Tag>
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
          <ul className="space-y-3">
            {m.reviews.latest.map((r) => (
              <li key={r.id} className="rounded-xl bg-slate-50 px-4 py-3.5">
                <div className="flex items-center justify-between gap-3">
                  <Stars rating={r.rating} />
                  <span className="text-xs text-slate-400">{r.at}</span>
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
      </Panel>
    </>
  );
}

function HeroChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "teal" | "plain" | "amber" | "rose";
}) {
  // Full class strings — Tailwind never sees an interpolated one.
  const skin =
    tone === "teal"
      ? "bg-teal-400/15 text-teal-300"
      : tone === "amber"
        ? "bg-amber-400/15 text-amber-300"
        : tone === "rose"
          ? "bg-rose-400/15 text-rose-300"
          : "bg-white/[0.07] text-white/70";

  return (
    <span
      className={`inline-flex items-baseline gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${skin}`}
    >
      <span className="font-semibold opacity-70">{label}</span>
      <span className="tabular-nums">{value}</span>
    </span>
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

/** One row of the donut's key. */
function Legend({
  colour,
  label,
  value,
}: {
  colour: string;
  label: string;
  value: string;
}) {
  return (
    <li className="flex items-center gap-2 text-sm">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${colour}`} />
      <span className="min-w-0 flex-1 truncate text-slate-600">{label}</span>
      <span className="shrink-0 font-semibold tabular-nums text-slate-900">
        {value}
      </span>
    </li>
  );
}

/** A labelled figure for places a gauge would be overkill. */
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

/** One figure inside the dark hero band. */
function HeroStat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="bg-[#0b1220] px-4 py-3.5">
      <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">
        {label}
      </dt>
      <dd className="mt-1 font-display text-xl font-bold tabular-nums text-white">
        {value}
      </dd>
      <p className="text-[11px] text-white/40">{sub}</p>
    </div>
  );
}

/** Share of the week's slots that are booked, as a percentage string. */
function weekFill(m: DashboardMetrics): string {
  const capacity = m.utilisation.byDay.reduce((s, d) => s + d.capacity, 0);
  if (capacity === 0) return "—";
  const booked = m.utilisation.byDay.reduce((s, d) => s + d.booked, 0);
  return `${Math.round((booked / capacity) * 100)}%`;
}
