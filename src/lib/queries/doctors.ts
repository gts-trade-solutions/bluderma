import { ConsultMode, Prisma, ReviewStatus } from "@prisma/client";
import { cache } from "react";

import { prisma } from "@/lib/prisma";
import type { ConsultModeDTO, DoctorDTO } from "./types";
import { PUBLIC_DOCTOR_WHERE } from "./doctorAccess";

// Re-exported so existing imports keep working; defined in doctorAccess.ts
// because that module stays free of React cache() and can be used by scripts.
export { PUBLIC_DOCTOR_WHERE } from "./doctorAccess";

const doctorInclude = {
  focus: { select: { concern: { select: { key: true } } } },
  languages: { orderBy: { sortOrder: "asc" }, select: { name: true } },
  services: { orderBy: { sortOrder: "asc" }, select: { name: true } },
  specialtyAreas: { orderBy: { sortOrder: "asc" }, select: { name: true } },
  otherFocus: { orderBy: { sortOrder: "asc" }, select: { name: true } },
  modes: { select: { mode: true } },
  /**
   * The doctor's own published reviews.
   *
   * A star rating with no words is not worth quoting, so bodyless rows are
   * excluded here exactly as they are in /api/reviews/published — they still
   * count toward the aggregate, which is a different question.
   *
   * Three on the listing is enough to read while choosing; the full set is a
   * page nobody has asked for yet.
   */
  reviewList: {
    where: { status: ReviewStatus.PUBLISHED, body: { not: null } },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: 3,
    select: {
      id: true,
      rating: true,
      title: true,
      body: true,
      publishedAt: true,
      createdAt: true,
      user: { select: { name: true } },
    },
  },
  clinics: {
    where: { isActive: true, clinic: { isActive: true } },
    orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
    select: {
      feeInr: true,
      isPrimary: true,
      clinic: {
        select: {
          id: true,
          name: true,
          area: true,
          city: true,
          landmark: true,
          lat: true,
          lng: true,
        },
      },
    },
  },
} satisfies Prisma.DoctorInclude;

type DoctorRow = Prisma.DoctorGetPayload<{ include: typeof doctorInclude }>;

/** "Priya Ramesh" -> "Priya R." Anything unusable becomes "A client". */
function displayName(name: string | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "A client";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

function toDTO(row: DoctorRow): DoctorDTO {
  return {
    id: row.slug,
    name: row.name,
    title: row.title,
    specialty: row.specialty,
    focus: row.focus.map((f) => f.concern.key),
    // Prisma returns Decimal for @db.Decimal; the UI wants a plain number.
    rating: Number(row.rating),
    reviews: row.reviews,
    experienceYears: row.experienceYears,
    clinic: row.clinic,
    location: row.location,
    image: row.image,
    fee: row.fee,
    languages: row.languages.map((l) => l.name),
    services: row.services.map((s) => s.name),
    specialtyAreas: row.specialtyAreas.map((s) => s.name),
    otherFocus: row.otherFocus.map((f) => f.name),
    modes: row.modes.map(
      (m) => (m.mode === ConsultMode.VIDEO ? "video" : "clinic") as ConsultModeDTO
    ),
    about: row.about,
    verified: row.verified,
    general: row.isGeneral || undefined,
    reviewList: row.reviewList.map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      body: r.body,
      author: displayName(r.user.name),
      at: (r.publishedAt ?? r.createdAt).toISOString().slice(0, 10),
    })),
    clinics: row.clinics.map((p) => ({
      id: p.clinic.id,
      name: p.clinic.name,
      area: p.clinic.area,
      city: p.clinic.city,
      landmark: p.clinic.landmark,
      lat: p.clinic.lat,
      lng: p.clinic.lng,
      feeInr: p.feeInr,
      isPrimary: p.isPrimary,
    })),
  };
}

export const getDoctors = cache(async (): Promise<DoctorDTO[]> => {
  const rows = await prisma.doctor.findMany({
    where: PUBLIC_DOCTOR_WHERE,
    orderBy: { sortOrder: "asc" },
    include: doctorInclude,
  });
  return rows.map(toDTO);
});

export const getDoctor = cache(
  async (slug: string): Promise<DoctorDTO | null> => {
    const row = await prisma.doctor.findFirst({
      where: { slug, ...PUBLIC_DOCTOR_WHERE },
      include: doctorInclude,
    });
    return row ? toDTO(row) : null;
  }
);

/**
 * Rank doctors by how well their focus areas overlap the patient's top
 * concerns, always keeping a generalist on the list. Ported verbatim from the
 * old in-memory suggestDoctors() so results stay familiar.
 */
export function rankDoctors(
  doctors: DoctorDTO[],
  topConcerns: string[],
  count = 4
): DoctorDTO[] {
  const scored = doctors.map((d) => {
    let score = 0;
    topConcerns.forEach((c, i) => {
      if (d.focus.includes(c)) score += (topConcerns.length - i) * 2;
    });
    if (d.general) score += 1;
    score += d.rating;
    return { d, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const picked = scored.slice(0, count).map((s) => s.d);

  if (!picked.some((d) => d.general)) {
    const generalist = doctors.find((d) => d.general);
    if (generalist) picked[picked.length - 1] = generalist;
  }
  return picked;
}

export function matchStrength(doctor: DoctorDTO, topConcerns: string[]): number {
  return topConcerns.filter((c) => doctor.focus.includes(c)).length;
}
