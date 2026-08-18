import { cache } from "react";

import { prisma } from "@/lib/prisma";
import type { HubCategory, HubTreatment } from "@/data/hub";
import { HUB_CATEGORIES } from "@/data/hub";
import type {
  TreatmentDetail,
  TreatmentFaq,
  TreatmentOption,
} from "@/data/treatmentDetail";
import { getTreatmentDetail as staticDetail } from "@/data/treatmentDetail";

/**
 * The client-facing catalogue, from the database, in the exact shapes the
 * explore pages were built against — so the pages did not change when the
 * content moved into the CMS.
 *
 * The static files remain as the fallback. An empty or unreachable catalogue
 * table renders the shipped content rather than an empty site, which also
 * means a fresh clone runs before anyone has seeded anything.
 */

/** Json columns come back as `unknown`; these narrow them safely. */
function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function options(value: unknown): TreatmentOption[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((v) => {
    if (!v || typeof v !== "object") return [];
    const o = v as Record<string, unknown>;
    if (typeof o.name !== "string" || typeof o.detail !== "string") return [];
    return [{ name: o.name, detail: o.detail, popular: o.popular === true }];
  });
}

function faqs(value: unknown): TreatmentFaq[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((v) => {
    if (!v || typeof v !== "object") return [];
    const f = v as Record<string, unknown>;
    if (typeof f.q !== "string" || typeof f.a !== "string") return [];
    return [{ q: f.q, a: f.a }];
  });
}

export const getHubCategories = cache(async (): Promise<HubCategory[]> => {
  const rows = await prisma.hubCategory.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: {
      treatments: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: {
          slug: true,
          name: true,
          blurb: true,
          image: true,
          beforeImage: true,
          afterImage: true,
          meta: true,
          beforeAfterCases: {
            orderBy: { sortOrder: "asc" },
            select: { beforeImage: true, afterImage: true },
          },
        },
      },
    },
  });

  // Nothing published yet — serve what shipped rather than an empty hub.
  if (rows.length === 0) return HUB_CATEGORIES;

  return rows.map((c) => ({
    slug: c.slug,
    name: c.name,
    icon: c.icon,
    blurb: c.blurb,
    intro: c.intro,
    image: c.image,
    tint: c.tint,
    treatments: c.treatments.map((t) => ({
      slug: t.slug,
      name: t.name,
      blurb: t.blurb,
      image: t.image,
      beforeImage: t.beforeImage ?? undefined,
      afterImage: t.afterImage ?? undefined,
      beforeAfterCases: t.beforeAfterCases,
      meta: t.meta ?? undefined,
    })),
  }));
});

export const getHubCategory = cache(
  async (slug: string): Promise<HubCategory | null> => {
    const all = await getHubCategories();
    return all.find((c) => c.slug === slug) ?? null;
  }
);

/**
 * The protocol behind a treatment page. Falls back to the static resolver
 * when the category has no protocol row, so a newly created category renders
 * sensible clinical copy until someone writes its own.
 */
export const getProtocol = cache(
  async (
    categorySlug: string,
    treatment: HubTreatment
  ): Promise<TreatmentDetail> => {
    const row = await prisma.treatmentProtocol.findFirst({
      where: { category: { slug: categorySlug } },
    });

    if (!row) return staticDetail(categorySlug, treatment);

    return {
      recommendedFor: strings(row.recommendedFor),
      summary: row.summary,
      howItWorks: row.howItWorks,
      options: options(row.options),
      areas: strings(row.areas),
      duration: row.duration,
      anaesthesia: row.anaesthesia,
      sessions: row.sessions,
      downtime: row.downtime,
      results: row.results,
      includes: strings(row.includes),
      excludes: strings(row.excludes),
      precautions: strings(row.precautions),
      sideEffects: strings(row.sideEffects),
      notSuitable: strings(row.notSuitable),
      aftercare: strings(row.aftercare),
      faqs: faqs(row.faqs),
    };
  }
);

/** Every published (category, treatment) pair — for generateStaticParams. */
export async function getAllHubPaths(): Promise<
  { category: string; treatment: string }[]
> {
  const categories = await getHubCategories();
  return categories.flatMap((c) =>
    c.treatments.map((t) => ({ category: c.slug, treatment: t.slug }))
  );
}
