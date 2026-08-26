/**
 * Configures the S3 bucket so browser uploads work and delivered images load.
 *
 * Two separate things have to be true, and both were missing:
 *
 *  1. CORS. Uploads go straight from the browser to S3 via a presigned PUT, so
 *     the browser sends a cross-origin preflight first. A bucket with no CORS
 *     configuration refuses that preflight, `fetch` throws before the file is
 *     sent, and the UI can only report a bare "Upload failed" — with no hint
 *     that the bucket is at fault.
 *
 *  2. A read policy that matches where we actually write. The bucket had a
 *     public-read statement for `bluderma/*`, but buildKey() writes to
 *     top-level prefixes (`doctors/`, `clinics/`, …). Nothing we uploaded was
 *     ever covered, so every upload succeeded and then 403'd on display.
 *
 * Idempotent — it writes the full configuration each time, so re-running after
 * adding a domain or a prefix is the intended way to update it.
 *
 *   npx tsx prisma/setup-s3.ts            # apply
 *   npx tsx prisma/setup-s3.ts --dry-run  # print what would change
 *
 * Upload origins come from S3_CORS_ORIGINS (comma-separated) when set, plus
 * NEXTAUTH_URL and the local dev hosts. ADD THE PRODUCTION DOMAIN to
 * S3_CORS_ORIGINS and re-run before going live, or uploads will fail there
 * exactly as they did locally.
 */
import { readFileSync } from "node:fs";

// This runs outside Next, which is what normally loads .env.
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
  if (m && process.env[m[1]] === undefined) {
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
}

import {
  S3Client,
  GetBucketCorsCommand,
  PutBucketCorsCommand,
  GetBucketPolicyCommand,
  PutBucketPolicyCommand,
  type CORSRule,
} from "@aws-sdk/client-s3";

const BUCKET = process.env.S3_BUCKET;
const REGION = process.env.AWS_REGION;

/**
 * Prefixes served straight to the public web.
 *
 * Kept as an explicit allow-list rather than a wildcard because two of the
 * prefixes we write to must never be readable without a signature.
 */
const PUBLIC_PREFIXES = [
  "doctors", // portraits, shown on every listing
  "clinics", // exterior/interior photographs
  "cases", // before/after imagery
  "treatments",
  "products",
  "categories",
  "concerns",
  "banners",
  "promos",
  "deals",
  "testimonials",
  "hub",
  "uploads",
  "site", // everything rehosted out of public/ — see rehost-local-images.ts
  "bluderma", // the pre-existing statement, preserved
];

/**
 * Deliberately NOT public, and the reason this is an allow-list:
 *
 *   credentials/   medical registration certificates. The onboarding form
 *                  tells the doctor it "goes to our review team and nowhere
 *                  else", and a public bucket prefix would make that false.
 *   prescriptions/ patient medical documents.
 *   patients/      photographs a patient attached to a booking. Clinical
 *                  images of a named person; never publicly readable.
 *
 * Anything not listed above is unreadable without a signed URL, which is the
 * default and the behaviour we want. Staff access to these goes through a
 * presigned GET instead — see /api/uploads/view.
 */
const PRIVATE_PREFIXES = [
  "credentials",
  "prescriptions",
  "patients",
  "vendor-licences",
];

function originsToAllow(): string[] {
  const out = new Set<string>();

  for (const o of (process.env.S3_CORS_ORIGINS ?? "").split(",")) {
    const t = o.trim().replace(/\/$/, "");
    if (t) out.add(t);
  }

  // The app's own origin is always allowed — it is the one uploading.
  if (process.env.NEXTAUTH_URL) {
    try {
      out.add(new URL(process.env.NEXTAUTH_URL).origin);
    } catch {
      /* a malformed NEXTAUTH_URL is not this script's problem */
    }
  }

  // Dev servers move ports constantly, and `next dev` silently walks up when
  // 3000 is taken — which is how uploads start failing with no code change.
  // S3 allows exactly one `*` per origin, so a port wildcard covers every
  // port at once and this stops being something to remember.
  out.add("http://localhost:*");
  out.add("http://127.0.0.1:*");
  // Testing on a phone means the LAN address, which no fixed list ever has.
  out.add("http://192.168.*");
  out.add("http://10.*");

  return [...out];
}

function corsRules(origins: string[]): CORSRule[] {
  return [
    {
      // The upload itself. GET/HEAD ride along so a just-uploaded object can be
      // read back without a second rule.
      AllowedOrigins: origins,
      AllowedMethods: ["PUT", "GET", "HEAD"],
      // Presigned PUTs carry Content-Type plus the SDK's signed headers;
      // naming them individually breaks when the signing algorithm adds one.
      AllowedHeaders: ["*"],
      // A browser cannot read ETag off a cross-origin response unless it is
      // explicitly exposed.
      ExposeHeaders: ["ETag"],
      MaxAgeSeconds: 3000,
    },
    {
      // Public reads of delivered images, from anywhere. A separate rule so
      // that widening delivery never widens who may write.
      AllowedOrigins: ["*"],
      AllowedMethods: ["GET", "HEAD"],
      AllowedHeaders: ["*"],
      MaxAgeSeconds: 86400,
    },
  ];
}

function bucketPolicy() {
  return {
    Version: "2012-10-17",
    Statement: [
      {
        Sid: "PublicReadDeliveryPrefixes",
        Effect: "Allow",
        Principal: "*",
        Action: "s3:GetObject",
        Resource: PUBLIC_PREFIXES.map((p) => `arn:aws:s3:::${BUCKET}/${p}/*`),
      },
    ],
  };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  if (!BUCKET || !REGION || !process.env.AWS_ACCESS_KEY_ID) {
    console.error(
      "S3 is not configured — set S3_BUCKET, AWS_REGION and the AWS keys in .env."
    );
    process.exit(1);
  }

  const s3 = new S3Client({
    region: REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });

  console.log(`Bucket ${BUCKET} (${REGION})\n`);

  // ── CORS ────────────────────────────────────────────────────────────────
  try {
    const cur = (await s3.send(new GetBucketCorsCommand({ Bucket: BUCKET }))).CORSRules;
    console.log(`CORS before:   ${cur?.length ?? 0} rule(s)`);
  } catch (err) {
    if ((err as { name?: string }).name === "NoSuchCORSConfiguration") {
      console.log("CORS before:   NONE — browser uploads cannot work.");
    } else throw err;
  }

  // ── Policy ──────────────────────────────────────────────────────────────
  try {
    const cur = await s3.send(new GetBucketPolicyCommand({ Bucket: BUCKET }));
    const parsed = JSON.parse(cur.Policy!);
    const res = parsed.Statement.flatMap((s: { Resource: string | string[] }) =>
      Array.isArray(s.Resource) ? s.Resource : [s.Resource]
    );
    console.log(`Policy before: ${res.length} public-read resource(s)`);
    res.forEach((r: string) => console.log(`  ${r}`));
  } catch (err) {
    if ((err as { name?: string }).name === "NoSuchBucketPolicy") {
      console.log("Policy before: NONE — nothing is publicly readable.");
    } else throw err;
  }

  const origins = originsToAllow();
  const policy = bucketPolicy();

  console.log(`\nUpload origins (${origins.length}):`);
  origins.forEach((o) => console.log(`  ${o}`));
  console.log(`\nPublic-read prefixes (${PUBLIC_PREFIXES.length}):`);
  console.log(`  ${PUBLIC_PREFIXES.join(", ")}`);
  console.log("\nDeliberately private (signed access only):");
  console.log(`  ${PRIVATE_PREFIXES.join(", ")}`);

  if (dryRun) {
    console.log("\n--dry-run: nothing written.");
    return;
  }

  await s3.send(
    new PutBucketCorsCommand({
      Bucket: BUCKET,
      CORSConfiguration: { CORSRules: corsRules(origins) },
    })
  );
  await s3.send(
    new PutBucketPolicyCommand({ Bucket: BUCKET, Policy: JSON.stringify(policy) })
  );

  const cors = (await s3.send(new GetBucketCorsCommand({ Bucket: BUCKET }))).CORSRules;
  console.log(
    `\nApplied. CORS rules: ${cors?.length ?? 0}. Public prefixes: ${PUBLIC_PREFIXES.length}.`
  );
}

main().catch((err) => {
  console.error("\nFailed:", (err as Error).message);
  process.exit(1);
});
