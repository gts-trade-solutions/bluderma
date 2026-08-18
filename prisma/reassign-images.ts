/**
 * Re-assigns every treatment photograph, relevance first.
 *
 * The earlier pass optimised for the wrong thing. It spread images evenly so
 * no photograph did too much work, treating theme as a tiebreak — which put a
 * spa massage on a hair-restoration page and a consulting room on a Botox
 * page. 43% of the catalogue was illustrated with something it was not.
 *
 * A repeated relevant photograph is far better than a unique irrelevant one:
 * nobody browsing notices that two lip treatments share a picture of lips,
 * and everybody notices a massage on a hair page. So a treatment now draws
 * only from photographs of what it actually is, and evenness applies inside
 * that pool rather than across the whole library.
 *
 * Run: npx tsx prisma/reassign-images.ts
 */
import fs from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

import { STOCK, type StockTheme } from "./stock-manifest";
import { EXPANSION, NEW_CATEGORIES } from "./catalogue-expansion";
import { CATEGORIES_2 } from "./catalogue-categories-2";

const prisma = new PrismaClient();

const SEEDS = [...EXPANSION, ...NEW_CATEGORIES, ...CATEGORIES_2];

/** A treatment's own theme when we seeded it; otherwise its category's. */
const themeByPath = new Map<string, StockTheme>();
const themeByCategory = new Map<string, StockTheme>();
for (const c of SEEDS) {
  themeByCategory.set(c.slug, c.theme);
  for (const t of c.treatments) themeByPath.set(`${c.slug}/${t.slug}`, t.theme);
}

/**
 * Categories the original 108 came from, which carry no per-treatment theme.
 * Mapped by what the category is about, so those treatments are illustrated
 * as sensibly as the seeded ones.
 */
const FALLBACK_BY_CATEGORY: Record<string, StockTheme> = {
  "glass-skin": "facial",
  lifting: "device",
  botox: "injectable",
  fillers: "injectable",
  laser: "device",
  "hair-removal": "device",
  "hair-restoration": "hair",
  "acne-scars": "clinical",
  pigmentation: "device",
  eyes: "injectable",
  nose: "injectable",
  "face-contour": "injectable",
  "body-fat": "body",
  wellness: "clinical",
  bridal: "portrait",
  mens: "portrait",
  dental: "dental",
  "skin-health": "clinical",
};

const byTheme = new Map<StockTheme, typeof STOCK>();
for (const p of STOCK) {
  byTheme.set(p.theme, [...(byTheme.get(p.theme) ?? []), p]);
}

async function main() {
  const used = new Map<string, number>(STOCK.map((p) => [p.id, 0]));

  const categories = await prisma.hubCategory.findMany({
    orderBy: { sortOrder: "asc" },
    select: {
      slug: true,
      name: true,
      treatments: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, slug: true },
      },
    },
  });

  let assigned = 0;
  const themeCounts = new Map<StockTheme, number>();

  for (const c of categories) {
    // Photographs already handed out inside this category, so a repeat only
    // happens once the category has exhausted its theme.
    const takenHere = new Set<string>();

    for (const t of c.treatments) {
      const theme =
        themeByPath.get(`${c.slug}/${t.slug}`) ??
        themeByCategory.get(c.slug) ??
        FALLBACK_BY_CATEGORY[c.slug] ??
        "clinical";

      const pool = byTheme.get(theme) ?? [];
      if (pool.length === 0) continue;

      // Prefer one this category has not used yet; otherwise the least-used
      // in the theme. Never leave the theme — that is the whole point.
      const fresh = pool.filter((p) => !takenHere.has(p.id));
      const candidates = fresh.length ? fresh : pool;
      candidates.sort((a, b) => (used.get(a.id) ?? 0) - (used.get(b.id) ?? 0));

      const pick = candidates[0];
      used.set(pick.id, (used.get(pick.id) ?? 0) + 1);
      takenHere.add(pick.id);
      themeCounts.set(theme, (themeCounts.get(theme) ?? 0) + 1);

      await prisma.hubTreatment.update({
        where: { id: t.id },
        data: { image: `/images/treatments/${pick.id}.jpg` },
      });
      assigned += 1;
    }

    // The category cover follows the same rule.
    const catTheme =
      themeByCategory.get(c.slug) ?? FALLBACK_BY_CATEGORY[c.slug] ?? "clinical";
    const catPool = [...(byTheme.get(catTheme) ?? [])].sort(
      (a, b) => (used.get(a.id) ?? 0) - (used.get(b.id) ?? 0)
    );
    if (catPool.length) {
      await prisma.hubCategory.update({
        where: { slug: c.slug },
        data: { image: `/images/treatments/${catPool[0].id}.jpg` },
      });
    }
  }

  const counts = [...used.values()];
  console.log(`
re-assigned ${assigned} treatment images, relevance first

  photos in pool     ${STOCK.length}
  photos used        ${counts.filter((n) => n > 0).length}
  busiest photo      ${Math.max(...counts)} treatments
`);

  console.log("demand vs supply, by theme:");
  for (const [theme, demand] of [...themeCounts].sort((a, b) => b[1] - a[1])) {
    const supply = (byTheme.get(theme) ?? []).length;
    const each = (demand / supply).toFixed(1);
    console.log(
      `  ${theme.padEnd(11)} ${String(demand).padStart(3)} treatments / ${String(supply).padStart(2)} photos  = ${each} each`
    );
  }

  // The honest gap list, rewritten for the new assignment.
  const rows = await prisma.hubTreatment.findMany({
    select: {
      slug: true,
      name: true,
      image: true,
      category: { select: { name: true } },
    },
    orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
  });
  const byImage = new Map<string, typeof rows>();
  for (const r of rows) byImage.set(r.image, [...(byImage.get(r.image) ?? []), r]);
  const shared = rows.filter((r) => (byImage.get(r.image)?.length ?? 0) > 1);

  const csv = [
    "category,treatment,slug,current_image,shared_with",
    ...shared.map((r) => {
      const others = (byImage.get(r.image) ?? [])
        .filter((o) => o.slug !== r.slug)
        .map((o) => o.name)
        .join("; ");
      return `"${r.category.name}","${r.name}","${r.slug}","${r.image}","${others}"`;
    }),
  ].join("\n");

  const out = path.join(process.cwd(), "docs", "image-gap.csv");
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, csv, "utf8");
  console.log(`\n${shared.length} treatment(s) share a photo — docs/image-gap.csv`);
}

main().finally(() => prisma.$disconnect());
