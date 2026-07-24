/**
 * Applies web-researched product enrichment to the catalogue.
 *
 * Reads a JSON array (path as the first CLI arg, default prisma/enrich-data.json)
 * of enrichment records and updates each matching product: details, feature /
 * benefit / indication bullets, and up to 5 image URLs. Idempotent — bullets
 * and images are replaced wholesale, and enrichedAt/sourceUrl mark the product
 * as done so the staged pass is resumable.
 *
 * Usage: npx tsx prisma/enrich.ts prisma/enrich-botox.json
 */
import { readFileSync } from "fs";
import { PrismaClient, ProductBulletKind } from "@prisma/client";

const prisma = new PrismaClient({ log: ["warn", "error"] });

interface EnrichRecord {
  slug: string;
  brand?: string | null;
  description?: string;
  howItWorks?: string;
  composition?: string;
  usageNotes?: string;
  tagline?: string;
  features?: string[];
  benefits?: string[];
  indications?: string[];
  images?: string[];
  sourceUrl?: string | null;
}

const MAX_IMAGES = 5;
const clean = (arr?: string[]) =>
  (arr ?? []).map((s) => s.trim()).filter(Boolean);

async function main() {
  const path = process.argv[2] ?? "prisma/enrich-data.json";
  const records = JSON.parse(readFileSync(path, "utf8")) as EnrichRecord[];
  console.log(`Enriching from ${path} (${records.length} records)…\n`);

  let updated = 0;
  const missing: string[] = [];

  for (const r of records) {
    const product = await prisma.product.findUnique({
      where: { slug: r.slug },
      select: { id: true, name: true },
    });
    if (!product) {
      missing.push(r.slug);
      continue;
    }

    const features = clean(r.features);
    const benefits = clean(r.benefits);
    const indications = clean(r.indications);
    const images = clean(r.images).slice(0, MAX_IMAGES);

    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: product.id },
        data: {
          brand: r.brand ?? undefined,
          tagline: r.tagline?.trim() || undefined,
          description: r.description?.trim() || null,
          howItWorks: r.howItWorks?.trim() || null,
          composition: r.composition?.trim() || null,
          usageNotes: r.usageNotes?.trim() || null,
          sourceUrl: r.sourceUrl?.trim() || null,
          enrichedAt: new Date(),
        },
      });

      await tx.productBullet.deleteMany({ where: { productId: product.id } });
      const rows = [
        ...features.map((text, i) => ({ kind: ProductBulletKind.FEATURE, text, sortOrder: i })),
        ...benefits.map((text, i) => ({ kind: ProductBulletKind.BENEFIT, text, sortOrder: i })),
        ...indications.map((text, i) => ({ kind: ProductBulletKind.INDICATION, text, sortOrder: i })),
      ].map((b) => ({ ...b, productId: product.id }));
      if (rows.length) await tx.productBullet.createMany({ data: rows });

      // Only replace images when the record actually carries some, so a
      // details-only enrichment doesn't wipe manually-added photos.
      if (images.length) {
        await tx.productImage.deleteMany({ where: { productId: product.id } });
        await tx.productImage.createMany({
          data: images.map((url, sortOrder) => ({
            productId: product.id,
            url,
            sortOrder,
          })),
        });
      }
    });

    updated++;
    console.log(
      `  ✓ ${product.name}  (${features.length}f/${benefits.length}b/${indications.length}i, ${images.length} img)`
    );
  }

  console.log(`\nEnriched ${updated}/${records.length} products.`);
  if (missing.length) {
    console.log(`  ! no product for slugs: ${missing.join(", ")}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
