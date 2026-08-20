import { createHash } from "node:crypto";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { clinicWallClock } from "@/lib/queries/availability";
import { generateInsights } from "@/lib/integrations/insights";
import type { InsightItem, InsightMetrics } from "@/lib/integrations/insightsCore";
import type { DashboardMetrics, DashboardPeriod } from "./metrics";

/**
 * One set of practice pointers per doctor per day.
 *
 * The metrics behind the dashboard are recomputed on every load — they are
 * cheap and they should be current. The prose written *about* them is the only
 * paid call in the product, so it is generated once a day and stored.
 *
 * Keyed on the clinic wall-clock day, not UTC: 19:00Z is already tomorrow in
 * Chennai, and a UTC key would roll the cache over at half past five in the
 * morning, mid-clinic. The selected window is part of the key too — see
 * dateKeyNow.
 */

export interface CachedInsights {
  items: InsightItem[];
  source: "ai" | "template";
  dateKey: string;
}

/** Reduces the full dashboard to the figures the writer is allowed to quote. */
export function toInsightMetrics(m: DashboardMetrics): InsightMetrics {
  const top = m.demand.find((d) => d.key !== "__none") ?? null;
  return {
    periodBooked: m.periodBooked,
    projected: m.projected,
    averageValue: m.averageValue,
    realised: m.revenue.realised,
    unresolved: m.revenue.unresolved,
    lostCount: Math.round(m.revenue.lost),
    awaiting: m.appointments.awaiting,
    daysLeft: Math.max(m.daysInPeriod - m.daysElapsed, 0),
    emptiestDay: m.utilisation.emptiest?.label ?? null,
    emptiestFree: m.utilisation.emptiest?.free ?? 0,
    weeklyCapacity: m.utilisation.weeklyCapacity,
    topReason: top?.label ?? null,
    topReasonCount: top?.count ?? 0,
    noShowRate: m.ops.noShowRate.value,
    noShowSample: m.ops.noShowRate.sampleSize,
    returningRate: m.patients.returning.value,
    returningSample: m.patients.returning.sampleSize,
    reviewCount: m.reviews.count,
    rating: m.reviews.rating,
    memberShare: m.ops.memberShare.value,
    uplift1: m.uplift[0]?.amount ?? 0,
  };
}

/**
 * The cache key: the clinic's day, and the window the figures came from.
 *
 * The period suffix is not decoration. The strip quotes rupee figures, and
 * every one of them is checked against the metrics it was generated from —
 * serving a set written for August on a page showing July would put numbers
 * on screen that the tripwire never approved for it. `this-month` keeps the
 * bare date so rows written before the period control still resolve.
 */
export function dateKeyNow(period: DashboardPeriod = "this-month"): string {
  const day = clinicWallClock().toISOString().slice(0, 10);
  return period === "this-month" ? day : `${day}:${period}`;
}

function hashOf(m: InsightMetrics): string {
  return createHash("sha256").update(JSON.stringify(m)).digest("hex").slice(0, 32);
}

/**
 * Today's pointers, generated once.
 *
 * A stored row is returned as-is even though the figures will have moved since
 * it was written — the suggestions are about the shape of the practice, not
 * the balance at this second, and regenerating on every load would burn the
 * budget to change "3 slots" to "2 slots".
 */
export async function getDailyInsights(
  doctorId: string,
  metrics: DashboardMetrics
): Promise<CachedInsights> {
  const dateKey = dateKeyNow(metrics.period);
  const slim = toInsightMetrics(metrics);

  const existing = await prisma.doctorDailyInsight
    .findUnique({ where: { doctorId_dateKey: { doctorId, dateKey } } })
    .catch(() => null);

  if (existing) {
    const items = parseItems(existing.items);
    // A row written by an older shape degrades to regenerating rather than
    // rendering nothing.
    if (items.length) {
      return {
        items,
        source: existing.source === "ai" ? "ai" : "template",
        dateKey,
      };
    }
  }

  const generated = await generateInsights(slim);
  // Prisma's Json input type will not take a typed interface array directly.
  const payload = generated.items as unknown as Prisma.InputJsonValue;

  await prisma.doctorDailyInsight
    .upsert({
      // The unique key is what makes two concurrent first-renders idempotent
      // instead of racing to insert.
      where: { doctorId_dateKey: { doctorId, dateKey } },
      create: {
        doctorId,
        dateKey,
        metricsHash: hashOf(slim),
        items: payload,
        source: generated.source,
        model: generated.model,
      },
      update: {
        metricsHash: hashOf(slim),
        items: payload,
        source: generated.source,
        model: generated.model,
      },
    })
    .catch((e) => {
      // A cache miss must never take the dashboard down with it.
      console.error("[insightCache] could not store insights:", e);
    });

  return { items: generated.items, source: generated.source, dateKey };
}

/** Json from the database is unknown until proven otherwise. */
function parseItems(raw: unknown): InsightItem[] {
  if (!Array.isArray(raw)) return [];
  const out: InsightItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const title = (entry as InsightItem).title;
    const body = (entry as InsightItem).body;
    if (typeof title !== "string" || typeof body !== "string") continue;
    if (!title.trim() || !body.trim()) continue;
    out.push({ title: title.trim(), body: body.trim() });
  }
  return out.slice(0, 4);
}
