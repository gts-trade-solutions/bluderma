/**
 * Curated, capped product↔treatment mapping for the procedure/condition
 * treatments that have no dedicated SKUs in the KORMART product price list
 * (laser toning, thread lift, HIFU, microneedling, scar revision, pigmentation,
 * acne, rosacea, melasma, anti-ageing) plus thinly-stocked ones (prp-hair,
 * chemical-peels).
 *
 * For each target it draws from clinically-relevant product CATEGORIES, ranked
 * by how many condition keywords appear in the product's enriched text
 * (name + description + composition + bullets), price as a tiebreak, and caps
 * the total so no treatment is overloaded. Injectable treatments keep their full
 * native lists untouched. Added links are non-primary (isPrimary:false) and sort
 * after any primary products.
 *
 * Idempotent (skips links that already exist). Runtime source of truth is the
 * DB, so run on local AND prod. NOTE: a catalog re-seed replaces a product's
 * treatment links wholesale, so re-run this after any `db:seed:catalog`.
 *
 *   npx tsx prisma/map-condition-products.ts          # dry run (prints picks)
 *   npx tsx prisma/map-condition-products.ts --write  # apply
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ log: ["warn", "error"] });
const WRITE = process.argv.includes("--write");

type Target = {
  slug: string;
  cats: string[];
  keywords: string[];
  /** Desired total product count for the treatment (existing + added). */
  total: number;
};

const TARGETS: Target[] = [
  { slug: "pigmentation", total: 10, cats: ["Cosmeceutical", "Skin Booster", "Exosome", "IV Therapy"],
    keywords: ["pigment", "melasma", "bright", "whiten", "glutathione", "tranexamic", "dark spot", "tone", "radian", "dull", "even"] },
  { slug: "melasma-treatment", total: 10, cats: ["Cosmeceutical", "Skin Booster", "Exosome", "IV Therapy"],
    keywords: ["melasma", "pigment", "bright", "whiten", "glutathione", "tranexamic", "dark spot", "tone", "even"] },
  { slug: "acne-treatment", total: 10, cats: ["Cosmeceutical", "Exosome", "Skin Booster"],
    keywords: ["acne", "blemish", "sebum", "pore", "oily", "breakout", "clarif", "purif", "spot", "scar"] },
  { slug: "rosacea-treatment", total: 8, cats: ["Cosmeceutical", "Exosome", "Skin Booster"],
    keywords: ["rosacea", "redness", "calm", "sooth", "sensitiv", "barrier", "hydrat", "anti-inflam"] },
  { slug: "anti-aging-program", total: 12, cats: ["Biostimulator (PLLA/PCL)", "Biostimulator (CaHA)", "Skin Booster", "Botulinum Toxin", "HA Filler", "Exosome"],
    keywords: ["wrinkle", "aging", "ageing", "firm", "elasticity", "collagen", "rejuven", "lift", "fine line", "anti-aging", "youth"] },
  { slug: "microneedling", total: 10, cats: ["Exosome", "Skin Booster", "Topical Anaesthetic", "Cosmeceutical"],
    keywords: ["texture", "pore", "microneedl", "regenerat", "rejuven", "scar", "collagen", "resurfac"] },
  { slug: "scar-revision", total: 9, cats: ["Exosome", "Biostimulator (PLLA/PCL)", "Skin Booster", "Cosmeceutical"],
    keywords: ["scar", "texture", "resurfac", "regenerat", "heal", "repair", "collagen"] },
  { slug: "thread-lift", total: 8, cats: ["Biostimulator (PLLA/PCL)", "Biostimulator (CaHA)", "HA Filler", "Topical Anaesthetic"],
    keywords: ["lift", "collagen", "firm", "contour", "sag", "elasticity", "tighten"] },
  { slug: "hifu-ultherapy", total: 8, cats: ["Exosome", "Skin Booster", "Biostimulator (PLLA/PCL)", "Medical Device"],
    keywords: ["lift", "firm", "tighten", "collagen", "elasticity", "contour"] },
  { slug: "laser-toning", total: 8, cats: ["Cosmeceutical", "Exosome", "Topical Anaesthetic", "Medical Device"],
    keywords: ["bright", "pigment", "tone", "calm", "sooth", "barrier", "regenerat", "even"] },
  { slug: "prp-hair", total: 8, cats: ["Exosome", "Skin Booster"],
    keywords: ["hair", "scalp", "follicle", "alopecia", "thinning", "growth"] },
  { slug: "chemical-peels", total: 8, cats: ["Cosmeceutical", "Exosome", "Skin Booster"],
    keywords: ["peel", "exfoliat", "texture", "bright", "resurfac", "pore", "renew", "acid"] },
];

function priceOf(p: { priceInr: number | null; variants: { priceInr: number | null }[] }): number {
  if (p.priceInr != null) return p.priceInr;
  const vs = p.variants.map((v) => v.priceInr).filter((n): n is number => n != null);
  return vs.length ? Math.min(...vs) : 0;
}

async function main() {
  const products = await prisma.product.findMany({
    where: { isPublished: true },
    select: {
      id: true, slug: true, name: true, category: true, priceInr: true,
      description: true, composition: true, howItWorks: true,
      variants: { select: { priceInr: true } },
      bullets: { select: { text: true } },
      treatments: { select: { treatment: { select: { slug: true } } } },
    },
  });

  const treatmentIdBySlug = new Map(
    (await prisma.treatment.findMany({ select: { id: true, slug: true } })).map((t) => [t.slug, t.id])
  );

  const text = (p: (typeof products)[number]) =>
    [p.name, p.description, p.composition, p.howItWorks, ...p.bullets.map((b) => b.text)]
      .filter(Boolean).join(" \n ").toLowerCase();

  let totalAdded = 0;

  for (const tgt of TARGETS) {
    const tId = treatmentIdBySlug.get(tgt.slug);
    if (!tId) { console.log(`  SKIP ${tgt.slug} (treatment not found)`); continue; }

    const already = new Set(
      products.filter((p) => p.treatments.some((tp) => tp.treatment.slug === tgt.slug)).map((p) => p.id)
    );
    const need = tgt.total - already.size;
    if (need <= 0) { console.log(`  ${tgt.slug}: already ${already.size} (target ${tgt.total}) — no change`); continue; }

    const candidates = products
      .filter((p) => tgt.cats.includes(p.category) && !already.has(p.id))
      .map((p) => {
        const t = text(p);
        const score = tgt.keywords.reduce((n, k) => n + (t.includes(k) ? 1 : 0), 0);
        return { p, score, price: priceOf(p) };
      })
      // keyword relevance first, then premium/flagship as a tiebreak
      .sort((a, b) => (b.score - a.score) || (b.price - a.price) || a.p.name.localeCompare(b.p.name));

    const picks = candidates.slice(0, need);
    console.log(`  ${tgt.slug}: have ${already.size}, adding ${picks.length} -> total ${already.size + picks.length}`);
    for (const c of picks) {
      console.log(`      + ${c.p.name}  [${c.p.category}] kw=${c.score}`);
      if (WRITE) {
        await prisma.treatmentProduct.upsert({
          where: { treatmentId_productId: { treatmentId: tId, productId: c.p.id } },
          update: {},
          create: { treatmentId: tId, productId: c.p.id, isPrimary: false, sortOrder: 500 },
        });
      }
      totalAdded++;
    }
  }
  console.log(`\n${WRITE ? "Added" : "Would add"} ${totalAdded} product links.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
