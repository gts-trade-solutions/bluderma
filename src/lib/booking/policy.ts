/**
 * What a client is allowed to do to their own booking, and what it costs.
 *
 * The rules are deliberately time-based rather than a flat "cancel" button.
 * A slot given up a week ahead costs the clinic nothing and should be free to
 * release; the same slot given up an hour before is a clinician sitting idle,
 * and every clinic in the world charges for it. Between those, a fee.
 *
 * Closest to the appointment, self-service stops entirely and the client is
 * asked to phone. That is not an obstruction — at two hours' notice somebody
 * needs to actually speak to the patient, and a silent cancel button hides
 * that conversation from both sides.
 *
 * Every threshold is admin-editable (Settings → Booking), because the right
 * numbers differ by clinic and should never need a deploy.
 *
 * Deliberately free of any data access: these are pure decisions over values
 * handed in, which is what lets them be exercised directly and reused by both
 * the server action and the page that warns the client beforehand. The
 * settings fetch lives in ./policySettings.
 */

export interface BookingPolicy {
  /** Beyond this many hours, cancelling is free. */
  freeHours: number;
  /** Inside `freeHours` but beyond `contactHours`, this fee applies. */
  feeInr: number;
  /** Inside this many hours, the client must phone reception. */
  contactHours: number;
  /** How many times one booking may be moved. */
  maxReschedules: number;
  /** A reschedule must be at least this many hours ahead. */
  rescheduleMinHours: number;
  /** Shown wherever the policy is explained. */
  receptionPhone: string;
}

export const POLICY_DEFAULTS: BookingPolicy = {
  freeHours: 24,
  feeInr: 300,
  contactHours: 4,
  maxReschedules: 2,
  rescheduleMinHours: 4,
  receptionPhone: "",
};

export type CancelOutcome =
  /** Free to cancel, nothing owed. `waived` when a membership paid for it. */
  | { kind: "free"; hoursAway: number; waived?: boolean }
  /** Allowed, but a fee is charged against the booking. */
  | { kind: "fee"; hoursAway: number; feeInr: number }
  /** Too close — reception has to handle it. */
  | { kind: "contact"; hoursAway: number; phone: string }
  /** Already gone, or already in the past. */
  | { kind: "not_applicable"; reason: string };

/**
 * Decides what cancelling this appointment means, right now.
 *
 * Split out from the action so the UI can show the consequence *before* the
 * client commits — being charged by a button you did not know was a paid
 * button is the thing this design exists to avoid.
 */
export function evaluateCancellation(
  scheduledAt: Date,
  policy: BookingPolicy,
  now: Date = new Date(),
  /**
   * A Gold Collar member never pays the late-cancellation fee. It does NOT
   * lift the reception window: inside a few hours somebody still has to be
   * told a slot is going empty, and that conversation is not something a
   * membership buys its way out of.
   */
  options: { waiveFee?: boolean } = {}
): CancelOutcome {
  const msAway = scheduledAt.getTime() - now.getTime();
  const hoursAway = msAway / 3_600_000;

  if (msAway <= 0) {
    return {
      kind: "not_applicable",
      reason: "That appointment has already passed.",
    };
  }
  if (hoursAway < policy.contactHours) {
    return { kind: "contact", hoursAway, phone: policy.receptionPhone };
  }
  if (hoursAway < policy.freeHours && policy.feeInr > 0) {
    if (options.waiveFee) return { kind: "free", hoursAway, waived: true };
    return { kind: "fee", hoursAway, feeInr: policy.feeInr };
  }
  return { kind: "free", hoursAway };
}

export type RescheduleOutcome =
  | { kind: "allowed"; remaining: number }
  | { kind: "too_late"; phone: string; minHours: number }
  | { kind: "limit_reached"; phone: string; max: number }
  | { kind: "not_applicable"; reason: string };

/**
 * Whether this booking can still be moved by the client themselves.
 *
 * The cap matters: without one, a slot can be held indefinitely by moving it
 * every time it approaches, which costs the clinic the same as a no-show
 * while never appearing as one.
 */
export function evaluateReschedule(
  scheduledAt: Date,
  rescheduleCount: number,
  policy: BookingPolicy,
  now: Date = new Date()
): RescheduleOutcome {
  const hoursAway = (scheduledAt.getTime() - now.getTime()) / 3_600_000;

  if (hoursAway <= 0) {
    return {
      kind: "not_applicable",
      reason: "That appointment has already passed.",
    };
  }
  if (rescheduleCount >= policy.maxReschedules) {
    return {
      kind: "limit_reached",
      phone: policy.receptionPhone,
      max: policy.maxReschedules,
    };
  }
  if (hoursAway < policy.rescheduleMinHours) {
    return {
      kind: "too_late",
      phone: policy.receptionPhone,
      minHours: policy.rescheduleMinHours,
    };
  }
  return { kind: "allowed", remaining: policy.maxReschedules - rescheduleCount };
}
