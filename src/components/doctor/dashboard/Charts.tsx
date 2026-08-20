"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * The dashboard's infographics.
 *
 * All of them share one rule: recharts measures the DOM, so nothing renders
 * until mount. The `useChart` gate keeps SSR and the first client render
 * identical — without it React hydration mismatches and the charts flicker or
 * throw. Same pattern as SkinProfileDashboard.tsx.
 *
 * Colours are written as full literals rather than composed, because Tailwind
 * never sees an interpolated class and recharts wants hex anyway.
 */

const BRAND = "#1f6fd6";
const TEAL = "#0fa08e";
const AMBER = "#f59e0b";
const ROSE = "#e11d48";
const SLATE = "#cbd5e1";

function useChart(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

function Skeleton({ height }: { height: number }) {
  return (
    <div
      className="w-full animate-pulse rounded-xl bg-slate-100"
      style={{ height }}
    />
  );
}

const TOOLTIP = {
  borderRadius: 12,
  border: "1px solid rgb(226 232 240)",
  fontSize: 12,
  boxShadow: "0 12px 32px -20px rgba(15,23,42,0.4)",
};

const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/* ------------------------- Where the money sits ------------------------- */

/**
 * The month's booked value split by what state it is in.
 *
 * A donut rather than four numbers because the question it answers is "how
 * much of this have I actually banked" — a proportion, which is what a ring
 * shows and a list of figures does not.
 */
export function RevenueDonut({
  realised,
  scheduled,
  unresolved,
  lost,
}: {
  realised: number;
  scheduled: number;
  unresolved: number;
  lost: number;
}) {
  const mounted = useChart();
  const data = [
    { name: "Completed", value: realised, fill: TEAL },
    { name: "Still to come", value: scheduled, fill: BRAND },
    { name: "Awaiting outcome", value: unresolved, fill: AMBER },
    { name: "Lost", value: lost, fill: ROSE },
  ].filter((d) => d.value > 0);

  const total = data.reduce((s, d) => s + d.value, 0);
  if (!mounted) return <Skeleton height={220} />;

  if (total === 0) {
    return (
      <div className="flex h-[220px] flex-col items-center justify-center gap-2 text-center">
        <div className="h-24 w-24 rounded-full border-8 border-slate-100" />
        <p className="text-xs text-slate-400">No bookings this month yet</p>
      </div>
    );
  }

  return (
    <div className="relative h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            innerRadius="62%"
            outerRadius="92%"
            paddingAngle={2}
            stroke="none"
            isAnimationActive={false}
          >
            {data.map((d) => (
              <Cell key={d.name} fill={d.fill} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={TOOLTIP}
            formatter={(value, name) => [
              money(typeof value === "number" ? value : 0),
              String(name),
            ]}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* The total lives in the hole — the thing the ring is a breakdown of. */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <p className="font-display text-2xl font-bold tabular-nums text-slate-900">
          {money(total)}
        </p>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Booked
        </p>
      </div>
    </div>
  );
}

/* --------------------------- Week utilisation --------------------------- */

/**
 * Booked against capacity for each weekday.
 *
 * Stacked to full height so every bar is the same length: the eye compares the
 * filled portion, which is the actual question ("which day has room"), rather
 * than comparing raw counts across days with different capacity.
 */
export function UtilisationChart({
  data,
}: {
  data: { label: string; capacity: number; booked: number; rate: number }[];
}) {
  const mounted = useChart();
  const rows = data.filter((d) => d.capacity > 0);
  if (!mounted) return <Skeleton height={200} />;
  if (!rows.length) {
    return (
      <p className="py-10 text-center text-sm text-slate-400">
        No working hours set yet.
      </p>
    );
  }

  const chart = rows.map((d) => ({
    day: d.label.slice(0, 3),
    booked: d.booked,
    free: Math.max(d.capacity - d.booked, 0),
    rate: Math.round(d.rate * 100),
    capacity: d.capacity,
  }));

  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chart} margin={{ top: 4, right: 0, bottom: 0, left: -22 }}>
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#64748b", fontSize: 11 }}
          />
          <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} tickLine={false} axisLine={false} />
          <Tooltip
            cursor={{ fill: "rgba(15,23,42,0.04)" }}
            contentStyle={TOOLTIP}
            formatter={(value, name) => [
              `${typeof value === "number" ? value : 0} slots`,
              name === "booked" ? "Booked" : "Free",
            ]}
          />
          <Bar dataKey="booked" stackId="a" fill={BRAND} radius={[0, 0, 4, 4]} isAnimationActive={false} />
          <Bar dataKey="free" stackId="a" fill="#e2e8f0" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ------------------------------ Busy hours ------------------------------ */

/**
 * When in the day the practice actually fills.
 *
 * The axis is chronological and spans every hour the practice sees work,
 * quiet ones included — the metric used to hand this the four busiest hours
 * ranked by volume, which drew a plausible curve out of an axis that was not
 * in time order. A trough at 13:00 is the most useful bar on the chart.
 */
export function HoursChart({
  data,
}: {
  data: { label: string; count: number }[];
}) {
  const mounted = useChart();
  if (!mounted) return <Skeleton height={160} />;
  if (!data.length) {
    return (
      <p className="py-8 text-center text-sm text-slate-400">
        Not enough bookings to show a pattern yet.
      </p>
    );
  }
  const max = Math.max(...data.map((d) => d.count));

  return (
    <div className="h-[160px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: -28 }}>
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={4}
            // A full working day is a dozen-odd ticks; "09:00" five times over
            // collides on a phone, and the ":00" carries nothing.
            tickFormatter={(v: string) => v.slice(0, 2)}
            tick={{ fill: "#64748b", fontSize: 11 }}
          />
          <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: "rgba(15,23,42,0.04)" }}
            contentStyle={TOOLTIP}
            formatter={(value) => [
              `${typeof value === "number" ? value : 0} bookings`,
              "In 90 days",
            ]}
          />
          <Bar dataKey="count" radius={[6, 6, 0, 0]} isAnimationActive={false}>
            {data.map((d) => (
              <Cell
                key={d.label}
                fill={d.count === max && max > 0 ? TEAL : "#bfdbfe"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* -------------------------------- Gauges -------------------------------- */

/**
 * A rate as a ring.
 *
 * Below its sample threshold it draws an empty ring and says so, rather than
 * showing a confident-looking arc built from three appointments.
 */
export function Gauge({
  label,
  value,
  sampleSize,
  minSample = 5,
  tone = "brand",
  suffix = "%",
  invert = false,
}: {
  label: string;
  value: number;
  sampleSize: number;
  minSample?: number;
  tone?: "brand" | "teal" | "amber" | "rose";
  suffix?: string;
  invert?: boolean;
}) {
  const mounted = useChart();
  const enough = sampleSize >= minSample;
  const pct = Math.round(value * 100);
  const colour =
    tone === "teal" ? TEAL : tone === "amber" ? AMBER : tone === "rose" ? ROSE : BRAND;

  if (!mounted) return <Skeleton height={128} />;

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-[104px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            innerRadius="72%"
            outerRadius="100%"
            data={[{ value: enough ? pct : 0, fill: enough ? colour : SLATE }]}
            startAngle={220}
            endAngle={-40}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar
              dataKey="value"
              background={{ fill: "#f1f5f9" }}
              cornerRadius={8}
              isAnimationActive={false}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center pt-2">
          <span
            className={`font-display text-xl font-bold tabular-nums ${
              enough
                ? invert && pct >= 15
                  ? "text-rose-600"
                  : "text-slate-900"
                : "text-slate-300"
            }`}
          >
            {enough ? `${pct}${suffix}` : "—"}
          </span>
        </div>
      </div>
      <p className="-mt-1 text-center text-xs font-semibold text-slate-600">{label}</p>
      {!enough && (
        <p className="mt-0.5 text-center text-[10px] text-slate-400">
          Needs {minSample}
        </p>
      )}
    </div>
  );
}
