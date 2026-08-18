/**
 * How a doctor card reads when the record is incomplete.
 *
 * A directory fills up over time — a clinic added this morning has no reviews,
 * and its consultation fee may not have been confirmed yet. Rendering those
 * gaps as "★ 0 · 0 reviews · 0 yrs · ₹0" is worse than saying nothing: it
 * reads as a clinic nobody rates, with no experience, that charges nothing.
 * Every one of those is a false claim about a real business.
 *
 * So absent data is shown as absent. "New" is honest; zero is not.
 */

/** The star figure, or null when nobody has reviewed them yet. */
export function ratingLabel(
  rating: number,
  reviews: number
): { value: string; reviews: string } | null {
  if (!reviews || rating <= 0) return null;
  return {
    value: rating.toFixed(1),
    reviews: reviews === 1 ? "1 review" : `${reviews} reviews`,
  };
}

/** Years in practice, or null when it has not been recorded. */
export function experienceLabel(years: number): string | null {
  if (!years || years <= 0) return null;
  return years === 1 ? "1 yr" : `${years} yrs`;
}

/**
 * The consultation fee.
 *
 * Zero means "not published", not "free" — a clinic that has not given us a
 * figure should not appear to be giving consultations away.
 */
export function feeLabel(fee: number): { amount: string; note: string } {
  if (!fee || fee <= 0) {
    return { amount: "On enquiry", note: "consultation fee" };
  }
  return { amount: `₹${fee.toLocaleString("en-IN")}`, note: "consultation" };
}
