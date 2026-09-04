/**
 * The swatch each clinic gets on the calendar.
 *
 * Every class is written out in full rather than composed — `bg-${key}-100`
 * would compile to nothing, because Tailwind scans source text and never sees
 * the interpolated result. That failure is silent: the colour just goes
 * missing. Same reason src/lib and src/data are in the content globs.
 *
 * ── Nine hues out of four ────────────────────────────────────────────────
 * The portal now runs on the five colours of the brand mark, and a doctor can
 * practise at more than five locations. So each of the four brights lends a
 * light and a dark step — azure and deep azure, mint and deep mint, coral and
 * deep coral, gold and bronze — with graphite closing the set. Nine hues that
 * are all obviously from the same family, and all obviously not each other.
 *
 * The KEYS did not change, and must not: they are stored on Clinic.colorKey
 * in the database, so renaming "violet" to "navy" would leave every existing
 * clinic pointing at a swatch that no longer exists.
 *
 * ── Solid in a time grid, tinted in a month ──────────────────────────────
 * `block` is a solid fill, because a day column is read from across a desk and
 * a 4%-tint block cannot be told from the one beside it. The step chosen per
 * hue is the one whose type passes AA: azure and coral go a step darker to
 * carry white, mint and gold stay light and carry black. Picking -500 for all
 * of them looked consistent in a palette and left white on #58BE9F at 2.1:1.
 * `chip` is the tinted version for the month grid, where six of them stack in
 * a 116px cell and six solid bars would read as a colour chart rather than as
 * a day. Both were checked against the type they carry.
 *
 * A cancelled booking deliberately follows neither: it keeps its place so the
 * doctor can see the slot came back, and stays pale so it stops competing.
 */

export interface ClinicSwatch {
  /** The block in the day and week grids: solid, white type. */
  block: string;
  /** The chip in the month grid and the agenda: tinted, dark type. */
  chip: string;
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
    block: "bg-azure-600 border-azure-700 text-white hover:bg-azure-700",
    chip: "bg-azure-50 text-azure-900 hover:bg-azure-100",
    dot: "bg-azure-500",
    pill: "bg-azure-50 text-azure-800",
    edge: "border-l-azure-600",
    strip: "bg-azure-500",
    ring: "ring-azure-400",
  },
  teal: {
    block: "bg-mint-400 border-mint-600 text-graphite-900 hover:bg-mint-500",
    chip: "bg-mint-50 text-mint-900 hover:bg-mint-100",
    dot: "bg-mint-500",
    pill: "bg-mint-50 text-mint-800",
    edge: "border-l-mint-600",
    strip: "bg-mint-500",
    ring: "ring-mint-400",
  },
  /** Deep azure. Was violet; the key stays for the rows already using it. */
  violet: {
    block: "bg-azure-800 border-azure-900 text-white hover:bg-azure-900",
    chip: "bg-azure-100 text-azure-900 hover:bg-azure-200",
    dot: "bg-azure-800",
    pill: "bg-azure-100 text-azure-900",
    edge: "border-l-azure-900",
    strip: "bg-azure-800",
    ring: "ring-azure-700",
  },
  /** Deep mint. */
  emerald: {
    block: "bg-mint-700 border-mint-800 text-white hover:bg-mint-800",
    chip: "bg-mint-100 text-mint-900 hover:bg-mint-200",
    dot: "bg-mint-700",
    pill: "bg-mint-100 text-mint-900",
    edge: "border-l-mint-800",
    strip: "bg-mint-700",
    ring: "ring-mint-600",
  },
  /** Gold. The one block that carries black type — white on it is 1.6:1. */
  amber: {
    block: "bg-gold-500 border-gold-600 text-graphite-900 hover:bg-gold-400",
    chip: "bg-gold-50 text-gold-900 hover:bg-gold-100",
    dot: "bg-gold-500",
    pill: "bg-gold-100 text-gold-900",
    edge: "border-l-gold-600",
    strip: "bg-gold-500",
    ring: "ring-gold-500",
  },
  rose: {
    block: "bg-coral-600 border-coral-700 text-white hover:bg-coral-700",
    chip: "bg-coral-50 text-coral-900 hover:bg-coral-100",
    dot: "bg-coral-500",
    pill: "bg-coral-50 text-coral-800",
    edge: "border-l-coral-600",
    strip: "bg-coral-500",
    ring: "ring-coral-400",
  },
  /** Charcoal. */
  indigo: {
    block: "bg-graphite-700 border-graphite-800 text-white hover:bg-graphite-800",
    chip: "bg-graphite-100 text-graphite-900 hover:bg-graphite-200",
    dot: "bg-graphite-700",
    pill: "bg-graphite-100 text-graphite-800",
    edge: "border-l-graphite-800",
    strip: "bg-graphite-700",
    ring: "ring-graphite-600",
  },
  /** Bronze. */
  orange: {
    block: "bg-gold-800 border-gold-900 text-white hover:bg-gold-900",
    chip: "bg-gold-100 text-gold-900 hover:bg-gold-200",
    dot: "bg-gold-700",
    pill: "bg-gold-100 text-gold-900",
    edge: "border-l-gold-800",
    strip: "bg-gold-700",
    ring: "ring-gold-600",
  },
  /** Deep coral. */
  sky: {
    block: "bg-coral-800 border-coral-900 text-white hover:bg-coral-900",
    chip: "bg-coral-100 text-coral-900 hover:bg-coral-200",
    dot: "bg-coral-700",
    pill: "bg-coral-100 text-coral-900",
    edge: "border-l-coral-800",
    strip: "bg-coral-700",
    ring: "ring-coral-600",
  },
  /** Bookings with no clinic — pre-multi-clinic rows. Deliberately colourless. */
  slate: {
    block: "bg-graphite-500 border-graphite-600 text-white hover:bg-graphite-600",
    chip: "bg-graphite-100 text-graphite-800 hover:bg-graphite-200",
    dot: "bg-graphite-400",
    pill: "bg-graphite-100 text-graphite-700",
    edge: "border-l-graphite-500",
    strip: "bg-graphite-400",
    ring: "ring-graphite-400",
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
 * Recharts fills are SVG attributes, not classes — it cannot take `bg-mint-500`
 * and Tailwind cannot resolve a class it never sees in source. Keeping the two
 * side by side means a clinic is the same colour in its calendar block and in
 * the dashboard bar for it, which is the entire point of giving it one.
 */
const HEXES: Record<string, string> = {
  blue: "#3e8ccb",
  teal: "#58be9f",
  violet: "#244d71",
  emerald: "#33826d",
  amber: "#ffc80b",
  rose: "#f15256",
  indigo: "#454545",
  orange: "#b58100",
  sky: "#b9262c",
  slate: "#9a9a9a",
};

export function hexFor(colorKey: string | null | undefined): string {
  return HEXES[colorKey ?? "slate"] ?? HEXES.slate;
}

/**
 * A cancelled booking keeps its place on the calendar — the doctor needs to
 * see that the slot came back — but stops competing for attention.
 */
export const CANCELLED_SWATCH: ClinicSwatch = {
  block:
    "bg-graphite-50 border-graphite-200 text-graphite-500 line-through hover:bg-graphite-100",
  chip: "bg-graphite-50 text-graphite-500 line-through hover:bg-graphite-100",
  dot: "bg-graphite-300",
  pill: "bg-graphite-100 text-graphite-500",
  edge: "border-l-graphite-300",
  strip: "bg-graphite-300",
  ring: "ring-graphite-300",
};
