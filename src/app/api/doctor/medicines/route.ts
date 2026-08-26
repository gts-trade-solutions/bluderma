import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getOwnDoctor } from "@/lib/doctor/guard";

export const dynamic = "force-dynamic";

/**
 * The signed-in practitioner's own dispensary, for the prescribing form.
 *
 * Fetched on demand rather than threaded through the appointment drawer,
 * because the drawer is opened from four different screens and the list is
 * only needed by one panel inside it — the one a doctor opens perhaps twice a
 * day. Loading it with every drawer would cost every one of those four
 * screens a query they mostly do not use.
 *
 * Scoped to the caller's own doctor id, never to one supplied by the request:
 * a route handler is a public endpoint, so a doctorId in a query string is an
 * assertion by the caller and nothing more.
 */
export async function GET() {
  const owner = await getOwnDoctor();
  if (!owner) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const medicines = await prisma.medicine.findMany({
    where: { doctorId: owner.doctorId, isActive: true },
    orderBy: { name: "asc" },
    take: 300,
    select: {
      id: true,
      name: true,
      brand: true,
      form: true,
      strength: true,
      stock: true,
      lowStockAt: true,
      prescriptionOnly: true,
    },
  });

  return NextResponse.json({ ok: true, medicines });
}
