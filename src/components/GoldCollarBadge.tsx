/**
 * The Gold Collar mark.
 *
 * ── Named for the colour, and coloured to match ─────────────────────────
 * It was White Collar, set in the same pale amber the portal uses for
 * warnings and pending states — so a paying member's badge read as a caution
 * flag, and on a row that also carried an amber "awaiting you" pill the two
 * were indistinguishable at a glance. The tier is Gold Collar now, and the
 * badge is actual gold rather than a word about a colour it was not.
 *
 * Gold is reserved for this one badge across the whole app, which is what
 * makes it work as a signal. It is a metal rather than a hue — a flat #d4af37
 * reads as mustard — so it is a three-stop gradient with a darker rule under
 * it and near-black text, which is how gold foil actually behaves and the
 * only way it survives on both the light portal canvas and a dark client
 * surface.
 *
 * One component rather than a class string, because it appears on the day
 * list, the request queue, the calendar, the patient's own profile and the
 * booking summary, and five copies of a gradient drift within a release.
 */

const GOLD =
  "bg-[linear-gradient(135deg,#f6e27a_0%,#e6c34a_38%,#b8860b_100%)] text-[#2b1d02] " +
  "ring-1 ring-inset ring-[#a97c1f]/60 shadow-[0_1px_0_rgba(255,255,255,0.45)_inset,0_1px_3px_-1px_rgba(120,80,10,0.5)]";

export default function GoldCollarBadge({
  /** "full" spells it out; "short" is the two-letter chip for a calendar cell. */
  size = "full",
  className = "",
}: {
  size?: "full" | "short";
  className?: string;
}) {
  if (size === "short") {
    return (
      <span
        title="Gold Collar member"
        className={`grid h-4 min-w-[1.05rem] shrink-0 place-items-center rounded px-1 text-[9px] font-black leading-none tracking-wider ${GOLD} ${className}`}
      >
        GC
        <span className="sr-only">Gold Collar member</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.06em] ${GOLD} ${className}`}
    >
      {/* A small mark so it is recognisable before it is read. */}
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden
        className="h-[0.85em] w-[0.85em] shrink-0 opacity-80"
      >
        <path d="M4 18h16v2H4zM3 7l4.5 3L12 4l4.5 6L21 7l-1.6 9H4.6z" />
      </svg>
      Gold Collar
    </span>
  );
}
