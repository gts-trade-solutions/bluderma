/**
 * Downloads externally-hosted treatment section images (TreatmentImage rows)
 * and re-uploads them to our S3 bucket under bluderma/treatments/<slug>/, then
 * rewrites the url. Same idempotent/resumable design as rehost-images.ts (which
 * handles product images). Skips images already on our own base.
 *
 * Run: npx tsx prisma/rehost-treatment-images.ts
 */
import { PrismaClient } from "@prisma/client";
import { buildKey, isConfigured, uploadObject } from "../src/lib/storage";

const prisma = new PrismaClient({ log: ["warn", "error"] });

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
};

function ownBases(): string[] {
  const bases: string[] = [];
  if (process.env.CDN_BASE_URL) bases.push(process.env.CDN_BASE_URL.replace(/\/$/, ""));
  if (process.env.S3_BUCKET) {
    bases.push(`https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com`);
    bases.push(`https://s3.${process.env.AWS_REGION}.amazonaws.com/${process.env.S3_BUCKET}`);
  }
  return bases;
}

async function fetchImage(url: string) {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      Accept: "image/avif,image/webp,image/png,image/jpeg,*/*",
    },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim();
  if (!contentType.startsWith("image/")) throw new Error(`not an image (${contentType})`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength === 0) throw new Error("empty body");
  return { buf, contentType };
}

async function main() {
  if (!isConfigured()) {
    console.error("S3 not configured (S3_BUCKET + AWS creds).");
    process.exit(1);
  }
  const bases = ownBases();
  const mine = (url: string) => bases.some((b) => url.startsWith(b));

  const images = await prisma.treatmentImage.findMany({
    include: { treatment: { select: { slug: true } } },
  });
  const todo = images.filter((i) => !mine(i.url));
  console.log(
    `${images.length} treatment images · ${todo.length} to re-host · ${
      images.length - todo.length
    } already ours.\n`
  );

  let done = 0;
  const failures: string[] = [];
  for (const img of todo) {
    const slug = img.treatment.slug;
    try {
      const { buf, contentType } = await fetchImage(img.url);
      const ext = EXT[contentType] ?? "jpg";
      const key = buildKey(
        `bluderma/treatments/${slug}`,
        `${slug}-${img.kind.toLowerCase()}-${img.sortOrder}.${ext}`
      );
      const newUrl = await uploadObject({ key, body: buf, contentType });
      await prisma.treatmentImage.update({ where: { id: img.id }, data: { url: newUrl } });
      done++;
    } catch (err) {
      failures.push(`${slug}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(`Re-hosted ${done} treatment images. ${failures.length} failed.`);
  if (failures.length) failures.forEach((f) => console.log(`  ${f}`));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
