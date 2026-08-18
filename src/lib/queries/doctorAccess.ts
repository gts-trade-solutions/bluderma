import { DoctorStatus, type Prisma } from "@prisma/client";

/**
 * Who is allowed to appear on the public site.
 *
 * Doctors now sign themselves up, so the table holds half-finished drafts,
 * applications waiting on an admin, and people who were turned down. None of
 * them may be listed, searched, recommended or booked.
 *
 * Every public read imports this rather than writing its own filter — one
 * predicate to audit instead of a dozen, and a surface that forgets it becomes
 * a visible omission rather than an invisible leak.
 *
 * The doctor's OWN portal deliberately does not use it: a DRAFT practitioner
 * still has to sign in and finish their profile. Portal reads resolve the
 * doctor from the session user id instead, which is its own guarantee.
 *
 * WHY THIS LIVES ALONE. It is a plain constant with no data access and no
 * React import, so scripts and tests can pull it in without dragging in
 * queries/doctors.ts, whose module-level cache() only exists inside a React
 * render. Same reasoning as the booking/policy.ts and policySettings.ts split.
 */
export const PUBLIC_DOCTOR_WHERE = {
  status: DoctorStatus.APPROVED,
  isActive: true,
} satisfies Prisma.DoctorWhereInput;
