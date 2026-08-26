import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { ChartPanel, SectionHead, money } from "./kit";
import {
  categoryLabel,
  type MachineStatus,
  type NetSummary,
  type Recovery,
  type RevenueSummary,
} from "@/lib/doctor/financeCore";

/**
 * What is left after the practice has paid for itself.
 *
 * ── Revenue is four streams ──────────────────────────────────────────────
 * Bookings, medicine sales, procedure charges and other income, each counted
 * once. It used to be bookings alone while the other three sat recorded and
 * unread, which made this panel wrong in the least helpful direction: the
 * costs were complete, so a practitioner who recorded their expenses properly
 * made their own practice look unprofitable.
 *
 * ── Two figures that must not be added together ──────────────────────────
 * Net is revenue minus RUNNING costs. Machines are shown beside it, being
 * recovered, and are deliberately not subtracted from the month: a ₹5,00,000
 * laser taken out of one month's takings reads as a disaster for something
 * that earns out over years, and a practitioner acting on that number would
 * act wrongly.
 *
 * ── It refuses to be a dashboard when there is nothing behind it ─────────
 * With no costs recorded, "net = takings" is arithmetically true and
 * completely misleading, because the rent has not been entered rather than
 * not been paid. So the panel says that instead of printing a profit figure
 * nobody should trust.
 */
export default function ProfitPanel({
  net,
  revenue,
  recoveries,
  statusFor,
  periodLabel,
}: {
  net: NetSummary;
  /** The four streams behind net.takingsInr. */
  revenue: RevenueSummary;
  recoveries: Recovery[];
  /** How each machine is doing. Passed in so this stays a pure renderer. */
  statusFor: (r: Recovery) => MachineStatus;
  periodLabel: string;
}) {
  const nothingRecorded = net.runningCostInr === 0;

  // Streams worth drawing. A stream at zero is a stream the practice does not
  // run, and four bars where three are empty says less than one bar does.
  const streams = revenue.streams.filter((r) => r.amountInr > 0);

  return (
    <>
      <SectionHead
        title="What you keep"
        sub="All four revenue streams against what the practice costs to run. Equipment is tracked separately, below."
        action={
          <Link
            href="/doctor/portal/finance"
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-600 ring-1 ring-slate-200 transition hover:text-slate-900"
          >
            Manage costs <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        }
      />

      <div className="mb-5 grid gap-3.5 lg:grid-cols-3">
        <ChartPanel
          className="lg:col-span-2"
          index={0}
          tone="teal"
          icon="rupee"
          title="Revenue against running costs"
          sub={periodLabel}
          note={
            nothingRecorded ? (
              // The honest empty state. See the note at the top.
              <>
                No running costs recorded for {periodLabel}, so there is no net
                figure to show yet. Add rent, salaries and consumables and this
                becomes the number worth watching.
              </>
            ) : (
              <>
                <strong className="font-bold text-slate-900">
                  {money(net.netInr)}
                </strong>{" "}
                left after {money(net.runningCostInr)} of running costs
                {net.profitRatio !== null && (
                  <>
                    , which is {Math.round(net.profitRatio * 100)}% of
                    everything you took
                  </>
                )}
                . Equipment is not in this figure: a machine is capital, and
                subtracting one from a single month would read as a loss for
                something that earns out over years.
              </>
            )
          }
        >
          <div className="p-4 sm:p-5">
            {/* Two stacked bars rather than a chart library: this is one
                comparison, and a bar the reader can measure against the one
                above it says it better than axes would. */}
            <Bar
              label="Revenue"
              value={net.takingsInr}
              max={Math.max(net.takingsInr, net.runningCostInr, 1)}
              className="bg-gradient-to-r from-brand-500 to-brand-400"
            />

            {/* What the revenue bar is made of. Printed under it rather than
                as a second chart: it is a decomposition of the bar above, and
                a separate ring beside it is how this screen once ended up with
                two different totals for one month. */}
            {streams.length > 1 && (
              <ul className="-mt-1 mb-3 flex flex-wrap gap-x-3 gap-y-0.5">
                {streams.map((r) => (
                  <li key={r.key} className="text-[11px] text-slate-500">
                    <span className="font-semibold text-slate-600">{r.label}</span>{" "}
                    {money(r.amountInr)}
                  </li>
                ))}
              </ul>
            )}

            <Bar
              label="Running costs"
              value={net.runningCostInr}
              max={Math.max(net.takingsInr, net.runningCostInr, 1)}
              className="bg-gradient-to-r from-amber-400 to-orange-500"
            />

            {!nothingRecorded && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  Net
                </p>
                <p
                  className={`font-display text-3xl font-extrabold tracking-[-0.03em] tabular-nums ${
                    net.netInr >= 0 ? "text-teal-700" : "text-rose-600"
                  }`}
                >
                  {money(net.netInr)}
                </p>
              </div>
            )}

            {net.byCategory.length > 0 && (
              <ul className="mt-4 space-y-1.5">
                {net.byCategory.slice(0, 5).map((c) => (
                  <li
                    key={c.category}
                    className="flex items-baseline justify-between gap-2 text-xs"
                  >
                    <span className="font-semibold text-slate-600">
                      {categoryLabel(c.category)}
                    </span>
                    <span className="font-bold tabular-nums text-slate-900">
                      {money(c.amountInr)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </ChartPanel>

        <ChartPanel
          index={1}
          tone="violet"
          icon="pulse"
          title="Equipment paying for itself"
          sub={
            recoveries.length === 0
              ? "No machines registered"
              : `${recoveries.length} machine${recoveries.length === 1 ? "" : "s"}`
          }
          note={
            recoveries.length === 0 ? (
              <>
                Add a machine and record each use, and this shows how much of
                what it cost has come back.
              </>
            ) : (
              recoveries[0].guidance
            )
          }
        >
          <div className="p-4 sm:p-5">
            {recoveries.length === 0 ? (
              <Link
                href="/doctor/portal/finance"
                className="block rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm font-semibold text-slate-500 transition hover:border-violet-400 hover:text-violet-700"
              >
                Add your first machine
              </Link>
            ) : (
              <ul className="space-y-4">
                {recoveries.slice(0, 4).map((r) => {
                  const pct = Math.round(r.progress * 100);
                  const status = statusFor(r);
                  // Full literal strings: Tailwind never sees an interpolated
                  // class, so an interpolated colour compiles to nothing.
                  const bar = {
                    blue: "from-blue-500 to-teal-400",
                    teal: "from-teal-500 to-emerald-400",
                    amber: "from-amber-400 to-orange-500",
                    rose: "from-rose-400 to-rose-600",
                    slate: "from-slate-300 to-slate-400",
                  }[status.tone];
                  const dot = {
                    blue: "bg-blue-500",
                    teal: "bg-teal-500",
                    amber: "bg-amber-500",
                    rose: "bg-rose-500",
                    slate: "bg-slate-300",
                  }[status.tone];
                  return (
                    <li key={r.id}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
                          <span className="min-w-0 truncate text-sm font-semibold text-slate-700">
                            {r.name}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-bold tabular-nums text-slate-900">
                          {pct}%
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${bar}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {money(r.recoveredInr)} of {money(r.outlayInr)}
                        {r.usesToBreakEven !== null && r.usesToBreakEven > 0 && (
                          <> · about {r.usesToBreakEven} more uses</>
                        )}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </ChartPanel>
      </div>
    </>
  );
}

function Bar({
  label,
  value,
  max,
  className,
}: {
  label: string;
  value: number;
  max: number;
  className: string;
}) {
  // Scaled against the larger of the two, so the pair can be read against each
  // other. Scaling each to its own width would make equal-looking bars for
  // wildly different numbers.
  const width = Math.round((value / max) * 100);
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold text-slate-500">{label}</span>
        <span className="text-sm font-bold tabular-nums text-slate-900">
          {money(value)}
        </span>
      </div>
      <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${className}`}
          style={{ width: `${Math.max(width, value > 0 ? 2 : 0)}%` }}
        />
      </div>
    </div>
  );
}
