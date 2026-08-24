/**
 * The swatch each clinic gets on the calendar.
 *
 * Every class is written out in full rather than composed — `bg-${key}-100`
 * would compile to nothing, because Tailwind scans source text and never sees
 * the interpolated result. That failure is silent: the colour just goes
 * missing. Same reason src/lib and src/data are in the content globs.
 *
 * Eight distinguishable hues. A doctor practising at more than eight locations
 * wraps around, which is a nicer failure than running out.
 *
 * ── Why the fills are -100 and not -50 ───────────────────────────────────
 * They were -50 on a white grid, which is about four percent of a hue: enough
 * to tell two blocks apart if you compare them deliberately, not enough to
 * read a day at a glance, which is the entire job. The step to -100 with a
 * -600 edge keeps every one of them well clear of WCAG AA for the -900 text
 * they carry while making the clinic legible from across a desk.
 *
 * A cancelled booking deliberately does NOT follow: it keeps its place so the
 * doctor can see the slot came back, and stays pale so it stops competing.
 */

export interface ClinicSwatch {
  /** The block on the calendar. */
  block: string;
  /** The dot in the filter row and the legend. */
  dot: string;
  /** A tinted pill for the clinic name. */
  pill: string;
  /** The left edge that carries the colour in dense views. */
  edge: string;
  /** A solid bar of the hue, for a legend or a dense strip. */
  strip: string;
  /** Focus and selection ring, matched to the clinic. */
  ring: string;
}

const SWATCHES: Record<string, ClinicSwatch> = {
  blue: {
    block: "bg-blue-100 border-blue-300 text-blue-900 hover:bg-blue-200",
    dot: "bg-blue-500",
    pill: "bg-blue-100 text-blue-800",
    edge: "border-l-blue-600",
    strip: "bg-blue-500",
    ring: "ring-blue-400",
  },
  teal: {
    block: "bg-teal-100 border-teal-300 text-teal-900 hover:bg-teal-200",
    dot: "bg-teal-500",
    pill: "bg-teal-100 text-teal-800",
    edge: "border-l-teal-600",
    strip: "bg-teal-500",
    ring: "ring-teal-400",
  },
  violet: {
    block: "bg-violet-100 border-violet-300 text-violet-900 hover:bg-violet-200",
    dot: "bg-violet-500",
    pill: "bg-violet-100 text-violet-800",
    edge: "border-l-violet-600",
    strip: "bg-violet-500",
    ring: "ring-violet-400",
  },
  emerald: {
    block: "bg-emerald-100 border-emerald-300 text-emerald-900 hover:bg-emerald-200",
    dot: "bg-emerald-500",
    pill: "bg-emerald-100 text-emerald-800",
    edge: "border-l-emerald-600",
    strip: "bg-emerald-500",
    ring: "ring-emerald-400",
  },
  amber: {
    block: "bg-amber-100 border-amber-300 text-amber-900 hover:bg-amber-200",
    dot: "bg-amber-500",
    pill: "bg-amber-100 text-amber-800",
    edge: "border-l-amber-600",
    strip: "bg-amber-500",
    ring: "ring-amber-400",
  },
  rose: {
    block: "bg-rose-100 border-rose-300 text-rose-900 hover:bg-rose-200",
    dot: "bg-rose-500",
    pill: "bg-rose-100 text-rose-800",
    edge: "border-l-rose-600",
    strip: "bg-rose-500",
    ring: "ring-rose-400",
  },
  indigo: {
    block: "bg-indigo-100 border-indigo-300 text-indigo-900 hover:bg-indigo-200",
    dot: "bg-indigo-500",
    pill: "bg-indigo-100 text-indigo-800",
    edge: "border-l-indigo-600",
    strip: "bg-indigo-500",
    ring: "ring-indigo-400",
  },
  orange: {
    block: "bg-orange-100 border-orange-300 text-orange-900 hover:bg-orange-200",
    dot: "bg-orange-500",
    pill: "bg-orange-100 text-orange-800",
    edge: "border-l-orange-600",
    strip: "bg-orange-500",
    ring: "ring-orange-400",
  },
  sky: {
    block: "bg-sky-100 border-sky-300 text-sky-900 hover:bg-sky-200",
    dot: "bg-sky-500",
    pill: "bg-sky-100 text-sky-800",
    edge: "border-l-sky-600",
    strip: "bg-sky-500",
    ring: "ring-sky-400",
  },
  /** Bookings with no clinic — pre-multi-clinic rows. Deliberately colourless. */
  slate: {
    block: "bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200",
    dot: "bg-slate-400",
    pill: "bg-slate-100 text-slate-700",
    edge: "border-l-slate-500",
    strip: "bg-slate-400",
    ring: "ring-slate-400",
  },
};

export const CLINIC_COLOR_KEYS = [
  "blue",
  "teal",
  "violet",
  "emerald",
  "amber",
  "rose",
  "indigo",
  "orange",
  "sky",
] as const;

export function swatchFor(colorKey: string | null | undefined): ClinicSwatch {
  return SWATCHES[colorKey ?? "slate"] ?? SWATCHES.slate;
}

/**
 * The same hue as a hex literal, for charts.
 *
 * Recharts fills are SVG attributes, not classes — it cannot take `bg-teal-500`
 * and Tailwind cannot resolve a class it never sees in source. Keeping the two
 * side by side means a clinic is the same colour in its calendar block and in
 * the dashboard bar for it, which is the entire point of giving it one.
 */
const HEXES: Record<string, string> = {
  blue: "#3b82f6",
  teal: "#0fa08e",
  violet: "#8b5cf6",
  emerald: "#10b981",
  amber: "#f59e0b",
  rose: "#f43f5e",
  indigo: "#6366f1",
  orange: "#f97316",
  sky: "#0ea5e9",
  slate: "#94a3b8",
};

export function hexFor(colorKey: string | null | undefined): string {
  return HEXES[colorKey ?? "slate"] ?? HEXES.slate;
}

/**
 * A cancelled booking keeps its place on the calendar — the doctor needs to
 * see that the slot came back — but stops competing for attention.
 */
export const CANCELLED_SWATCH: ClinicSwatch = {
  block: "bg-slate-50 border-slate-200 text-slate-400 line-through hover:bg-slate-100",
  dot: "bg-slate-300",
  pill: "bg-slate-100 text-slate-500",
  edge: "border-l-slate-300",
  strip: "bg-slate-300",
  ring: "ring-slate-300",
};
