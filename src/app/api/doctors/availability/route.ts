import { NextResponse } from "next/server";

import {
  buildDayOptions,
  clinicNow,
  getSlotsForDoctor,
} from "@/lib/queries/availability";
import { getCurrentUser } from "@/lib/session";
import { hasActiveMembership } from "@/lib/subscription/membership";

/**
 * Next free times for several doctors at once.
 *
 * Exists to kill the last consumer of a seeded pseudo-random generator that
 * INVENTED availability. Doctor cards used to render "Free today · 10:30,
 * 11:00, 14:30" from a hash of the doctor's slug — times that had nothing to
 * do with their calendar. A client clicked one, the booking dialog then loaded
 * the real slots, and the time they had been promised was frequently gone.
 * Doctors with no hours at all showed times; doctors who were free all day
 * showed "Fully booked".
 *
 * Batched because a directory page renders many cards and one request per card
 * would be a request storm for what is only a hint.
 *
 * Deliberately uncached, for the same reason as the per-doctor slots route: a
 * stale free-time is worse than none, and members see slots held back from
 * everyone else, so the answer depends on who is asking.
 */
export const dynamic = "force-dynamic";

const MAX_DOCTORS = 24;
const MAX_PER_DOCTOR = 3;
/** How many days ahead to look before giving up and saying nothing. */
const LOOKAHEAD_DAYS = 7;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slugs = (url.searchParams.get("slugs") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_DOCTORS);

  if (slugs.length === 0) {
    return NextResponse.json({ ok: true, availability: {} });
  }

  const user = await getCurrentUser();
  const isMember = user ? await hasActiveMembership(user.id) : false;

  const days = buildDayOptions(new Date(clinicNow()), LOOKAHEAD_DAYS);

  const entries = await Promise.all(
    slugs.map(async (slug) => {
      // Walk forward until something is actually free. Stopping at "today"
      // would report every doctor as fully booked from Friday evening.
      for (const day of days) {
        const slots = await getSlotsForDoctor(slug, day.daySeed, { isMember });
        const free = slots.filter((s) => s.available);
        if (free.length > 0) {
          return [
            slug,
            {
              daySeed: day.daySeed,
              dayLabel: day.label,
              times: free.slice(0, MAX_PER_DOCTOR).map((s) => ({
                label: s.label,
                clinicId: s.clinicId,
                clinicName: s.clinicName,
              })),
            },
          ] as const;
        }
      }
      // Nothing free in the window, or no hours set at all. Null, not an
      // empty array — the UI must be able to tell "none free this week" from
      // "we did not look".
      return [slug, null] as const;
    })
  );

  return NextResponse.json({
    ok: true,
    availability: Object.fromEntries(entries),
  });
}
