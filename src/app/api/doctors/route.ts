import { NextResponse } from "next/server";

import { getDoctors } from "@/lib/queries/doctors";

/**
 * The public doctor directory, for client components too deep in the tree to
 * receive it as a server prop (the quiz's consultation step, the intake
 * result, the hub booking pickers).
 *
 * Directory records change on an admin timescale, so short CDN-style caching
 * is safe — unlike the slots endpoint, which must never be stale.
 */
export const revalidate = 300;

export async function GET() {
  const doctors = await getDoctors();
  return NextResponse.json(
    { doctors },
    { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } }
  );
}
