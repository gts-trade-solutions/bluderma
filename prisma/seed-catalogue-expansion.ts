/**
 * Merges the expansion catalogue into the hub and gives every treatment an
 * image of its own.
 *
 * Image assignment is the interesting part. There are more treatments than
 * photographs, so a naive loop would put the same picture on treatments
 * sitting next to each other — which is exactly what looks wrong. Instead
 * each treatment draws from the pool matching what it actually depicts
 * (a scalp procedure never illustrates itself with a lip filler photo), and
 * the assigner walks that pool so a photograph is never repeated inside a
 * category and is spread as far as possible across the catalogue.
 *
 * The script reports honestly how many photographs ended up doing double
 * duty, and writes the gap list, so filling it is a known piece of work
 * rather than a discovery months later.
 *
 * Run: npx tsx prisma/seed-catalogue-expansion.ts
 */
import fs from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

import { EXPANSION, NEW_CATEGORIES, type SeedCategory } from "./catalogue-expansion";
import { CATEGORIES_2 } from "./catalogue-categories-2";
import { STOCK, type StockPhoto, type StockTheme } from "./stock-manifest";

const prisma = new PrismaClient();

/** Themes fall back in this order when their own pool runs dry. */
const FALLBACK: Record<StockTheme, StockTheme[]> = {
  facial: ["facial", "portrait", "product", "clinical"],
  product: ["product", "facial", "portrait", "clinical"],
  portrait: ["portrait", "facial", "clinical", "product"],
  injectable: ["injectable", "clinical", "facial", "portrait"],
  device: ["device", "clinical", "facial", "portrait"],
  hair: ["hair", "clinical", "portrait", "facial"],
  body: ["body", "device", "clinical", "portrait"],
  dental: ["dental", "portrait", "clinical", "facial"],
  clinical: ["clinical", "portrait", "facial", "device"],
};

/**
 * Hands out photographs, least-used first within the requested theme, so the
 * load spreads evenly instead of exhausting the front of each pool.
 */
class ImageAssigner {
  private used = new Map<string, number>();

  constructor() {
    for (const p of STOCK) this.used.set(p.id, 0);
  }

  /**
   * Selection order, and the order matters more than it looks:
   *
   *   1. an unused photo from the closest matching theme
   *   2. an unused photo from any theme
   *   3. the least-used photo from the closest matching theme
   *   4. the least-used photo anywhere
   *
   * Steps 1 and 2 come before any repeat because a large pool like portraits
   * never empties for a single category, so a theme-first search would reuse
   * portraits forever while the dental photographs were never touched once.
   *
   * @param taken ids already used inside this category.
   */
  next(theme: StockTheme, taken: Set<string>): { url: string; alt: string } {
    const chain = FALLBACK[theme];
    const unused = (p: StockPhoto) => (this.used.get(p.id) ?? 0) === 0;
    const free = (p: StockPhoto) => !taken.has(p.id);
    const byUsage = (a: StockPhoto, b: StockPhoto) =>
      (this.used.get(a.id) ?? 0) - (this.used.get(b.id) ?? 0);

    for (const t of chain) {
      const pool = STOCK.filter((p) => p.theme === t && free(p) && unused(p));
      if (pool.length) return this.take(pool[0], taken);
    }

    const anyFresh = STOCK.filter((p) => free(p) && unused(p));
    if (anyFresh.length) return this.take(anyFresh[0], taken);

    // Past this point every photograph has been used at least once, so the
    // question is which to repeat. Fewest-uses wins outright and theme only
    // breaks ties: ranking by theme first let the injectable pool climb to
    // seven uses while portraits sat at one.
    const rank = (p: StockPhoto) => {
      const i = chain.indexOf(p.theme);
      return i === -1 ? chain.length : i;
    };
    const order = (a: StockPhoto, b: StockPhoto) =>
      byUsage(a, b) || rank(a) - rank(b);

    const rest = STOCK.filter(free).sort(order);
    const pool = rest.length ? rest : [...STOCK].sort(order);
    return this.take(pool[0], taken);
  }

  private take(pick: StockPhoto, taken: Set<string>) {
    this.used.set(pick.id, (this.used.get(pick.id) ?? 0) + 1);
    taken.add(pick.id);
    return { url: `/images/treatments/${pick.id}.jpg`, alt: pick.alt };
  }

  report() {
    const counts = [...this.used.values()];
    return {
      distinctUsed: counts.filter((c) => c > 0).length,
      unused: counts.filter((c) => c === 0).length,
      reused: counts.filter((c) => c > 1).length,
      maxTimes: Math.max(0, ...counts),
    };
  }
}

async function main() {
  const assigner = new ImageAssigner();
  const all: SeedCategory[] = [...EXPANSION, ...NEW_CATEGORIES, ...CATEGORIES_2];

  let createdCategories = 0;
  let createdTreatments = 0;
  let updatedTreatments = 0;

  // Existing categories keep their position; new ones go after them.
  const highestOrder = await prisma.hubCategory.aggregate({
    _max: { sortOrder: true },
  });
  let nextOrder = (highestOrder._max.sortOrder ?? 0) + 1;

  for (const c of all) {
    const existing = await prisma.hubCategory.findUnique({
      where: { slug: c.slug },
      select: { id: true },
    });

    const category = existing
      ? { id: existing.id }
      : await prisma.hubCategory.create({
          data: {
            slug: c.slug,
            name: c.name,
            icon: c.icon,
            blurb: c.blurb,
            intro: c.intro,
            tint: c.tint,
            // A new category needs a cover; take one from its own theme.
            image: assigner.next(c.theme, new Set()).url,
            sortOrder: nextOrder++,
          },
          select: { id: true },
        });
    if (!existing) createdCategories += 1;

    // Photographs already used by this category's existing treatments must
    // not be handed out again inside it.
    const taken = new Set<string>();
    const current = await prisma.hubTreatment.findMany({
      where: { categoryId: category.id },
      select: { slug: true, image: true, sortOrder: true },
    });
    for (const t of current) {
      const m = t.image.match(/\/images\/treatments\/(photo-[\w-]+)\.jpg$/);
      if (m) taken.add(m[1]);
    }

    let order = Math.max(0, ...current.map((t) => t.sortOrder), -1) + 1;

    for (const t of c.treatments) {
      const known = current.find((x) => x.slug === t.slug);

      if (known) {
        // Already present — copy is left alone; images are assigned below.
        updatedTreatments += 1;
      } else {
        await prisma.hubTreatment.create({
          data: {
            categoryId: category.id,
            slug: t.slug,
            name: t.name,
            blurb: t.blurb,
            // Placeholder; the global pass below assigns the real image.
            image: "",
            meta: t.meta,
            sortOrder: order++,
          },
        });
        createdTreatments += 1;
      }
    }
  }

  // Every treatment is re-imaged in a single pass, after all rows exist.
  // Doing it per-category during creation meant the categories seeded first
  // drained the small pools and the ones seeded last repeated heavily; one
  // global pass is the only way the spread comes out even.
  const themeOf = new Map<string, StockTheme>();
  for (const c of all) {
    for (const t of c.treatments) themeOf.set(`${c.slug}/${t.slug}`, t.theme);
  }

  const categories = await prisma.hubCategory.findMany({
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      slug: true,
      treatments: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, slug: true },
      },
    },
  });

  let reimaged = 0;
  for (const c of categories) {
    const taken = new Set<string>();
    const seed = all.find((x) => x.slug === c.slug);
    for (const t of c.treatments) {
      const theme = themeOf.get(`${c.slug}/${t.slug}`) ?? seed?.theme ?? "clinical";
      const image = assigner.next(theme, taken);
      await prisma.hubTreatment.update({
        where: { id: t.id },
        data: { image: image.url },
      });
      reimaged += 1;
    }
  }

  const totals = await Promise.all([
    prisma.hubCategory.count(),
    prisma.hubTreatment.count(),
  ]);
  const stats = assigner.report();

  console.log(`
catalogue expansion complete
  categories      ${totals[0]}  (+${createdCategories} new)
  treatments      ${totals[1]}  (+${createdTreatments} new, ${updatedTreatments} existing, ${reimaged} imaged)

images
  in the pool     ${STOCK.length}
  actually used   ${stats.distinctUsed}
  never used      ${stats.unused}
  used more once  ${stats.reused}
  busiest photo   ${stats.maxTimes} treatments
`);

  // The honest gap list: every treatment sharing a photograph, so filling it
  // is a tracked job rather than something discovered by a client.
  const rows = await prisma.hubTreatment.findMany({
    select: { slug: true, name: true, image: true, category: { select: { name: true } } },
    orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
  });
  const byImage = new Map<string, typeof rows>();
  for (const r of rows) {
    byImage.set(r.image, [...(byImage.get(r.image) ?? []), r]);
  }
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
  console.log(
    `${shared.length} treatment(s) share a photograph — listed in docs/image-gap.csv`
  );
}

main().finally(() => prisma.$disconnect());
