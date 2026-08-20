import { prisma } from "@/lib/prisma";

/**
 * The real treatment names, for suggesting what a practitioner offers.
 *
 * Sourced from the seeded hub catalogue rather than written out here, because
 * the point of this list is that every name in it is a treatment the site
 * genuinely knows about. It is also the vocabulary the AI matcher is allowed
 * to return from — a model asked to name treatments freely will invent
 * plausible ones, so it never gets to; it picks from this.
 *
 * `HubTreatment.name` carries no unique constraint and slugs repeat across
 * categories, so the list is deduped on a lowercased key.
 */

/** Every active treatment name we know, deduped, alphabetical. */
export async function getTreatmentVocabulary(): Promise<string[]> {
  const rows = await prisma.hubTreatment.findMany({
    where: { isActive: true },
    select: { name: true },
  });

  const seen = new Map<string, string>();
  for (const r of rows) {
    const name = r.name.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (!seen.has(key)) seen.set(key, name);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

/**
 * A starter set to show before the doctor types anything.
 *
 * One treatment from each category rather than the first N overall, so the
 * suggestions span what a dermatologist actually does instead of listing four
 * kinds of filler. Falls back to plain top-of-list if categories are thin.
 *
 * Deliberately NOT wrapped in React's cache(): this module is imported by an
 * API route as well as by rendered pages, and a module-level cache() call
 * breaks under plain Node — same reason noted in subscription/membership.ts.
 */
export async function getSuggestedTreatments(limit = 14): Promise<string[]> {
    const categories = await prisma.hubCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      take: limit,
      select: {
        treatments: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
          take: 1,
          select: { name: true },
        },
      },
    });

    const picked: string[] = [];
    const seen = new Set<string>();
    for (const c of categories) {
      const name = c.treatments[0]?.name?.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      picked.push(name);
    }

    if (picked.length >= Math.min(limit, 8)) return picked.slice(0, limit);

    // Not enough categories seeded — top up from the flat vocabulary rather
    // than showing three suggestions.
    for (const name of await getTreatmentVocabulary()) {
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      picked.push(name);
      if (picked.length >= limit) break;
    }
  return picked;
}

/**
 * Ranked substring search, for the typeahead.
 *
 * Deterministic and local — this is the path that works with no API key, and
 * the fallback when the AI matcher is unavailable or returns nothing usable.
 */
export function searchTreatments(
  query: string,
  vocabulary: string[],
  limit = 20
): string[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const starts: string[] = [];
  const contains: string[] = [];
  for (const name of vocabulary) {
    const lower = name.toLowerCase();
    if (lower.startsWith(q)) starts.push(name);
    else if (lower.includes(q)) contains.push(name);
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit);
}
