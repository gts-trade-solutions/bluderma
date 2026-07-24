/**
 * Applies web-sourced section images to treatments, storing them as GALLERY
 * TreatmentImage rows (sortOrder 0..n) that the treatment page's alternating
 * rows consume. Idempotent: replaces the existing GALLERY rows for each
 * treatment. Hero (Treatment.image) and other typed slots are untouched.
 *
 * Reads a JSON array [{slug, images:[url...]}] from the CLI arg.
 * Usage: npx tsx prisma/apply-treatment-images.ts prisma/enrich-timg-1.json
 */
import { readFileSync } from "fs";
import { PrismaClient, TreatmentImageKind } from "@prisma/client";

const prisma = new PrismaClient({ log: ["warn", "error"] });

interface Rec {
  slug: string;
  images: string[];
}

const MAX = 4;

async function main() {
  const path = process.argv[2];
  if (!path) throw new Error("pass a JSON file path");
  const records = JSON.parse(readFileSync(path, "utf8")) as Rec[];

  let done = 0;
  const missing: string[] = [];

  for (const r of records) {
    const treatment = await prisma.treatment.findUnique({
      where: { slug: r.slug },
      select: { id: true, name: true },
    });
    if (!treatment) {
      missing.push(r.slug);
      continue;
    }

    const urls = (r.images ?? [])
      .map((u) => u.trim())
      .filter(Boolean)
      .slice(0, MAX);
    if (urls.length === 0) continue;

    await prisma.$transaction([
      prisma.treatmentImage.deleteMany({
        where: { treatmentId: treatment.id, kind: TreatmentImageKind.GALLERY },
      }),
      prisma.treatmentImage.createMany({
        data: urls.map((url, sortOrder) => ({
          treatmentId: treatment.id,
          kind: TreatmentImageKind.GALLERY,
          url,
          sortOrder,
        })),
      }),
    ]);

    done++;
    console.log(`  ✓ ${treatment.name} — ${urls.length} section images`);
  }

  console.log(`\nApplied ${done}/${records.length} treatments.`);
  if (missing.length) console.log(`  ! no treatment for: ${missing.join(", ")}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
