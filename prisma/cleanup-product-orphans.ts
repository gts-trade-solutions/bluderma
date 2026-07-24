/**
 * Deletes product-image objects in S3 that no ProductImage row references any
 * more — i.e. the old watermarked/replaced files left behind by the clean-image
 * pass. Scoped strictly to the `bluderma/products/` prefix.
 *
 *   npx tsx prisma/cleanup-product-orphans.ts          # dry run (lists only)
 *   npx tsx prisma/cleanup-product-orphans.ts --delete # actually delete
 */
import { PrismaClient } from "@prisma/client";
import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";

const prisma = new PrismaClient({ log: ["warn", "error"] });
const DELETE = process.argv.includes("--delete");
const PREFIX = "bluderma/products/";
const BUCKET = process.env.S3_BUCKET!;

function s3() {
  return new S3Client({
    region: process.env.AWS_REGION!,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

/** Extract the S3 object key from one of our public URLs. */
function keyFromUrl(url: string): string | null {
  const marker = ".amazonaws.com/";
  const i = url.indexOf(marker);
  if (i > -1) return decodeURIComponent(url.slice(i + marker.length));
  const cdn = process.env.CDN_BASE_URL?.replace(/\/$/, "");
  if (cdn && url.startsWith(cdn + "/"))
    return decodeURIComponent(url.slice(cdn.length + 1));
  return null;
}

async function main() {
  // 1. Referenced keys.
  const imgs = await prisma.productImage.findMany({ select: { url: true } });
  const referenced = new Set<string>();
  for (const { url } of imgs) {
    const k = keyFromUrl(url);
    if (k) referenced.add(k);
  }
  console.log(`${referenced.size} referenced product-image keys in DB.`);

  // 2. List all objects under the prefix.
  const client = s3();
  const all: string[] = [];
  let token: string | undefined;
  do {
    const out = await client.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: PREFIX,
        ContinuationToken: token,
      })
    );
    for (const o of out.Contents ?? []) if (o.Key) all.push(o.Key);
    token = out.IsTruncated ? out.NextContinuationToken : undefined;
  } while (token);
  console.log(`${all.length} objects under ${PREFIX} in S3.`);

  // 3. Orphans = objects not referenced.
  const orphans = all.filter((k) => !referenced.has(k));
  console.log(`\n${orphans.length} orphaned objects:`);
  for (const k of orphans) console.log(`  ${k}`);

  if (!orphans.length) return;
  if (!DELETE) {
    console.log("\nDry run — pass --delete to remove these.");
    return;
  }

  // 4. Delete in batches of 1000.
  for (let i = 0; i < orphans.length; i += 1000) {
    const chunk = orphans.slice(i, i + 1000);
    await client.send(
      new DeleteObjectsCommand({
        Bucket: BUCKET,
        Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: true },
      })
    );
    console.log(`Deleted ${Math.min(i + 1000, orphans.length)}/${orphans.length}`);
  }
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
