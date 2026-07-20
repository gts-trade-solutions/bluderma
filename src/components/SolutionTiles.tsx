import Link from "next/link";
import { categoryTiles } from "@/data/nav";
import SmartImage from "./SmartImage";

interface SolutionTilesProps {
  /** Where the category anchors live (the current hub). */
  hubPath: string;
}

/**
 * Reference-style "exclusive solutions" grid — one tile per treatment
 * category, linking to that category section within the hub.
 */
export default function SolutionTiles({ hubPath }: SolutionTilesProps) {
  const tiles = categoryTiles();
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {tiles.map((tile) => (
        <Link
          key={tile.category}
          href={`${hubPath}#cat-${tile.anchor}`}
          className="group relative flex h-56 items-end overflow-hidden rounded-2xl shadow-card"
        >
          <SmartImage
            src={tile.image}
            alt={tile.category}
            sizes="(max-width: 768px) 100vw, 33vw"
            className="transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-brand-950/90 via-brand-950/25 to-transparent" />
          <div className="relative z-10 w-full p-5 text-white">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">{tile.category}</h3>
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
