import Link from "next/link";

/**
 * The doctor portal's own building blocks.
 *
 * These are deliberately separate from admin/ui.tsx rather than a variant of
 * it. The two surfaces have different jobs and will keep diverging; sharing
 * one set means every change to either has to be checked against both.
 *
 * ── The 2026 rebuild, second pass ────────────────────────────────────────
 * The client supplied a reference product and a five-colour mark, and asked
 * for the portal to be rebuilt in that language without losing a single
 * feature. Both are load-bearing, so both are written down here.
 *
 * THE COLOURS, sampled from the mark rather than guessed:
 *
 *   azure    #3E8CCB  what the reader can act on — links, primary figures
 *   mint     #58BE9F  what went well — completed, collected, growth
 *   coral    #F15256  what went wrong or is about to — cancelled, overdue
 *   gold     #FFC80B  the call to action, and time not yet sold
 *   graphite #2F2F2F  every word on the page
 *
 * One colour, one meaning, everywhere in the portal. A doctor should be able
 * to learn what mint means once, on the dashboard, and still be right about
 * it on the calendar three screens later.
 *
 * THE FORM, taken from the reference:
 *
 *   FLAT      One shadow, near-flat, and a real hairline border. The old kit
 *             stacked 20-40px blurs on every panel; the reference gets its
 *             separation from a 1px edge and reads sharper for it.
 *   SQUARER   10px corners, not 16px. Pills stay fully round.
 *   FILLED    A panel's identity comes from a solid colour block — a filled
 *             icon tile, a tinted header — not from a gradient wash.
 *   MARKED    Headings carry a hand-drawn gold stroke under the word that
 *             matters. See `.mark-swoosh` in globals.css.
 *
 * Motion is unchanged and stays behind `prefers-reduced-motion`: vestibular
 * disorders are a real condition and this is a screen people use all day.
 */

/* --------------------------- Shared surfaces --------------------------- */

/**
 * The card, as one string.
 *
 * Every surface in the portal is this: white, one hairline, one shallow
 * shadow, 10px corners. Exported because half the portal's screens build
 * their own panels inline and they must not drift from the ones built here.
 */
export const portalCard =
  "rounded-[10px] border border-graphite-200 bg-white shadow-flat";

/** The same card, but responding to a cursor. Only for things that DO something. */
export const portalCardHover =
  "transition duration-150 hover:-translate-y-0.5 hover:border-graphite-300 hover:shadow-flat-lg";

/* ------------------------------ Page head ------------------------------ */

/**
 * The heading every portal screen opens with.
 *
 * `mark` is the reference's signature and the reason this takes it as a prop
 * rather than leaving call sites to wrap a span: the stroke goes under ONE
 * word — the one naming what the screen is about — and a prop is the only way
 * to keep that consistent across fourteen pages.
 */
export function PageHead({
  eyebrow,
  title,
  mark,
  sub,
  action,
}: {
  eyebrow?: string;
  /** A node, not a string, so a heading can carry a mark — see RxMark. */
  title: React.ReactNode;
  /**
   * A word inside `title` to draw the gold stroke under. Ignored unless
   * `title` is a plain string, and ignored if the word is not in it — a
   * heading that silently loses its own text would be a worse bug than a
   * missing flourish.
   */
  mark?: string;
  sub?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-graphite-500">
            <span aria-hidden className="h-[3px] w-7 rounded-full bg-gold-500" />
            {eyebrow}
          </p>
        )}
        <h1 className="mt-2 font-portal text-[26px] font-extrabold leading-tight tracking-[-0.03em] text-graphite-900 sm:text-[32px]">
          {typeof title === "string" && mark ? marked(title, mark) : title}
        </h1>
        {sub && (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-graphite-600">
            {sub}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

/** Splits a heading around `word` and puts the gold stroke under it. */
function marked(title: string, word: string): React.ReactNode {
  const at = title.toLowerCase().indexOf(word.toLowerCase());
  if (at === -1) return title;
  return (
    <>
      {title.slice(0, at)}
      <span className="mark-swoosh">{title.slice(at, at + word.length)}</span>
      {title.slice(at + word.length)}
    </>
  );
}

/* -------------------------------- Surface ------------------------------ */

/**
 * The hues a panel may carry.
 *
 * The KEYS are the six the portal has always used, so no call site had to
 * change; the VALUES are the five brand colours. `violet` became graphite —
 * a filled charcoal tile, which the reference uses for its own emphasis
 * panels — and `slate` stays the quiet one.
 *
 * Full class strings; Tailwind sees no interpolation.
 */
const ACCENTS = {
  brand: {
    solid: "bg-azure-500 text-white",
    tint: "bg-azure-50",
    text: "text-azure-700",
    edge: "bg-azure-500",
  },
  teal: {
    solid: "bg-mint-500 text-white",
    tint: "bg-mint-50",
    text: "text-mint-700",
    edge: "bg-mint-500",
  },
  amber: {
    // Black on gold, never white: white on #FFC80B is 1.6:1 and unreadable.
    solid: "bg-gold-500 text-graphite-900",
    tint: "bg-gold-50",
    text: "text-gold-700",
    edge: "bg-gold-500",
  },
  violet: {
    solid: "bg-graphite-900 text-white",
    tint: "bg-graphite-100",
    text: "text-graphite-800",
    edge: "bg-graphite-900",
  },
  rose: {
    solid: "bg-coral-500 text-white",
    tint: "bg-coral-50",
    text: "text-coral-700",
    edge: "bg-coral-500",
  },
  slate: {
    solid: "bg-graphite-400 text-white",
    tint: "bg-graphite-100",
    text: "text-graphite-700",
    edge: "bg-graphite-400",
  },
} as const;

export type Accent = keyof typeof ACCENTS;

export function Panel({
  title,
  sub,
  note,
  action,
  accent,
  icon,
  padded = true,
  className = "",
  /** Position in its group, for the staggered entrance. */
  index = 0,
  children,
}: {
  title?: string;
  sub?: string;
  /**
   * What this panel is FOR, and when a practitioner would use it.
   *
   * Distinct from `sub`, which is a label. This is the sentence that answers
   * "why is this here": a heading like "Redeem a card" tells somebody what the
   * button does and nothing about why a doctor would ever press it.
   */
  note?: React.ReactNode;
  action?: React.ReactNode;
  /** A hue for the header glyph and the left edge. Omit for a quiet panel. */
  accent?: Accent;
  /** Glyph key. Only rendered when an accent is set, so the two travel together. */
  icon?: string;
  padded?: boolean;
  /** For grid spans at the call site. */
  className?: string;
  index?: number;
  children: React.ReactNode;
}) {
  const skin = accent ? ACCENTS[accent] : null;

  return (
    <section
      // Outlines the whole panel when a field inside it fails validation.
      // See lib/formValidation.ts.
      data-form-section
      className={`portal-enter group/panel relative overflow-hidden ${portalCard} transition duration-150 hover:shadow-flat-lg ${className}`}
      // Staggered so a screenful arrives rather than appearing. Capped: past
      // about eight the last panel is visibly late and it stops reading as
      // polish.
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      {(title || action) && (
        <div
          className={`flex flex-wrap items-center justify-between gap-3 border-b border-graphite-200 px-4 py-3 ${
            skin ? skin.tint : "bg-graphite-50"
          }`}
        >
          <div className="flex min-w-0 items-center gap-3">
            {skin && icon && (
              <span
                aria-hidden
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${skin.solid}`}
              >
                <GlyphIcon name={icon} />
              </span>
            )}
            <div className="min-w-0">
              {title && (
                <h2 className="font-portal text-[15px] font-bold tracking-[-0.01em] text-graphite-900">
                  {title}
                </h2>
              )}
              {sub && <p className="mt-0.5 text-xs text-graphite-600">{sub}</p>}
            </div>
          </div>
          {action}
        </div>
      )}
      {note && (
        <p className="border-b border-graphite-200 bg-white px-4 py-3 text-[13px] leading-relaxed text-graphite-600">
          {note}
        </p>
      )}
      <div className={padded ? "p-4 sm:p-5" : ""}>{children}</div>
    </section>
  );
}

/* --------------------------------- Stats ------------------------------- */

export function StatTile({
  label,
  value,
  hint,
  href,
  icon,
  accent = "brand",
  delta,
  index = 0,
  tone = "plain",
}: {
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
  icon?: string;
  accent?: Accent;
  /** Change on the previous period, as a fraction. Null when there is none. */
  delta?: number | null;
  index?: number;
  /** `attention` is for a number the doctor is meant to act on. */
  tone?: "plain" | "attention";
}) {
  const skin = ACCENTS[accent];

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        {/* Label first, small and set wide: the eye lands on the figure either
            way, and this way it already knows what it is looking at. */}
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-graphite-500">
          {label}
        </p>
        {icon && (
          <span
            aria-hidden
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${skin.solid}`}
          >
            <GlyphIcon name={icon} />
          </span>
        )}
      </div>

      <p
        className={`mt-2 font-portal text-[28px] font-extrabold leading-none tracking-[-0.03em] tabular-nums ${
          tone === "attention" ? "text-gold-700" : "text-graphite-900"
        }`}
      >
        {value}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        {/* Null is a real answer: a first month has nothing to compare to, and
            printing +100% would be inventing a trend. */}
        {delta !== null && delta !== undefined && (
          <span
            className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${
              delta >= 0
                ? "bg-mint-50 text-mint-700"
                : "bg-coral-50 text-coral-700"
            }`}
          >
            {delta >= 0 ? "▲" : "▼"}
            {Math.abs(Math.round(delta * 100))}%
          </span>
        )}
        {hint && <p className="text-xs leading-relaxed text-graphite-600">{hint}</p>}
      </div>

      {/* The accent as a rule along the foot rather than a wash behind the
          figure. A tinted card makes the number harder to read; a 3px block
          of colour tells four tiles apart from across the room and leaves the
          figure on white. */}
      <span
        aria-hidden
        className={`absolute inset-x-0 bottom-0 h-[3px] ${skin.edge}`}
      />
    </>
  );

  const shell = `portal-enter group/stat relative overflow-hidden p-4 ${portalCard}`;
  const style = { animationDelay: `${Math.min(index, 8) * 40}ms` };

  return href ? (
    <Link href={href} style={style} className={`${shell} block ${portalCardHover}`}>
      {body}
    </Link>
  ) : (
    <div style={style} className={shell}>
      {body}
    </div>
  );
}

/* -------------------------------- States ------------------------------- */

export function Empty({
  title,
  body,
  action,
  icon = "calendar",
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
  icon?: "calendar" | "inbox" | "clinic" | "user";
}) {
  return (
    <div className="rounded-[10px] border border-dashed border-graphite-300 bg-white px-6 py-14 text-center">
      <span
        aria-hidden
        className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-gold-100 text-gold-700"
      >
        <GlyphIcon name={icon} />
      </span>
      <h3 className="mt-4 font-portal text-base font-bold text-graphite-900">
        {title}
      </h3>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-graphite-600">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** A banner for something the doctor must act on, not merely read. */
export function Notice({
  tone = "info",
  title,
  children,
  action,
}: {
  tone?: "info" | "attention" | "warning";
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  // A 4px bar in the tone's own colour down the left edge, which is how the
  // reference marks a block that is speaking rather than merely sitting there.
  const skin = {
    info: "border-azure-200 bg-azure-50 text-azure-900 border-l-4 border-l-azure-500",
    attention: "border-gold-300 bg-gold-50 text-graphite-900 border-l-4 border-l-gold-500",
    warning: "border-coral-200 bg-coral-50 text-coral-900 border-l-4 border-l-coral-500",
  }[tone];

  return (
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[10px] border px-5 py-4 ${skin}`}
    >
      <div className="min-w-0 flex-1">
        <p className="font-bold">{title}</p>
        {children && <div className="mt-0.5 text-sm opacity-90">{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function Tag({
  tone = "slate",
  children,
}: {
  tone?: "slate" | "teal" | "amber" | "rose" | "brand" | "gold";
  children: React.ReactNode;
}) {
  const skin = {
    slate: "bg-graphite-100 text-graphite-700",
    teal: "bg-mint-50 text-mint-800 ring-1 ring-mint-200",
    amber: "bg-gold-100 text-gold-800 ring-1 ring-gold-300",
    rose: "bg-coral-50 text-coral-700 ring-1 ring-coral-200",
    brand: "bg-azure-50 text-azure-700 ring-1 ring-azure-200",
    // The reference's own tag: solid gold, black text, no ring.
    gold: "bg-gold-500 text-graphite-900",
  }[tone];
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${skin}`}>
      {children}
    </span>
  );
}

/* -------------------------------- Buttons ------------------------------ */

export const portalBtn =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-azure-400 focus-visible:ring-offset-2 active:scale-[0.98]";

/**
 * The primary action, in the reference's own form: a solid gold block with
 * black type.
 *
 * Gold rather than the brand blue, and that is the point of the reference —
 * the one warm colour on a cool page is unmissable, and the portal has
 * exactly one primary action per screen. Black on #FFC80B is 11:1; white on
 * it is 1.6:1, which is why `text-graphite-900` is not negotiable here.
 */
export const portalBtnPrimary = `${portalBtn} bg-gold-500 text-graphite-900 shadow-flat hover:bg-gold-400 hover:shadow-flat-lg`;

/** The second action: solid charcoal, white type. The reference's "Book a demo". */
export const portalBtnDark = `${portalBtn} bg-graphite-900 text-white hover:bg-graphite-800`;

export const portalBtnQuiet = `${portalBtn} border border-graphite-300 bg-white text-graphite-800 hover:border-graphite-400 hover:bg-graphite-50`;

/**
 * The circular arrow the reference puts inside its CTAs.
 *
 * Optional and inline, so a button can be `<Link className={portalBtnPrimary}>
 * Book a slot <BtnArrow /></Link>` and pick up the whole treatment.
 */
export function BtnArrow() {
  return (
    <span
      aria-hidden
      className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-graphite-900 text-white"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
        <path d="M5 12h13M13 6l6 6-6 6" />
      </svg>
    </span>
  );
}

/* -------------------------------- Glyphs ------------------------------- */

const PATHS: Record<string, string> = {
  chart: "M4 19h16M7 16V9m5 7V5m5 11v-5",
  lock: "M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z",
  today: "M4 7h16M4 12h16M4 17h10",
  calendar:
    "M7 3v3M17 3v3M4 9h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z",
  inbox:
    "M4 13h4l1.5 3h5L16 13h4M5 5h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z",
  clinic: "M4 20V9l8-5 8 5v11M9 20v-6h6v6M12 8v3M10.5 9.5h3",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM5 20a7 7 0 0 1 14 0",
  link: "M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1",
  star: "M12 3l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 18.3 5.9 21.6l1.4-6.8L2.2 10.1l6.9-.8z",
  clock: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
  // A rupee sign as strokes rather than a glyph, so it inherits colour and
  // weight like every other icon here instead of depending on a font.
  rupee: "M6 4h11M6 9h11M15 4c0 3.5-2.4 5-5.5 5H6l7.5 10",
  sheet:
    "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 12h6M9 16h4",
  pulse: "M3 12h4l2-6 3.5 12L16 9l1.5 3H21",
  // ℞ — the prescription mark, drawn as strokes for the same reason the
  // rupee sign is: a glyph would depend on a font having it and would not
  // take the stroke weight the rest of the rail is set in. An R whose leg
  // carries the crossed tail, which is what tells it apart from a plain R.
  rx: "M7 20V5h4a3.5 3.5 0 0 1 0 7H7M11 12l6 8M13 15l4-3",
};

/**
 * ℞, set as an inline mark for a heading.
 *
 * The character U+211E exists, and is not used: it is absent from most UI
 * font stacks and falls back to a serif face at a different weight, so the
 * heading it sits in visibly changes typeface. Drawn instead, at the same
 * stroke weight as the rail glyphs, sized to the text it accompanies.
 */
export function RxMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`inline-block h-[0.9em] w-[0.9em] shrink-0 align-[-0.08em] text-azure-600 ${className}`}
      role="img"
      aria-label="Prescription"
    >
      <path d="M7 20V5h4a3.5 3.5 0 0 1 0 7H7M11 12l6 8M13 15l4-3" />
    </svg>
  );
}

export function GlyphIcon({ name }: { name: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden
    >
      <path d={PATHS[name] ?? PATHS.today} />
    </svg>
  );
}
