import { NextResponse } from "next/server";
import { ClinicPhotoKind } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/**
 * Real clinics, optionally narrowed to a city.
 *
 * Replaces `clinicsNear()` in src/data/clinics.ts, which returned six invented
 * clinics with invented distances ("3.2 km"), invented opening hours and
 * invented home-visit flags — and, when the client's city did not match,
 * quietly showed them Chennai addresses anyway "so the section is never
 * empty". A client could have set out for a building that does not exist.
 *
 * Returns an empty list when there is no clinic in that city. The section that
 * renders this hides itself rather than falling back to somewhere else.
 *
 * DISTANCE IS NOT RETURNED. Clinic.lat/lng exist but no address is geocoded on
 * save yet, and a distance we cannot compute must not be printed. City and
 * area are what a client navigates by in the meantime.
 */
export const dynamic = "force-dynamic";

const MAX = 6;

export async function GET(req: Request) {
  const city = new URL(req.url).searchParams.get("city")?.trim() ?? "";

  const rows = await prisma.clinic.findMany({
    where: {
      isActive: true,
      // Only clinics somebody actually practises at — an approved doctor's
      // location, not an orphaned row from a withdrawn application.
      doctors: { some: { isActive: true, doctor: { status: "APPROVED", isActive: true } } },
      ...(city
        ? {
            OR: [
              { city: { contains: city } },
              { area: { contains: city } },
            ],
          }
        : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    take: MAX,
    select: {
      id: true,
      slug: true,
      name: true,
      addressLine1: true,
      area: true,
      city: true,
      pincode: true,
      phone: true,
      photos: {
        where: { kind: { in: [ClinicPhotoKind.EXTERIOR, ClinicPhotoKind.INTERIOR] } },
        orderBy: { sortOrder: "asc" },
        take: 1,
        select: { url: true },
      },
      facilities: { orderBy: { sortOrder: "asc" }, take: 4, select: { name: true } },
      doctors: {
        where: { isActive: true, doctor: { status: "APPROVED", isActive: true } },
        select: { doctor: { select: { name: true, modes: { select: { mode: true } } } } },
      },
    },
  });

  return NextResponse.json({
    ok: true,
    clinics: rows.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      address: c.addressLine1,
      area: c.area,
      city: c.city,
      pincode: c.pincode,
      phone: c.phone,
      image: c.photos[0]?.url ?? null,
      facilities: c.facilities.map((f) => f.name),
      doctorCount: c.doctors.length,
      // True only when somebody there actually offers it.
      homeVisit: c.doctors.some((d) =>
        d.doctor.modes.some((m) => m.mode === "HOME")
      ),
    })),
  });
}
