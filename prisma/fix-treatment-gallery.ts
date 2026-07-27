/**
 * Corrective update of specific treatment-detail GALLERY images (the alternating
 * "zig-zag" rows on /treatments/[slug]). The audit found a handful of gallery
 * rows that were irrelevant, off-brand, or wrong:
 *   - body-contouring: a running-track exercise shot + tape-measure weight-loss
 *     vibe + generic consult  → aesthetic body-contouring device treatments
 *   - fat-dissolving: two outdoor lifestyle portraits + ambiguous shot
 *     → clinical submental/jaw injections + double-chin target area
 *   - laser-toning[1]: a photo with "HOUSE OF SKINCARE" clinic branding
 *     → unbranded laser facial
 *   - prp-hair[0]: a dyed-hair close-up → hair-loss concern
 *   - cosmeceuticals[2]: garish branded yellow tubes → premium skincare set
 *
 * Targets rows by (treatment slug, sortOrder). Uses direct Pexels URLs, matching
 * the hero-image fix (prisma/fix-treatment-images.ts) — images.pexels.com is
 * allow-listed in next.config.js. Idempotent. Run on local AND prod (deploys
 * don't re-seed, and /treatments/[slug] is SSG, so run this BEFORE the build).
 *
 *   npx tsx prisma/fix-treatment-gallery.ts          # dry run
 *   npx tsx prisma/fix-treatment-gallery.ts --write  # apply
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ log: ["warn", "error"] });
const WRITE = process.argv.includes("--write");

const P = (id: number) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1400`;

/** slug -> { sortOrder: corrected image } for the gallery rows to replace. */
const GALLERY: Record<string, Record<number, string>> = {
  "body-contouring": { 0: P(5042605), 1: P(7772681), 2: P(27659253) },
  "fat-dissolving": { 0: P(4586708), 1: P(7581583), 2: P(8076091) },
  "laser-toning": { 1: P(4586726) },
  "prp-hair": { 0: P(9755382) },
  cosmeceuticals: { 2: P(3785147) },
};

async function main() {
  let planned = 0;
  let updated = 0;
  for (const [slug, bySort] of Object.entries(GALLERY)) {
    const t = await prisma.treatment.findUnique({
      where: { slug },
      select: { id: true, images: { select: { id: true, sortOrder: true } } },
    });
    if (!t) {
      console.log(`  SKIP ${slug} (treatment not found)`);
      continue;
    }
    for (const [sortStr, url] of Object.entries(bySort)) {
      planned++;
      const sortOrder = Number(sortStr);
      const row = t.images.find((im) => im.sortOrder === sortOrder);
      if (!row) {
        console.log(`  SKIP ${slug}[${sortOrder}] (no gallery row at that index)`);
        continue;
      }
      if (!WRITE) {
        console.log(`  would set ${slug}[${sortOrder}] -> ${url}`);
        continue;
      }
      await prisma.treatmentImage.update({ where: { id: row.id }, data: { url } });
      updated++;
      console.log(`  set ${slug}[${sortOrder}]`);
    }
  }
  console.log(`\n${WRITE ? "Updated" : "Would update"} ${WRITE ? updated : planned} gallery images.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
