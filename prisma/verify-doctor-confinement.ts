/**
 * The doctor confinement rule, asserted against a running server.
 *
 * A signed-in DOCTOR may open /doctor, /api and /forbidden, and nothing else.
 * That rule lives in two places by necessity — `middleware.ts` enforces it on
 * the edge, `lib/roles.ts` mirrors it so sign-in never targets a page it is
 * about to bounce from — and the failure mode is silent: somebody adds
 * /clinic-tools, nobody adds it to DOCTOR_AREAS, and the practitioner side
 * quietly leaks into the client shop. Or the reverse, which is worse: a route
 * the portal depends on starts redirecting and a screen goes blank.
 *
 * So this asks the running app, the way a browser would.
 *
 *   npm run dev            # or point BASE at any environment
 *   npx tsx prisma/verify-doctor-confinement.ts
 *
 * It signs in as the demo doctor and the demo client and changes nothing —
 * every request is a GET, and the only state it creates is two sessions.
 */
const BASE = process.env.BASE ?? "http://localhost:3000";

const DOCTOR = {
  email: process.env.VERIFY_DOCTOR_EMAIL ?? "demo.doctor@bluderma.local",
  password: process.env.VERIFY_DOCTOR_PASSWORD ?? "DemoDoctor@2026",
};
const CLIENT = {
  email: process.env.VERIFY_CLIENT_EMAIL ?? "demo.client@bluderma.local",
  password: process.env.VERIFY_CLIENT_PASSWORD ?? "DemoClient@2026",
};

type Expect =
  | { path: string; expect: "ok" }
  | { path: string; expect: "redirect"; to: string };

/** Where a doctor may be, and where they must be sent instead. */
const DOCTOR_CASES: Expect[] = [
  { path: "/doctor/portal", expect: "ok" },
  { path: "/doctor/portal/calendar", expect: "ok" },
  { path: "/doctor/portal/patients", expect: "ok" },
  // Not the confinement rule: the join page moved its steps into the portal
  // and sends any signed-in practitioner there itself. Asserted anyway,
  // because "the deep links we have emailed still land somewhere useful" is
  // the promise that redirect exists to keep.
  { path: "/doctor/join", expect: "redirect", to: "/doctor/portal" },
  // The marketing front door redirects a practitioner who already has an
  // account: it is a pitch for the thing they are already using.
  { path: "/doctor", expect: "redirect", to: "/doctor/portal" },
  { path: "/", expect: "redirect", to: "/doctor/portal" },
  { path: "/patient/explore", expect: "redirect", to: "/doctor/portal" },
  { path: "/patient/skin-analyzer", expect: "redirect", to: "/doctor/portal" },
  { path: "/patient/appointments", expect: "redirect", to: "/doctor/portal" },
  { path: "/login", expect: "redirect", to: "/doctor/portal" },
];

/** Nothing about the client side may have changed. */
const CLIENT_CASES: Expect[] = [
  { path: "/", expect: "ok" },
  { path: "/patient/explore", expect: "ok" },
  { path: "/patient/appointments", expect: "ok" },
  { path: "/doctor/portal", expect: "redirect", to: "/forbidden" },
];

const ANON_CASES: Expect[] = [
  { path: "/", expect: "ok" },
  { path: "/patient/explore", expect: "ok" },
  { path: "/doctor", expect: "ok" },
  { path: "/login", expect: "ok" },
  { path: "/doctor/portal", expect: "redirect", to: "/login" },
];

/** A cookie jar the width of what NextAuth needs, and no wider. */
function jarOf(): { put: (r: Response) => void; header: () => string } {
  const jar = new Map<string, string>();
  return {
    put(r) {
      for (const c of r.headers.getSetCookie?.() ?? []) {
        const [pair] = c.split(";");
        const i = pair.indexOf("=");
        jar.set(pair.slice(0, i), pair.slice(i + 1));
      }
    },
    header() {
      return [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
    },
  };
}

async function signIn(who: { email: string; password: string }) {
  const jar = jarOf();
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  jar.put(csrfRes);
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      cookie: jar.header(),
    },
    body: new URLSearchParams({
      csrfToken,
      email: who.email,
      password: who.password,
      callbackUrl: "/",
      json: "true",
    }),
  });
  jar.put(res);

  const session = await fetch(`${BASE}/api/auth/session`, {
    headers: { cookie: jar.header() },
  }).then((r) => r.json());
  if (!session?.user?.role) {
    throw new Error(`Could not sign in as ${who.email}. Is the demo seeded?`);
  }
  return { jar, role: session.user.role as string };
}

let failures = 0;

async function check(label: string, cookie: string, cases: Expect[]) {
  console.log(`\n${label}`);
  for (const c of cases) {
    const res = await fetch(`${BASE}${c.path}`, {
      redirect: "manual",
      headers: cookie ? { cookie } : {},
    });
    const location = res.headers.get("location") ?? "";
    const redirected = res.status >= 300 && res.status < 400;

    let ok: boolean;
    let saw: string;
    if (c.expect === "ok") {
      ok = res.status === 200;
      saw = redirected ? `${res.status} -> ${location}` : String(res.status);
    } else {
      // A relative or absolute Location both count; only the path matters.
      const path = location.startsWith("http")
        ? new URL(location).pathname
        : location.split("?")[0];
      ok = redirected && path === c.to;
      saw = redirected ? `${res.status} -> ${path}` : String(res.status);
    }

    if (!ok) failures += 1;
    const want = c.expect === "ok" ? "200" : `-> ${c.to}`;
    console.log(
      `  ${ok ? "ok  " : "FAIL"}  ${c.path.padEnd(26)} want ${want.padEnd(18)} saw ${saw}`
    );
  }
}

async function main() {
  console.log(`Checking ${BASE}`);

  const doctor = await signIn(DOCTOR);
  if (doctor.role !== "DOCTOR") {
    throw new Error(`Expected a DOCTOR account, got ${doctor.role}.`);
  }
  await check("As a doctor", doctor.jar.header(), DOCTOR_CASES);

  const client = await signIn(CLIENT);
  if (client.role !== "PATIENT") {
    throw new Error(`Expected a PATIENT account, got ${client.role}.`);
  }
  await check("As a client", client.jar.header(), CLIENT_CASES);

  await check("Signed out", "", ANON_CASES);

  console.log(
    failures === 0
      ? "\nAll good: the practitioner side is sealed and nothing else moved."
      : `\n${failures} check(s) failed.`
  );
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

// A file with no import or export is a global script to TypeScript, and every
// other verify script also declares `main`. This makes it a module.
export {};
