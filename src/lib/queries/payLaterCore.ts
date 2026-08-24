/**
 * The pay-later rules, with no React and no Prisma in the way.
 *
 * Split out for the reason profileCore.ts exists: `cache()` at module level
 * cannot be imported by a tsx script, so anything wrapped in it is untestable
 * from prisma/verify-*.ts. The rules below are the part worth testing, so they
 * live where a suite can reach them.
 */

export interface PayLaterPlanRow {
  id: string;
  item: string;
  provider: string;
  totalInr: number;
  instalmentInr: number;
  instalmentsPaid: number;
  instalmentsTotal: number;
  nextDueAt: Date | null;
  settledAt: Date | null;
}

export interface PayLaterPlan {
  id: string;
  item: string;
  provider: string;
  totalInr: number;
  paidInr: number;
  instalmentInr: number;
  instalmentsPaid: number;
  instalmentsTotal: number;
  /** Formatted for display, or null when there is nothing more to pay. */
  nextDue: string | null;
  settled: boolean;
}

export interface PayLaterSettings {
  enabled: boolean;
  provider: string;
  limitInr: number;
  interestFreeMonths: number;
}

export const SETTING_KEYS = {
  enabled: "paylater.enabled",
  provider: "paylater.provider",
  limitInr: "paylater.limit_inr",
  interestFreeMonths: "paylater.interest_free_months",
} as const;

export const fmtDue = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/**
 * Read the programme's settings out of raw key/value rows.
 *
 * `enabled` requires BOTH the switch and a named provider. That is the whole
 * lesson of the mock this replaced: it quoted an "approved limit of ₹60,000
 * through BluDerma Care Credit", and the indefensible part was not the figure
 * but that no such lender existed. A limit with nobody behind it must be
 * unreachable by configuration, not merely discouraged.
 */
export function readSettings(rows: { key: string; value: string | null }[]): PayLaterSettings {
  const map = new Map(rows.map((r) => [r.key, (r.value ?? "").trim()]));
  const provider = map.get(SETTING_KEYS.provider) ?? "";
  const num = (k: string) => {
    const n = Number(map.get(k));
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
  };
  return {
    enabled: map.get(SETTING_KEYS.enabled) === "true" && provider.length > 0,
    provider,
    limitInr: num(SETTING_KEYS.limitInr),
    interestFreeMonths: num(SETTING_KEYS.interestFreeMonths),
  };
}

/**
 * One stored agreement, as the page shows it.
 *
 * Two rules carry the honesty here:
 *
 *   - `paidInr` is COUNTED from instalments recorded as paid, never inferred
 *     from how many due dates have gone by. A missed payment must not mark
 *     itself as made simply because time passed.
 *   - a settled plan reports no next due date, so a finished course stops
 *     asking for money without needing a date comparison to notice.
 */
export function toPlan(r: PayLaterPlanRow): PayLaterPlan {
  const settled = Boolean(r.settledAt);
  return {
    id: r.id,
    item: r.item,
    provider: r.provider,
    totalInr: r.totalInr,
    // Capped: a data-entry slip of one instalment too many must not report
    // somebody as having overpaid.
    paidInr: Math.min(Math.max(r.instalmentsPaid, 0) * r.instalmentInr, r.totalInr),
    instalmentInr: r.instalmentInr,
    instalmentsPaid: r.instalmentsPaid,
    instalmentsTotal: r.instalmentsTotal,
    nextDue: settled || !r.nextDueAt ? null : fmtDue(r.nextDueAt),
    settled,
  };
}

/** Committed but not yet paid, across real plans only. */
export function outstanding(plans: PayLaterPlan[]): number {
  return plans.reduce((n, p) => n + Math.max(p.totalInr - p.paidInr, 0), 0);
}
