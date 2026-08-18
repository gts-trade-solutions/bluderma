import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { HUB_CATEGORIES } from "@/data/hub";
import Rail from "./Rail";
import TreatmentLabel from "./TreatmentLabel";
import { categoryIcon } from "./icons";

/**
 * Every category as its own row, with its treatments as labels sitting next
 * to each other — the layout the Korean marketplaces use down their whole
 * front page, and the one the client pointed at.
 *
 * The tabbed browser above this exists for someone who knows the category
 * they want. This is for everyone else: it shows the whole catalogue at once
 * without making them click a tab to find out what is in it.
 */
export default function CategoryRows({ limit = 8 }: { limit?: number }) {
  return (
    <div className="space-y-10">
      {HUB_CATEGORIES.map((category) => {
        const Icon = categoryIcon(category.icon);
        return (
          <section key={category.slug}>
            <div className="mb-3.5 flex items-end justify-between gap-4">
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${category.tint}`}
                >
                  <Icon className="h-5 w-5" strokeWidth={1.9} />
                </span>
                <div>
                  <h3 className="display-sm text-lg text-ink">
                    {category.name}
                  </h3>
                  <p className="text-xs text-ink-muted">{category.blurb}</p>
                </div>
              </div>

              <Link
                href={`/patient/explore/${category.slug}`}
                className="hidden shrink-0 items-center gap-1 text-sm font-semibold text-brand-200 hover:text-brand-100 sm:inline-flex"
              >
                See all {category.treatments.length}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <Rail ariaLabel={`${category.name} treatments`} className="gap-3">
              {category.treatments.slice(0, limit).map((treatment) => (
                <TreatmentLabel
                  key={treatment.slug}
                  treatment={treatment}
                  categorySlug={category.slug}
                  categoryLabel={category.name}
                  tint={category.tint}
                />
              ))}
            </Rail>
          </section>
        );
      })}
    </div>
  );
}
