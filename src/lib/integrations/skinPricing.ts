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
  /** What each subsequent analysis costs, in whole rupees. */
  priceInr: number;
  /** Whether clients may ask staff for a free scan. */
  allowRequests: boolean;
}

const DEFAULTS: ScanPricing = {
  firstScanFree: true,
  priceInr: 499,
  allowRequests: true,
};

const KEYS = {
  firstScanFree: "skin.first_scan_free",
  priceInr: "skin.scan_price_inr",
  allowRequests: "skin.allow_access_requests",
} as const;

export const getScanPricing = cache(async (): Promise<ScanPricing> => {
  const rows = await prisma.siteSetting.findMany({
    where: { key: { in: Object.values(KEYS) } },
    select: { key: true, value: true },
  });
  const map = new Map(rows.map((r) => [r.key, (r.value ?? "").trim()]));

  const price = Number(map.get(KEYS.priceInr));

  return {
    firstScanFree: map.get(KEYS.firstScanFree) !== "false",
    priceInr: Number.isFinite(price) && price >= 0 ? Math.round(price) : DEFAULTS.priceInr,
    allowRequests: map.get(KEYS.allowRequests) !== "false",
  };
});

export interface ScanOffer {
  /** True when this client can start a scan without paying. */
  free: boolean;
  /** What they would pay, if they are not entitled to a free one. */
  priceInr: number;
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
    creditsAvailable,
    scansUsed,
    allowRequests: pricing.allowRequests,
  };
}
