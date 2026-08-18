"use client";

import Link from "next/link";

/**
 * The BluDerma identity: a letterspaced logotype, optionally preceded by the
 * nested D monogram drawn from dermal layers.
 *
 * The logotype is set in caps on wide tracking — B L U   D E R M A — which is
 * how an aesthetics brand is usually set, and it reads as a mark in its own
 * right rather than as a word in the menu. Wide tracking leaves a trailing
 * space after the final letter, so the wrapper pulls it back; without that the
 * gap to whatever follows looks like a mistake.
 *
 * Inline vector artwork keeps the monogram sharp and lets both parts adapt to
 * light and dark surfaces with no separate raster exports.
 */
export default function BrandLogo({
  size = 48,
  showWordmark = true,
  showMark = true,
  tone = "dark",
  href = "/",
  className = "",
  onClick,
}: {
  /** Icon edge length in pixels; also sets the logotype's size. */
  size?: number;
  /** Show the BluDerma logotype. */
  showWordmark?: boolean;
  /** Show the monogram. Off leaves the logotype standing alone. */
  showMark?: boolean;
  /** Colour: "dark" on light backgrounds, "light" on dark ones. */
  tone?: "dark" | "light";
  /** Wrap in a link. Pass null to render the identity inline with no link. */
  href?: string | null;
  className?: string;
  onClick?: () => void;
}) {
  // Standing alone the logotype carries the whole identity, so it is set
  // larger than it would be sitting next to the monogram.
  const fontSize = Math.max(
    showMark ? 20 : 22,
    Math.round(size * (showMark ? 0.46 : 0.54))
  );

  const body = (
    <>
      {showMark && (
        <svg
          viewBox="0 0 64 64"
          style={{ height: size, width: size }}
          className="shrink-0"
          aria-hidden="true"
        >
          <rect x="2" y="2" width="60" height="60" rx="18" fill="#1769D2" />
          <path
            d="M18.5 15.5h14C43.3 15.5 50 22 50 32S43.3 48.5 32.5 48.5h-14v-33Z"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="4.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M25.5 23h6.7c6 0 9.8 3.5 9.8 9s-3.8 9-9.8 9h-6.7"
            fill="none"
            stroke="#67E0CF"
            strokeWidth="4.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M18.5 32h13.7"
            stroke="#FFFFFF"
            strokeWidth="4.25"
            strokeLinecap="round"
          />
          <circle cx="50.5" cy="14" r="3.2" fill="#67E0CF" />
        </svg>
      )}

      {showWordmark && (
        <span
          style={{ fontSize }}
          className="-mr-[0.3em] whitespace-nowrap font-bold uppercase leading-none tracking-[0.3em]"
        >
          <span className={tone === "light" ? "text-white" : "text-[#102A43]"}>
            Blu
          </span>
          {/* The wider gap between the two halves, on top of the tracking. */}
          <span
            className={`ml-[0.16em] ${
              tone === "light" ? "text-teal-300" : "text-[#1769D2]"
            }`}
          >
            Derma
          </span>
        </span>
      )}
    </>
  );

  const wrap = `inline-flex items-center ${showMark ? "gap-2.5" : ""} ${className}`;

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
