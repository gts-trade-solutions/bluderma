"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * What was booked over the period, day by day or week by week.
 *
 * This replaced a smoothed area sparkline, and the reason is not taste. A
 * `type="monotone"` curve invents values between the points it was given: it
 * drew a gentle slope from Tuesday to Thursday through a Wednesday that was
 * empty, and dipped below zero on the way into a quiet day. Neither of those
 * things happened. It also carried no axes at all, so a doctor could see a
 * shape and had no way to learn which day any part of it was.
 *
 * Bars cannot do that. One bar is one day, its height is that day's money, an
 * empty day is visibly empty, and the dates are written along the bottom — the
 * form the client's reference decks use for exactly this figure.
 *
 * The line over the bars is a rolling average, and it is labelled as one. It
 * exists because a single quiet Sunday is not a downturn and daily bars alone
 * invite reading one as though it were; the average is the part you can act
 * on. It is drawn only when there are enough points for the window to mean
 * something.
 *
 * Recharts measures the DOM, so it is browser-only — the mount gate keeps SSR
 * and the first client render identical. Without it React hydration mismatches
 * and the chart flickers or throws.
 */

/* Lifted for the navy ground. The mid tones these were are a dark blue on a
   dark blue; on this canvas a series has to be turned up to be seen at all. */
const BRAND = "#5aa9ff";
const BRAND_DEEP = "#328ff0";
const TEAL = "#3ee0c4";
const AXIS = "rgba(255,255,255,0.72)";
const AXIS_MUTED = "rgba(255,255,255,0.48)";

/** "₹12k", "₹1.4L" — an axis has no room for ₹1,42,500. */
function compact(n: number): string {
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(n % 100_000 === 0 ? 0 : 1)}L`;
  if (n >= 1_000) return `₹${Math.round(n / 1_000)}k`;
  return `₹${n}`;
}

function prettyDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/**
 * Centred rolling mean.
 *
 * Centred rather than trailing so the line sits over the bars it describes.
 * A trailing average lags the data by half its window, which on a 30-bar chart
 * puts the "trend" visibly to the right of the thing that caused it.
 */
function rollingMean(values: number[], window: number): (number | null)[] {
  if (values.length < window) return values.map(() => null);
  const half = Math.floor(window / 2);
  return values.map((_, i) => {
    const from = Math.max(0, i - half);
    const to = Math.min(values.length, i + half + 1);
    const slice = values.slice(from, to);
    return Math.round(slice.reduce((s, v) => s + v, 0) / slice.length);
  });
}

export default function BookingsChart({
  data,
  grain = "day",
  todayIso,
}: {
  data: { date: string; value: number; count: number }[];
  grain?: "day" | "week";
  /** Today in clinic time, so the current bar can be picked out. */
  todayIso?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (!mounted) {
    return <div className="min-h-[210px] w-full flex-1 animate-pulse rounded-xl bg-white/[0.06] sm:min-h-[260px]" />;
  }

  // Nothing booked is a real answer, and a flat line at zero reads as a broken
  // chart rather than an empty diary.
  if (total === 0) {
    return (
      <div className="flex min-h-[210px] w-full flex-1 flex-col justify-end gap-3 sm:min-h-[260px]">
        <div className="flex flex-1 items-end gap-1.5">
          {Array.from({ length: 16 }, (_, i) => (
            <span
              key={i}
              className="flex-1 rounded-t bg-white/[0.06]"
              style={{ height: `${10 + (i % 5) * 4}%` }}
            />
          ))}
        </div>
        <p className="text-center text-xs text-ink-muted">
          Nothing booked in this period yet — this fills in as clients book.
        </p>
      </div>
    );
  }

  const window = grain === "week" ? 3 : 7;
  const trend = rollingMean(
    data.map((d) => d.value),
    window
  );
  const showTrend = trend.some((v) => v !== null);

  const chart = data.map((d, i) => ({
    ...d,
    trend: trend[i],
    // Recharts needs a plain string on the axis; the ISO date rides along in
    // the payload so the tooltip can spell the day out in full.
    tick: new Date(`${d.date}T00:00:00Z`).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }),
    isToday: d.date === todayIso,
  }));

  return (
    <div className="flex flex-1 flex-col">
      {/* Written key rather than recharts' own <Legend>, which cannot say
          "7-day average" without also repeating the dataKey. */}
      <div className="mb-2 flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-[11px] font-semibold text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-brand-500" />
          Booked each {grain === "week" ? "week" : "day"}
        </span>
        {showTrend && (
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full bg-teal-500" />
            {window}-{grain} average
          </span>
        )}
      </div>

      {/* relative + inset-0: ResponsiveContainer wants `height: 100%`, which
          only resolves against a definite parent height, and this wrapper is a
          flex item that grows. See the note in Charts.tsx. */}
      <div className="relative min-h-[210px] w-full flex-1 sm:min-h-[260px]">
        <div className="absolute inset-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chart} margin={{ top: 6, right: 6, bottom: 0, left: -4 }}>
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.08)" />
            <XAxis
              dataKey="tick"
              tickLine={false}
              axisLine={{ stroke: "rgba(255,255,255,0.14)" }}
              // Enough gap that "5 Aug" never collides with "6 Aug" on a
              // phone; recharts drops the labels between rather than
              // overprinting them.
              interval="preserveStartEnd"
              minTickGap={24}
              tick={{ fill: AXIS, fontSize: 11 }}
            />
            <YAxis
              width={52}
              tickLine={false}
              axisLine={false}
              tickFormatter={compact}
              tick={{ fill: AXIS_MUTED, fontSize: 10 }}
            />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.06)" }}
              contentStyle={{
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "#0d1526",
                fontSize: 12,
                padding: "8px 12px",
                boxShadow: "0 18px 44px -18px rgba(0,0,0,0.85)",
              }}
              labelStyle={{ fontWeight: 700, color: "#eef2f8", marginBottom: 2 }}
              // Recharts colours a tooltip row with its series fill. The trend
              // line is teal and legible, but keeping both rows in ink means
              // no row can ever be paler than the panel it sits on.
              itemStyle={{ color: "#eef2f8", fontWeight: 600, padding: "1px 0" }}
              labelFormatter={(_l, payload) => {
                const row = payload?.[0]?.payload as { date?: string } | undefined;
                if (!row?.date) return "";
                return grain === "week"
                  ? `Week starting ${prettyDate(row.date)}`
                  : prettyDate(row.date);
              }}
              formatter={(value, name, item) => {
                const v = typeof value === "number" ? value : 0;
                if (name === "trend") {
                  return [`₹${v.toLocaleString("en-IN")}`, `${window}-${grain} average`];
                }
                const count =
                  (item?.payload as { count?: number } | undefined)?.count ?? 0;
                return [
                  `₹${v.toLocaleString("en-IN")} from ${count} booking${count === 1 ? "" : "s"}`,
                  "Booked",
                ];
              }}
            />
            <Bar dataKey="value" radius={[3, 3, 0, 0]} isAnimationActive={false} maxBarSize={40}>
              {chart.map((d) => (
                <Cell key={d.date} fill={d.isToday ? BRAND_DEEP : BRAND} />
              ))}
            </Bar>
            {showTrend && (
              <Line
                type="monotone"
                dataKey="trend"
                stroke={TEAL}
                strokeWidth={2.5}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
