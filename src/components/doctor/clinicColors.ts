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
}

const SWATCHES: Record<string, ClinicSwatch> = {
  blue: {
    block: "bg-blue-50 border-blue-200 text-blue-900 hover:bg-blue-100",
    dot: "bg-blue-500",
    pill: "bg-blue-100 text-blue-800",
    edge: "border-l-blue-500",
  },
  teal: {
    block: "bg-teal-50 border-teal-200 text-teal-900 hover:bg-teal-100",
    dot: "bg-teal-500",
    pill: "bg-teal-100 text-teal-800",
    edge: "border-l-teal-500",
  },
  violet: {
    block: "bg-violet-50 border-violet-200 text-violet-900 hover:bg-violet-100",
    dot: "bg-violet-500",
    pill: "bg-violet-100 text-violet-800",
    edge: "border-l-violet-500",
  },
  emerald: {
    block: "bg-emerald-50 border-emerald-200 text-emerald-900 hover:bg-emerald-100",
    dot: "bg-emerald-500",
    pill: "bg-emerald-100 text-emerald-800",
    edge: "border-l-emerald-500",
  },
  amber: {
    block: "bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100",
    dot: "bg-amber-500",
    pill: "bg-amber-100 text-amber-800",
    edge: "border-l-amber-500",
  },
  rose: {
    block: "bg-rose-50 border-rose-200 text-rose-900 hover:bg-rose-100",
    dot: "bg-rose-500",
    pill: "bg-rose-100 text-rose-800",
    edge: "border-l-rose-500",
  },
  indigo: {
    block: "bg-indigo-50 border-indigo-200 text-indigo-900 hover:bg-indigo-100",
    dot: "bg-indigo-500",
    pill: "bg-indigo-100 text-indigo-800",
    edge: "border-l-indigo-500",
  },
  orange: {
    block: "bg-orange-50 border-orange-200 text-orange-900 hover:bg-orange-100",
    dot: "bg-orange-500",
    pill: "bg-orange-100 text-orange-800",
    edge: "border-l-orange-500",
  },
  sky: {
    block: "bg-sky-50 border-sky-200 text-sky-900 hover:bg-sky-100",
    dot: "bg-sky-500",
    pill: "bg-sky-100 text-sky-800",
    edge: "border-l-sky-500",
  },
  /** Bookings with no clinic — pre-multi-clinic rows. Deliberately colourless. */
  slate: {
    block: "bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100",
    dot: "bg-slate-400",
    pill: "bg-slate-100 text-slate-700",
    edge: "border-l-slate-400",
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
 * A cancelled booking keeps its place on the calendar — the doctor needs to
 * see that the slot came back — but stops competing for attention.
 */
export const CANCELLED_SWATCH: ClinicSwatch = {
  block: "bg-slate-50 border-slate-200 text-slate-400 line-through hover:bg-slate-100",
  dot: "bg-slate-300",
  pill: "bg-slate-100 text-slate-500",
  edge: "border-l-slate-300",
};
