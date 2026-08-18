/**
 * Downloads the curated stock photography into the project and registers each
 * file as a MediaAsset, so the site serves its own images rather than
 * hotlinking Unsplash.
 *
 * That matters for more than tidiness: a hotlinked photo can be removed,
 * rate-limited or re-pathed by someone else at any time, and the catalogue
 * would develop holes nobody notices until a client does.
 *
 * Every download is verified — a non-200, an empty body or a non-image
 * content-type is reported and skipped, never written. Re-running skips files
 * already on disk, so it is cheap to repeat after adding to the manifest.
 *
 * Run: npx tsx prisma/download-stock.ts
 */
import fs from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

import { STOCK } from "./stock-manifest";

const prisma = new PrismaClient();

/** Where the files land, and the public path the app will reference. */
const OUT_DIR = path.join(process.cwd(), "public", "images", "treatments");
const PUBLIC_PREFIX = "/images/treatments";

/** Enough for a full-bleed hero on a high-density display, no larger. */
const RENDER = "?w=1600&q=75&fm=jpg&fit=crop";

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  let written = 0;
  let skipped = 0;
  const failures: { id: string; reason: string }[] = [];

  for (const photo of STOCK) {
    const file = `${photo.id}.jpg`;
    const dest = path.join(OUT_DIR, file);
    const url = `${PUBLIC_PREFIX}/${file}`;

    // Already downloaded — just make sure it is registered.
    try {
      const stat = await fs.stat(dest);
      if (stat.size > 0) {
        await register(photo.id, url, photo.alt, stat.size);
        skipped += 1;
        continue;
      }
    } catch {
      /* not on disk yet */
    }

    try {
      const res = await fetch(`https://images.unsplash.com/${photo.id}${RENDER}`);
      if (!res.ok) {
        failures.push({ id: photo.id, reason: `HTTP ${res.status}` });
        continue;
      }
      const type = res.headers.get("content-type") ?? "";
      if (!type.startsWith("image/")) {
        failures.push({ id: photo.id, reason: `content-type ${type}` });
        continue;
      }

      const bytes = Buffer.from(await res.arrayBuffer());
      if (bytes.length < 1024) {
        failures.push({ id: photo.id, reason: `only ${bytes.length} bytes` });
        continue;
      }

      await fs.writeFile(dest, bytes);
      await register(photo.id, url, photo.alt, bytes.length);
      written += 1;
      process.stdout.write(".");
    } catch (err) {
      failures.push({
        id: photo.id,
        reason: err instanceof Error ? err.message : "download failed",
      });
    }
  }

  console.log(
    `\n\nstock images — ${written} downloaded, ${skipped} already present, ${failures.length} failed`
  );
  if (failures.length) {
    console.log("\nfailed (left out of the catalogue rather than shipped broken):");
    for (const f of failures) console.log(`   ${f.id} — ${f.reason}`);
  }
  const total = await prisma.mediaAsset.count();
  console.log(`\nMediaAsset rows: ${total}`);
}

/** The database keeps the registry; the bytes live under /public. */
async function register(id: string, url: string, alt: string, size: number) {
  const storageKey = `treatments/${id}.jpg`;
  await prisma.mediaAsset.upsert({
    where: { storageKey },
    create: { storageKey, url, mimeType: "image/jpeg", sizeBytes: size, alt },
    update: { url, sizeBytes: size, alt },
  });
}

main().finally(() => prisma.$disconnect());
