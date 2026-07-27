/**
 * One-off corrective update of treatment hero images. The seeded Unsplash
 * photos for several treatments were irrelevant, too clinical/intense, or plain
 * wrong (gym/exercise shots for body treatments, a coronavirus render for
 * "clinic supplies", competitor-branded product shots, etc.). This replaces
 * them with accurate, calm, on-brand stock (Pexels, already allow-listed in
 * next.config.js). Idempotent — sets image by slug.
 *
 * Runtime source of truth is the DB (deploys don't re-seed), so this runs
 * against local AND prod. The committed seed src/data/treatments.ts and the
 * private prisma/catalog.ts are updated to match so a future re-seed won't
 * regress.
 *
 *   npx tsx prisma/fix-treatment-images.ts          # dry run
 *   npx tsx prisma/fix-treatment-images.ts --write  # apply
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ log: ["warn", "error"] });
const WRITE = process.argv.includes("--write");

/** Pexels CDN URL for a photo id, at the width the treatment cards expect. */
const P = (id: number) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1400`;

/** slug -> corrected image. Only the audited-as-wrong treatments are listed. */
const IMAGES: Record<string, string> = {
  "laser-toning": P(3985356),
  "thread-lift": P(3762410),
  "prp-hair": P(28994388),
  microneedling: P(5042629),
  "body-contouring": P(7772642),
  "fat-dissolving": P(3985319),
  "iv-wellness-drips": P(4421486),
  "exosome-therapy": P(8533080),
  "numbing-adjuncts": P(5240619),
  cosmeceuticals: P(6167446),
  "clinic-supplies-devices": P(8460227),
  "collagen-biostimulators": P(3762756),
};

async function main() {
  const entries = Object.entries(IMAGES);
  console.log(`Treatments to fix: ${entries.length}${WRITE ? "" : " (dry run)"}`);
  let updated = 0;
  for (const [slug, image] of entries) {
    const existing = await prisma.treatment.findUnique({
      where: { slug },
      select: { slug: true },
    });
    if (!existing) {
      console.log(`  SKIP ${slug} (not found)`);
      continue;
    }
    if (!WRITE) {
      console.log(`  would set ${slug} -> ${image}`);
      continue;
    }
    await prisma.treatment.update({ where: { slug }, data: { image } });
    updated++;
    console.log(`  set ${slug}`);
  }
  console.log(`\n${WRITE ? "Updated" : "Would update"} ${updated || entries.length} treatments.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
