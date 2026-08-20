/**
 * Moves every image the database still points at in `public/` up to S3, and
 * rewrites the rows to the bucket URL.
 *
 * The app shipped with ~1.1GB of imagery served out of `public/`, which works
 * on one machine and stops working the moment the app runs anywhere that does
 * not carry that folder — a container, a serverless deploy, a second instance.
 * This makes the data self-describing: a row points at a URL that resolves
 * from anywhere.
 *
 * Idempotent and resumable, which matters at this size:
 *   - a URL already on our own base is skipped,
 *   - an object already in the bucket is not re-uploaded (HEAD first),
 *   - the key is derived from the path, so a re-run produces the same key.
 * Interrupt it and run it again; it picks up where it stopped.
 *
 *   npx tsx prisma/rehost-local-images.ts --dry-run     # report only
 *   npx tsx prisma/rehost-local-images.ts --limit 20    # try a few first
 *   npx tsx prisma/rehost-local-images.ts               # the lot
 *
 * Requires the bucket to allow public reads on the `site/` prefix — run
 * prisma/setup-s3.ts first.
 */
import { readFileSync, existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, posix } from "node:path";

// This runs outside Next, which is what normally loads .env.
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
  if (m && process.env[m[1]] === undefined) {
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
}

import { PrismaClient } from "@prisma/client";
import { S3Client, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

const prisma = new PrismaClient({ log: ["warn", "error"] });

/**
 * Every column that can hold a local path.
 *
 * Listed explicitly rather than discovered from INFORMATION_SCHEMA: this
 * script writes to whatever it is given, and a column list built at runtime
 * from a LIKE pattern is one schema change away from rewriting something it
 * should not.
 */
const TARGETS: { table: string; column: string }[] = [
  { table: "doctors", column: "image" },
  { table: "clinic_photos", column: "url" },
  { table: "media_assets", column: "url" },
  { table: "banners", column: "mediaUrl" },
  { table: "banners", column: "mediaUrlMobile" },
  { table: "banners", column: "mediaUrlTablet" },
  { table: "hub_before_after_cases", column: "beforeImage" },
  { table: "hub_before_after_cases", column: "afterImage" },
  { table: "hub_categories", column: "image" },
  { table: "hub_concerns", column: "image" },
  { table: "hub_deals", column: "image" },
  { table: "hub_promos", column: "image" },
  { table: "hub_treatments", column: "image" },
  { table: "hub_treatments", column: "beforeImage" },
  { table: "hub_treatments", column: "afterImage" },
];

/**
 * Paths hard-coded in source rather than stored in a row.
 *
 * They cannot be found by scanning the database, so they are listed here and
 * uploaded alongside everything else. The source keeps referring to them by
 * local path and resolves through assetUrl() at render time — see
 * src/lib/assetUrl.ts — so this list only has to make sure the object exists.
 */
const STATIC_ASSETS = [
  "/images/doctor/doctor-practice-hero-v1.png",
  "/images/korean/doctor-female-1-v2.png",
  "/images/korean/doctor-female-2-v2.png",
  "/images/korean/doctor-female-3-v2.png",
  "/images/korean/doctor-female-4-v2.png",
  "/images/korean/doctor-male-1-v2.png",
  "/images/korean/doctor-male-2-v2.png",
  "/images/korean/doctor-male-3-v2.png",
];

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

const BUCKET = process.env.S3_BUCKET!;
const REGION = process.env.AWS_REGION!;

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

function publicUrlFor(key: string): string {
  const cdn = process.env.CDN_BASE_URL?.replace(/\/$/, "");
  if (cdn) return `${cdn}/${key}`;
  return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
}

/**
 * `/images/generated/a b.webp` -> `site/images/generated/a-b.webp`
 *
 * The local folder structure is kept because it is already meaningful and
 * because a stable, path-derived key is what makes re-running this safe. Only
 * characters that are awkward in a URL are changed.
 */
function keyForLocalPath(localPath: string): string {
  const clean = decodeURIComponent(localPath.split("?")[0]).replace(/^\//, "");
  const segments = clean.split("/").map((seg) => {
    const ext = extname(seg);
    const base = ext ? seg.slice(0, -ext.length) : seg;
    const safe = base
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return `${safe || "file"}${ext.toLowerCase()}`;
  });
  return posix.join("site", ...segments);
}

function isLocal(url: string): boolean {
  return url.startsWith("/images/") || url.startsWith("/videos/");
}

async function alreadyInBucket(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

/** Uploads one local file and returns its public URL, or null if unusable. */
async function uploadLocal(localPath: string): Promise<string | null> {
  const onDisk = `public${decodeURIComponent(localPath.split("?")[0])}`;
  if (!existsSync(onDisk)) return null;

  const key = keyForLocalPath(localPath);
  const url = publicUrlFor(key);

  if (await alreadyInBucket(key)) return url;

  const body = await readFile(onDisk);
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: MIME[extname(onDisk).toLowerCase()] ?? "application/octet-stream",
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
  return url;
}

/** Runs `worker` over `items` with a fixed number in flight. */
async function pooled<T>(
  items: T[],
  size: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      for (;;) {
        const i = next++;
        if (i >= items.length) return;
        await worker(items[i], i);
      }
    })
  );
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const limitArg = process.argv.indexOf("--limit");
  const limit = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity;

  if (!BUCKET || !REGION || !process.env.AWS_ACCESS_KEY_ID) {
    console.error("S3 is not configured — set S3_BUCKET, AWS_REGION and the AWS keys in .env.");
    process.exit(1);
  }

  // ── Collect every distinct local path the database references ───────────
  const paths = new Set<string>();
  const perTarget: { table: string; column: string; n: number }[] = [];

  for (const { table, column } of TARGETS) {
    let rows: { v: string }[];
    try {
      rows = await prisma.$queryRawUnsafe<{ v: string }[]>(
        `SELECT DISTINCT \`${column}\` v FROM \`${table}\`
         WHERE \`${column}\` LIKE '/images/%' OR \`${column}\` LIKE '/videos/%'`
      );
    } catch {
      // A table or column that does not exist in this database is not an
      // error — the list is deliberately broader than any one environment.
      continue;
    }
    if (rows.length) perTarget.push({ table, column, n: rows.length });
    rows.forEach((r) => paths.add(r.v));
  }

  // Source-referenced files are uploaded too, but never rewritten — nothing in
  // the database points at them, so there is no row to update.
  const fromDb = paths.size;
  STATIC_ASSETS.forEach((p) => paths.add(p));

  const all = [...paths].sort();
  const todo = all.slice(0, limit === Infinity ? undefined : limit);

  let bytes = 0;
  let missing = 0;
  for (const p of todo) {
    const f = `public${decodeURIComponent(p.split("?")[0])}`;
    if (existsSync(f)) bytes += statSync(f).size;
    else missing++;
  }

  console.log("Local files referenced by the database\n");
  perTarget.forEach((t) =>
    console.log(`  ${t.table}.${t.column}`.padEnd(44) + `${t.n} distinct`)
  );
  console.log(
    `\n  distinct files : ${all.length}  (${fromDb} from rows, ${
      all.length - fromDb
    } from source)`
  );
  console.log(`  this run       : ${todo.length}`);
  console.log(`  missing on disk: ${missing}`);
  console.log(`  upload size    : ${(bytes / 1048576).toFixed(1)} MB`);
  console.log(`  destination    : ${publicUrlFor("site/…")}\n`);

  if (dryRun) {
    console.log("Sample key mapping:");
    todo.slice(0, 5).forEach((p) => console.log(`  ${p}\n    -> ${keyForLocalPath(p)}`));
    console.log("\n--dry-run: nothing uploaded, nothing rewritten.");
    return;
  }

  // ── Upload ──────────────────────────────────────────────────────────────
  const mapping = new Map<string, string>();
  const failed: string[] = [];
  let done = 0;

  await pooled(todo, 8, async (localPath) => {
    try {
      const url = await uploadLocal(localPath);
      if (url) mapping.set(localPath, url);
      else failed.push(`${localPath} (not on disk)`);
    } catch (err) {
      failed.push(`${localPath} (${(err as Error).message})`);
    }
    if (++done % 50 === 0 || done === todo.length) {
      console.log(`  uploaded ${done}/${todo.length}`);
    }
  });

  console.log(`\nUploaded/verified ${mapping.size} object(s).`);

  // ── Rewrite the rows ────────────────────────────────────────────────────
  let updated = 0;
  const writeErrors: string[] = [];

  for (const { table, column } of TARGETS) {
    for (const [localPath, url] of mapping) {
      try {
        updated += await prisma.$executeRawUnsafe(
          `UPDATE \`${table}\` SET \`${column}\` = ? WHERE \`${column}\` = ?`,
          url,
          localPath
        );
      } catch (err) {
        const msg = (err as Error).message;
        // A table or column missing from this database is expected — the list
        // is deliberately broader than any one environment. Anything else is a
        // real write failure and must not be swallowed, or the run reports
        // success while leaving rows pointing at files it is about to orphan.
        if (/Unknown column|doesn't exist|no such table/i.test(msg)) break;
        writeErrors.push(`${table}.${column} -> ${localPath}: ${msg}`);
      }
    }
  }

  console.log(`Rewrote ${updated} column value(s).`);
  if (writeErrors.length) {
    console.log(`\n${writeErrors.length} row update(s) FAILED:`);
    writeErrors.slice(0, 10).forEach((e) => console.log(`  ${e}`));
    process.exitCode = 1;
  }

  // ── What is still local ─────────────────────────────────────────────────
  let remaining = 0;
  for (const { table, column } of TARGETS) {
    try {
      const r = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
        `SELECT COUNT(*) n FROM \`${table}\`
         WHERE \`${column}\` LIKE '/images/%' OR \`${column}\` LIKE '/videos/%'`
      );
      remaining += Number(r[0].n);
    } catch {
      continue;
    }
  }
  console.log(`Rows still pointing at public/: ${remaining}`);

  if (failed.length) {
    console.log(`\n${failed.length} file(s) could not be uploaded:`);
    failed.slice(0, 20).forEach((f) => console.log(`  ${f}`));
    if (failed.length > 20) console.log(`  …and ${failed.length - 20} more`);
  }
}

main()
  .catch((err) => {
    console.error("\nFailed:", (err as Error).message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
