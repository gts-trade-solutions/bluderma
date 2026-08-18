/**
 * Pulls any remotely-hosted doctor avatar into the project.
 *
 * Same reasoning as the treatment photography: a directory that depends on
 * someone else's CDN develops holes without warning. Verified before it is
 * written, and the row is only repointed once the file is on disk.
 *
 * Run: npx tsx prisma/localise-doctor-images.ts
 */
import fs from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const OUT = path.join(process.cwd(), "public", "images", "doctors");

async function main() {
  await fs.mkdir(OUT, { recursive: true });

  const doctors = await prisma.doctor.findMany({
    where: { image: { startsWith: "http" } },
    select: { id: true, slug: true, image: true },
  });

  let moved = 0;
  const failed: string[] = [];

  for (const d of doctors) {
    try {
      const res = await fetch(d.image);
      if (!res.ok || !(res.headers.get("content-type") ?? "").startsWith("image/")) {
        failed.push(`${d.slug} — HTTP ${res.status}`);
        continue;
      }
      const bytes = Buffer.from(await res.arrayBuffer());
      if (bytes.length < 1024) {
        failed.push(`${d.slug} — too small`);
        continue;
      }

      const file = `${d.slug}.jpg`;
      await fs.writeFile(path.join(OUT, file), bytes);
      const url = `/images/doctors/${file}`;

      await prisma.doctor.update({ where: { id: d.id }, data: { image: url } });
      await prisma.mediaAsset.upsert({
        where: { storageKey: `doctors/${file}` },
        create: {
          storageKey: `doctors/${file}`,
          url,
          mimeType: "image/jpeg",
          sizeBytes: bytes.length,
          alt: `Portrait of ${d.slug}`,
        },
        update: { url, sizeBytes: bytes.length },
      });
      moved += 1;
    } catch (err) {
      failed.push(`${d.slug} — ${err instanceof Error ? err.message : "failed"}`);
    }
  }

  console.log(`doctor avatars localised: ${moved} of ${doctors.length}`);
  for (const f of failed) console.log(`   left remote: ${f}`);
}

main().finally(() => prisma.$disconnect());
