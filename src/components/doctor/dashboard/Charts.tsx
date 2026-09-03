"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
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
 * throw.
 *
 * The second rule came out of the client's review, where a practising doctor
 * read this screen and could not say what most of it meant. Every chart here
 * now has to pass three tests before it ships:
 *
 *   1. Can the reader tell what one mark represents, without a key? One bar
 *      is one day, one hour, one weekday — never a rank, never a smoothed
 *      interpolation between two real values.
 *   2. Are the axes written down, and is every bar's value readable without
 *      hovering? The reference decks print the figure at the end of the bar,
 *      because a chart nobody can hover — printed, screenshotted, on a phone
 *      mid-clinic — still has to answer.
 *   3. Does the tooltip answer in a sentence rather than a number? "12" is
 *      not an answer; "12 of 18 seats booked" is.
 *
 * Colours are written as full literals rather than composed, because Tailwind
 * never sees an interpolated class and recharts wants hex anyway.
 *
 * ── Why every chart sits in `relative` + `absolute inset-0` ──────────────
 * `ResponsiveContainer` asks for `height: 100%`, and a percentage height only
 * resolves against a parent whose own height is definite. These wrappers are
 * flex items that grow to fill their panel, so their height comes from the
 * flex algorithm — definite when the panel is stretched by a grid row, and
 * indefinite when the panel stands alone. In the second case the container
 * measured itself as 0×0 and the chart silently vanished, which is exactly
 * what happened to the seats chart. Anchoring the inner div to all four
 * edges gives the container a resolved box either way.
 */

/* ── The palette ───────────────────────────────────────────────────────
   Bright and distinguishable, because these charts are read at a glance
   between patients rather than studied.

   EMPTY was #e2e8f0 — the same near-white the grid lines are drawn in. On
   the seats chart that meant the unbooked half of every bar read as
   background rather than as a quantity, so a doctor could not see the thing
   the chart exists to show: how much of the week is still sellable. It is a
   warm amber now. Unbooked time is not neutral, it is money not yet earned,
   and it should look like something worth acting on.

   Every fill below carries white or near-black type in its label, and each
   pair was checked rather than assumed. */
const BRAND = "#1f6fd6";
const BRAND_LIGHT = "#8ecdff";
const TEAL = "#0fa08e";
const AMBER = "#f59e0b";
/** Unbooked capacity. Amber, not grey — see the note above. */
const EMPTY = "#fcd34d";
/** Grid lines and axes only. Never a data series. */
const GRID = "#e2e8f0";

function useChart(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

/**
 * True on a phone.
 *
 * Recharts wants pixel numbers for axis widths and font sizes — they end up
 * as SVG attributes, so a Tailwind breakpoint cannot reach them. A 148px
 * category axis is right on a desktop and eats half the plot on a 360px
 * screen, which is where this portal is actually read.
 */
function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return narrow;
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
  padding: "8px 12px",
  boxShadow: "0 12px 32px -20px rgba(15,23,42,0.4)",
};

const LABEL_STYLE = { fontWeight: 700, color: "#0f172a", marginBottom: 2 };

/**
 * Recharts colours each tooltip row with the series' own fill, which is right
 * for a saturated bar and unreadable for a pale one: the "still open" and
 * "left empty" series are slate-200, so their line of the tooltip was pale
 * grey text on white and effectively invisible — the half of the tooltip a
 * doctor most needs, since the empty seats are the actionable part.
 *
 * So the swatch keeps the series colour and the words do not. The dot carries
 * the identification; the text is set in ink at a contrast that passes on
 * white whatever the series is filled with.
 */
const ITEM_STYLE = { color: "#0f172a", fontWeight: 600, padding: "1px 0" };


const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/** "₹12k", "₹1.4L" — for axis ticks and end-of-bar labels. */
function compactMoney(n: number): string {
  const v = Math.round(n);
  if (v >= 100_000) return `₹${(v / 100_000).toFixed(v >= 1_000_000 ? 0 : 1)}L`;
  if (v >= 1_000) return `₹${Math.round(v / 1_000)}k`;
  return `₹${v}`;
}

/* ------------------------- Where the money sits ------------------------- */

/**
 * The share written onto its own slice, as the reference decks print it.
 *
 * Placed by polar arithmetic rather than by recharts' default outside-the-ring
 * position: an outside label needs a leader line and room the panel does not
 * have at this width, and three of them at the top of a ring overlap. Sitting
 * the figure in the middle of the band means it always belongs to a segment
 * the reader can see it touching.
 *
 * Anything under a sixteenth of the ring is skipped. The band is only so many
 * pixels tall, "6%" is three characters, and a label that overflows its own
 * slice points at the wrong one.
 */
const RADIANS = Math.PI / 180;

function sliceShareLabel(props: unknown): React.ReactNode {
  const p = props as {
    cx: number;
    cy: number;
    midAngle: number;
    innerRadius: number;
    outerRadius: number;
    percent: number;
  };
  const share = (p.percent ?? 0) * 100;
  if (share < 6) return null;

  const r = p.innerRadius + (p.outerRadius - p.innerRadius) / 2;
  const x = p.cx + r * Math.cos(-p.midAngle * RADIANS);
  const y = p.cy + r * Math.sin(-p.midAngle * RADIANS);

  return (
    <text
      x={x}
      y={y}
      fill="#ffffff"
      fontSize={11}
      fontWeight={700}
      textAnchor="middle"
      dominantBaseline="central"
    >
      {Math.round(share)}%
    </text>
  );
}

/**
 * The period's booked value, split by the state each visit is in.
 *
 * The ring holds the three states that make up the booked total and nothing
 * else. It used to include cancelled visits as a fourth slice, which meant the
 * figure in the hole did not match the headline at the top of the same screen:
 * ₹3,09,730 against ₹2,91,570. Two different totals for one month, both
 * correct, both unexplained, is the most confusing thing a money screen can
 * do. Lost money is real and still shown — beside the ring, where it cannot
 * silently change what the total means.
 *
 * Percentages are printed on the segments, as the reference decks do. A ring
 * shows a proportion; making the reader estimate that proportion by eye and
 * then hover to check is asking them to do the chart's job.
 */
export function RevenueDonut({
  realised,
  scheduled,
  unresolved,
}: {
  realised: number;
  scheduled: number;
  unresolved: number;
}) {
  const mounted = useChart();
  const data = [
    { name: "Money earned", value: realised, fill: TEAL },
    { name: "Money coming in", value: scheduled, fill: BRAND },
    { name: "Not closed off", value: unresolved, fill: AMBER },
  ].filter((d) => d.value > 0);

  const total = data.reduce((s, d) => s + d.value, 0);
  if (!mounted) return <Skeleton height={230} />;

  if (total === 0) {
    return (
      <div className="flex h-[200px] flex-col items-center justify-center gap-3 text-center sm:h-[230px]">
        <div className="h-24 w-24 rounded-full border-[10px] border-slate-100" />
        <p className="text-xs text-slate-400">Nothing booked in this period yet</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-[200px] w-full flex-1 sm:min-h-[230px]">
      <div className="absolute inset-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            innerRadius="58%"
            outerRadius="82%"
            paddingAngle={2}
            stroke="none"
            isAnimationActive={false}
            label={sliceShareLabel}
            labelLine={false}
          >
            {data.map((d) => (
              <Cell key={d.name} fill={d.fill} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={TOOLTIP}
            itemStyle={ITEM_STYLE}
            formatter={(value, name) => {
              const v = typeof value === "number" ? value : 0;
              return [
                `${money(v)} — ${Math.round((v / total) * 100)}% of the total`,
                String(name),
              ];
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      </div>

      {/* The total lives in the hole — the thing the ring is a breakdown of,
          and the same figure as the headline at the top of the page. */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <p className="font-display text-2xl font-bold tabular-nums text-slate-900">
          {money(total)}
        </p>
        <p className="mt-0.5 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          total booked
        </p>
      </div>
    </div>
  );
}

/* --------------------------- Seats, week ahead --------------------------- */

/**
 * Every seat in the next seven days: taken, and still for sale.
 *
 * Deliberately NOT stacked to a common height, unlike the four-week chart
 * below it. That one asks "which weekday runs full", which is a proportion;
 * this one asks "where are the gaps", which is a count — and a Tuesday with
 * four free slots should look the same here as a Friday with four free slots,
 * even when Tuesday is a half day.
 */
export function SeatWeekChart({
  data,
  perSeat,
}: {
  data: {
    date: string;
    label: string;
    short: string;
    isToday: boolean;
    seats: number;
    booked: number;
    empty: number;
  }[];
  /** What one seat is worth, so the tooltip can price the gap. */
  perSeat: number;
}) {
  const mounted = useChart();
  if (!mounted) return <Skeleton height={200} />;

  if (!data.some((d) => d.seats > 0)) {
    return (
      <p className="py-14 text-center text-sm text-slate-400">
        No working hours in the next seven days. Add your hours under Practice
        and your seats will appear here.
      </p>
    );
  }

  const chart = data.map((d) => ({
    ...d,
    // "Today" beats "Thu" — it is the one label the reader is looking for.
    tick: d.isToday ? "Today" : d.short,
  }));

  return (
    <div className="relative min-h-[200px] w-full flex-1 sm:min-h-[230px]">
      <div className="absolute inset-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chart} margin={{ top: 14, right: 6, bottom: 0, left: -20 }}>
          <CartesianGrid vertical={false} stroke="#eef2f7" />
          <XAxis
            dataKey="tick"
            tickLine={false}
            axisLine={{ stroke: GRID }}
            tick={{ fill: "#475569", fontSize: 11, fontWeight: 600 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            tick={{ fill: "#94a3b8", fontSize: 10 }}
          />
          <Tooltip
            cursor={{ fill: "rgba(15,23,42,0.04)" }}
            contentStyle={TOOLTIP}
            itemStyle={ITEM_STYLE}
            labelStyle={LABEL_STYLE}
            labelFormatter={(_l, payload) =>
              (payload?.[0]?.payload as { label?: string } | undefined)?.label ?? ""
            }
            formatter={(value, name) => {
              const v = typeof value === "number" ? value : 0;
              if (name === "booked") {
                return [`${v} seat${v === 1 ? "" : "s"} taken`, "Booked"];
              }
              return [
                `${v} free, worth about ${money(v * perSeat)}`,
                "Still open",
              ];
            }}
          />
          <Bar
            dataKey="booked"
            stackId="seats"
            fill={TEAL}
            radius={[0, 0, 4, 4]}
            isAnimationActive={false}
            maxBarSize={52}
          />
          <Bar
            dataKey="empty"
            stackId="seats"
            fill={EMPTY}
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
            maxBarSize={52}
          >
            {/* The number of empty seats, printed above each day. This chart's
                whole job is "where are my gaps" and the answer should not
                require a hover. */}
            <LabelList
              dataKey="seats"
              position="top"
              formatter={(v) => (Number(v) > 0 ? String(v) : "")}
              style={{ fill: "#94a3b8", fontSize: 10, fontWeight: 700 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
}

/* --------------------------- Week utilisation --------------------------- */

/**
 * Booked against capacity for each weekday, over the last four weeks.
 *
 * Stacked to full height so every bar is the same length: the eye compares the
 * filled portion, which is the actual question ("which weekday runs empty"),
 * rather than comparing raw counts across days with different capacity.
 */
export function UtilisationChart({
  data,
}: {
  data: { label: string; capacity: number; booked: number; rate: number }[];
}) {
  const mounted = useChart();
  const rows = data.filter((d) => d.capacity > 0);
  if (!mounted) return <Skeleton height={220} />;
  if (!rows.length) {
    return (
      <p className="py-12 text-center text-sm text-slate-400">
        No working hours set yet.
      </p>
    );
  }

  const chart = rows.map((d) => ({
    day: d.label.slice(0, 3),
    fullDay: d.label,
    booked: d.booked,
    free: Math.max(d.capacity - d.booked, 0),
    rate: Math.round(d.rate * 100),
    capacity: d.capacity,
  }));

  return (
    <div className="relative min-h-[190px] w-full flex-1 sm:min-h-[220px]">
      <div className="absolute inset-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chart} margin={{ top: 14, right: 6, bottom: 0, left: -20 }}>
          <CartesianGrid vertical={false} stroke="#eef2f7" />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={{ stroke: GRID }}
            tick={{ fill: "#475569", fontSize: 11, fontWeight: 600 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            tick={{ fill: "#94a3b8", fontSize: 10 }}
          />
          <Tooltip
            cursor={{ fill: "rgba(15,23,42,0.04)" }}
            contentStyle={TOOLTIP}
            itemStyle={ITEM_STYLE}
            labelStyle={LABEL_STYLE}
            labelFormatter={(_l, payload) => {
              const row = payload?.[0]?.payload as
                | { fullDay?: string; rate?: number }
                | undefined;
              return row?.fullDay ? `${row.fullDay}s — ${row.rate}% full` : "";
            }}
            formatter={(value, name, item) => {
              const v = typeof value === "number" ? value : 0;
              const cap =
                (item?.payload as { capacity?: number } | undefined)?.capacity ?? 0;
              return name === "booked"
                ? [`${v} of ${cap} seats booked`, "Booked"]
                : [`${v} seats nobody took`, "Left empty"];
            }}
          />
          <Bar
            dataKey="booked"
            stackId="a"
            fill={BRAND}
            radius={[0, 0, 4, 4]}
            isAnimationActive={false}
            maxBarSize={52}
          />
          <Bar
            dataKey="free"
            stackId="a"
            fill={EMPTY}
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
            maxBarSize={52}
          >
            <LabelList
              dataKey="rate"
              position="top"
              formatter={(v) => `${v}%`}
              style={{ fill: "#94a3b8", fontSize: 10, fontWeight: 700 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      </div>
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
  if (!mounted) return <Skeleton height={200} />;
  if (!data.length) {
    return (
      <p className="py-12 text-center text-sm text-slate-400">
        Not enough bookings to show a pattern yet.
      </p>
    );
  }
  const max = Math.max(...data.map((d) => d.count));

  return (
    <div className="relative min-h-[175px] w-full flex-1 sm:min-h-[200px]">
      <div className="absolute inset-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 14, right: 6, bottom: 0, left: -24 }}>
          <CartesianGrid vertical={false} stroke="#eef2f7" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: GRID }}
            interval="preserveStartEnd"
            minTickGap={4}
            // A full working day is a dozen-odd ticks; "09:00" five times over
            // collides on a phone, and the ":00" carries nothing.
            tickFormatter={(v: string) => v.slice(0, 2)}
            tick={{ fill: "#475569", fontSize: 11 }}
          />
          <YAxis
            tick={{ fill: "#94a3b8", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(15,23,42,0.04)" }}
            contentStyle={TOOLTIP}
            itemStyle={ITEM_STYLE}
            labelStyle={LABEL_STYLE}
            labelFormatter={(l) => `Visits starting at ${l}`}
            formatter={(value) => {
              const v = typeof value === "number" ? value : 0;
              return [`${v} booking${v === 1 ? "" : "s"}`, "Over 90 days"];
            }}
          />
          <Bar dataKey="count" radius={[5, 5, 0, 0]} isAnimationActive={false} maxBarSize={38}>
            {data.map((d) => (
              <Cell key={d.label} fill={d.count === max && max > 0 ? TEAL : BRAND_LIGHT} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ------------------------------ Growth bars ------------------------------ */

/**
 * What a few more clients a week would add to the period.
 *
 * The first attempt stacked each increment on top of the run rate, so the
 * reader could see where the month lands. It was unreadable: the run rate is
 * ₹4,30,413 and the increments are ₹2,114 to ₹10,571, so all four bars were
 * the same height and every label rounded to "₹4.3L". A chart whose bars are
 * indistinguishable has told the reader nothing.
 *
 * So the bars are the addition itself, where the 1:2:5 ratio is the whole
 * shape and is plainly visible. Where the month lands is not dropped — it is
 * in the tooltip against each bar, and in the sentence under the panel, which
 * is the right place for a figure that does not need comparing.
 *
 * Every bar is multiplication, not a forecast: the average booking times the
 * weeks left.
 */
export function UpliftChart({
  projected,
  uplift,
}: {
  /** The straight-line run rate for the period, for the tooltip. */
  projected: number;
  uplift: { perWeek: number; amount: number }[];
}) {
  const mounted = useChart();
  const narrow = useNarrow();
  if (!mounted) return <Skeleton height={200} />;

  const data = uplift.map((u) => ({
    label: `+${u.perWeek} a week`,
    amount: u.amount,
    lands: projected + u.amount,
  }));

  return (
    <div className="relative min-h-[180px] w-full flex-1 sm:min-h-[210px]">
      <div className="absolute inset-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 22, right: 6, bottom: 0, left: -6 }}>
          <CartesianGrid vertical={false} stroke="#eef2f7" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: GRID }}
            tick={{ fill: "#475569", fontSize: narrow ? 11 : 12, fontWeight: 600 }}
          />
          <YAxis
            width={narrow ? 42 : 52}
            tickLine={false}
            axisLine={false}
            tickFormatter={compactMoney}
            tick={{ fill: "#94a3b8", fontSize: 10 }}
          />
          <Tooltip
            cursor={{ fill: "rgba(15,23,42,0.04)" }}
            contentStyle={TOOLTIP}
            itemStyle={ITEM_STYLE}
            labelStyle={LABEL_STYLE}
            labelFormatter={(l) => `${l} more clients`}
            formatter={(value, _name, item) => {
              const v = typeof value === "number" ? value : 0;
              const lands =
                (item?.payload as { lands?: number } | undefined)?.lands ?? 0;
              return [
                `${money(v)} extra — the period would finish on ${money(lands)} instead of ${money(projected)}`,
                "Adds",
              ];
            }}
          />
          <Bar
            dataKey="amount"
            fill={TEAL}
            radius={[5, 5, 0, 0]}
            isAnimationActive={false}
            maxBarSize={72}
          >
            <LabelList
              dataKey="amount"
              position="top"
              formatter={(v) => `+${money(Number(v))}`}
              style={{ fill: "#0a665d", fontSize: narrow ? 10 : 12, fontWeight: 700 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ------------------------------ Ranked bars ------------------------------ */

/**
 * A ranked list drawn as horizontal bars with the figure printed at the end.
 *
 * The form the client's reference uses for "revenue per location" and "new
 * patients per location", and it is the right one whenever the categories are
 * words: a vertical bar chart with seven treatment names underneath rotates
 * the labels to 45° and becomes unreadable on a phone, which is where this
 * portal is actually used.
 */
export function RankedBars({
  data,
  unit = "count",
  emptyNote,
}: {
  data: {
    key: string;
    label: string;
    value: number;
    /** Optional second figure for the tooltip, e.g. money behind a count. */
    secondary?: string;
    /** Overrides the palette for one row — a "not recorded" bucket. */
    muted?: boolean;
    /** Full hex, when the caller owns the colour (clinic swatches). */
    fill?: string;
  }[];
  /** How to print the value at the end of the bar and in the tooltip. */
  unit?: "count" | "money";
  emptyNote?: string;
}) {
  const mounted = useChart();
  const narrow = useNarrow();
  if (!mounted) return <Skeleton height={Math.max(data.length * 40, 140)} />;
  if (!data.length) {
    return (
      <p className="py-10 text-center text-sm text-slate-400">
        {emptyNote ?? "Nothing to show yet."}
      </p>
    );
  }

  const minHeight = Math.max(data.length * (narrow ? 34 : 38), 130);
  const print = (v: number) =>
    unit === "money" ? compactMoney(v) : String(Math.round(v));

  return (
    <div style={{ minHeight }} className="relative w-full flex-1">
      <div className="absolute inset-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          // Room on the right for the printed figure, which sits outside the
          // bar and would otherwise be clipped by the plot area.
          margin={{ left: 0, right: narrow ? 34 : 44, top: 4, bottom: 4 }}
        >
          <CartesianGrid horizontal={false} stroke="#eef2f7" />
          <XAxis
            type="number"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#94a3b8", fontSize: 10 }}
            tickFormatter={(v: number) => print(v)}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={narrow ? 104 : 148}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#334155", fontSize: narrow ? 10 : 12 }}
          />
          <Tooltip
            cursor={{ fill: "rgba(15,23,42,0.04)" }}
            contentStyle={TOOLTIP}
            itemStyle={ITEM_STYLE}
            labelStyle={LABEL_STYLE}
            formatter={(value, _name, item) => {
              const v = typeof value === "number" ? value : 0;
              const secondary = (item?.payload as { secondary?: string } | undefined)
                ?.secondary;
              const main =
                unit === "money"
                  ? money(v)
                  : `${v} booking${v === 1 ? "" : "s"}`;
              return [secondary ? `${main} · ${secondary}` : main, "Total"];
            }}
          />
          <Bar dataKey="value" radius={[0, 6, 6, 0]} isAnimationActive={false} maxBarSize={26}>
            {data.map((d) => (
              <Cell
                key={d.key}
                // A "not recorded" bucket is deliberately grey — it is an
                // absence of data, not a category of demand.
                fill={d.fill ?? (d.muted ? EMPTY : BRAND)}
              />
            ))}
            <LabelList
              dataKey="value"
              position="right"
              formatter={(v) => print(Number(v))}
              style={{ fill: "#0f172a", fontSize: 11, fontWeight: 700 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
}
