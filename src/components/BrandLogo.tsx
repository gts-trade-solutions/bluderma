"use client";

import Link from "next/link";

/**
 * The BluDerma identity: a letterspaced logotype.
 *
 * The nested-D monogram that used to sit ahead of it has been removed
 * outright rather than defaulted off, so it cannot quietly come back on a
 * new call site. The logotype carries the identity on its own — which is how
 * the navbar had already been using it.
 *
 * The logotype is set in caps on wide tracking — B L U   D E R M A — which is
 * how an aesthetics brand is usually set, and it reads as a mark in its own
 * right rather than as a word in the menu. Wide tracking leaves a trailing
 * space after the final letter, so the wrapper pulls it back; without that the
 * gap to whatever follows looks like a mistake.
 *
 * Inline text rather than an image keeps it sharp at any size and lets it
 * adapt to light and dark surfaces with no separate exports.
 */
export default function BrandLogo({
  size = 48,
  showWordmark = true,
  tone = "dark",
  href = "/",
  className = "",
  onClick,
}: {
  /** Sets the logotype's size. */
  size?: number;
  /** Show the BluDerma logotype. */
  showWordmark?: boolean;
  /** Colour: "dark" on light backgrounds, "light" on dark ones. */
  /**
   * "light" for a logo sitting on something dark on every theme — a hero
   * photograph. "dark" for a permanently light surface. "auto" follows the
   * theme, which is what anything on a themed surface wants: the bar and the
   * wordmark then come from the same tokens and cannot disagree.
   */
  tone?: "dark" | "light" | "auto";
  /** Wrap in a link. Pass null to render the identity inline with no link. */
  href?: string | null;
  className?: string;
  onClick?: () => void;
}) {
  // Standing alone the logotype carries the whole identity, so it is set
  // larger than it was when a monogram sat beside it.
  const fontSize = Math.max(22, Math.round(size * 0.54));

  const body = (
    <>
      {showWordmark && (
        <span
          style={{ fontSize }}
          className="-mr-[0.3em] whitespace-nowrap font-bold uppercase leading-none tracking-[0.3em]"
        >
          <span
            className={
              tone === "light"
                ? "text-white"
                : tone === "auto"
                ? "text-[var(--logo-ink)]"
                : "text-[#102A43]"
            }
          >
            Blu
          </span>
          {/* The wider gap between the two halves, on top of the tracking. */}
          <span
            className={`ml-[0.16em] ${
              tone === "light"
                ? "text-teal-300"
                : tone === "auto"
                ? "text-[var(--logo-accent)]"
                : "text-[#1769D2]"
            }`}
          >
            Derma
          </span>
        </span>
      )}
    </>
  );

  const wrap = `inline-flex items-center ${className}`;

  if (href === null) {
    return (
      <span className={wrap} aria-label="BluDerma">
        {body}
      </span>
    );
  }

  return (
    <Link
      href={href}
      onClick={onClick}
      className={wrap}
      aria-label="BluDerma home"
    >
      {body}
    </Link>
  );
}
