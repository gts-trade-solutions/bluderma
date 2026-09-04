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
  /** SALARY rows only, and only when the practitioner broke it down. */
  headcount?: number | null;
}

export interface AssetRow {
  id: string;
  publicId?: string | null;
  name: string;
  purpose: string | null;
  costInr: number;
  upkeepInr: number;
  purchasedOn: Date;
  uses: { chargedInr: number; usedOn: Date }[];
}

export interface Recovery {
  id: string;
  publicId?: string | null;
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
    publicId: asset.publicId ?? null,
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

/* ------------------------------ Revenue ---------------------------------- */

/**
 * Where the month's money came from.
 *
 * -- The problem this replaces -------------------------------------------
 * "Revenue" was appointments and nothing else. Three other streams were
 * already sitting in the database, fully recorded, and never once added up:
 *
 *   * medicine sales, on MedicineOrder;
 *   * procedure charges, on AssetUsage, which the equipment section was
 *     already reading to compute machine payback;
 *   * anything else, which had nowhere to live at all.
 *
 * So a practice selling ten thousand rupees of retail a month saw none of it,
 * and the net-profit figure underneath was takings-minus-costs where the
 * takings were missing three quarters of the question. Worse, the costs were
 * complete — so recording your expenses properly made the practice look less
 * profitable than it was.
 *
 * -- The one rule that keeps it honest ------------------------------------
 * Each rupee is counted in exactly one stream. A laser session charge belongs
 * on AssetUsage; putting the same amount in the consultation fee as well
 * counts it twice, and a revenue figure that is quietly too high is worse than
 * one that is honestly too low. The entry forms say so, and `overlapWarning`
 * below is what the screen uses to say it again when the numbers look like it
 * has happened.
 */
export type RevenueStreamKey =
  | "BOOKINGS"
  | "MEDICINES"
  | "PROCEDURES"
  | "OTHER";

export interface RevenueStream {
  key: RevenueStreamKey;
  label: string;
  /** One line saying exactly what is counted, and what is not. */
  basis: string;
  amountInr: number;
  /** How many things make it up — visits, orders, uses, entries. */
  count: number;
  /** Share of total revenue, 0-1. Zero when there is no revenue. */
  share: number;
}

export interface RevenueSummary {
  totalInr: number;
  streams: RevenueStream[];
  /**
   * Set when procedure charges look like they may also be inside the
   * consultation fees. Never asserted as fact — it cannot be known from here,
   * only suspected, and the wording says so.
   */
  overlapWarning: string | null;
}

export interface RevenueInput {
  /** feeAtBooking + visitFee, cancellations excluded. */
  bookingsInr: number;
  bookingCount: number;
  /** Order totals, cancelled orders excluded. */
  medicinesInr: number;
  medicineOrderCount: number;
  /** AssetUsage.chargedInr in the window. */
  proceduresInr: number;
  procedureCount: number;
  /** PracticeIncome in the window. */
  otherInr: number;
  otherCount: number;
}

export function revenueFor(input: RevenueInput): RevenueSummary {
  const rows: Omit<RevenueStream, "share">[] = [
    {
      key: "BOOKINGS",
      label: "Bookings",
      basis:
        "Consultation and visit fees clients agreed to pay. Cancellations and no-shows are not in it.",
      amountInr: Math.max(input.bookingsInr, 0),
      count: input.bookingCount,
    },
    {
      key: "MEDICINES",
      label: "Medicine sales",
      basis:
        "Orders placed against your dispensary. Cancelled orders are not in it. What the stock cost you is a running cost, not a deduction here.",
      amountInr: Math.max(input.medicinesInr, 0),
      count: input.medicineOrderCount,
    },
    {
      key: "PROCEDURES",
      label: "Equipment and procedures",
      basis:
        "What you charged for each machine use you recorded. Separate from the consultation fee — record a charge in one place, not both.",
      amountInr: Math.max(input.proceduresInr, 0),
      count: input.procedureCount,
    },
    {
      key: "OTHER",
      label: "Other income",
      basis:
        "Retail, packages, room rental, professional work. Anything that is not one of the three above.",
      amountInr: Math.max(input.otherInr, 0),
      count: input.otherCount,
    },
  ];

  const totalInr = rows.reduce((n, r) => n + r.amountInr, 0);

  // Procedure charges materially bigger than the whole booking line usually
  // means the same money has been entered twice. "Usually" is doing real work
  // in that sentence, which is why this is a question and not a correction: a
  // practice running mostly on laser courses with a waived consultation fee is
  // a real practice, and its figures look exactly like this.
  const proc = rows.find((r) => r.key === "PROCEDURES")!.amountInr;
  const book = rows.find((r) => r.key === "BOOKINGS")!.amountInr;
  const overlapWarning =
    proc > 0 && book > 0 && proc > book * 1.5
      ? "Equipment charges are running well ahead of consultation fees. That is normal for a laser-led practice, but it also looks the way it does when a procedure charge has been entered both against the machine and inside the visit fee. Worth a check: each amount should appear in one place only."
      : null;

  return {
    totalInr,
    streams: rows.map((r) => ({
      ...r,
      share: totalInr > 0 ? r.amountInr / totalInr : 0,
    })),
    overlapWarning,
  };
}

/* -------------------------------- Costs ---------------------------------- */

/**
 * The four groups a practitioner actually thinks in.
 *
 * The enum has ten categories and a P&L has about four lines. Grouping happens
 * here rather than in the enum because the two jobs are different: the enum
 * has to be fine enough to answer "why did the electricity bill jump", and the
 * screen has to be coarse enough to be read in one glance. Merging them in the
 * database would win the second and lose the first permanently.
 */
export type CostGroupKey =
  | "INFRASTRUCTURE"
  | "PEOPLE"
  | "SUPPLIES"
  | "OTHER";

const COST_GROUP_OF: Record<string, CostGroupKey> = {
  RENT: "INFRASTRUCTURE",
  UTILITIES: "INFRASTRUCTURE",
  LAUNDRY: "INFRASTRUCTURE",
  MAINTENANCE: "INFRASTRUCTURE",
  SALARY: "PEOPLE",
  CONSUMABLES: "SUPPLIES",
  MEDICINES: "SUPPLIES",
  MARKETING: "OTHER",
  TAX: "OTHER",
  OTHER: "OTHER",
};

export const COST_GROUP_LABEL: Record<CostGroupKey, string> = {
  INFRASTRUCTURE: "Infrastructure",
  PEOPLE: "People",
  SUPPLIES: "Supplies",
  OTHER: "Everything else",
};

export const COST_GROUP_BASIS: Record<CostGroupKey, string> = {
  INFRASTRUCTURE: "Rent, utilities, laundry and upkeep — the building.",
  PEOPLE: "Salaries and everything that goes with employing somebody.",
  SUPPLIES: "Consumables you use, and dispensary stock you bought to sell.",
  OTHER: "Marketing, tax and anything that fits nowhere else.",
};

export function costGroupOf(category: string): CostGroupKey {
  return COST_GROUP_OF[category] ?? "OTHER";
}

export interface CostGroup {
  key: CostGroupKey;
  label: string;
  basis: string;
  amountInr: number;
  share: number;
  /** The enum categories inside it, largest first. */
  categories: { category: string; amountInr: number }[];
  /**
   * People only: how many staff the salary rows account for.
   *
   * Null when no salary row was broken down, which is different from zero.
   * "₹1,42,000 on salaries" is a number nobody can act on; "across 6 people"
   * invites the comparison with what those six are billing.
   */
  headcount: number | null;
}

export interface NetSummary {
  takingsInr: number;
  runningCostInr: number;
  netInr: number;
  /** Running costs as a share of takings. Null when nothing was taken. */
  costRatio: number | null;
  /**
   * Net as a share of revenue — the margin.
   *
   * A separate figure from costRatio rather than one minus it, because the
   * two answer different questions and a practitioner asks the second one:
   * "costs are 62% of takings" is a bookkeeping fact, "you keep 38p in the
   * rupee" is the thing to act on. Negative when the month ran at a loss,
   * which is exactly when it most needs saying. Null when nothing was taken,
   * since a margin on no revenue is not zero, it is undefined.
   */
  profitRatio: number | null;
  byCategory: { category: string; amountInr: number }[];
  /** The same costs, in the four lines a practitioner reads. */
  groups: CostGroup[];
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

  const netInr = takingsInr - runningCostInr;

  const byCategory = [...totals.entries()]
    .map(([category, amountInr]) => ({ category, amountInr }))
    .sort((a, b) => b.amountInr - a.amountInr);

  // ── The four groups ─────────────────────────────────────────────────
  const grouped = new Map<CostGroupKey, { category: string; amountInr: number }[]>();
  for (const row of byCategory) {
    const key = costGroupOf(row.category);
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }

  // Headcount is summed only across rows that stated one. A practice with two
  // salary entries, one saying "4 people" and one saying nothing, reports 4
  // and not 4-or-more-we-cannot-say — the screen prints "at least".
  const stated = expenses.filter(
    (e) => e.category === "SALARY" && typeof e.headcount === "number" && e.headcount > 0
  );
  const headcount = stated.length
    ? stated.reduce((n, e) => n + (e.headcount ?? 0), 0)
    : null;

  const groups: CostGroup[] = (
    ["INFRASTRUCTURE", "PEOPLE", "SUPPLIES", "OTHER"] as CostGroupKey[]
  )
    .map((key) => {
      const categories = grouped.get(key) ?? [];
      const amountInr = categories.reduce((n, c) => n + c.amountInr, 0);
      return {
        key,
        label: COST_GROUP_LABEL[key],
        basis: COST_GROUP_BASIS[key],
        amountInr,
        share: runningCostInr > 0 ? amountInr / runningCostInr : 0,
        categories,
        headcount: key === "PEOPLE" ? headcount : null,
      };
    })
    .filter((g) => g.amountInr > 0);

  return {
    takingsInr,
    runningCostInr,
    netInr,
    costRatio: takingsInr > 0 ? runningCostInr / takingsInr : null,
    profitRatio: takingsInr > 0 ? netInr / takingsInr : null,
    byCategory,
    groups,
  };
}

/**
 * "Consumables" from CONSUMABLES, for a screen rather than a database.
 *
 * OTHER is spelled out rather than title-cased, because "Other" beside three
 * named categories reads as a gap in the list and "Miscellaneous" reads as a
 * decision. The database keeps OTHER: renaming live rows to change a word on
 * a screen is a migration that can go wrong for nothing.
 */
const CATEGORY_LABEL_OVERRIDE: Record<string, string> = {
  OTHER: "Miscellaneous",
  MEDICINES: "Dispensary stock",
  TAX: "Tax and statutory",
};

export function categoryLabel(key: string): string {
  const override = CATEGORY_LABEL_OVERRIDE[key];
  if (override) return override;
  const words = key.toLowerCase().replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/* ---------------------------- Equipment status --------------------------- */

/**
 * How a machine is doing, as a colour.
 *
 * ── Why a colour at all ──────────────────────────────────────────────────
 * The equipment list already carried every fact — outlay, recovered,
 * remaining, uses, a per-month rate and a sentence — and a practitioner with
 * six machines still could not answer "which one is not earning its keep"
 * without reading six paragraphs. That question is the reason the section
 * exists, and it was the one thing the section could not answer at a glance.
 *
 * ── Why it is NOT profit ─────────────────────────────────────────────────
 * A machine that has recovered 40% of its cost is not "40% profitable" — it
 * depends entirely on how long it has been owned. A laser bought last month
 * at 12% recovered is doing well; the same figure after four years is a
 * write-off. So the tier is computed from the RATE of recovery against how
 * long it has been owned, not from the raw percentage, and a machine too new
 * to judge is told apart from one that is doing badly rather than being
 * flattered or condemned by the same number.
 */
export type MachineTier = "EARNING" | "ON_TRACK" | "SLOW" | "STALLED" | "NEW";

export interface MachineStatus {
  tier: MachineTier;
  label: string;
  /** Tailwind colour key. Full literal strings live at the call site. */
  tone: "blue" | "teal" | "amber" | "rose" | "slate";
  /** One line a practitioner can act on. */
  meaning: string;
}

/**
 * Months a machine is given before its rate is judged.
 *
 * Two is not arbitrary: `guidanceFor` already refuses to project a payback
 * date below two months owned, on the grounds that one month of data
 * extrapolated is a guess with a decimal point on it. The same threshold, for
 * the same reason.
 */
const GRACE_MONTHS = 2;

/**
 * The pace that counts as on track: recovering the outlay inside three years.
 *
 * A number worth stating rather than tuning quietly. Aesthetic equipment is
 * generally financed or depreciated over three to five years, so a machine
 * recovering its cost in under three is comfortably ahead and one that will
 * take more than six is not paying for itself in any meaningful sense.
 */
const TARGET_MONTHS = 36;

export function machineStatus(r: Recovery): MachineStatus {
  if (r.remainingInr === 0) {
    return {
      tier: "EARNING",
      label: "Paid for itself",
      tone: "blue",
      meaning: `Everything the ${r.name} earns from here is on top of what it cost.`,
    };
  }

  if (r.useCount === 0 || r.monthsOwned < GRACE_MONTHS) {
    return {
      tier: "NEW",
      label: "Too early to say",
      tone: "slate",
      meaning:
        r.useCount === 0
          ? "No uses recorded yet. Log each one and this starts telling you something."
          : "Owned less than two months. A rate from this little history is a guess.",
    };
  }

  if (r.perMonthInr <= 0) {
    return {
      tier: "STALLED",
      label: "Not earning",
      tone: "rose",
      meaning: `Nothing has been charged for on the ${r.name} in the time you have owned it. Either it is not being used, or its uses are not being recorded.`,
    };
  }

  // Months to recover what is left, at the pace it has actually run.
  const monthsToGo = Math.ceil(r.remainingInr / r.perMonthInr);
  const totalMonths = r.monthsOwned + monthsToGo;

  if (totalMonths <= TARGET_MONTHS * 0.6) {
    return {
      tier: "EARNING",
      label: "Earning well",
      tone: "blue",
      meaning: `On track to pay for itself in about ${totalMonths} months from purchase — comfortably ahead of the three years this kind of equipment is usually written down over.`,
    };
  }
  if (totalMonths <= TARGET_MONTHS) {
    return {
      tier: "ON_TRACK",
      label: "On track",
      tone: "teal",
      meaning: `About ${monthsToGo} more months at the current rate, which puts it inside the usual three-year window.`,
    };
  }
  if (totalMonths <= TARGET_MONTHS * 2) {
    return {
      tier: "SLOW",
      label: "Slow to recover",
      tone: "amber",
      meaning: `At this rate it takes about ${totalMonths} months from purchase to break even. More uses, or a higher charge per use, is what changes that.`,
    };
  }
  return {
    tier: "STALLED",
    label: "Not paying its way",
    tone: "rose",
    meaning: `At the current rate the ${r.name} would take over ${Math.round(totalMonths / 12)} years to earn back what it cost. Worth deciding whether to push it or let it go.`,
  };
}

/** Every tier, for the legend. Ordered best to worst, with NEW last. */
export const MACHINE_TIERS: { tier: MachineTier; label: string; tone: MachineStatus["tone"] }[] = [
  { tier: "EARNING", label: "Earning well", tone: "blue" },
  { tier: "ON_TRACK", label: "On track", tone: "teal" },
  { tier: "SLOW", label: "Slow", tone: "amber" },
  { tier: "STALLED", label: "Not paying its way", tone: "rose" },
  { tier: "NEW", label: "Too early to say", tone: "slate" },
];

/* ═══════════════════════════════════════════════════════════════════════
   Which clinic is actually carrying the practice
   ═══════════════════════════════════════════════════════════════════════

   A doctor working three locations has one revenue figure and no idea which
   of the three produced it. That is the wrong shape of answer for almost
   every decision they make with it: which day to give the extra session to,
   which rent is defensible, which location to drop.

   ── What can honestly be split, and what cannot ────────────────────────
   Bookings, machine charges, other income and running costs all carry a
   clinic on the row, so they split exactly. The dispensary does not — a
   medicine order belongs to the practice, not to a room — and there is no
   defensible way to invent one. Guessing (splitting it evenly, or by booking
   share) would produce a number that looks attributed and is not, and the
   whole point of this table is deciding things with it.

   So dispensary income is reported OUTSIDE the split, named, with its
   amount. A doctor comparing two clinics can see what is in the comparison
   and what is deliberately not.

   ── Why rank rather than just list ─────────────────────────────────────
   Three numbers in a column is a table. What was asked for is the ordering,
   because the ordering is the finding: the point is to see at a glance which
   location earns most and which is quietly costing money.
   ═══════════════════════════════════════════════════════════════════════ */

export type ClinicTier = "LEADING" | "STRONG" | "STEADY" | "QUIET" | "LOSING";

export interface ClinicTierMeta {
  label: string;
  /** Tailwind colour key. Blue is best, matching the machine tiers. */
  tone: "blue" | "teal" | "amber" | "rose" | "slate";
}

export const CLINIC_TIERS: Record<ClinicTier, ClinicTierMeta> = {
  LEADING: { label: "Earns most", tone: "blue" },
  STRONG: { label: "Close behind", tone: "teal" },
  STEADY: { label: "Steady", tone: "amber" },
  QUIET: { label: "Quiet", tone: "slate" },
  LOSING: { label: "Costs more than it earns", tone: "rose" },
};

/** One clinic's month, in the four streams that carry a location. */
export interface ClinicPerfRow {
  clinicId: string;
  name: string;
  /** 1 is the highest revenue. Ties keep their input order. */
  rank: number;
  bookingsInr: number;
  bookingCount: number;
  proceduresInr: number;
  procedureCount: number;
  otherInr: number;
  /** The three above, added up. */
  revenueInr: number;
  /** Running costs booked to this clinic. Capital is not in it. */
  costsInr: number;
  netInr: number;
  /** Net as a share of revenue. Null when there is no revenue to divide by. */
  marginPct: number | null;
  /** This clinic's share of all ATTRIBUTED revenue, 0-1. */
  sharePct: number;
  /** Share of the leader's revenue, 0-1. What the tier is judged on. */
  ofLeaderPct: number;
  tier: ClinicTier;
  meaning: string;
}

export interface ClinicPerfInput {
  clinics: { id: string; name: string }[];
  bookings: { clinicId: string | null; amountInr: number }[];
  procedures: { clinicId: string | null; amountInr: number }[];
  otherIncome: { clinicId: string | null; amountInr: number }[];
  expenses: { clinicId: string | null; amountInr: number }[];
  /** Practice-wide income that cannot be split. Reported, never divided. */
  unattributableInr?: number;
}

export interface ClinicPerfSummary {
  rows: ClinicPerfRow[];
  /** Revenue that carried a clinic and is in the table. */
  attributedInr: number;
  /** Revenue on rows with no clinic set — recorded, but not placed. */
  unplacedInr: number;
  /** The dispensary. Practice-wide by nature, not a gap in the data. */
  unattributableInr: number;
  /** Running costs on rows with no clinic set. */
  unplacedCostsInr: number;
  /** True when ranking says nothing, because there is nothing to rank against. */
  singleClinic: boolean;
}

/** A clinic earning at least this much of the leader is "close behind". */
const STRONG_OF_LEADER = 0.6;
/** Below this share of the leader a clinic is quiet rather than steady. */
const STEADY_OF_LEADER = 0.25;

function sumFor(
  rows: { clinicId: string | null; amountInr: number }[],
  clinicId: string
): { total: number; count: number } {
  let total = 0;
  let count = 0;
  for (const r of rows) {
    if (r.clinicId !== clinicId) continue;
    total += Math.max(r.amountInr, 0);
    count += 1;
  }
  return { total, count };
}

function unplaced(rows: { clinicId: string | null; amountInr: number }[]): number {
  return rows.reduce((n, r) => (r.clinicId ? n : n + Math.max(r.amountInr, 0)), 0);
}

export function clinicPerformanceFor(input: ClinicPerfInput): ClinicPerfSummary {
  const bare = input.clinics.map((c) => {
    const b = sumFor(input.bookings, c.id);
    const p = sumFor(input.procedures, c.id);
    const o = sumFor(input.otherIncome, c.id);
    const e = sumFor(input.expenses, c.id);
    const revenueInr = b.total + p.total + o.total;
    return {
      clinicId: c.id,
      name: c.name,
      bookingsInr: b.total,
      bookingCount: b.count,
      proceduresInr: p.total,
      procedureCount: p.count,
      otherInr: o.total,
      revenueInr,
      costsInr: e.total,
      netInr: revenueInr - e.total,
    };
  });

  // Highest revenue first. A stable sort keeps ties in their input order
  // rather than shuffling two equal clinics on every page load.
  const ordered = [...bare].sort((a, b) => b.revenueInr - a.revenueInr);
  const leader = ordered[0]?.revenueInr ?? 0;
  const attributedInr = ordered.reduce((n, r) => n + r.revenueInr, 0);

  const rows: ClinicPerfRow[] = ordered.map((r, i) => {
    const ofLeaderPct = leader > 0 ? r.revenueInr / leader : 0;
    const marginPct = r.revenueInr > 0 ? r.netInr / r.revenueInr : null;
    const sharePct = attributedInr > 0 ? r.revenueInr / attributedInr : 0;

    // Losing money outranks placing well. A clinic can be second by revenue
    // and still be the one to look at, and saying "close behind" about
    // something running at a loss is the table lying politely.
    let tier: ClinicTier;
    if (r.netInr < 0) tier = "LOSING";
    else if (i === 0 && r.revenueInr > 0) tier = "LEADING";
    else if (ofLeaderPct >= STRONG_OF_LEADER) tier = "STRONG";
    else if (ofLeaderPct >= STEADY_OF_LEADER) tier = "STEADY";
    else tier = "QUIET";

    const meaning =
      tier === "LOSING"
        ? `Running costs here are ${inr(r.costsInr - r.revenueInr)} more than it brought in this month.`
        : tier === "LEADING"
        ? r.revenueInr === 0
          ? "Nothing recorded at any location this month."
          : `${pctText(sharePct)} of everything you can place by location.`
        : tier === "STRONG"
        ? `Within reach of ${ordered[0].name} — ${pctText(ofLeaderPct)} of what it earns.`
        : tier === "STEADY"
        ? `${pctText(ofLeaderPct)} of what ${ordered[0].name} earns.`
        : r.revenueInr === 0
        ? "Nothing recorded here this month."
        : `Well behind ${ordered[0].name}, at ${pctText(ofLeaderPct)} of its takings.`;

    return {
      ...r,
      rank: i + 1,
      marginPct,
      sharePct,
      ofLeaderPct,
      tier,
      meaning,
    };
  });

  return {
    rows,
    attributedInr,
    unplacedInr:
      unplaced(input.bookings) + unplaced(input.procedures) + unplaced(input.otherIncome),
    unattributableInr: Math.max(input.unattributableInr ?? 0, 0),
    unplacedCostsInr: unplaced(input.expenses),
    singleClinic: input.clinics.length < 2,
  };
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const pctText = (n: number) => `${Math.round(n * 100)}%`;
