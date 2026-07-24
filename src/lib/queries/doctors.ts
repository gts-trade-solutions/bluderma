import { ConsultMode, Prisma } from "@prisma/client";
import { cache } from "react";

import { prisma } from "@/lib/prisma";
import type { ConsultModeDTO, DoctorDTO } from "./types";

const doctorInclude = {
  focus: { select: { concern: { select: { key: true } } } },
  languages: { orderBy: { sortOrder: "asc" }, select: { name: true } },
  services: { orderBy: { sortOrder: "asc" }, select: { name: true } },
  modes: { select: { mode: true } },
} satisfies Prisma.DoctorInclude;

type DoctorRow = Prisma.DoctorGetPayload<{ include: typeof doctorInclude }>;

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
    modes: row.modes.map(
      (m) => (m.mode === ConsultMode.VIDEO ? "video" : "clinic") as ConsultModeDTO
    ),
    about: row.about,
    verified: row.verified,
    general: row.isGeneral || undefined,
  };
}

export const getDoctors = cache(async (): Promise<DoctorDTO[]> => {
  const rows = await prisma.doctor.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: doctorInclude,
  });
  return rows.map(toDTO);
});

export const getDoctor = cache(
  async (slug: string): Promise<DoctorDTO | null> => {
    const row = await prisma.doctor.findFirst({
      where: { slug, isActive: true },
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
