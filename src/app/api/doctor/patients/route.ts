import { NextResponse } from "next/server";

import { getOwnDoctor } from "@/lib/doctor/guard";
import { attachPhones, getDoctorPatients } from "@/lib/queries/doctorPatients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Find one of this practice's patients, for the "book somebody in" form.
 *
 * Doctor-scoped through `getOwnDoctor`, so it cannot be used to look up a
 * stranger: the query is built from appointments this doctor holds, and a
 * name that is not in them returns nothing.
 *
 * Deliberately thin — eight rows, four fields. The full list has its own page;
 * this exists so a receptionist can type three letters and attach the booking
 * to the right account rather than creating a second, accountless copy of a
 * patient the practice already has.
 */
export async function GET(req: Request) {
  const owner = await getOwnDoctor();
  if (!owner) {
    return NextResponse.json({ error: "Not permitted." }, { status: 403 });
  }

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ rows: [] });

  const found = await getDoctorPatients(owner.doctorId, { q });
  const rows = await attachPhones(owner.doctorId, found.rows.slice(0, 8));

  return NextResponse.json({
    rows: rows.map((r) => ({
      userId: r.userId,
      name: r.name,
      publicId: r.publicId,
      phone: r.phone,
      visits: r.visits,
    })),
  });
}
