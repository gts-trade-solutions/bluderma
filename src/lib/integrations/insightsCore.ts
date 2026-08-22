/**
 * The deterministic practice pointers.
 *
 * Pure, so it can be tested — and load-bearing, because it is what a doctor
 * sees whenever the AI is unconfigured, rate-limited or down. Written to be
 * good enough on its own: every rule fires only when the numbers actually
 * support it, and every sentence quotes a figure the caller supplied.
 *
 * Same split as aiAssistCore.ts, for the same reason: `server-only` cannot
 * resolve outside a bundler.
 */

export interface InsightMetrics {
  periodBooked: number;
  projected: number;
  averageValue: number;
  realised: number;
  unresolved: number;
  lostCount: number;
  awaiting: number;
  daysLeft: number;
  emptiestDay: string | null;
  emptiestFree: number;
  weeklyCapacity: number;
  topReason: string | null;
  topReasonCount: number;
  noShowRate: number;
  noShowSample: number;
  returningRate: number;
  returningSample: number;
  reviewCount: number;
  rating: number;
  memberShare: number;
  uplift1: number;
}

export interface InsightItem {
  title: string;
  body: string;
  /**
   * The one figure this pointer turns on, rendered large beside it. Reading a
   * number is faster than reading a sentence about a number, so the sentence
   * gets shorter and this carries the weight.
   */
  metric?: string;
  /** Which glyph to show. See INSIGHT_ICONS. */
  kind?: string;
}

/** Icon keys an insight may claim. Anything else falls back to "spark". */
export const INSIGHT_ICONS = [
  "calendar",
  "money",
  "people",
  "star",
  "clock",
  "spark",
] as const;

const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const pct = (v: number) => `${Math.round(v * 100)}%`;

/**
 * Rules in priority order; the first three or four that apply are shown.
 *
 * Ordered by what a practitioner can act on soonest — a held booking costs
 * them today, a thin review count costs them over months.
 */
export function templateInsights(m: InsightMetrics): InsightItem[] {
  const out: InsightItem[] = [];

  if (m.awaiting > 0) {
    out.push({
      kind: "clock",
      metric: String(m.awaiting),
      // Was "Waiting on you", which the money donut ALSO used, for a
      // different figure entirely: this is a COUNT of booking requests, that
      // is a SUM of money from visits never closed off. Two things cannot
      // share one name on one screen.
      title: "Requests to confirm",
      body: "Each one holds a slot nobody else can book.",
    });
  }

  if (m.unresolved > 0) {
    out.push({
      kind: "money",
      metric: money(m.unresolved),
      title: "Not closed off",
      body: "The visit happened but was never marked complete.",
    });
  }

  if (m.emptiestDay && m.emptiestFree >= 3) {
    out.push({
      kind: "calendar",
      metric: `${m.emptiestFree} free`,
      title: `${m.emptiestDay} is quietest`,
      body: "Unbooked slots over four weeks.",
    });
  }

  if (m.noShowSample >= 5 && m.noShowRate >= 0.1) {
    out.push({
      kind: "people",
      metric: pct(m.noShowRate),
      title: "No-show rate",
      body: "Manual confirmation would vet each booking.",
    });
  }

  if (m.reviewCount < 3) {
    out.push({
      kind: "star",
      metric: String(m.reviewCount),
      title: "Published reviews",
      body: "The first thing a new client reads.",
    });
  }

  if (m.averageValue > 0 && m.daysLeft > 3 && m.uplift1 > 0) {
    out.push({
      kind: "money",
      metric: `+${money(m.uplift1)}`,
      title: "One more a week",
      body: `Across the ${m.daysLeft} days left.`,
    });
  }

  if (m.topReason && m.topReasonCount >= 3) {
    out.push({
      kind: "spark",
      metric: String(m.topReasonCount),
      title: m.topReason,
      body: "Your most booked concern, 90 days.",
    });
  }

  if (m.returningSample >= 5 && m.returningRate < 0.2) {
    out.push({
      kind: "people",
      metric: pct(m.returningRate),
      title: "Returning clients",
      body: "Mostly first visits. Try a follow-up plan.",
    });
  }

  if (out.length === 0) {
    out.push({
      kind: "spark",
      title: "All clear",
      body: "No held bookings or unclosed visits.",
    });
  }

  return out.slice(0, 4);
}

/**
 * The exact strings the big figure on a card is allowed to be.
 *
 * The numeric tripwire below checks that a figure is REAL. It cannot check
 * that it is being read as the right kind of thing, and that gap put this on
 * a doctor's dashboard:
 *
 *     291570
 *     Total appointments booked
 *
 * 291570 is a real figure — it is the month's booked value in rupees — so
 * every existing check passed. Rendered bare under that title it says the
 * practice took two hundred and ninety-one thousand appointments.
 *
 * So the metric is no longer free text that merely has to contain a true
 * number: it has to BE one of these, character for character, with the unit
 * already attached. A model that cannot copy one exactly gets no big figure
 * and its sentence stands on its own.
 */
export function allowedMetrics(m: InsightMetrics): string[] {
  const out: string[] = [];
  const push = (v: string) => {
    if (v && !out.includes(v)) out.push(v);
  };

  // Money, always with the rupee mark and Indian grouping.
  for (const n of [m.periodBooked, m.projected, m.averageValue, m.realised, m.unresolved]) {
    if (Number.isFinite(n) && n > 0) push(money(n));
  }
  if (m.uplift1 > 0) push(`+${money(m.uplift1)}`);

  // Counts, always bare.
  for (const n of [m.awaiting, m.lostCount, m.topReasonCount, m.reviewCount, m.daysLeft]) {
    if (Number.isFinite(n) && n > 0) push(String(Math.round(n)));
  }
  if (m.weeklyCapacity > 0) push(`${m.weeklyCapacity} slots`);
  if (m.emptiestFree > 0) push(`${m.emptiestFree} free`);

  // Rates, always with the per-cent sign, and only where the sample carries it.
  if (m.noShowSample >= 5) push(pct(m.noShowRate));
  if (m.returningSample >= 5) push(pct(m.returningRate));
  push(pct(m.memberShare));
  if (m.reviewCount > 0) push(m.rating.toFixed(1));

  return out;
}

/**
 * Every number that may legitimately appear in generated prose.
 *
 * Used to verify AI output: a figure the model produced that is not in here
 * was invented, and this is a dashboard about somebody's income.
 */
export function allowedFigures(m: InsightMetrics): Set<string> {
  const nums = [
    m.periodBooked,
    m.projected,
    m.averageValue,
    m.realised,
    m.unresolved,
    m.lostCount,
    m.awaiting,
    m.daysLeft,
    m.emptiestFree,
    m.weeklyCapacity,
    m.topReasonCount,
    m.reviewCount,
    m.uplift1,
    Math.round(m.noShowRate * 100),
    Math.round(m.returningRate * 100),
    Math.round(m.memberShare * 100),
    Math.round(m.rating * 10) / 10,
  ];

  const set = new Set<string>();
  for (const n of nums) {
    if (!Number.isFinite(n)) continue;
    set.add(String(n));
    // Figures are rendered with separators, so "12,500" must pass too.
    set.add(Math.round(n).toLocaleString("en-IN"));
    set.add(String(Math.round(n)));
  }
  return set;
}

/**
 * Pulls every number out of prose so it can be checked against the source.
 *
 * Commas are stripped, so "₹12,500" and "12500" compare equal.
 */
export function figuresIn(text: string): string[] {
  return (text.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((n) => n.replace(/,/g, ""));
}

/**
 * Does this prose only quote figures it was given?
 *
 * Ordinals and small counts inside sentences ("one more", "3 slots") are
 * covered because the allowed set contains those values; anything else that
 * looks like a statistic and is not in the set fails the check.
 */
export function figuresAreSupported(
  text: string,
  m: InsightMetrics
): boolean {
  const allowed = allowedFigures(m);
  const allowedPlain = new Set([...allowed].map((a) => a.replace(/,/g, "")));
  return figuresIn(text).every((n) => allowedPlain.has(n));
}
