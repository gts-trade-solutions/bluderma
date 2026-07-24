/**
 * Downloads every externally-hosted product image and re-uploads it to our own
 * S3 bucket, then rewrites ProductImage.url to the bucket/CDN source link.
 *
 * Idempotent and resumable: images already pointing at our own base
 * (CDN_BASE_URL, or the bucket's S3 endpoint) are skipped, so it can be re-run
 * as new categories are enriched. Download/upload failures are logged and leave
 * the original URL in place rather than losing the image.
 *
 * Requires S3 to be configured (S3_BUCKET + AWS creds). Run:
 *   npx tsx prisma/rehost-images.ts
 */
import { PrismaClient } from "@prisma/client";
import {
  buildKey,
  isConfigured,
  publicUrlFor,
  uploadObject,
} from "../src/lib/storage";

const prisma = new PrismaClient({ log: ["warn", "error"] });

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
};

/** Our own delivery bases — a URL already on one of these is skipped. */
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
      // Some reseller CDNs block non-browser user agents / hotlinking.
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      Accept: "image/avif,image/webp,image/png,image/jpeg,*/*",
    },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim();
  if (!contentType.startsWith("image/")) {
    throw new Error(`not an image (${contentType || "no content-type"})`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength === 0) throw new Error("empty body");
  return { buf, contentType };
}

async function main() {
  if (!isConfigured()) {
    console.error(
      "S3 is not configured. Set S3_BUCKET, AWS_REGION, AWS_ACCESS_KEY_ID and\n" +
        "AWS_SECRET_ACCESS_KEY (and optionally CDN_BASE_URL) before running."
    );
    process.exit(1);
  }

  const bases = ownBases();
  const alreadyOurs = (url: string) => bases.some((b) => url.startsWith(b));

  const images = await prisma.productImage.findMany({
    orderBy: { productId: "asc" },
    include: { product: { select: { slug: true } } },
  });

  const todo = images.filter((i) => !alreadyOurs(i.url));
  console.log(
    `${images.length} product images total · ${todo.length} to re-host · ${
      images.length - todo.length
    } already on our storage.\n`
  );

  let done = 0;
  let failed = 0;
  const failures: { slug: string; url: string; reason: string }[] = [];

  for (const img of todo) {
    const slug = img.product.slug;
    try {
      const { buf, contentType } = await fetchImage(img.url);
      const ext = EXT[contentType] ?? "jpg";
      // Must live under bluderma/products/* — that is the prefix the bucket
      // policy makes publicly readable.
      const key = buildKey(
        `bluderma/products/${slug}`,
        `${slug}-${img.sortOrder}.${ext}`
      );
      const newUrl = await uploadObject({ key, body: buf, contentType });

      await prisma.productImage.update({
        where: { id: img.id },
        data: { url: newUrl },
      });
      done++;
      if (done % 20 === 0) console.log(`  …${done} re-hosted`);
    } catch (err) {
      failed++;
      failures.push({
        slug,
        url: img.url,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  console.log(`\nRe-hosted ${done} images. ${failed} failed.`);
  if (failures.length) {
    console.log("\nFailures (left on original URL):");
    for (const f of failures) console.log(`  ${f.slug}  ${f.reason}  ${f.url}`);
  }
  console.log(`\nDelivery base: ${bases[0] ?? publicUrlFor("")}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
