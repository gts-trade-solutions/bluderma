/**
 * What a practice earned, what it spent, and how far a machine has paid for
 * itself.
 *
 * Pure arithmetic, kept out of the query module so a verification script can
 * reach it: anything wrapped in React's cache() cannot be imported under tsx.
 *
 * ── The one accounting decision everything else follows from ─────────────
 * Running costs and capital purchases are NOT added together. Subtracting a
 * ₹5,00,000 laser from one month's takings shows a catastrophic month for a
 * purchase that earns out over years, and a practitioner reading that would
 * draw exactly the wrong conclusion.
 *
 * So "net" here means takings minus RUNNING costs, and it says so on the
 * screen. A machine is tracked separately as something being recovered, which
 * is the question a practitioner actually has about it.
 */

export interface ExpenseRow {
  category: string;
  amountInr: number;
}

export interface AssetRow {
  id: string;
  name: string;
  purpose: string | null;
  costInr: number;
  upkeepInr: number;
  purchasedOn: Date;
  uses: { chargedInr: number; usedOn: Date }[];
}

export interface Recovery {
  id: string;
  name: string;
  purpose: string | null;
  /** Purchase price plus upkeep: what actually has to come back. */
  outlayInr: number;
  recoveredInr: number;
  remainingInr: number;
  useCount: number;
  /** Mean charge across recorded uses. Null with nothing to average. */
  averageChargeInr: number | null;
  /** 0-1. Capped at 1: a machine cannot be 130% recovered. */
  progress: number;
  /** Uses still needed at the current average, or null when unknowable. */
  usesToBreakEven: number | null;
  /** Months since purchase, at least 1, for a per-month reading. */
  monthsOwned: number;
  /** What it has brought in per month so far. */
  perMonthInr: number;
  /** One sentence a practitioner can act on. */
  guidance: string;
}

const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/**
 * How far one machine has paid for itself.
 *
 * `usesToBreakEven` is deliberately null rather than a large number when there
 * is nothing to average or the average is zero. Dividing by an average of nil
 * yields Infinity, and printing "Infinity more uses" is worse than admitting
 * the question cannot be answered yet.
 */
export function recoveryFor(asset: AssetRow, now: Date): Recovery {
  const outlayInr = asset.costInr + asset.upkeepInr;
  const recoveredInr = asset.uses.reduce((n, u) => n + Math.max(u.chargedInr, 0), 0);
  const remainingInr = Math.max(outlayInr - recoveredInr, 0);

  const useCount = asset.uses.length;
  // Averaged over uses that were actually charged for. A touch-up included in
  // a course still wears the machine but tells you nothing about its earning
  // rate, and counting it drags the average toward zero.
  const charged = asset.uses.filter((u) => u.chargedInr > 0);
  const averageChargeInr = charged.length
    ? Math.round(charged.reduce((n, u) => n + u.chargedInr, 0) / charged.length)
    : null;

  const progress = outlayInr > 0 ? Math.min(recoveredInr / outlayInr, 1) : 1;

  const usesToBreakEven =
    remainingInr > 0 && averageChargeInr && averageChargeInr > 0
      ? Math.ceil(remainingInr / averageChargeInr)
      : remainingInr === 0
        ? 0
        : null;

  const ms = Math.max(now.getTime() - asset.purchasedOn.getTime(), 0);
  const monthsOwned = Math.max(Math.round(ms / (1000 * 60 * 60 * 24 * 30.44)), 1);
  const perMonthInr = Math.round(recoveredInr / monthsOwned);

  return {
    id: asset.id,
    name: asset.name,
    purpose: asset.purpose,
    outlayInr,
    recoveredInr,
    remainingInr,
    useCount,
    averageChargeInr,
    progress,
    usesToBreakEven,
    monthsOwned,
    perMonthInr,
    guidance: guidanceFor({
      name: asset.name,
      outlayInr,
      recoveredInr,
      remainingInr,
      useCount,
      averageChargeInr,
      usesToBreakEven,
      monthsOwned,
      perMonthInr,
    }),
  };
}

/**
 * The sentence under the chart.
 *
 * Every number in it is one already computed above, never an extrapolation
 * beyond "at this rate". The months-to-go line is the one place a projection
 * appears and it says what it assumes, because a practitioner deciding whether
 * to buy a second machine deserves to know the difference between a measured
 * figure and a continuation of one.
 */
function guidanceFor(r: {
  name: string;
  outlayInr: number;
  recoveredInr: number;
  remainingInr: number;
  useCount: number;
  averageChargeInr: number | null;
  usesToBreakEven: number | null;
  monthsOwned: number;
  perMonthInr: number;
}): string {
  if (r.useCount === 0) {
    return `No uses recorded yet. Add one each time you use the ${r.name} and this will show how much of the ${money(r.outlayInr)} it has earned back.`;
  }

  if (r.remainingInr === 0) {
    return `Paid for itself. Everything the ${r.name} earns from here is on top of the ${money(r.outlayInr)} it cost.`;
  }

  const head = `${money(r.recoveredInr)} of ${money(r.outlayInr)} recovered over ${r.useCount} use${r.useCount === 1 ? "" : "s"}. ${money(r.remainingInr)} to go.`;

  if (r.usesToBreakEven === null) {
    return `${head} Nothing has been charged for yet, so there is no rate to work from.`;
  }

  const uses = `About ${r.usesToBreakEven} more at your average of ${money(r.averageChargeInr ?? 0)}.`;

  // Only worth saying once there is enough history for a rate to mean
  // anything. One month of data extrapolated to a date is a guess with a
  // decimal point on it.
  if (r.monthsOwned >= 2 && r.perMonthInr > 0) {
    const months = Math.ceil(r.remainingInr / r.perMonthInr);
    return `${head} ${uses} At ${money(r.perMonthInr)} a month so far, that is roughly ${months} month${months === 1 ? "" : "s"} if it carries on the same way.`;
  }
  return `${head} ${uses}`;
}

export interface NetSummary {
  takingsInr: number;
  runningCostInr: number;
  netInr: number;
  /** Running costs as a share of takings. Null when nothing was taken. */
  costRatio: number | null;
  byCategory: { category: string; amountInr: number }[];
}

/**
 * Takings minus running costs for a period.
 *
 * `takingsInr` is passed in rather than computed here: the dashboard already
 * has one definition of what a booking is worth, and a second one in this file
 * would eventually disagree with it. One source, two readers.
 */
export function netFor(takingsInr: number, expenses: ExpenseRow[]): NetSummary {
  const runningCostInr = expenses.reduce((n, e) => n + Math.max(e.amountInr, 0), 0);

  const totals = new Map<string, number>();
  for (const e of expenses) {
    totals.set(e.category, (totals.get(e.category) ?? 0) + Math.max(e.amountInr, 0));
  }

  return {
    takingsInr,
    runningCostInr,
    netInr: takingsInr - runningCostInr,
    costRatio: takingsInr > 0 ? runningCostInr / takingsInr : null,
    byCategory: [...totals.entries()]
      .map(([category, amountInr]) => ({ category, amountInr }))
      .sort((a, b) => b.amountInr - a.amountInr),
  };
}

/** "Consumables" from CONSUMABLES, for a screen rather than a database. */
export function categoryLabel(key: string): string {
  const words = key.toLowerCase().replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
