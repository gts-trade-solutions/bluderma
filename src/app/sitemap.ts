import type { MetadataRoute } from "next";

import { prisma } from "@/lib/prisma";
import { absolute } from "@/lib/seo";
import { ARTICLES } from "@/data/knowYourself";

/**
 * Every page worth indexing, built from the database rather than a list.
 *
 * The site ships 723 routes and had nothing telling a crawler that any of them
 * existed beyond whatever it could reach by following links. Most of the
 * catalogue is three clicks deep behind a tabbed browser, which is exactly the
 * shape a crawler gives up on.
 *
 * Private and transactional routes are deliberately absent, and they already
 * carry `robots: { index: false }` in their own metadata — this is the second
 * half of the same statement, not a substitute for it.
 *
 * Revalidated hourly: the catalogue is admin-editable and a stale sitemap is
 * worse than a slightly expensive one.
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const stat = (
    path: string,
    priority: number,
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] = "weekly"
  ) => ({ url: absolute(path), lastModified: now, changeFrequency, priority });

  const staticPages: MetadataRoute.Sitemap = [
    stat("/", 1, "daily"),
    stat("/patient/explore", 0.9, "daily"),
    stat("/patient/doctors", 0.9, "daily"),
    stat("/patient/skin-analyzer", 0.9),
    stat("/patient/membership", 0.7),
    stat("/patient/before-after", 0.6),
    stat("/patient/know-yourself", 0.6),
    stat("/patient/rx-skin", 0.6),
    // Public pages that were simply never added. Each is indexable, linked
    // from the footer or the nav, and was reachable by a person and invisible
    // to a crawler — which is the quiet way a page stops existing.
    stat("/patient/gallery", 0.6),
    stat("/patient/gift-cards", 0.5),
    stat("/sell", 0.5),
    stat("/doctor", 0.8),
    stat("/terms", 0.2, "yearly"),
    stat("/privacy", 0.2, "yearly"),
    stat("/precautions", 0.3, "yearly"),
    stat("/client-rights", 0.3, "yearly"),
  ];

  // The catalogue. Failures degrade to the static list rather than taking the
  // whole sitemap down: an empty sitemap is worse than a partial one, because
  // it reads as a positive statement that there is nothing here.
  let catalogue: MetadataRoute.Sitemap = [];
  try {
    const [hubCategories, treatments, products] = await Promise.all([
      prisma.hubCategory.findMany({
        where: { isActive: true },
        select: {
          slug: true,
          updatedAt: true,
          treatments: { select: { slug: true, updatedAt: true } },
        },
      }),
      prisma.treatment.findMany({
        where: { isPublished: true },
        select: { slug: true, updatedAt: true },
      }),
      prisma.product.findMany({
        where: { isPublished: true },
        select: { slug: true, updatedAt: true },
      }),
    ]);

    catalogue = [
      ...hubCategories.flatMap((c) => [
        {
          url: absolute(`/patient/explore/${c.slug}`),
          lastModified: c.updatedAt,
          changeFrequency: "weekly" as const,
          priority: 0.8,
        },
        ...c.treatments.map((t) => ({
          url: absolute(`/patient/explore/${c.slug}/${t.slug}`),
          lastModified: t.updatedAt,
          changeFrequency: "monthly" as const,
          priority: 0.7,
        })),
      ]),
      ...treatments.map((t) => ({
        url: absolute(`/treatments/${t.slug}`),
        lastModified: t.updatedAt,
        changeFrequency: "monthly" as const,
        priority: 0.6,
      })),
      ...products.map((p) => ({
        url: absolute(`/products/${p.slug}`),
        lastModified: p.updatedAt,
        changeFrequency: "monthly" as const,
        priority: 0.5,
      })),
    ];
  } catch (e) {
    console.error("[sitemap] catalogue unavailable:", e);
  }

  const articles: MetadataRoute.Sitemap = ARTICLES.map((a) => ({
    url: absolute(`/patient/know-yourself/${a.slug}`),
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));

  return [...staticPages, ...catalogue, ...articles];
}
