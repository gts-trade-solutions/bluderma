/**
 * Imports approved treatment images, uploads them to S3, registers MediaAsset,
 * and links the final CDN/S3 URL back to the database.
 *
 * This intentionally expects a manifest of licensed/consented source URLs or
 * local public paths. It does not scrape search results or fabricate clinical
 * before/after outcomes.
 *
 * Manifest shape:
 * [
 *   {
 *     "type": "treatment",
 *     "slug": "acne-treatment",
 *     "hero": { "source": "https://...", "alt": "..." },
 *     "gallery": [{ "source": "https://...", "caption": "Consultation" }],
 *     "results": [{ "source": "https://...", "caption": "12 week result" }],
 *     "beforeAfter": [{ "source": "https://...", "caption": "Before and after" }]
 *   },
 *   {
 *     "type": "hubTreatment",
 *     "categorySlug": "acne-scars",
 *     "slug": "teen-acne",
 *     "hero": { "source": "/images/treatments/photo-....jpg", "alt": "..." }
 *   }
 * ]
 *
 * Run:
 *   npx tsx prisma/import-treatment-image-manifest.ts path/to/manifest.json
 *   npx tsx prisma/import-treatment-image-manifest.ts path/to/manifest.json --write
 *   npx tsx prisma/import-treatment-image-manifest.ts path/to/manifest.json --write --local-review
 *
 * `--local-review` links local public paths without uploading. It is for
 * development previews only; omit it for the normal S3 + MediaAsset flow.
 */
import fs from "node:fs/promises";
import path from "node:path";

import { MediaType, PrismaClient, TreatmentImageKind } from "@prisma/client";

import { buildKey, isConfigured, publicUrlFor, uploadObject } from "../src/lib/storage";

const prisma = new PrismaClient({ log: ["warn", "error"] });
const WRITE = process.argv.includes("--write");
const LOCAL_REVIEW = process.argv.includes("--local-review");

type ImageInput = {
  source: string;
  caption?: string;
  alt?: string;
};

type TreatmentRecord = {
  type?: "treatment";
  slug: string;
  hero?: ImageInput;
  gallery?: ImageInput[];
  results?: ImageInput[];
  beforeAfter?: ImageInput[];
};

type HubRecord = {
  type: "hubTreatment";
  categorySlug: string;
  slug: string;
  hero?: ImageInput;
  beforeAfter?: {
    before: ImageInput;
    after: ImageInput;
  };
  beforeAfterCases?: {
    before: ImageInput;
    after: ImageInput;
  }[];
};

type ManifestRecord = TreatmentRecord | HubRecord;

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
};

function ownBases(): string[] {
  const bases: string[] = [];
  if (process.env.CDN_BASE_URL) bases.push(process.env.CDN_BASE_URL.replace(/\/$/, ""));
  if (process.env.S3_BUCKET && process.env.AWS_REGION) {
    bases.push(`https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com`);
    bases.push(`https://s3.${process.env.AWS_REGION}.amazonaws.com/${process.env.S3_BUCKET}`);
  }
  return bases;
}

function isOwnUrl(source: string): boolean {
  return ownBases().some((base) => source.startsWith(base));
}

function extFromSource(source: string): string {
  const clean = source.split("?")[0].split("#")[0];
  const ext = clean.slice(clean.lastIndexOf(".") + 1).toLowerCase();
  return MIME_BY_EXT[ext] ? ext : "jpg";
}

async function loadImage(source: string): Promise<{ body: Buffer; contentType: string; finalUrl?: string }> {
  if (isOwnUrl(source)) return { body: Buffer.alloc(0), contentType: "image/jpeg", finalUrl: source };

  if (source.startsWith("/")) {
    const local = path.join(process.cwd(), "public", source.replace(/^\/+/, ""));
    const body = await fs.readFile(local);
    return { body, contentType: MIME_BY_EXT[extFromSource(source)] ?? "image/jpeg" };
  }

  if (!/^https?:\/\//i.test(source)) {
    const body = await fs.readFile(path.resolve(process.cwd(), source));
    return { body, contentType: MIME_BY_EXT[extFromSource(source)] ?? "image/jpeg" };
  }

  const res = await fetch(source, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      Accept: "image/avif,image/webp,image/png,image/jpeg,*/*",
    },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim();
  if (!contentType.startsWith("image/")) throw new Error(`not an image (${contentType || "no content-type"})`);
  const body = Buffer.from(await res.arrayBuffer());
  if (!body.byteLength) throw new Error("empty image body");
  return { body, contentType };
}

async function putImage(input: {
  source: string;
  folder: string;
  filename: string;
  alt?: string;
}): Promise<string> {
  if (LOCAL_REVIEW && input.source.startsWith("/")) return input.source;

  const loaded = await loadImage(input.source);
  if (loaded.finalUrl) return loaded.finalUrl;

  const ext = EXT_BY_MIME[loaded.contentType] ?? extFromSource(input.source);
  const key = buildKey(input.folder, `${input.filename}.${ext}`);

  if (!WRITE) return publicUrlFor(key);

  const url = await uploadObject({
    key,
    body: loaded.body,
    contentType: loaded.contentType,
  });

  await prisma.mediaAsset.upsert({
    where: { storageKey: key },
    create: {
      storageKey: key,
      url,
      mimeType: loaded.contentType,
      sizeBytes: loaded.body.byteLength,
      alt: input.alt ?? null,
      mediaType: MediaType.IMAGE,
    },
    update: {
      url,
      mimeType: loaded.contentType,
      sizeBytes: loaded.body.byteLength,
      alt: input.alt ?? null,
    },
  });

  return url;
}

function asList(value: ImageInput[] | undefined): ImageInput[] {
  return Array.isArray(value) ? value.filter((v) => v?.source) : [];
}

async function replaceTreatmentImages(input: {
  treatmentId: string;
  slug: string;
  kind: TreatmentImageKind;
  images: ImageInput[];
}) {
  if (input.images.length === 0) return 0;

  const rows = [];
  for (const [sortOrder, img] of input.images.entries()) {
    const url = await putImage({
      source: img.source,
      folder: `bluderma/treatments/${input.slug}`,
      filename: `${input.slug}-${input.kind.toLowerCase()}-${sortOrder}`,
      alt: img.alt ?? img.caption,
    });
    rows.push({
      treatmentId: input.treatmentId,
      kind: input.kind,
      url,
      caption: img.caption ?? null,
      sortOrder,
    });
  }

  if (WRITE) {
    await prisma.$transaction([
      prisma.treatmentImage.deleteMany({
        where: { treatmentId: input.treatmentId, kind: input.kind },
      }),
      prisma.treatmentImage.createMany({ data: rows }),
    ]);
  }

  return rows.length;
}

async function importTreatment(record: TreatmentRecord) {
  const treatment = await prisma.treatment.findUnique({
    where: { slug: record.slug },
    select: { id: true, name: true },
  });
  if (!treatment) throw new Error(`treatment not found: ${record.slug}`);

  let linked = 0;

  if (record.hero?.source) {
    const url = await putImage({
      source: record.hero.source,
      folder: `bluderma/treatments/${record.slug}`,
      filename: `${record.slug}-hero`,
      alt: record.hero.alt ?? treatment.name,
    });
    if (WRITE) await prisma.treatment.update({ where: { id: treatment.id }, data: { image: url } });
    linked += 1;
  }

  linked += await replaceTreatmentImages({
    treatmentId: treatment.id,
    slug: record.slug,
    kind: TreatmentImageKind.GALLERY,
    images: asList(record.gallery),
  });
  linked += await replaceTreatmentImages({
    treatmentId: treatment.id,
    slug: record.slug,
    kind: TreatmentImageKind.RESULT,
    images: asList(record.results),
  });
  linked += await replaceTreatmentImages({
    treatmentId: treatment.id,
    slug: record.slug,
    kind: TreatmentImageKind.BEFORE_AFTER,
    images: asList(record.beforeAfter),
  });

  console.log(`${WRITE ? "imported" : "would import"} treatment ${record.slug}: ${linked} image(s)`);
}

async function importHubTreatment(record: HubRecord) {
  const row = await prisma.hubTreatment.findFirst({
    where: { slug: record.slug, category: { slug: record.categorySlug } },
    select: { id: true, name: true },
  });
  if (!row) throw new Error(`hub treatment not found: ${record.categorySlug}/${record.slug}`);

  const folder = `bluderma/hub-treatments/${record.categorySlug}/${record.slug}`;
  const data: { image?: string; beforeImage?: string; afterImage?: string } = {};
  const caseRows: { treatmentId: string; beforeImage: string; afterImage: string; sortOrder: number }[] = [];

  if (record.hero?.source) {
    data.image = await putImage({
      source: record.hero.source,
      folder,
      filename: `${record.slug}-hero`,
      alt: record.hero.alt ?? row.name,
    });
  }

  if (record.beforeAfter?.before.source && record.beforeAfter.after.source) {
    data.beforeImage = await putImage({
      source: record.beforeAfter.before.source,
      folder,
      filename: `${record.slug}-before`,
      alt: record.beforeAfter.before.alt ?? `${row.name} illustrative before`,
    });
    data.afterImage = await putImage({
      source: record.beforeAfter.after.source,
      folder,
      filename: `${record.slug}-after`,
      alt: record.beforeAfter.after.alt ?? `${row.name} illustrative after`,
    });
  }

  for (const [sortOrder, pair] of (record.beforeAfterCases ?? []).entries()) {
    if (!pair.before?.source || !pair.after?.source) continue;
    const beforeImage = await putImage({
      source: pair.before.source,
      folder,
      filename: `${record.slug}-case-${sortOrder + 1}-before`,
      alt: pair.before.alt ?? `${row.name} illustrative case ${sortOrder + 1} before`,
    });
    const afterImage = await putImage({
      source: pair.after.source,
      folder,
      filename: `${record.slug}-case-${sortOrder + 1}-after`,
      alt: pair.after.alt ?? `${row.name} illustrative case ${sortOrder + 1} after`,
    });
    caseRows.push({ treatmentId: row.id, beforeImage, afterImage, sortOrder });
  }

  if (Object.keys(data).length === 0 && caseRows.length === 0) return;
  if (WRITE && Object.keys(data).length > 0) {
    await prisma.hubTreatment.update({ where: { id: row.id }, data });
  }
  if (WRITE && caseRows.length > 0) {
    await prisma.$transaction([
      prisma.hubBeforeAfterCase.deleteMany({ where: { treatmentId: row.id } }),
      prisma.hubBeforeAfterCase.createMany({ data: caseRows }),
    ]);
  }

  console.log(
    `${WRITE ? "imported" : "would import"} hub treatment ${record.categorySlug}/${record.slug}: ${Object.keys(data).length + caseRows.length * 2} image(s)`
  );
}

async function main() {
  if (!LOCAL_REVIEW && !isConfigured()) {
    throw new Error("S3 is not configured. Set S3_BUCKET, AWS_REGION, AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.");
  }

  const manifestPath = process.argv.find((arg) => arg.endsWith(".json"));
  if (!manifestPath) throw new Error("Pass a manifest JSON file.");

  const records = JSON.parse(await fs.readFile(manifestPath, "utf8")) as ManifestRecord[];
  if (!Array.isArray(records)) throw new Error("Manifest must be a JSON array.");

  for (const record of records) {
    if (record.type === "hubTreatment") await importHubTreatment(record);
    else await importTreatment(record);
  }

  console.log(`${WRITE ? "Done." : "Dry run complete. Add --write to apply."}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
