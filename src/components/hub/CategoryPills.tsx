import Link from "next/link";

import type { HubCategory } from "@/data/hub";
import { categoryIcon } from "./icons";
import Rail from "./Rail";

/**
 * Category chooser as a single scrolling row of compact pills — a soft icon
 * tile and a label, nothing more. Eighteen photo tiles competed with the hero
 * for attention; at this size the categories sit quietly under it and stay
 * scannable in one pass, which is how the marketplaces this is modelled on
 * handle a long category list.
 */
export default function CategoryPills({
  categories,
  activeSlug,
}: {
  categories: HubCategory[];
  activeSlug?: string;
}) {
  return (
    <Rail ariaLabel="Treatment categories" className="gap-2.5 py-1">
      {categories.map((c) => {
        const Icon = categoryIcon(c.icon);
        const active = c.slug === activeSlug;
        return (
          <Link
            key={c.slug}
            href={`/patient/explore/${c.slug}`}
            className={`group inline-flex shrink-0 snap-start items-center gap-2.5 rounded-2xl border bg-white/[0.04] py-2 pl-2 pr-4 shadow-[0_1px_2px_rgba(16,42,71,0.04)] transition-all duration-200 ${
              active
                ? "border-brand-500 ring-1 ring-brand-500"
                : "border-white/10 hover:-translate-y-0.5 hover:border-brand-300/50 hover:shadow-soft"
            }`}
          >
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br shadow-[0_4px_12px_-4px_rgba(0,0,0,0.55)] ring-1 ring-inset ring-white/25 ${c.tint}`}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
            </span>
            <span className="whitespace-nowrap text-sm font-semibold text-ink">
              {c.name}
            </span>
          </Link>
        );
      })}
    </Rail>
  );
}
