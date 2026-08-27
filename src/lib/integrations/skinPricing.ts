import { cache } from "react";

import { prisma } from "@/lib/prisma";

/**
 * What a skin analysis costs, and when.
 *
 * The commercial shape the clinic asked for: the first scan is free, because
 * it is the thing that gets someone through the door, and every scan after it
 * is paid. Both halves are admin-editable — the free scan can be switched off
 * entirely, and the price changed, without a deploy.
 *
 * "Request access" survives alongside this deliberately. Not everyone who
 * should get a scan can pay for one, and a clinic needs a way to comp it.
 */

export interface ScanPricing {
  /** Whether a client's first analysis is free. */
  firstScanFree: boolean;
  /** What each subsequent analysis costs, in whole rupees. This is the figure
   *  that is CHARGED, so it is the only one a card may quote next to a
   *  buy button. */
  priceInr: number;
  /**
   * The undiscounted figure, shown struck through as the "usually" anchor.
   *
   * This exists because the cards were drawing a strike-through against
   * `priceInr` itself: the same number twice, one of them crossed out, which
   * is a saving of nothing. Worse, two of the three cards had 99 typed into
   * them as a literal while this setting said 499, so the site advertised one
   * price and the checkout charged another.
   *
   * A discount needs two numbers. This is the second one, and where it is not
   * above `priceInr` the strike-through is not drawn at all.
   */
  listPriceInr: number;
  /** Whether clients may ask staff for a free scan. */
  allowRequests: boolean;
}

const DEFAULTS: ScanPricing = {
  firstScanFree: true,
  priceInr: 99,
  // Equal to the charged price, so NO anchor is drawn and 99 is the only
  // figure the site shows. It defaulted to 499, which meant a struck-through
  // 499 appeared beside every price on a product that has never charged it —
  // a "discount" against a number nobody was ever asked to pay.
  //
  // Still admin-editable: set skin.scan_list_price_inr above the charged
  // price and the strike-through comes back everywhere at once.
  listPriceInr: 99,
  allowRequests: true,
};

const KEYS = {
  firstScanFree: "skin.first_scan_free",
  priceInr: "skin.scan_price_inr",
  listPriceInr: "skin.scan_list_price_inr",
  allowRequests: "skin.allow_access_requests",
} as const;

export const getScanPricing = cache(async (): Promise<ScanPricing> => {
  const rows = await prisma.siteSetting.findMany({
    where: { key: { in: Object.values(KEYS) } },
    select: { key: true, value: true },
  });
  const map = new Map(rows.map((r) => [r.key, (r.value ?? "").trim()]));

  const num = (key: string, fallback: number) => {
    const n = Number(map.get(key));
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : fallback;
  };

  const priceInr = num(KEYS.priceInr, DEFAULTS.priceInr);
  const listPriceInr = num(KEYS.listPriceInr, DEFAULTS.listPriceInr);

  return {
    firstScanFree: map.get(KEYS.firstScanFree) !== "false",
    priceInr,
    // An anchor at or below the charged price is not an anchor. Collapsing it
    // to the price here means every card can render the strike-through on one
    // rule (`listPriceInr > priceInr`) rather than each inventing its own.
    listPriceInr: Math.max(listPriceInr, priceInr),
    allowRequests: map.get(KEYS.allowRequests) !== "false",
  };
});

export interface ScanOffer {
  /** True when this client can start a scan without paying. */
  free: boolean;
  /** What they would pay, if they are not entitled to a free one. */
  priceInr: number;
  /** The "usually" anchor. Equal to priceInr when there is no offer running. */
  listPriceInr: number;
  /** Credits they already hold and have not spent. */
  creditsAvailable: number;
  /** Analyses they have already run — what makes the first one "first". */
  scansUsed: number;
  allowRequests: boolean;
}

/**
 * What this specific client is being offered right now.
 *
 * Counts consumed entitlements rather than analyses, because a scan that was
 * reserved and abandoned should not cost someone their free one.
 */
export async function getScanOffer(userId: string): Promise<ScanOffer> {
  const pricing = await getScanPricing();

  const [creditsAvailable, scansUsed] = await Promise.all([
    prisma.skinEntitlement.count({
      where: { userId, state: "available" },
    }),
    prisma.skinEntitlement.count({
      where: { userId, state: "consumed" },
    }),
  ]);

  return {
    // Holding a credit — free, granted or already paid for — means nothing
    // more to pay right now.
    free:
      creditsAvailable > 0 ||
      (pricing.firstScanFree && scansUsed === 0 && creditsAvailable === 0),
    priceInr: pricing.priceInr,
    listPriceInr: pricing.listPriceInr,
    creditsAvailable,
    scansUsed,
    allowRequests: pricing.allowRequests,
  };
}
