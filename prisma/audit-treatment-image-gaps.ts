/**
 * Audits treatment imagery across the clinician catalogue and patient hub.
 *
 * Writes CSV reports to docs/ so duplicate/missing images can be fixed from a
 * licensed source manifest instead of hunting through the admin UI.
 *
 * Run:
 *   npx tsx prisma/audit-treatment-image-gaps.ts
 */
import fs from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ log: ["warn", "error"] });

function csv(value: unknown): string {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function isRemote(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

function ownBases(): string[] {
  const bases: string[] = [];
  if (process.env.CDN_BASE_URL) bases.push(process.env.CDN_BASE_URL.replace(/\/$/, ""));
  if (process.env.S3_BUCKET && process.env.AWS_REGION) {
    bases.push(`https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com`);
    bases.push(`https://s3.${process.env.AWS_REGION}.amazonaws.com/${process.env.S3_BUCKET}`);
  }
  return bases;
}

function storageState(url: string, bases: string[]): string {
  if (!url) return "missing";
  if (url.startsWith("/")) return "local-public";
  if (bases.some((b) => url.startsWith(b))) return "s3";
  if (isRemote(url)) return "external";
  return "unknown";
}

async function main() {
  const bases = ownBases();

  const treatments = await prisma.treatment.findMany({
    orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    select: {
      slug: true,
      name: true,
      image: true,
      category: { select: { name: true } },
      images: {
        orderBy: [{ kind: "asc" }, { sortOrder: "asc" }],
        select: { kind: true, url: true, sortOrder: true, caption: true },
      },
    },
  });

  const hubTreatments = await prisma.hubTreatment.findMany({
    orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    select: {
      slug: true,
      name: true,
      image: true,
      category: { select: { slug: true, name: true } },
    },
  });

  const heroUse = new Map<string, typeof treatments>();
  for (const t of treatments) heroUse.set(t.image, [...(heroUse.get(t.image) ?? []), t]);

  const treatmentImageUse = new Map<string, { slug: string; name: string; kind: string; sortOrder: number }[]>();
  for (const t of treatments) {
    for (const img of t.images) {
      treatmentImageUse.set(img.url, [
        ...(treatmentImageUse.get(img.url) ?? []),
        { slug: t.slug, name: t.name, kind: img.kind, sortOrder: img.sortOrder },
      ]);
    }
  }

  const hubUse = new Map<string, typeof hubTreatments>();
  for (const t of hubTreatments) hubUse.set(t.image, [...(hubUse.get(t.image) ?? []), t]);

  const treatmentRows = [
    ["catalogue", "category", "treatment", "slug", "slot", "sort_order", "url", "storage", "duplicate_count", "issue"].join(","),
  ];

  for (const t of treatments) {
    const heroDupes = heroUse.get(t.image)?.length ?? 0;
    const issue = [
      !t.image && "missing hero",
      heroDupes > 1 && "duplicate hero",
      t.images.filter((i) => i.kind === "GALLERY").length < 3 && "less than 3 gallery images",
      t.images.filter((i) => i.kind === "RESULT").length === 0 && "no result images",
    ].filter(Boolean).join("; ");

    treatmentRows.push([
      "treatment",
      csv(t.category.name),
      csv(t.name),
      csv(t.slug),
      "HERO",
      "0",
      csv(t.image),
      storageState(t.image, bases),
      String(heroDupes),
      csv(issue),
    ].join(","));

    for (const img of t.images) {
      const dupes = treatmentImageUse.get(img.url)?.length ?? 0;
      treatmentRows.push([
        "treatment",
        csv(t.category.name),
        csv(t.name),
        csv(t.slug),
        img.kind,
        String(img.sortOrder),
        csv(img.url),
        storageState(img.url, bases),
        String(dupes),
        csv(dupes > 1 ? "duplicate image row" : ""),
      ].join(","));
    }
  }

  const hubRows = [
    ["catalogue", "category", "treatment", "category_slug", "slug", "url", "storage", "duplicate_count", "issue"].join(","),
  ];
  for (const t of hubTreatments) {
    const dupes = hubUse.get(t.image)?.length ?? 0;
    hubRows.push([
      "hub",
      csv(t.category.name),
      csv(t.name),
      csv(t.category.slug),
      csv(t.slug),
      csv(t.image),
      storageState(t.image, bases),
      String(dupes),
      csv([!t.image && "missing image", dupes > 1 && "duplicate hub image"].filter(Boolean).join("; ")),
    ].join(","));
  }

  const outDir = path.join(process.cwd(), "docs");
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, "treatment-image-audit.csv"), treatmentRows.join("\n"), "utf8");
  await fs.writeFile(path.join(outDir, "hub-treatment-image-audit.csv"), hubRows.join("\n"), "utf8");

  const duplicateTreatmentImages = [...treatmentImageUse.values()].filter((rows) => rows.length > 1).length;
  const duplicateHubImages = [...hubUse.values()].filter((rows) => rows.length > 1).length;
  const missingGallery = treatments.filter((t) => t.images.filter((i) => i.kind === "GALLERY").length < 3).length;
  const missingResults = treatments.filter((t) => t.images.filter((i) => i.kind === "RESULT").length === 0).length;

  console.log(`treatments: ${treatments.length}`);
  console.log(`hub treatments: ${hubTreatments.length}`);
  console.log(`duplicate treatment image URLs: ${duplicateTreatmentImages}`);
  console.log(`duplicate hub hero URLs: ${duplicateHubImages}`);
  console.log(`treatments with fewer than 3 gallery images: ${missingGallery}`);
  console.log(`treatments with no result images: ${missingResults}`);
  console.log("wrote docs/treatment-image-audit.csv");
  console.log("wrote docs/hub-treatment-image-audit.csv");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
