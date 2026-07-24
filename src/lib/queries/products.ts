import { ProductBulletKind, Prisma } from "@prisma/client";
import { cache } from "react";

import { prisma } from "@/lib/prisma";

/**
 * Public product read models.
 *
 * PRICE IS NEVER IN THESE TYPES. The site is enquiry-to-order, and price is
 * internal-only — excluding it at the DTO layer means a public component
 * physically cannot render it, no matter how it's written. Admin reads use the
 * raw Prisma models (which do carry price) via lib/queries/admin paths.
 */

export interface ProductCardDTO {
  slug: string;
  name: string;
  brand: string | null;
  category: string;
  tagline: string | null;
  image: string | null; // first image, if any
}

export interface ProductDetailDTO {
  slug: string;
  name: string;
  brand: string | null;
  category: string;
  origin: string | null;
  tagline: string | null;
  description: string | null;
  howItWorks: string | null;
  composition: string | null;
  usageNotes: string | null;
  variants: string[];
  features: string[];
  benefits: string[];
  indications: string[];
  images: { url: string; alt: string | null }[];
  treatments: { slug: string; name: string }[];
  seoDescription: string | null;
}

const cardSelect = {
  slug: true,
  name: true,
  brand: true,
  category: true,
  tagline: true,
  images: {
    orderBy: { sortOrder: "asc" },
    take: 1,
    select: { url: true },
  },
} satisfies Prisma.ProductSelect;

function toCard(
  row: Prisma.ProductGetPayload<{ select: typeof cardSelect }>
): ProductCardDTO {
  return {
    slug: row.slug,
    name: row.name,
    brand: row.brand,
    category: row.category,
    tagline: row.tagline,
    image: row.images[0]?.url ?? null,
  };
}

/** Products shown under a treatment, primary first. Published only. */
export const getProductsForTreatment = cache(
  async (treatmentSlug: string): Promise<ProductCardDTO[]> => {
    const rows = await prisma.product.findMany({
      where: {
        isPublished: true,
        treatments: { some: { treatment: { slug: treatmentSlug } } },
      },
      orderBy: [{ sortOrder: "asc" }],
      select: {
        ...cardSelect,
        treatments: {
          where: { treatment: { slug: treatmentSlug } },
          select: { isPrimary: true, sortOrder: true },
        },
      },
    });

    // Primary products first, then by the mapping's sort order.
    return rows
      .map((r) => ({ card: toCard(r), link: r.treatments[0] }))
      .sort((a, b) => {
        if (a.link?.isPrimary !== b.link?.isPrimary)
          return a.link?.isPrimary ? -1 : 1;
        return (a.link?.sortOrder ?? 0) - (b.link?.sortOrder ?? 0);
      })
      .map((x) => x.card);
  }
);

export const getProduct = cache(
  async (slug: string): Promise<ProductDetailDTO | null> => {
    const row = await prisma.product.findFirst({
      where: { slug, isPublished: true },
      include: {
        variants: { orderBy: { sortOrder: "asc" }, select: { label: true } },
        bullets: {
          orderBy: [{ kind: "asc" }, { sortOrder: "asc" }],
          select: { kind: true, text: true },
        },
        images: {
          orderBy: { sortOrder: "asc" },
          take: 5,
          select: { url: true, alt: true },
        },
        treatments: {
          orderBy: { sortOrder: "asc" },
          select: {
            treatment: {
              select: { slug: true, name: true, isPublished: true },
            },
          },
        },
      },
    });
    if (!row) return null;

    const of = (kind: ProductBulletKind) =>
      row.bullets.filter((b) => b.kind === kind).map((b) => b.text);

    return {
      slug: row.slug,
      name: row.name,
      brand: row.brand,
      category: row.category,
      origin: row.origin,
      tagline: row.tagline,
      description: row.description,
      howItWorks: row.howItWorks,
      composition: row.composition,
      usageNotes: row.usageNotes,
      variants: row.variants.map((v) => v.label),
      features: of(ProductBulletKind.FEATURE),
      benefits: of(ProductBulletKind.BENEFIT),
      indications: of(ProductBulletKind.INDICATION),
      images: row.images,
      treatments: row.treatments
        .map((t) => t.treatment)
        .filter((t) => t.isPublished)
        .map((t) => ({ slug: t.slug, name: t.name })),
      seoDescription: row.description?.slice(0, 320) ?? row.tagline ?? null,
    };
  }
);

export async function getAllProductSlugs(): Promise<string[]> {
  const rows = await prisma.product.findMany({
    where: { isPublished: true },
    select: { slug: true },
  });
  return rows.map((r) => r.slug);
}

/** Distinct catalog sections with a live product count, for the index page. */
export const getProductCategories = cache(
  async (): Promise<{ category: string; count: number }[]> => {
    const rows = await prisma.product.groupBy({
      by: ["category"],
      where: { isPublished: true },
      _count: { _all: true },
      orderBy: { category: "asc" },
    });
    return rows.map((r) => ({ category: r.category, count: r._count._all }));
  }
);
