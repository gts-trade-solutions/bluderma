/**
 * Upload and storage rules.
 *
 * Covers the failure reported as "image is not able to upload": the bucket had
 * no CORS configuration, so the browser's preflight for the presigned PUT was
 * refused and `fetch` threw before the file was ever sent — surfacing as a bare
 * "Upload failed. Please try again or paste a URL."
 *
 * The bucket checks talk to AWS and are skipped when S3 is not configured, so
 * this stays runnable on a machine without credentials.
 */
import { readFileSync } from "node:fs";

for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
  if (m && process.env[m[1]] === undefined) {
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
}

import {
  S3Client,
  GetBucketCorsCommand,
  GetBucketPolicyCommand,
} from "@aws-sdk/client-s3";
import {
  buildKey,
  isConfigured,
  isPrivateKey,
  keyFromUrl,
  publicUrlFor,
  PRIVATE_PREFIXES,
} from "../src/lib/storage";

let pass = 0;
const fails: string[] = [];
function check(name: string, ok: boolean) {
  if (ok) pass++;
  else fails.push(name);
}
const read = (p: string) => readFileSync(p, "utf8");

// ── Key building ───────────────────────────────────────────────────────────
const k = buildKey("doctors", "My Portrait .JPG");
check("key lands in the requested folder", k.startsWith("doctors/"));
check("key lowercases the extension", k.endsWith(".jpg"));
check("key slugifies the name", /doctors\/my-portrait-[0-9a-f]{12}\.jpg/.test(k));
check(
  "two uploads of one filename cannot collide",
  buildKey("doctors", "a.jpg") !== buildKey("doctors", "a.jpg")
);
check(
  "a traversing folder cannot escape",
  !buildKey("../../etc", "a.jpg").includes("..")
);

// ── Public vs private ──────────────────────────────────────────────────────
check("credentials are private", isPrivateKey("credentials/cert-abc.jpg"));
check("prescriptions are private", isPrivateKey("prescriptions/rx-abc.pdf"));
check("portraits are not private", !isPrivateKey("doctors/portrait-abc.jpg"));
check("clinic photos are not private", !isPrivateKey("clinics/exterior-abc.jpg"));

// ── URL round-trip ─────────────────────────────────────────────────────────
if (isConfigured()) {
  const key = "credentials/cert-0123456789ab.jpg";
  check("a stored URL resolves back to its key", keyFromUrl(publicUrlFor(key)) === key);
  check(
    "a URL with a space round-trips",
    keyFromUrl(publicUrlFor("site/images/a b.jpg")) === "site/images/a b.jpg"
  );
}
check("someone else's bucket is refused", keyFromUrl("https://evil.example/x.jpg") === null);
check("a non-URL is refused", keyFromUrl("not a url") === null);
check("a relative path is refused", keyFromUrl("/images/x.jpg") === null);

// ── The signed-view route ──────────────────────────────────────────────────
const view = read("src/app/api/uploads/view/route.ts");
check("view requires a signed-in user", /if \(!user\)/.test(view));
check("view refuses foreign URLs", /if \(!key\)/.test(view));
check("view redirects public objects unsigned", /if \(!isPrivateKey\(key\)\)/.test(view));
check("non-admins are ownership-checked", /ownsPrivateObject/.test(view));
check("the signed redirect is not cached", /no-store/.test(view));
check(
  "uploading it counts as owning it",
  /uploadedById: userId/.test(view)
);

// ── The client ─────────────────────────────────────────────────────────────
const field = read("src/components/admin/ImageField.tsx");
check(
  "a thrown PUT is caught separately from a network drop",
  /try \{\s*put = await fetch/.test(field)
);
check("the CORS case names the fix", /setup-s3\.ts/.test(field));
check("the old catch-all message is gone", !/Upload failed\. Please try again or paste a URL/.test(field));
check("private files preview through the signed route", /api\/uploads\/view/.test(field));

// ── The presign endpoint's folder scoping ──────────────────────────────────
const presign = read("src/app/api/uploads/presign/route.ts");
check("doctors are folder-scoped", /DOCTOR_FOLDERS/.test(presign));
check("the register half re-checks the folder", /d\.key\.split\("\/"\)\[0\]/.test(presign));

// ── The bucket itself ──────────────────────────────────────────────────────
async function bucketChecks() {
  if (!isConfigured()) {
    console.log("S3 not configured — skipping live bucket checks.");
    return;
  }
  const s3 = new S3Client({
    region: process.env.AWS_REGION!,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
  const bucket = process.env.S3_BUCKET!;

  try {
    const cors = (await s3.send(new GetBucketCorsCommand({ Bucket: bucket }))).CORSRules ?? [];
    const upload = cors.find((r) => r.AllowedMethods?.includes("PUT"));
    check("the bucket has a CORS rule allowing PUT", Boolean(upload));
    check(
      "the app's own origin may upload",
      Boolean(upload?.AllowedOrigins?.includes("http://localhost:3000"))
    );
    check(
      "PUT is not open to every origin",
      !upload?.AllowedOrigins?.includes("*")
    );
    check("ETag is exposed to the browser", Boolean(upload?.ExposeHeaders?.includes("ETag")));
  } catch {
    fails.push("could not read bucket CORS");
  }

  try {
    const pol = JSON.parse(
      (await s3.send(new GetBucketPolicyCommand({ Bucket: bucket }))).Policy!
    );
    const resources: string[] = pol.Statement.flatMap((s: { Resource: string | string[] }) =>
      Array.isArray(s.Resource) ? s.Resource : [s.Resource]
    );
    check(
      "portraits are publicly readable",
      resources.includes(`arn:aws:s3:::${bucket}/doctors/*`)
    );
    check(
      "rehosted site imagery is publicly readable",
      resources.includes(`arn:aws:s3:::${bucket}/site/*`)
    );
    for (const p of PRIVATE_PREFIXES) {
      check(
        `${p}/ is NOT publicly readable`,
        !resources.some((r) => r.includes(`/${p}/`))
      );
    }
  } catch {
    fails.push("could not read bucket policy");
  }
}

bucketChecks().then(() => {
  console.log(`\n${pass} passed, ${fails.length} failed`);
  if (fails.length) {
    fails.forEach((f) => console.log(`  FAIL  ${f}`));
    process.exit(1);
  }
});
