import type { VisitReason } from "@prisma/client";

import { reasonLabel } from "@/lib/booking/visitIntake";

/**
 * The profile's derivations, with no database and no React in them.
 *
 * Split out for the same reason `aiAssistCore.ts` and `insightsCore.ts` are:
 * `profileData.ts` wraps its query in React's `cache()`, and `cache()` at
 * module level throws the moment a `tsx` script imports the file — so anything
 * in there is unreachable from `prisma/verify-*.ts`. The rules worth proving
 * live here instead.
 *
 * The rule being protected: **a condition is never a diagnosis.** Everything
 * this returns is something the client themselves supplied — a scan they ran,
 * or a reason they picked from a fixed list at booking — and each entry says
 * which. Merging them into one unattributed list would turn the client's own
 * guesswork into something that reads like a clinical record.
 */

export interface ProfileCondition {
  key: string;
  label: string;
  /** Shown under the label. Names the client's own source, in their terms. */
  source: string;
  detail: string;
  /** 0-100, drives the bar only. */
  weight: number;
}

export const SOURCE_SCAN = "From your latest skin analysis";
export const SOURCE_BOOKING = "You told us this at booking";

/**
 * What the client is being seen about.
 *
 * @param scan the newest analysis, or null. Its worst concerns come first.
 *   `createdAt` is `Date | string` because the analysis DTO has already been
 *   serialised for the client boundary by the time this sees it; the date is
 *   only ever passed straight to `formatDate`, never parsed here.
 * @param reasons booking counts per VisitReason, nulls already tolerated.
 * @param formatDate renders the scan's date in the page's own format.
 */
export function buildConditions(
  scan: {
    createdAt: Date | string;
    topConcerns: { label: string; score: number }[];
  } | null,
  reasons: { reason: VisitReason | null; count: number }[],
  formatDate: (d: Date | string) => string
): ProfileCondition[] {
  const out: ProfileCondition[] = [];

  if (scan) {
    for (const c of scan.topConcerns) {
      out.push({
        key: `scan:${c.label}`,
        label: c.label,
        source: SOURCE_SCAN,
        detail: `Scored ${c.score} of 100 on ${formatDate(scan.createdAt)}`,
        // A LOW score is the bigger problem, so the bar reads as severity
        // rather than as the score itself — a 90% bar next to "scored 10"
        // would say the opposite of what it means.
        weight: clamp(100 - c.score),
      });
    }
  }

  // A booking with no reason recorded is not a condition — it predates the
  // intake form and never said what it was about. It is dropped BEFORE the
  // scale is taken, not after: an old client with nine unlabelled visits and
  // four for acne would otherwise see acne drawn at 44% of a bar whose full
  // width belongs to a row that is not on the page.
  const named = reasons.filter((r) => r.reason !== null);

  // The busiest named reason sets the scale. Guarded at 1 so a single booking
  // is a full bar rather than a division by zero.
  const top = Math.max(1, ...named.map((r) => r.count));

  for (const r of named) {
    if (!r.reason) continue;
    out.push({
      key: `reason:${r.reason}`,
      label: reasonLabel(r.reason) ?? r.reason,
      source: SOURCE_BOOKING,
      detail: `${r.count} appointment${r.count === 1 ? "" : "s"}`,
      weight: clamp(Math.round((r.count / top) * 100)),
    });
  }

  return out;
}

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

/** Prisma's `Json` column is `unknown` until proven otherwise. */
export function perksOf(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((p): p is string => typeof p === "string") : [];
}
