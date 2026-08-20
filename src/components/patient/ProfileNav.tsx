"use client";

import { useEffect, useState } from "react";

export interface ProfileSection {
  id: string;
  label: string;
  /** One of the glyph keys below. */
  icon: string;
  /** Shown on the right of the row — a count, a balance, a state. */
  badge?: string;
}

/**
 * The profile's own navigation.
 *
 * My Profile had grown to nine sections down one long scroll, which on a phone
 * is a thousand pixels of thumb between "my reports" and "my prescriptions".
 * This is the index: a sticky rail on a desktop, and a sticky strip of pills
 * on a phone, where a horizontal swipe is cheaper than a vertical hunt.
 *
 * Anchors, not routes. Every section is already rendered by the server in one
 * pass, so linking to `#wallet` costs nothing, keeps the whole record
 * printable, and means Back does the obvious thing. Turning them into nine
 * routes would mean nine round trips to read your own file.
 *
 * The highlight is driven by IntersectionObserver rather than by scroll
 * arithmetic — sections here are wildly different heights, and any
 * offset-based guess picks the wrong one on the short ones.
 */
export default function ProfileNav({
  sections,
}: {
  sections: ProfileSection[];
}) {
  const [active, setActive] = useState(sections[0]?.id ?? "");

  useEffect(() => {
    const nodes = sections
      .map((s) => document.getElementById(s.id))
      .filter((n): n is HTMLElement => Boolean(n));
    if (!nodes.length) return;

    const seen = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id, e.intersectionRatio);
        // The section showing most of itself wins. Ties keep document order,
        // which is what a reader scrolling down expects.
        let best = "";
        let bestRatio = 0;
        for (const s of sections) {
          const ratio = seen.get(s.id) ?? 0;
          if (ratio > bestRatio) {
            best = s.id;
            bestRatio = ratio;
          }
        }
        if (best) setActive(best);
      },
      {
        // The sticky chrome covers the top ~140px; without this margin a
        // section counts as visible while it is hidden behind the navbar.
        rootMargin: "-140px 0px -55% 0px",
        threshold: [0, 0.15, 0.35, 0.6, 1],
      }
    );

    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, [sections]);

  // Keep the active pill visible on a phone. Without this the highlight moves
  // to something off-screen as you scroll, which is the same as having no
  // highlight at all. `nearest` so it only scrolls when it has to, and
  // `block: "nearest"` so it never drags the PAGE around.
  useEffect(() => {
    if (!active) return;
    const pill = document.querySelector<HTMLElement>(
      `[data-pill="${CSS.escape(active)}"]`
    );
    pill?.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
  }, [active]);

  return (
    <>
      {/* ── Phone: a sticky strip ──────────────────────────────────────── */}
      <nav
        aria-label="Profile sections"
        // top-20 is the navbar's own h-20, and z-30 keeps this under it.
        // The negative margins match container-page's px-5 sm:px-8 exactly, so
        // the strip bleeds edge to edge instead of sitting in a gutter.
        className="sticky top-20 z-30 -mx-5 border-b border-white/10 bg-[#070d1c]/95 px-5 py-2.5 backdrop-blur sm:-mx-8 sm:px-8 lg:hidden"
      >
        {/* Ten pills never fit a phone, and the scrollbar is hidden — so the
            row is faded at the right edge to say "there is more this way".
            Without it the strip reads as a complete list of four. The mask is
            in the same direction as the scroll, and it is decoration only:
            the pills themselves stay fully reachable. */}
        <ul className="flex snap-x gap-2 overflow-x-auto pr-6 [-ms-overflow-style:none] [mask-image:linear-gradient(to_right,black_calc(100%-2.5rem),transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {sections.map((s) => (
            <li key={s.id} className="shrink-0 snap-start">
              <a
                href={`#${s.id}`}
                data-pill={s.id}
                aria-current={active === s.id ? "true" : undefined}
                className={`inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-semibold transition ${
                  active === s.id
                    ? "bg-white text-[#070d1c]"
                    : "bg-white/[0.06] text-ink-soft ring-1 ring-inset ring-white/10"
                }`}
              >
                <Glyph name={s.icon} />
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* ── Desktop: the rail ──────────────────────────────────────────── */}
      <nav
        aria-label="Profile sections"
        className="hidden lg:sticky lg:top-24 lg:block lg:self-start"
      >
        <ul className="space-y-1">
          {sections.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                aria-current={active === s.id ? "true" : undefined}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                  active === s.id
                    ? "bg-white/[0.09] font-bold text-ink ring-1 ring-inset ring-white/15"
                    : "font-semibold text-ink-muted hover:bg-white/[0.05] hover:text-ink"
                }`}
              >
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition ${
                    active === s.id
                      ? "bg-gradient-to-br from-brand-500 to-teal-500 text-white"
                      : "bg-white/[0.06] text-ink-muted group-hover:text-teal-300"
                  }`}
                >
                  <Glyph name={s.icon} />
                </span>
                <span className="min-w-0 flex-1 truncate">{s.label}</span>
                {s.badge && (
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${
                      active === s.id
                        ? "bg-white/15 text-ink"
                        : "bg-white/[0.07] text-ink-muted"
                    }`}
                  >
                    {s.badge}
                  </span>
                )}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}

/**
 * Hand-rolled so the rail carries no icon library weight for nine glyphs, and
 * so each one is a single stroked path that inherits colour from its tile.
 */
const PATHS: Record<string, string> = {
  report: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h4",
  condition: "M3 12h3l2-5 3 10 2.5-7 1.5 2h6",
  wallet: "M3 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 10h18M16 14h.01",
  rx: "M6 20V9h4a3 3 0 0 1 0 6H6m6 0 5 5M17 15l-5 5",
  treatment: "M12 3v18M7 7l10 10M17 7 7 17",
  location: "M12 21s7-5.3 7-11a7 7 0 1 0-14 0c0 5.7 7 11 7 11zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  calendar: "M7 3v3m10-3v3M4 9h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z",
  paylater: "M3 9h18M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM7 14h4",
  crown: "M4 18h16M4 8l4 3 4-6 4 6 4-3v7H4z",
  order: "M4 7l8-4 8 4v10l-8 4-8-4zM4 7l8 4 8-4M12 11v10",
};

function Glyph({ name }: { name: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px]"
      aria-hidden
    >
      <path d={PATHS[name] ?? PATHS.report} />
    </svg>
  );
}
