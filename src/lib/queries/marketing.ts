import { cache } from "react";

import { prisma } from "@/lib/prisma";
import type { HubConcern, HubDeal, HubPromo } from "@/data/hub";
import {
  HOT_DEALS,
  HUB_CONCERNS,
  HUB_PROMOS,
  REGULAR_DEALS,
} from "@/data/hub";

/**
 * The marketing rails, from the database, in the shapes the hub already
 * renders — so the page did not change when the content became editable.
 *
 * Every query filters on the live window, which is the point: an offer that
 * ended on Sunday stops appearing on Monday without anyone remembering to
 * take it down. Empty tables fall back to the shipped content, so a fresh
 * database still renders a complete hub.
 */

/** Live now: active, started, and not yet ended. */
function liveWindow(now: Date) {
  return {
    isActive: true,
    AND: [
      { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
      { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
    ],
  };
}

export const getHubDeals = cache(
  async (): Promise<{ hot: HubDeal[]; regular: HubDeal[] }> => {
    const rows = await prisma.hubDeal.findMany({
      where: liveWindow(new Date()),
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });

    // No fallback to the static HOT_DEALS / REGULAR_DEALS arrays.
    //
    // Those carried invented enquiry counts and a hardcoded "ends Today", so a
    // fresh deploy advertised expiring discounts nobody had created. An empty
    // deals rail is the correct rendering of "there are no deals"; the rails
    // hide themselves when the list is empty.
    if (rows.length === 0) {
      return { hot: [], regular: [] };
    }

    const mapped: HubDeal[] = rows.map((d) => ({
      slug: d.slug,
      title: d.title,
      treatment: d.treatment,
      categorySlug: d.categorySlug,
      categoryLabel: d.categoryLabel,
      image: d.image,
      discount: d.discount,
      perk: d.perk,
      claimed: d.claimed,
      endsIn: d.endsIn,
      hot: d.isHot,
    }));

    return {
      hot: mapped.filter((d) => d.hot),
      regular: mapped.filter((d) => !d.hot),
    };
  }
);

export const getHubPromos = cache(async (): Promise<HubPromo[]> => {
  const rows = await prisma.hubPromo.findMany({
    where: liveWindow(new Date()),
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  if (rows.length === 0) return HUB_PROMOS;

  return rows.map((p) => ({
    slug: p.slug,
    eyebrow: p.eyebrow,
    title: p.title,
    body: p.body,
    image: p.image,
    cta: p.cta,
    href: p.href,
  }));
});

export const getHubConcerns = cache(async (): Promise<HubConcern[]> => {
  const rows = await prisma.hubConcern.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  if (rows.length === 0) return HUB_CONCERNS;

  return rows.map((c) => ({
    slug: c.slug,
    label: c.label,
    hint: c.hint,
    image: c.image,
    category: c.category,
  }));
});
