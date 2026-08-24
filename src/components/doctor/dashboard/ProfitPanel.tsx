import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { ChartPanel, SectionHead, money } from "./kit";
import { categoryLabel, type NetSummary, type Recovery } from "@/lib/doctor/financeCore";

/**
 * What is left after the practice has paid for itself.
 *
 * ── Two figures that must not be added together ──────────────────────────
 * Net is takings minus RUNNING costs. Machines are shown beside it, being
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
  recoveries,
  periodLabel,
}: {
  net: NetSummary;
  recoveries: Recovery[];
  periodLabel: string;
}) {
  const nothingRecorded = net.runningCostInr === 0;

  return (
    <>
      <SectionHead
        title="What you keep"
        sub="Takings against what the practice costs to run. Equipment is tracked separately, below."
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
          title="Takings against running costs"
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
                {net.costRatio !== null && (
                  <>
                    , which is {Math.round(net.costRatio * 100)}% of what you
                    booked
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
              label="Booked"
              value={net.takingsInr}
              max={Math.max(net.takingsInr, net.runningCostInr, 1)}
              className="bg-gradient-to-r from-brand-500 to-brand-400"
            />
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
                  return (
                    <li key={r.id}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="min-w-0 truncate text-sm font-semibold text-slate-700">
                          {r.name}
                        </span>
                        <span className="shrink-0 text-sm font-bold tabular-nums text-slate-900">
                          {pct}%
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-teal-500"
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
