import Link from "next/link";

/**
 * The doctor portal's own building blocks.
 *
 * The portal was assembled from the ADMIN component set — PageHeader, Table,
 * EmptyState — which is styled for a back-office CRUD console: dense, grey,
 * utilitarian. Correct for /admin, wrong here. A practitioner opens this
 * between patients and it is the product they were sold, not an internal tool
 * somebody bolted on.
 *
 * These are deliberately separate from admin/ui.tsx rather than a variant of
 * it. The two surfaces have different jobs and will keep diverging; sharing
 * one set means every change to either has to be checked against both.
 *
 * The canvas is light on purpose. This is read across a whole clinic day, and
 * the calendar's per-clinic colour coding needs a high-contrast ground. The
 * dark chrome lives in the rail, where the brand belongs.
 *
 * ── The 2026 rebuild ─────────────────────────────────────────────────────
 * The client's words were "cluttered", "boring" and "not interactive", and
 * all three came from one cause: every panel had identical weight. The same
 * white, the same ring, the same shadow, stacked down a flat grey page, with
 * no motion anywhere. Nothing led, so everything competed, so it read as
 * dense — and a screen where nothing responds to a cursor reads as a static
 * report rather than a tool.
 *
 * What changed, and the rule behind each:
 *
 *   ACCENT   A panel can carry a hue and a glyph. Colour is how the eye
 *            finds a section without reading it. Used sparingly: an accent
 *            on everything is the same as an accent on nothing.
 *
 *   LIFT     Anything that can be clicked rises under the cursor and settles
 *            when pressed. This is the whole of "interactive" — feedback on
 *            the things that DO something, and stillness on the things that
 *            merely say something.
 *
 *   ENTER    Panels fade up on mount, staggered by position. It costs one
 *            animation and turns a page that appears all at once into one
 *            that arrives.
 *
 * Every motion here sits behind `prefers-reduced-motion`, which is not a nicety
 * on a medical product: vestibular disorders are a real condition and this is
 * a screen people use all day.
 */

/* ------------------------------ Page head ------------------------------ */

export function PageHead({
  eyebrow,
  title,
  sub,
  action,
}: {
  eyebrow?: string;
  /** A node, not a string, so a heading can carry a mark — see RxMark. */
  title: React.ReactNode;
  sub?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          // A short gradient rule ahead of the eyebrow. It is two pixels of
          // brand on a page that otherwise has none above the fold, and it
          // gives the heading a place to start rather than floating.
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-brand-600">
            <span
              aria-hidden
              className="h-[3px] w-7 rounded-full bg-gradient-to-r from-brand-500 to-teal-400"
            />
            {eyebrow}
          </p>
        )}
        <h1 className="mt-2 font-display text-[26px] font-extrabold leading-tight tracking-[-0.035em] text-slate-900 sm:text-[32px]">
          {title}
        </h1>
        {sub && (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
            {sub}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

/* -------------------------------- Surface ------------------------------ */

/** The hues a panel may carry. Full class strings; Tailwind sees no interpolation. */
const ACCENTS = {
  brand: {
    tile: "bg-gradient-to-br from-brand-500 to-brand-600 text-white",
    edge: "from-brand-400/70",
  },
  teal: {
    tile: "bg-gradient-to-br from-teal-500 to-emerald-500 text-white",
    edge: "from-teal-400/70",
  },
  amber: {
    tile: "bg-gradient-to-br from-amber-400 to-orange-500 text-white",
    edge: "from-amber-400/70",
  },
  violet: {
    tile: "bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white",
    edge: "from-violet-400/70",
  },
  rose: {
    tile: "bg-gradient-to-br from-rose-500 to-pink-500 text-white",
    edge: "from-rose-400/70",
  },
  slate: {
    tile: "bg-gradient-to-br from-slate-400 to-slate-500 text-white",
    edge: "from-slate-300/70",
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
   * button does and nothing about why a doctor would ever press it. Panels a
   * practitioner meets rarely need one; the daily ones do not.
   */
  note?: React.ReactNode;
  action?: React.ReactNode;
  /** A hue for the header glyph and the top edge. Omit for a quiet panel. */
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
      className={`portal-enter group/panel relative overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05),0_12px_32px_-20px_rgba(15,23,42,0.22)] ring-1 ring-slate-200/80 transition duration-200 hover:shadow-[0_1px_2px_rgba(15,23,42,0.05),0_18px_44px_-22px_rgba(15,23,42,0.4)] hover:ring-slate-300 ${className}`}
      // Staggered so a screenful arrives rather than appearing. Capped: past
      // about eight the last panel is visibly late and it stops reading as
      // polish.
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
    >
      {/* A hairline of the accent along the top. Enough to tell two adjacent
          panels apart at a glance; not enough to be decoration. */}
      {skin && (
        <span
          aria-hidden
          className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r to-transparent ${skin.edge}`}
        />
      )}

      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            {skin && icon && (
              <span
                aria-hidden
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl shadow-sm transition duration-200 group-hover/panel:scale-105 ${skin.tile}`}
              >
                <GlyphIcon name={icon} />
              </span>
            )}
            <div className="min-w-0">
              {title && (
                <h2 className="font-display text-base font-bold text-slate-900">
                  {title}
                </h2>
              )}
              {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
            </div>
          </div>
          {action}
        </div>
      )}
      {note && (
        <p className="border-b border-slate-100 bg-slate-50/70 px-5 py-3 text-[13px] leading-relaxed text-slate-600">
          {note}
        </p>
      )}
      <div className={padded ? "p-5" : ""}>{children}</div>
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
      {/* A soft bloom of the accent behind the figure. It is what stops four
          tiles in a row reading as four identical boxes. */}
      <span
        aria-hidden
        className={`pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full opacity-[0.14] blur-2xl transition-opacity duration-300 group-hover/stat:opacity-25 ${skin.tile}`}
      />

      <div className="relative flex items-start justify-between gap-3">
        {/* Label first, small and set wide: the eye lands on the figure either
            way, and this way it already knows what it is looking at. */}
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
          {label}
        </p>
        {icon && (
          <span
            aria-hidden
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg shadow-sm transition duration-200 group-hover/stat:scale-110 ${skin.tile}`}
          >
            <GlyphIcon name={icon} />
          </span>
        )}
      </div>

      <p
        className={`relative mt-2 font-display text-3xl font-bold tracking-[-0.02em] tabular-nums ${
          tone === "attention" ? "text-amber-600" : "text-slate-900"
        }`}
      >
        {value}
      </p>

      <div className="relative mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        {/* Null is a real answer: a first month has nothing to compare to, and
            printing +100% would be inventing a trend. */}
        {delta !== null && delta !== undefined && (
          <span
            className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${
              delta >= 0
                ? "bg-teal-50 text-teal-700"
                : "bg-rose-50 text-rose-700"
            }`}
          >
            {delta >= 0 ? "▲" : "▼"}
            {Math.abs(Math.round(delta * 100))}%
          </span>
        )}
        {hint && <p className="text-xs leading-relaxed text-slate-500">{hint}</p>}
      </div>
    </>
  );

  const shell =
    "portal-enter group/stat relative overflow-hidden rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)] ring-1 ring-slate-200/80 transition duration-200";
  const style = { animationDelay: `${Math.min(index, 8) * 45}ms` };

  return href ? (
    <Link
      href={href}
      style={style}
      // Rises under the cursor and settles when pressed. The whole of
      // "interactive" is feedback on the things that do something.
      className={`${shell} block hover:-translate-y-0.5 hover:shadow-[0_1px_2px_rgba(15,23,42,0.05),0_16px_36px_-20px_rgba(15,23,42,0.45)] hover:ring-slate-300 active:translate-y-0`}
    >
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
    <div className="rounded-2xl border border-dashed border-slate-300 bg-gradient-to-b from-white/70 to-slate-50/50 px-6 py-14 text-center">
      <span
        aria-hidden
        className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400 ring-1 ring-inset ring-white"
      >
        <GlyphIcon name={icon} />
      </span>
      <h3 className="mt-4 font-display text-base font-bold text-slate-900">
        {title}
      </h3>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-slate-500">{body}</p>
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
  const skin = {
    info: "border-blue-200 bg-blue-50 text-blue-900",
    attention: "border-amber-200 bg-amber-50 text-amber-900",
    warning: "border-rose-200 bg-rose-50 text-rose-900",
  }[tone];

  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border px-5 py-4 ${skin}`}>
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
    slate: "bg-slate-100 text-slate-600",
    teal: "bg-teal-50 text-teal-700 ring-1 ring-teal-200",
    amber: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
    rose: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
    brand: "bg-brand-50 text-brand-700 ring-1 ring-brand-200",
    gold: "bg-amber-100 text-amber-900 ring-1 ring-amber-300",
  }[tone];
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${skin}`}>
      {children}
    </span>
  );
}

/* -------------------------------- Buttons ------------------------------ */

export const portalBtn =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 active:scale-[0.97]";
// A gradient rather than a flat fill, and a shadow in the button's own hue —
// the same treatment the client side gives its primary action, so a doctor
// who has seen the public site recognises this one.
export const portalBtnPrimary = `${portalBtn} bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-[0_6px_18px_-6px_rgba(31,111,214,0.7)] hover:from-brand-700 hover:to-brand-600 hover:shadow-[0_8px_22px_-6px_rgba(31,111,214,0.85)]`;
export const portalBtnQuiet = `${portalBtn} border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50`;

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
      className={`inline-block h-[0.9em] w-[0.9em] shrink-0 align-[-0.08em] text-brand-600 ${className}`}
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
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden
    >
      <path d={PATHS[name] ?? PATHS.today} />
    </svg>
  );
}
