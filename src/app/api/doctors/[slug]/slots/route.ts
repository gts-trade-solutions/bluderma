import { NextResponse } from "next/server";

import {
  buildDayOptions,
  clinicNow,
  getSlotsForDays,
} from "@/lib/queries/availability";

/**
 * Live slot availability for the booking modal.
 *
 * Deliberately uncached: a slot list that is even a minute stale sends people
 * into a booking that will be rejected. The page around it can be cached; this
 * cannot.
 */
export const dynamic = "force-dynamic";

const MAX_DAYS = 14;

export async function GET(
  req: Request,
  { params }: { params: { slug: string } }
) {
  const url = new URL(req.url);
  const requested = Number(url.searchParams.get("days") ?? 5);
  const days = Math.min(
    Math.max(Number.isFinite(requested) ? requested : 5, 1),
    MAX_DAYS
  );

  // Anchor the day list to the clinic's local date, not the server's UTC date.
  const dayOptions = buildDayOptions(new Date(clinicNow()), days);
  const slotsByDay = await getSlotsForDays(
    params.slug,
    dayOptions.map((d) => d.daySeed)
  );

  return NextResponse.json({ days: dayOptions, slots: slotsByDay });
}
