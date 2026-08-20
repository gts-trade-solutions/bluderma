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
 */

/* ------------------------------ Page head ------------------------------ */

export function PageHead({
  eyebrow,
  title,
  sub,
  action,
}: {
  eyebrow?: string;
  title: string;
  sub?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-600">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-1 font-display text-2xl font-bold tracking-[-0.02em] text-slate-900 sm:text-3xl">
          {title}
        </h1>
        {sub && <p className="mt-1.5 max-w-2xl text-sm text-slate-500">{sub}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

/* -------------------------------- Surface ------------------------------ */

export function Panel({
  title,
  sub,
  action,
  padded = true,
  className = "",
  children,
}: {
  title?: string;
  sub?: string;
  action?: React.ReactNode;
  padded?: boolean;
  /** For grid spans at the call site. */
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05),0_12px_32px_-20px_rgba(15,23,42,0.22)] ring-1 ring-slate-200/80 ${className}`}>
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            {title && (
              <h2 className="font-display text-base font-bold text-slate-900">
                {title}
              </h2>
            )}
            {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
          </div>
          {action}
        </div>
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
  tone = "plain",
}: {
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
  /** `attention` is for a number the doctor is meant to act on. */
  tone?: "plain" | "attention";
}) {
  const body = (
    <>
      {/* Label first, small and set wide: the eye lands on the figure either
          way, and this way it already knows what it is looking at. */}
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>
      <p
        className={`mt-2 font-display text-3xl font-bold tracking-[-0.02em] tabular-nums ${
          tone === "attention" ? "text-amber-600" : "text-slate-900"
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{hint}</p>}
    </>
  );

  const shell =
    "relative overflow-hidden rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)] ring-1 ring-slate-200/80";

  return href ? (
    <Link
      href={href}
      className={`${shell} block transition hover:shadow-[0_1px_2px_rgba(15,23,42,0.05),0_10px_28px_-18px_rgba(15,23,42,0.35)] hover:ring-slate-300`}
    >
      {body}
    </Link>
  ) : (
    <div className={shell}>{body}</div>
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
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-14 text-center">
      <span
        aria-hidden
        className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400"
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
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2";
export const portalBtnPrimary = `${portalBtn} bg-brand-600 text-white hover:bg-brand-700`;
export const portalBtnQuiet = `${portalBtn} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`;

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
};

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
