import Link from "next/link";

/**
 * The dashboard's own building blocks, in the style the client signed off.
 *
 * The reference decks they sent share one structure, and it is worth writing
 * down because everything in this file follows from it:
 *
 *   KPI ROW      Four tiles across the top. Each is an icon, a label, one big
 *                number, and how that number moved. Nothing else. A reader
 *                gets the state of the practice before scrolling.
 *
 *   TITLED PANEL Every chart sits under a filled header strip carrying an
 *                icon and a plain-English title. No chart floats on the page
 *                unlabelled — in the references you can name every panel
 *                without reading the axes, and that is the point.
 *
 *   CAPTION      Under the chart, one sentence saying what it shows. The
 *                references do this everywhere: "38% growth since January",
 *                "Strong growth after promotional campaign in May". It is the
 *                difference between a picture and a finding.
 *
 *   SUMMARY ROW  Small tiles closing a section with its totals.
 *
 * These are deliberately separate from portalUi.tsx. That file's `Panel` is
 * used by the calendar, requests and profile screens, and this dashboard is
 * the only surface that wants a filled header bar and KPI furniture; forking
 * them means a change here cannot break the other four pages.
 */

export const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/**
 * "₹2.9L", "₹52k" — for tiles where the full figure would wrap.
 *
 * Indian grouping, not international: a doctor in Chennai reads lakhs, and
 * "₹291.6K" is a foreign unit printed in a rupee sign.
 */
export function moneyShort(n: number): string {
  const v = Math.round(n);
  if (v >= 10_000_000) return `₹${(v / 10_000_000).toFixed(1)}Cr`;
  if (v >= 100_000) return `₹${(v / 100_000).toFixed(v >= 1_000_000 ? 0 : 2)}L`;
  if (v >= 1_000) return `₹${Math.round(v / 1_000)}k`;
  return `₹${v}`;
}

/* --------------------------------- Tones -------------------------------- */

/**
 * Full class strings only. Tailwind scans source text, so an interpolated
 * class name compiles to nothing and the colour silently goes missing.
 */
const TONES = {
  brand: {
    bar: "border-brand-500",
    tile: "bg-gradient-to-br from-brand-500 to-brand-600",
    strip: "from-brand-50",
    text: "text-brand-700",
    dot: "bg-brand-600",
    soft: "bg-brand-50",
  },
  teal: {
    bar: "border-teal-500",
    tile: "bg-gradient-to-br from-teal-500 to-teal-600",
    strip: "from-teal-50",
    text: "text-teal-700",
    dot: "bg-teal-500",
    soft: "bg-teal-50",
  },
  violet: {
    bar: "border-violet-500",
    tile: "bg-gradient-to-br from-violet-500 to-fuchsia-500",
    strip: "from-violet-50",
    text: "text-violet-700",
    dot: "bg-violet-500",
    soft: "bg-violet-50",
  },
  amber: {
    bar: "border-amber-500",
    tile: "bg-gradient-to-br from-amber-400 to-orange-500",
    strip: "from-amber-50",
    text: "text-amber-700",
    dot: "bg-amber-500",
    soft: "bg-amber-50",
  },
  rose: {
    bar: "border-rose-500",
    tile: "bg-gradient-to-br from-rose-500 to-pink-500",
    strip: "from-rose-50",
    text: "text-rose-700",
    dot: "bg-rose-600",
    soft: "bg-rose-50",
  },
  slate: {
    bar: "border-slate-400",
    tile: "bg-gradient-to-br from-slate-400 to-slate-500",
    strip: "from-slate-100",
    text: "text-slate-700",
    dot: "bg-slate-400",
    soft: "bg-slate-100",
  },
} as const;

export type Tone = keyof typeof TONES;

/* ------------------------------- Delta chip ------------------------------ */

/**
 * How a figure moved, as the references print it: an arrow, a percentage, and
 * what it is being compared against.
 *
 * Direction is not always improvement, so `goodWhenUp` exists — a rising
 * cancellation rate is red, and colouring it green because the arrow points up
 * would be worse than printing no colour at all.
 */
export function Delta({
  value,
  since,
  goodWhenUp = true,
}: {
  /** -1..n, or null when there is nothing to compare against. */
  value: number | null;
  /** "vs last month". */
  since?: string;
  goodWhenUp?: boolean;
}) {
  if (value === null || !Number.isFinite(value)) {
    return (
      <span className="text-[11px] font-semibold text-slate-400">
        No earlier period to compare
      </span>
    );
  }

  const up = value >= 0;
  const good = up === goodWhenUp;
  const pct = Math.abs(Math.round(value * 100));

  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold">
      <span
        className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 ${
          good ? "bg-teal-50 text-teal-700" : "bg-rose-50 text-rose-600"
        }`}
      >
        <span aria-hidden>{up ? "▲" : "▼"}</span>
        {pct}%
      </span>
      {since && <span className="font-semibold text-slate-400">{since}</span>}
    </span>
  );
}

/* -------------------------------- KPI tile ------------------------------- */

/**
 * One headline figure, in the reference's top-row form.
 *
 * `hint` is not optional decoration — it is the sentence that says what the
 * number counts. The screen this replaced showed "₹2,91,570" under the word
 * "Booked" and a practitioner reading it could not tell whether that was money
 * received, money owed, or money hoped for.
 */
export function Kpi({
  label,
  value,
  hint,
  delta,
  since,
  goodWhenUp = true,
  tone = "brand",
  icon,
  href,
  "data-tour": tour,
}: {
  label: string;
  value: string;
  hint?: string;
  delta?: number | null;
  since?: string;
  goodWhenUp?: boolean;
  tone?: Tone;
  icon: string;
  /** Makes the whole tile a link, for figures with somewhere to go. */
  href?: string;
  /** Tour anchor. See the note on SectionHead. */
  "data-tour"?: string;
}) {
  const skin = TONES[tone];
  const body = (
    <>
      <span
        aria-hidden
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white shadow-sm transition duration-200 group-hover/kpi:scale-105 sm:h-10 sm:w-10 sm:rounded-xl ${skin.tile}`}
      >
        <Glyph name={icon} size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400 sm:text-[11px] sm:tracking-[0.1em]">
          {label}
        </span>
        <span className="mt-1 block font-display text-[20px] font-extrabold leading-none tracking-[-0.03em] tabular-nums text-slate-900 sm:text-[26px]">
          {value}
        </span>
        {(delta !== undefined || hint) && (
          <span className="mt-1.5 block">
            {delta !== undefined ? (
              <Delta value={delta ?? null} since={since} goodWhenUp={goodWhenUp} />
            ) : (
              // No delta to show, so the hint takes the slot. Clamped: on a
              // phone these tiles sit two across, and four lines of 11px prose
              // made the explanation taller than the figure it explains.
              <span className="line-clamp-2 text-[11px] font-semibold leading-snug text-slate-500">
                {hint}
              </span>
            )}
          </span>
        )}
        {delta !== undefined && hint && (
          <span className="mt-1 hidden text-[11px] leading-snug text-slate-400 sm:block">
            {hint}
          </span>
        )}
      </span>
    </>
  );

  const shell =
    `portal-enter group/kpi flex items-start gap-2.5 rounded-2xl border-t-[3px] bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_12px_32px_-24px_rgba(15,23,42,0.35)] ring-1 ring-slate-200/80 transition duration-200 sm:gap-3.5 sm:p-4 ${skin.bar}`;

  return href ? (
    <Link
      href={href}
      data-tour={tour}
      className={`${shell} hover:-translate-y-0.5 hover:ring-slate-300 hover:shadow-[0_1px_2px_rgba(15,23,42,0.05),0_18px_40px_-24px_rgba(15,23,42,0.5)]`}
    >
      {body}
    </Link>
  ) : (
    <div data-tour={tour} className={shell}>
      {body}
    </div>
  );
}

/* ------------------------------ Chart panel ------------------------------ */

/**
 * A titled panel with a filled header strip, as every reference deck uses.
 *
 * `sub` sits under the title and says, in one line, what the chart is counting
 * and over what window. Charts on this page are not allowed to leave that
 * implicit — "last 90 days" written on the panel is what stops a doctor
 * reading a quarter's figures as this month's.
 */
export function ChartPanel({
  title,
  sub,
  icon,
  tone = "brand",
  action,
  note,
  className = "",
  index = 0,
  padded = true,
  children,
}: {
  title: string;
  sub?: string;
  icon: string;
  tone?: Tone;
  action?: React.ReactNode;
  /** The finding under the chart. One sentence, plain words. */
  note?: React.ReactNode;
  className?: string;
  index?: number;
  padded?: boolean;
  children: React.ReactNode;
}) {
  const skin = TONES[tone];

  return (
    <section
      // A 3px coloured cap rather than only a hairline ring. On a pale
      // canvas a 1px slate edge is the difference between "a card" and
      // "a region of the page", and every panel reading identically is
      // most of what made this screen feel flat.
      className={`portal-enter group/panel flex flex-col overflow-hidden rounded-2xl border-t-[3px] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05),0_12px_32px_-22px_rgba(15,23,42,0.28)] ring-1 ring-slate-200/80 transition duration-200 hover:shadow-[0_1px_2px_rgba(15,23,42,0.05),0_20px_46px_-24px_rgba(15,23,42,0.42)] hover:ring-slate-300 ${skin.bar} ${className}`}
      // Staggered so a screenful arrives rather than appearing. Capped: past
      // about eight the last panel is visibly late and stops reading as polish.
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
    >
      <div
        className={`flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-gradient-to-r to-white px-3.5 py-2.5 sm:px-5 sm:py-3 ${skin.strip}`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white shadow-sm transition duration-200 group-hover/panel:scale-105 sm:h-9 sm:w-9 ${skin.tile}`}
          >
            <Glyph name={icon} size={16} />
          </span>
          <div className="min-w-0">
            <h3 className="truncate font-display text-[15px] font-bold tracking-[-0.015em] text-slate-900">
              {title}
            </h3>
            {sub && (
              <p className="truncate text-xs font-medium text-slate-500">{sub}</p>
            )}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>

      <div className={`flex min-w-0 flex-1 flex-col ${padded ? "p-3 sm:p-5" : ""}`}>
        {children}
      </div>

      {note && (
        <div className="border-t border-slate-100 bg-slate-50/70 px-3.5 py-2.5 text-xs leading-relaxed text-slate-600 sm:px-5 sm:py-3">
          {note}
        </div>
      )}
    </section>
  );
}

/* ------------------------------ Summary tile ----------------------------- */

/** A small closing figure, as the reference decks put under a section. */
export function Summary({
  label,
  value,
  hint,
  tone = "slate",
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
  icon?: string;
}) {
  const skin = TONES[tone];
  return (
    <div className="portal-enter flex items-center gap-2.5 rounded-2xl bg-white px-3 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.05)] ring-1 ring-slate-200/80">
      {icon && (
        <span
          aria-hidden
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${skin.soft} ${skin.text}`}
        >
          <Glyph name={icon} size={17} />
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">
          {label}
        </p>
        <p className="font-display text-lg font-bold leading-tight tabular-nums text-slate-900">
          {value}
        </p>
        {hint && <p className="truncate text-[11px] text-slate-500">{hint}</p>}
      </div>
    </div>
  );
}

/* ------------------------------ Section head ----------------------------- */

/** Breaks the page into the four questions it answers. */
export function SectionHead({
  title,
  sub,
  action,
  /**
   * An anchor for the guided tour. Inert everywhere else — nothing styles or
   * reads it but DemoTour, which uses it to point at the real section rather
   * than at a CSS selector that would break the next time this file is
   * touched.
   */
  "data-tour": tour,
}: {
  title: string;
  sub?: string;
  action?: React.ReactNode;
  "data-tour"?: string;
}) {
  return (
    <div
      data-tour={tour}
      className="mb-3.5 mt-1 flex flex-wrap items-end justify-between gap-3"
    >
      <div className="min-w-0">
        <h2 className="font-display text-xl font-extrabold tracking-[-0.03em] text-slate-900 sm:text-2xl">
          {title}
        </h2>
        {sub && <p className="mt-1 text-sm leading-relaxed text-slate-500">{sub}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ------------------------------ Money card ------------------------------- */

/**
 * One state the period's money can be in, with the sentence that explains it.
 *
 * The screen this replaced showed these four as bare pills — "Completed",
 * "Still to come", "Awaiting outcome", "Lost" — and the client's note was that
 * a doctor could not tell what any of them meant. The explanation is not a
 * tooltip here: it is printed, because the reader who needs it is exactly the
 * reader who will not hover to find it.
 *
 * They sit in a row of their own rather than stacked down the side of the
 * donut. Four explained rows made that panel 949px tall, which stretched the
 * chart beside it to match and left 600px of nothing under a 260px chart —
 * the single biggest patch of dead space on the page.
 */
export function MoneyCard({
  dot,
  label,
  amount,
  share,
  body,
  action,
}: {
  dot: string;
  label: string;
  amount: string;
  /** 0–100. Omitted for figures that are not part of the total. */
  share?: number;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="portal-enter flex flex-col rounded-2xl bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_12px_32px_-24px_rgba(15,23,42,0.35)] ring-1 ring-slate-200/80 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} />
          <span className="truncate text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500 sm:text-[11px]">
            {label}
          </span>
        </span>
        {share !== undefined && (
          <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-slate-500">
            {share}%
          </span>
        )}
      </div>

      <p className="mt-1.5 font-display text-[20px] font-extrabold leading-none tracking-[-0.02em] tabular-nums text-slate-900 sm:text-2xl">
        {amount}
      </p>

      {share !== undefined && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full ${dot}`}
            style={{ width: `${Math.max(share, 1.5)}%` }}
          />
        </div>
      )}

      <p className="mt-2 flex-1 text-[11px] leading-relaxed text-slate-500 sm:text-xs">
        {body}
      </p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/* -------------------------------- Rate row ------------------------------- */

/**
 * A rate, written as a sentence rather than drawn as a dial.
 *
 * These were four radial gauges. A gauge shows a proportion of a whole, and
 * "8% no-shows" has no whole a reader can picture — the arc was decoration
 * around a number, and below its sample threshold it drew an empty dial and a
 * dash, which reads as broken rather than as absent. A bar plus "about 8 in
 * every 100 visits" says the same thing in words a doctor already uses.
 */
export function RateRow({
  label,
  value,
  sampleSize,
  minSample = 5,
  sentence,
  tone = "brand",
  goodWhenUp = true,
}: {
  label: string;
  /** 0–1. */
  value: number;
  sampleSize: number;
  minSample?: number;
  /** Takes the rounded percentage and returns the plain-English line. */
  sentence: (pct: number) => string;
  tone?: Tone;
  goodWhenUp?: boolean;
}) {
  const enough = sampleSize >= minSample;
  const pct = Math.round(value * 100);
  const skin = TONES[tone];

  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-bold text-slate-900">{label}</span>
        <span
          className={`font-display text-lg font-bold tabular-nums ${
            enough
              ? goodWhenUp
                ? "text-slate-900"
                : pct >= 15
                  ? "text-rose-600"
                  : "text-slate-900"
              : "text-slate-300"
          }`}
        >
          {enough ? `${pct}%` : "—"}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white ring-1 ring-inset ring-slate-200">
        <div
          className={`h-full rounded-full ${enough ? skin.dot : "bg-slate-200"}`}
          style={{ width: `${enough ? Math.min(Math.max(pct, 1.5), 100) : 0}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
        {enough
          ? sentence(pct)
          : `Not enough visits yet to work this out — it needs ${minSample}, and there ${
              sampleSize === 1 ? "is 1" : `are ${sampleSize}`
            }.`}
      </p>
    </div>
  );
}

/* --------------------------------- Glyphs -------------------------------- */

/** Hand-rolled, stroke-based. The portal does not pull in an icon package. */
export function Glyph({ name, size = 18 }: { name: string; size?: number }) {
  const d = PATHS[name] ?? PATHS.chart;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {d.map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
}

const PATHS: Record<string, string[]> = {
  rupee: ["M7 4h10M7 9h10M17 4c0 3-2.5 5-6 5h-1l8 10", "M7 9h3"],
  calendar: [
    "M7 3v3m10-3v3M4 9h16",
    "M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z",
  ],
  users: [
    "M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1",
    "M12 7.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z",
    "M21 19v-1a4 4 0 0 0-3-3.87M16 4.6a3 3 0 0 1 0 5.8",
  ],
  repeat: ["M3 11V9a4 4 0 0 1 4-4h13m0 0-3-3m3 3-3 3", "M21 13v2a4 4 0 0 1-4 4H4m0 0 3 3m-3-3 3-3"],
  seat: [
    "M6 20v-3m12 3v-3",
    "M5 17h14a1 1 0 0 0 1-1v-3a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3a1 1 0 0 0 1 1z",
    "M7 11V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v5",
  ],
  chart: ["M4 20V10m5 10V4m5 16v-7m5 7V8"],
  trend: ["M3 16.5 9 10l4 4 8-8", "M15 6h6v6"],
  pulse: ["M3 12h4l2.5-7 4 14L16 12h5"],
  clock: ["M12 7v5l3 2", "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"],
  inbox: [
    "M4 13h4l1.5 3h5L16 13h4",
    "M6 4h12l2 9v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6z",
  ],
  clinic: ["M4 21V9l8-5 8 5v12", "M9 21v-6h6v6", "M12 7.5v3M10.5 9h3"],
  star: ["M12 3l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 18.3 5.9 21.6l1.4-6.8L2.2 10.1l6.9-.8z"],
  user: ["M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2", "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z"],
  link: [
    "M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7",
    "M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7L12.2 19",
  ],
  alert: ["M12 9v4m0 4h.01", "M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"],
  check: ["M20 6 9 17l-5-5"],
  wallet: [
    "M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
    "M16 12h5v3h-5a1.5 1.5 0 0 1 0-3z",
  ],
};
