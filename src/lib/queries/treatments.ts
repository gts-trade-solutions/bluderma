import { BulletKind, Prisma } from "@prisma/client";
import { cache } from "react";

import { prisma } from "@/lib/prisma";
import type { CategoryDTO, TreatmentDTO } from "./types";

/**
 * Treatment reads. `cache()` dedupes within a single render pass — a page that
 * asks for the same treatment in generateMetadata and again in the component
 * hits the database once.
 */

const treatmentInclude = {
  category: { select: { name: true, slug: true } },
  bullets: {
    orderBy: [{ kind: "asc" }, { sortOrder: "asc" }],
    select: { kind: true, text: true },
  },
} satisfies Prisma.TreatmentInclude;

// Derived from the include rather than hand-written, so the two can't drift.
type TreatmentRow = Prisma.TreatmentGetPayload<{
  include: typeof treatmentInclude;
}>;

function toDTO(row: TreatmentRow): TreatmentDTO {
  const of = (kind: BulletKind) =>
    row.bullets.filter((b) => b.kind === kind).map((b) => b.text);

  return {
    slug: row.slug,
    name: row.name,
    updatedAt: row.updatedAt,
    category: row.category.name,
    categorySlug: row.category.slug,
    tagline: row.tagline,
    image: row.image,
    summary: row.summary,
    concern: row.concern,
    concernPoints: of(BulletKind.CONCERN_POINT),
    howItWorks: row.howItWorks,
    procedureSteps: of(BulletKind.PROCEDURE_STEP),
    benefits: of(BulletKind.BENEFIT),
    idealFor: of(BulletKind.IDEAL_FOR),
    facts: {
      sessions: row.factSessions,
      downtime: row.factDowntime,
      results: row.factResults,
      duration: row.factDuration,
    },
    product: { name: row.productName, descriptor: row.productDescriptor },
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
  };
}

export const getTreatments = cache(async (): Promise<TreatmentDTO[]> => {
  const rows = await prisma.treatment.findMany({
    where: { isPublished: true },
    orderBy: { sortOrder: "asc" },
    include: treatmentInclude,
  });
  return rows.map(toDTO);
});

export const getTreatment = cache(
  async (slug: string): Promise<TreatmentDTO | null> => {
    const row = await prisma.treatment.findFirst({
      where: { slug, isPublished: true },
      include: treatmentInclude,
    });
    return row ? toDTO(row) : null;
  }
);

/** Slugs for generateStaticParams. */
export async function getAllTreatmentSlugs(): Promise<string[]> {
  const rows = await prisma.treatment.findMany({
    where: { isPublished: true },
    select: { slug: true },
    orderBy: { sortOrder: "asc" },
  });
  return rows.map((r) => r.slug);
}

/**
 * Same-category treatments first, then anything else, matching the behaviour
 * of the old in-memory getRelated().
 */
export const getRelated = cache(
  async (slug: string, count = 3): Promise<TreatmentDTO[]> => {
    const current = await getTreatment(slug);
    if (!current) return [];

    const all = await getTreatments();
    const others = all.filter((t) => t.slug !== slug);
    const sameCategory = others.filter((t) => t.category === current.category);
    const rest = others.filter((t) => t.category !== current.category);

    return [...sameCategory, ...rest].slice(0, count);
  }
);

export const getCategories = cache(async (): Promise<CategoryDTO[]> => {
  const rows = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      slug: true,
      name: true,
      blurb: true,
      image: true,
      _count: { select: { treatments: { where: { isPublished: true } } } },
    },
  });

  return rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    blurb: r.blurb,
    image: r.image,
    count: r._count.treatments,
  }));
});

/** Category display order — replaces the hardcoded `categoryOrder` array. */
export const getCategoryOrder = cache(async (): Promise<string[]> => {
  const cats = await getCategories();
  return cats.map((c) => c.name);
});

export interface TreatmentImageDTO {
  kind: "HERO" | "BEFORE_AFTER" | "RESULT" | "HOW_IT_WORKS" | "GALLERY";
  url: string;
  caption: string | null;
}

/** Typed image slots for a treatment (before/after, result, how-it-works, …). */
export const getTreatmentImages = cache(
  async (slug: string): Promise<TreatmentImageDTO[]> => {
    const rows = await prisma.treatmentImage.findMany({
      where: { treatment: { slug } },
      orderBy: [{ kind: "asc" }, { sortOrder: "asc" }],
      select: { kind: true, url: true, caption: true },
    });
    return rows;
  }
);
