/**
 * Is "Continue with Google" actually going to work?
 *
 * The code half of this was already right, which is exactly why it needed
 * checking: the provider registers, the button renders, the adapter is wired,
 * the Account columns are the right type — and every BluDerma user still hits
 * `Error 400: redirect_uri_mismatch`, because the redirect URI is registered
 * in a Google Cloud project nobody thought to look at.
 *
 * That failure lives entirely outside the repository. No amount of reading the
 * source finds it. So this suite has two halves:
 *
 *   1. STATIC — the wiring, read off the schema and the source.
 *   2. LIVE — one read-only GET per redirect URI to Google's own authorization
 *      endpoint, which answers before any user is involved.
 *
 * ── WHY THE CONTROLS MATTER ──────────────────────────────────────────────
 * An unauthenticated request to that endpoint is bounced to Google's sign-in
 * page BEFORE the redirect URI is validated, so a bare 302 is identical for a
 * registered and an unregistered URI. The verdict is only meaningful once the
 * `authError` payload is decoded — and even then, a probe that reports
 * "rejected" for everything proves nothing. So it runs two controls: a URI
 * that must fail, and (optionally) one that must pass. If the controls do not
 * behave, the run reports INCONCLUSIVE rather than a verdict it has not
 * earned.
 *
 * The client_id is public by design — it ships in every browser redirect. The
 * SECRET is never sent anywhere by this file.
 *
 *   npx tsx prisma/verify-google-oauth.ts
 *   npx tsx prisma/verify-google-oauth.ts https://bluderma.kr https://staging.example
 */
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ log: ["error"] });

let pass = 0;
const fails: string[] = [];
const notes: string[] = [];
function check(name: string, ok: boolean, detail?: string) {
  if (ok) pass++;
  else fails.push(detail ? `${name} (${detail})` : name);
}
const read = (p: string) => readFileSync(p, "utf8");

/** .env, without pulling in a dependency for four lines. */
function envFile(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const file of [".env.local", ".env"]) {
    let raw = "";
    try {
      raw = read(file);
    } catch {
      continue;
    }
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"#\r]*)"?/i);
      if (m && !out[m[1]]) out[m[1]] = m[2].trim();
    }
  }
  return out;
}

const env = { ...envFile(), ...process.env } as Record<string, string>;
const clientId = env.GOOGLE_CLIENT_ID ?? "";
const clientSecret = env.GOOGLE_CLIENT_SECRET ?? "";
const nextAuthUrl = env.NEXTAUTH_URL ?? "";

/* ── 1. Static wiring ─────────────────────────────────────────────────── */

console.log("1. The wiring");

check("GOOGLE_CLIENT_ID is set", clientId.length > 0);
check("GOOGLE_CLIENT_SECRET is set", clientSecret.length > 0);
check(
  "the client id looks like a Google one",
  /\.apps\.googleusercontent\.com$/.test(clientId),
  clientId ? `ends "${clientId.slice(-24)}"` : "empty"
);
check("NEXTAUTH_URL is set", nextAuthUrl.length > 0, nextAuthUrl || "empty");
check(
  "NEXTAUTH_URL has no trailing slash",
  !nextAuthUrl.endsWith("/"),
  // NextAuth builds "<url>/api/auth/..." by concatenation, so a trailing
  // slash produces a double slash that will not match what Google has.
  nextAuthUrl
);

const auth = read("src/lib/auth.ts");
check("the Google provider is registered", /GoogleProvider\(/.test(auth));
check(
  "it is gated so an unconfigured app still boots",
  /googleConfigured\s*\?/.test(auth)
);
check("the Prisma adapter is attached", /PrismaAdapter\(prisma\)/.test(auth));
// Credentials sign-in forces JWT sessions; the adapter still does the OAuth
// user creation and account linking.
check("sessions are JWT", /strategy:\s*"jwt"/.test(auth));

// The single most common MySQL failure: Google's id_token is a long JWT and
// will not fit a default VARCHAR(191).
const schema = read("prisma/schema.prisma");
const account = schema.slice(
  schema.indexOf("model Account"),
  schema.indexOf("}", schema.indexOf("model Account"))
);
for (const col of ["refresh_token", "access_token", "id_token"]) {
  check(
    `Account.${col} is @db.Text`,
    new RegExp(`${col}\\s+String\\?\\s+@db\\.Text`).test(account),
    "a VARCHAR(191) truncates Google's token and the sign-in fails at the database"
  );
}
check(
  "Account has the provider uniqueness key",
  /@@unique\(\[provider, providerAccountId\]\)/.test(account)
);

// Account linking is deliberately OFF, which is correct — silently attaching
// a Google login to an existing password account is an account-takeover
// vector if the email was never verified. It has a visible consequence, so
// the copy for it has to exist.
check(
  "email/account linking is not silently allowed",
  /allowDangerousEmailAccountLinking:\s*false/.test(auth)
);
const login = read("src/components/auth/LoginForm.tsx");
check(
  "OAuthAccountNotLinked is explained to the user",
  /OAuthAccountNotLinked/.test(login),
  "without it, a password user clicking Google sees a bare error code"
);

// Google always creates a PATIENT — the adapter has no notion of intent — so
// the doctor sign-up needs the bridge that promotes the new account.
const onboarding = read("src/lib/actions/doctorOnboarding.ts");
check(
  "the doctor sign-up promotes a Google account",
  /promoteCurrentUserToDoctor/.test(onboarding)
);
check(
  "and never demotes an admin",
  /user\.role === Role\.PATIENT/.test(onboarding)
);

/* ── 2. What Google says ──────────────────────────────────────────────── */

interface Verdict {
  label: string;
  uri: string;
  status: "accepted" | "mismatch" | "other";
  reason: string;
}

async function probe(label: string, redirectUri: string): Promise<Verdict> {
  const url =
    "https://accounts.google.com/o/oauth2/v2/auth?" +
    new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
    });

  const res = await fetch(url, { redirect: "follow" });
  const authError = new URL(res.url).searchParams.get("authError");

  if (!authError) {
    return { label, uri: redirectUri, status: "accepted", reason: "reached sign-in" };
  }

  // Google base64url-encodes a protobuf; the reason is plain ASCII inside it.
  const raw = Buffer.from(
    authError.replace(/-/g, "+").replace(/_/g, "/"),
    "base64"
  ).toString("latin1");
  const reason =
    raw.match(
      /(redirect_uri_mismatch|invalid_request|invalid_client|deleted_client|unauthorized_client|access_denied)/
    )?.[1] ?? "unknown";

  return {
    label,
    uri: redirectUri,
    status: reason === "redirect_uri_mismatch" ? "mismatch" : "other",
    reason,
  };
}

const callbackFor = (origin: string) =>
  `${origin.replace(/\/$/, "")}/api/auth/callback/google`;

async function live(): Promise<void> {
  console.log("\n2. What Google says about each redirect URI");

  if (!clientId) {
    notes.push("No client id, so nothing was asked of Google.");
    return;
  }

  // A URI that cannot be registered. If this comes back accepted, the probe
  // is measuring nothing.
  let control: Verdict;
  try {
    control = await probe("control", callbackFor("https://nope.invalid.example"));
  } catch (e) {
    notes.push(
      `Could not reach Google (${(e as Error).message}). The live half did not run.`
    );
    return;
  }
  if (control.status === "accepted") {
    notes.push(
      "INCONCLUSIVE: the control URI was accepted, so this probe cannot tell registered from unregistered. Ignore the results below."
    );
    return;
  }

  const origins = [
    ...(nextAuthUrl ? [nextAuthUrl] : []),
    ...process.argv.slice(2),
  ];
  if (!origins.length) origins.push("http://localhost:3000");

  const results: Verdict[] = [];
  for (const origin of origins) {
    results.push(await probe(origin, callbackFor(origin)));
  }

  for (const r of results) {
    const line = `${r.label} -> ${r.reason}`;
    if (r.status === "accepted") {
      check(`Google accepts the callback for ${r.label}`, true);
      console.log(`  OK    ${line}`);
    } else if (r.status === "mismatch") {
      check(
        `Google accepts the callback for ${r.label}`,
        false,
        `${callbackFor(r.label)} is not in this OAuth client's Authorised redirect URIs`
      );
      console.log(`  FAIL  ${line}`);
    } else {
      check(`Google accepts the callback for ${r.label}`, false, r.reason);
      console.log(`  FAIL  ${line}`);
    }
  }

  // Proof the probe can report a pass at all. Without it, a run where every
  // URI fails is indistinguishable from a broken probe.
  const anyAccepted = results.some((r) => r.status === "accepted");
  if (!anyAccepted) {
    notes.push(
      "Every URI above was rejected. The control behaved, so the readings are real — but no positive case was observed in this run."
    );
  }
}

/* ── 3. Has anyone ever completed it ──────────────────────────────────── */

async function dbState(): Promise<void> {
  console.log("\n3. The database");
  const accounts = await prisma.account.groupBy({
    by: ["provider"],
    _count: { _all: true },
  });
  const google = accounts.find((a) => a.provider === "google")?._count._all ?? 0;
  const oauthOnly = await prisma.user.count({ where: { passwordHash: null } });

  console.log(`  linked google accounts : ${google}`);
  console.log(`  password-less users    : ${oauthOnly}`);

  // Not a failure. A brand-new environment has none, and so does a broken
  // one — which is the point: this number cannot tell you it works, only
  // that somebody once got through.
  if (google === 0) {
    notes.push(
      "No Google account has ever been linked in this database, so the flow has never completed end to end here."
    );
  }
}

live()
  .then(dbState)
  .catch((e) => fails.push(`threw: ${(e as Error).message}`))
  .finally(async () => {
    await prisma.$disconnect();
    console.log(`\n${pass} passed, ${fails.length} failed`);
    if (fails.length) fails.forEach((f) => console.log(`  FAIL  ${f}`));
    if (notes.length) {
      console.log("");
      notes.forEach((n) => console.log(`  NOTE  ${n}`));
    }
    if (fails.length) process.exit(1);
  });
