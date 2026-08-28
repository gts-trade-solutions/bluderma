import { DoctorStatus, type Prisma } from "@prisma/client";

import { DEMO_EMAIL_SUFFIXES } from "@/lib/demo";

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
/**
 * The demo practitioner is APPROVED and active, because the demo has to look
 * like a real practice — which meant it passed this filter and was listed in
 * the public directory alongside the real ones.
 *
 * That is how "Dr. Nithya Raghavan" came to be offered to clients who could
 * have booked an appointment with somebody who does not exist. The seeded
 * addresses are on `.local` domains that cannot be registered or receive
 * mail, so excluding them here cannot catch a real practitioner.
 *
 * The list comes from lib/demo, which imports nothing itself — so this module
 * stays loadable by a plain script, which is the property the note at the top
 * is protecting.
 */

export const PUBLIC_DOCTOR_WHERE = {
  status: DoctorStatus.APPROVED,
  isActive: true,
  // NOT at the DOCTOR level, not inside a `user: { is: ... }`. A doctor whose
  // user record has not been linked yet has `user: null`, and a null relation
  // never matches an `is` clause — so the inner form excluded every
  // unlinked practitioner as well as the demo one, taking the whole directory
  // from eight listings to none. Negating at this level leaves them: they do
  // not match the demo condition, so NOT holds.
  NOT: DEMO_EMAIL_SUFFIXES.map((suffix) => ({
    user: { is: { email: { endsWith: suffix } } },
  })),
} satisfies Prisma.DoctorWhereInput;
