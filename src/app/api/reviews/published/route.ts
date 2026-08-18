import { NextResponse } from "next/server";
import { ReviewStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/**
 * Client reviews that have actually been left and actually been published.
 *
 * This replaces three invented testimonials in src/data/intake.ts, shown under
 * the heading "Real people, real proof" with a hardcoded five-star rating
 * attributed to "clients across our clinics". None of those people existed.
 * Fabricated reviews and an invented aggregate rating are the clearest
 * consumer-protection exposure on the site, and India's ASCI and CCPA rules on
 * fake reviews apply directly.
 *
 * The honest consequence is that this returns an empty list until real clients
 * have reviewed and an admin has published them — and the UI must render
 * nothing at all in that case rather than falling back to anything.
 *
 * Only the reviewer's first name and last initial go out. A full name against
 * a dermatology consultation is more than anybody agreed to publish.
 */
export const revalidate = 300;

/** "Priya Ramesh" -> "Priya R." Anything unusable becomes "A client". */
function displayName(name: string | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "A client";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

export async function GET() {
  const rows = await prisma.review.findMany({
    where: {
      status: ReviewStatus.PUBLISHED,
      // A star rating on its own says nothing worth quoting.
      body: { not: null },
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: 6,
    select: {
      id: true,
      rating: true,
      title: true,
      body: true,
      publishedAt: true,
      user: { select: { name: true } },
      doctor: { select: { name: true, specialty: true } },
    },
  });

  const reviews = rows
    .filter((r) => (r.body ?? "").trim().length >= 20)
    .map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      quote: (r.body ?? "").trim(),
      name: displayName(r.user.name),
      doctor: r.doctor.name,
      specialty: r.doctor.specialty,
      publishedOn: r.publishedAt?.toISOString().slice(0, 10) ?? null,
    }));

  // The average is computed from exactly these reviews, so the number and the
  // list a reader can see never disagree.
  const average =
    reviews.length > 0
      ? Math.round(
          (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10
        ) / 10
      : null;

  return NextResponse.json({ ok: true, reviews, average, count: reviews.length });
}
