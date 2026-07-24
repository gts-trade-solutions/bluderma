import { cache } from "react";

import { prisma } from "@/lib/prisma";
import type {
  BannerDTO,
  ConcernDTO,
  ContentBlockDTO,
  FaqDTO,
  TestimonialDTO,
} from "./types";

export const getConcerns = cache(async (): Promise<ConcernDTO[]> => {
  const rows = await prisma.skinConcern.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      key: true,
      legacyKey: true,
      label: true,
      hint: true,
      description: true,
    },
  });
  return rows;
});

export const getTestimonials = cache(
  async (limit = 12): Promise<TestimonialDTO[]> => {
    return prisma.testimonial.findMany({
      where: { isPublished: true },
      orderBy: { sortOrder: "asc" },
      take: limit,
      select: {
        id: true,
        authorName: true,
        authorRole: true,
        avatarUrl: true,
        quote: true,
        rating: true,
      },
    });
  }
);

/** Keyed content for a page section, e.g. ("doctor", "why"). */
export const getContentBlocks = cache(
  async (page: string, section: string): Promise<ContentBlockDTO[]> => {
    return prisma.contentBlock.findMany({
      where: { page, section, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        key: true,
        title: true,
        subtitle: true,
        body: true,
        image: true,
        icon: true,
      },
    });
  }
);

export const getFaqs = cache(async (category?: string): Promise<FaqDTO[]> => {
  return prisma.faq.findMany({
    where: { isPublished: true, ...(category ? { category } : {}) },
    orderBy: { sortOrder: "asc" },
    select: { id: true, question: true, answer: true, category: true },
  });
});

export const getActiveBanner = cache(
  async (
    placement: "HOME_HERO" | "DOCTOR_HERO" | "PATIENT_HERO"
  ): Promise<BannerDTO | null> => {
    const now = new Date();
    const row = await prisma.banner.findFirst({
      where: {
        placement,
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        title: true,
        subtitle: true,
        ctaLabel: true,
        ctaHref: true,
        mediaType: true,
        mediaUrl: true,
        posterUrl: true,
      },
    });
    return row;
  }
);

/**
 * All site settings as a plain key/value map. Small table, read often — one
 * query beats a lookup per key.
 */
export const getSettings = cache(async (): Promise<Record<string, string>> => {
  const rows = await prisma.siteSetting.findMany({
    select: { key: true, value: true },
  });
  return Object.fromEntries(rows.map((r) => [r.key, r.value ?? ""]));
});

export async function getSetting(
  key: string,
  fallback = ""
): Promise<string> {
  const settings = await getSettings();
  return settings[key] ?? fallback;
}
