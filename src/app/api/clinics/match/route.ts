import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { rateLimit } from "@/lib/rateLimit";
import { rankClinics, type ClinicCandidate } from "@/lib/clinicMatch";

export const dynamic = "force-dynamic";

/**
 * "Is this clinic already on BluDerma?"
 *
 * Called as the practitioner fills in the location step, once they have given
 * a PIN code and a name. Returns the handful of existing clinics in that
 * postal code that might be the same place, so the second dermatologist at an
 * address joins the first one's clinic instead of creating a duplicate of it.
 *
 * ── What is deliberately NOT returned ────────────────────────────────────
 * No phone number, no email, no fee, and no list of who practises there by
 * name — only a count. A clinic's name and street address are already public
 * on the directory, so surfacing them to a signed-in practitioner discloses
 * nothing new; the contact details and the roster are not, and a match
 * endpoint has no business being a way to enumerate them.
 *
 * DOCTOR and ADMIN only, and rate limited: it is a search over the whole
 * clinic table and there is no reason for a client account to call it.
 */

const schema = z.object({
  name: z.string().trim().min(2).max(160),
  pincode: z.string().trim().regex(/^\d{6}$/),
  addressLine1: z.string().trim().max(300).optional().default(""),
  /** The clinic being edited, so it never suggests itself. */
  excludeId: z.string().trim().max(40).optional().default(""),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "DOCTOR" && user.role !== "ADMIN")) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const limit = rateLimit(`clinic-match:${user.id}`, 60, 5 * 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429 }
    );
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    // Not an error worth showing: the form calls this on every keystroke and
    // an incomplete PIN code is the normal state, not a failure.
    return NextResponse.json({ ok: true, matches: [] });
  }
  const d = parsed.data;

  // Narrowed by PIN code in the query rather than scored across the country:
  // two clinics in different postal codes are not the same clinic however
  // alike their names are.
  const rows = await prisma.clinic.findMany({
    where: {
      pincode: d.pincode,
      ...(d.excludeId ? { id: { not: d.excludeId } } : {}),
    },
    take: 60,
    select: {
      id: true,
      name: true,
      addressLine1: true,
      area: true,
      city: true,
      pincode: true,
      landmark: true,
      _count: { select: { doctors: true } },
    },
  });

  const ranked = rankClinics(
    { name: d.name, addressLine1: d.addressLine1 },
    rows as unknown as ClinicCandidate[]
  );

  // A doctor cannot be offered a clinic they already practise at — they would
  // press "join" and get an error about a link that exists.
  const mine = await prisma.doctorClinic.findMany({
    where: { doctor: { userId: user.id } },
    select: { clinicId: true },
  });
  const already = new Set(mine.map((m) => m.clinicId));

  const byId = new Map(rows.map((r) => [r.id, r]));

  return NextResponse.json({
    ok: true,
    matches: ranked
      .filter((m) => !already.has(m.id))
      .map((m) => ({
        id: m.id,
        name: m.name,
        addressLine1: m.addressLine1,
        landmark: byId.get(m.id)?.landmark ?? null,
        area: m.area,
        city: m.city,
        pincode: m.pincode,
        reason: m.reason,
        /// How many practitioners already hold hours there. A count, never names.
        doctorCount: byId.get(m.id)?._count.doctors ?? 0,
      })),
  });
}
