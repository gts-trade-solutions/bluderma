"use client";

import Link from "next/link";
import { type MouseEvent } from "react";
import type { CategoryDTO } from "@/lib/queries/types";
import SmartImage from "./SmartImage";

interface SolutionTilesProps {
  /** Where the category anchors live (the current hub). */
  hubPath: string;
  tiles: CategoryDTO[];
}

/**
 * Reference-style "exclusive solutions" grid — one tile per treatment
 * category, deep-linking (via a `#cat-<slug>` hash) into the treatment browser,
 * which reads the hash to pre-select that category's filter.
 */
export default function SolutionTiles({ hubPath, tiles }: SolutionTilesProps) {
  // The `#cat-<slug>` hash matches no element on the page, so Next's <Link>
  // would scroll to the top ("hero"). For a same-page click we instead set the
  // hash ourselves — that fires a real `hashchange` (which the router's
  // pushState wouldn't), so TreatmentBrowser applies the filter and scrolls to
  // the grid. The href is kept for SSR/new-tab/right-click, where the target
  // page's mount effect handles the same thing.
  const openCategory = (e: MouseEvent<HTMLAnchorElement>, slug: string) => {
    // Let modified clicks (new tab/window) use the real href.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    const target = `cat-${slug}`;
    if (window.location.hash.replace(/^#/, "") === target) {
      document
        .getElementById("treatments")
        ?.scrollIntoView({ behavior: "smooth" });
    } else {
      window.location.hash = target;
    }
  };

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {tiles.map((tile) => (
        <Link
          key={tile.slug}
          href={`${hubPath}#cat-${tile.slug}`}
          onClick={(e) => openCategory(e, tile.slug)}
          className="group relative flex h-56 items-end overflow-hidden rounded-2xl shadow-card"
        >
          <SmartImage
            src={tile.image ?? ""}
            alt={tile.name}
            sizes="(max-width: 768px) 100vw, 33vw"
            className="transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-brand-950/90 via-brand-950/25 to-transparent" />
          <div className="relative z-10 w-full p-5 text-white">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">{tile.name}</h3>
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold ring-1 ring-white/25">
                {tile.count}
              </span>
            </div>
            <p className="mt-1 text-sm text-white/80">{tile.blurb}</p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-teal-300">
              Explore
              <svg
                viewBox="0 0 20 20"
                className="h-4 w-4 transition-transform group-hover:translate-x-1"
                fill="none"
              >
                <path
                  d="m8 5 5 5-5 5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
