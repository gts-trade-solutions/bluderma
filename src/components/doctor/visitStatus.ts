/**
 * How a booking's STATE reads on the calendar, as opposed to its clinic.
 *
 * Colour on this calendar already means one thing: which location. That is a
 * good use of it and it must not be taken away, so state has to be carried by
 * something else entirely.
 *
 * It was carried by a 1.5px amber dot. On a week grid that is invisible, and
 * "which of these is still waiting on me" is the question a doctor opens the
 * calendar to answer. So state now shows as a ring, a label and a texture,
 * none of which competes with the hue underneath.
 *
 * Every class is a full literal. Tailwind scans source text, so a composed
 * name compiles to nothing and the treatment silently disappears.
 */

export type VisitState =
  | "awaiting"
  | "cancelled"
  | "completed"
  | "no-show"
  | "confirmed";

export interface StateStyle {
  /** Applied to the block on top of the clinic swatch. */
  block: string;
  /** Two or three characters in the corner. Read before any colour is. */
  tag: string | null;
  /** For the legend. */
  label: string;
  /** The legend's own marker. */
  chip: string;
}

export const STATE_STYLES: Record<VisitState, StateStyle> = {
  awaiting: {
    // A ring rather than a fill: it sits OUTSIDE the block, so the clinic
    // colour underneath survives intact and both facts are readable at once.
    block: "ring-2 ring-amber-500 ring-offset-1",
    tag: "!",
    label: "Waiting on you",
    chip: "bg-amber-100 text-amber-800 ring-1 ring-amber-400",
  },
  cancelled: {
    block: "opacity-60",
    tag: null,
    label: "Cancelled",
    chip: "bg-slate-100 text-slate-500 line-through",
  },
  completed: {
    block: "",
    tag: "✓",
    label: "Seen",
    chip: "bg-teal-100 text-teal-800",
  },
  "no-show": {
    block: "ring-2 ring-rose-400 ring-offset-1",
    tag: "—",
    label: "Did not attend",
    chip: "bg-rose-100 text-rose-700 ring-1 ring-rose-300",
  },
  confirmed: {
    block: "",
    tag: null,
    label: "Confirmed",
    chip: "bg-slate-100 text-slate-600",
  },
};

/**
 * Which state a row is in.
 *
 * Order matters. A cancelled booking that was also awaiting approval is
 * cancelled: the slot is back and nothing is owed on it, so surfacing it as
 * something needing attention would send a doctor to a dead booking.
 */
export function stateOf(a: {
  status: string;
  approvalState?: string | null;
}): VisitState {
  if (a.status === "CANCELLED") return "cancelled";
  if (a.status === "NO_SHOW") return "no-show";
  if (a.status === "COMPLETED") return "completed";
  if (a.approvalState === "AWAITING_DOCTOR") return "awaiting";
  return "confirmed";
}

/** The states worth explaining in a legend; "confirmed" is the default. */
export const LEGEND_STATES: VisitState[] = [
  "awaiting",
  "completed",
  "no-show",
  "cancelled",
];
