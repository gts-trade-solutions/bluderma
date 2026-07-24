"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * The BluDerma mark. Renders /brand/logo.png and falls back to the original
 * droplet glyph if that file is missing, so the header never shows a broken
 * image while the brand asset is being finalised.
 *
 * Drop the supplied logo at `public/brand/logo.png` to activate it everywhere.
 */
export default function BrandLogo({
  size = 36,
  showWordmark = true,
  tone = "dark",
  href = "/",
  className = "",
  onClick,
}: {
  /** Icon edge length in pixels. */
  size?: number;
  /** Show the "BluDerma" wordmark beside the mark. */
  showWordmark?: boolean;
  /** Wordmark colour: "dark" on light backgrounds, "light" on dark ones. */
  tone?: "dark" | "light";
  /** Wrap in a link. Pass null to render the mark inline with no link. */
  href?: string | null;
  className?: string;
  onClick?: () => void;
}) {
  const [imgOk, setImgOk] = useState(true);

  const mark = imgOk ? (
    // eslint-disable-next-line @next/next/no-img-element -- fallback needs onError
    <img
      src="/brand/logo.png"
      alt="BluDerma"
      onError={() => setImgOk(false)}
      style={{ height: size, width: size }}
      className="shrink-0 rounded-xl object-contain"
    />
  ) : (
    <span
      style={{ height: size, width: size }}
      className="flex shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-soft"
    >
      <svg viewBox="0 0 24 24" className="h-1/2 w-1/2" fill="none">
        <path
          d="M12 3s6 5.5 6 10a6 6 0 1 1-12 0c0-4.5 6-10 6-10Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );

  const body = (
    <>
      {mark}
      {showWordmark && (
        <span
          className={`text-lg font-extrabold tracking-tight ${
            tone === "light" ? "text-white drop-shadow" : "text-brand-800"
          }`}
        >
          Blu<span className="text-teal-400">Derma</span>
        </span>
      )}
    </>
  );

  const wrap = `inline-flex items-center gap-2 ${className}`;

  if (href === null) {
    return <span className={wrap}>{body}</span>;
  }

  return (
    <Link href={href} onClick={onClick} className={wrap}>
      {body}
    </Link>
  );
}
