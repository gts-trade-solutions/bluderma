import { NextResponse } from "next/server";

import { getOwnDoctor } from "@/lib/doctor/guard";
import { getAppointmentDetail } from "@/lib/queries/doctorCalendar";

/**
 * One appointment, in full, for the calendar's detail drawer.
 *
 * A route rather than a server action because the drawer opens on demand from
 * an id the grid already holds — loading every client's scan history up front
 * to render a month view would be absurd.
 *
 * The doctor is resolved from the session, and getAppointmentDetail filters on
 * that doctorId, so an id belonging to someone else's list returns 404 exactly
 * like one that does not exist.
 */
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const owner = await getOwnDoctor();
  if (!owner) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const detail = await getAppointmentDetail(owner.doctorId, params.id);
  if (!detail) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, ...detail });
}
