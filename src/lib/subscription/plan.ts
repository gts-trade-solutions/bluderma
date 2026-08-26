import { SubscriptionInterval } from "@prisma/client";

/**
 * Gold Collar, the client membership — the pure half.
 *
 * No data access lives here on purpose, so the fee arithmetic can be reasoned
 * about and tested without a database, and so scripts can import it without
 * dragging in React's cache(). Same split as booking/policy.ts.
 */

/** What a membership entitles someone to. Mirrors the SubscriptionPlan row. */
export interface MembershipBenefits {
  /** Taken off every consultation fee at a listed clinic. */
  discountPercent: number;
  /** Skin scans granted at the start of each paid term. */
  scanCredits: number;
  /** Unlocks held-back slots and protects a booking from being moved. */
  priorityBooking: boolean;
  /** Cancelling never costs a member the standard fee. */
  waiveCancellationFee: boolean;
}

export const NO_BENEFITS: MembershipBenefits = {
  discountPercent: 0,
  scanCredits: 0,
  priorityBooking: false,
  waiveCancellationFee: false,
};

/**
 * What a member actually pays for a consultation.
 *
 * Rounded DOWN to the whole rupee, so the discount is never a paisa short of
 * what was advertised — the client should not be able to find a rounding
 * error in their own favour and be wrong about it.
 *
 * The home-visit surcharge is deliberately excluded: it is a travel cost, not
 * a consultation fee, and discounting it would mean the membership subsidises
 * mileage.
 */
export function applyMemberDiscount(
  feeInr: number,
  benefits: MembershipBenefits
): { payableInr: number; discountInr: number } {
  const pct = Math.max(0, Math.min(100, benefits.discountPercent));
  if (pct === 0 || feeInr <= 0) return { payableInr: Math.max(0, feeInr), discountInr: 0 };

  const discountInr = Math.floor((feeInr * pct) / 100);
  return { payableInr: feeInr - discountInr, discountInr };
}

/** When a term bought today runs out. */
export function periodEndFrom(start: Date, interval: SubscriptionInterval): Date {
  const end = new Date(start.getTime());
  if (interval === SubscriptionInterval.ANNUAL) {
    end.setUTCFullYear(end.getUTCFullYear() + 1);
  } else {
    // setUTCMonth clamps: 31 Jan + 1 month lands on 28 Feb rather than
    // rolling into March, which is the behaviour a member expects.
    const day = end.getUTCDate();
    end.setUTCMonth(end.getUTCMonth() + 1);
    if (end.getUTCDate() < day) end.setUTCDate(0);
  }
  return end;
}

/**
 * Renewing extends the term rather than restarting it, so a member who pays
 * early is not silently robbed of the days they had left.
 */
export function renewalStartFrom(currentPeriodEnd: Date | null, now: Date): Date {
  if (!currentPeriodEnd) return now;
  return currentPeriodEnd > now ? currentPeriodEnd : now;
}

export function intervalLabel(interval: SubscriptionInterval): string {
  return interval === SubscriptionInterval.ANNUAL ? "year" : "month";
}
