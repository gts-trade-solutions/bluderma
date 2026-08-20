/**
 * Proof that registering as a clinician produces a clinician, and that
 * sign-in never sends anyone somewhere they will be bounced from.
 *
 * The two bugs this guards:
 *
 *  1. RegisterForm hardcoded `accountType: "patient"`. Every account created
 *     through /register was a client — including clinicians who had arrived
 *     from the practitioner side, who were then told "You are signed in as a
 *     client" on /doctor/join with no way forward.
 *
 *  2. LoginForm followed the callbackUrl blindly. A client who clicked
 *     "Doctor sign in" on the practitioner home page was pushed to
 *     /doctor/portal after logging in, where middleware bounced them to
 *     /forbidden — a dead end reached by following an obvious button.
 *
 *   npx tsx prisma/verify-auth-roles.ts
 */
import { PrismaClient, Role } from "@prisma/client";

import { canRoleOpen, landingPathForRole, postLoginPath } from "../src/lib/roles";
import { registerSchema } from "../src/lib/validation";

const prisma = new PrismaClient();
const fails: string[] = [];

function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) fails.push(label);
}

async function main() {
  // ── 1. The registration payload can carry a clinician ─────────────────
  console.log("\n1. Registration accepts both audiences");

  const base = {
    name: "Test Person",
    email: "role-probe@example.com",
    phone: "9000000000",
    password: "correct-horse-battery",
    confirmPassword: "correct-horse-battery",
  };

  const asDoctor = registerSchema.safeParse({ ...base, accountType: "doctor" });
  const asPatient = registerSchema.safeParse({ ...base, accountType: "patient" });
  const asAdmin = registerSchema.safeParse({ ...base, accountType: "admin" });

  check("accountType 'doctor' is accepted", asDoctor.success);
  check("accountType 'patient' is accepted", asPatient.success);
  check(
    "accountType 'admin' is refused — no self-escalation",
    !asAdmin.success
  );

  // ── 2. Sign-in never lands somebody on a page they cannot open ────────
  console.log("\n2. Sign-in routes by what the account actually is");

  const cases: {
    label: string;
    role: Role;
    callback: string;
    expectAllowed: boolean;
  }[] = [
    { label: "client -> /doctor/portal", role: Role.PATIENT, callback: "/doctor/portal", expectAllowed: false },
    { label: "client -> /doctor/join", role: Role.PATIENT, callback: "/doctor/join", expectAllowed: false },
    { label: "client -> /admin", role: Role.PATIENT, callback: "/admin", expectAllowed: false },
    { label: "client -> /patient/membership", role: Role.PATIENT, callback: "/patient/membership", expectAllowed: true },
    { label: "doctor -> /doctor/portal", role: Role.DOCTOR, callback: "/doctor/portal", expectAllowed: true },
    { label: "doctor -> /admin", role: Role.DOCTOR, callback: "/admin", expectAllowed: false },
    { label: "admin -> /doctor/portal", role: Role.ADMIN, callback: "/doctor/portal", expectAllowed: true },
    { label: "admin -> /admin", role: Role.ADMIN, callback: "/admin", expectAllowed: true },
  ];

  for (const c of cases) {
    const allowed = canRoleOpen(c.callback, c.role);
    check(c.label, allowed === c.expectAllowed, allowed ? "allowed" : "refused");

    const landed = postLoginPath(c.callback, c.role);
    if (c.expectAllowed) {
      check(`  ...and lands there`, landed === c.callback, landed);
    } else {
      check(
        `  ...and is sent to its own landing instead of /forbidden`,
        landed === landingPathForRole(c.role),
        landed
      );
    }
  }

  // A bare "/" always resolves to the role's own home.
  for (const role of [Role.PATIENT, Role.DOCTOR, Role.ADMIN]) {
    const landed = postLoginPath("/", role);
    check(
      `${role} with no callback lands on its own page`,
      landed === landingPathForRole(role),
      landed
    );
  }

  // ── Where each role actually lands ──────────────────────────────────────
  // Asserted by value, not against landingPathForRole — every check above
  // compares the two functions to each other, which stays green no matter
  // what the destination is changed to. These are the destinations.
  check(
    "a client lands on the home page",
    landingPathForRole(Role.PATIENT) === "/",
    landingPathForRole(Role.PATIENT)
  );
  // It used to be /patient/skin-analyzer: a sales page for one feature, put
  // in front of somebody who had just proved they are already a customer,
  // hiding the appointments and reports they signed in to reach.
  check(
    "and not at a feature's landing page",
    landingPathForRole(Role.PATIENT) !== "/patient/skin-analyzer"
  );
  check("a doctor lands in the portal", landingPathForRole(Role.DOCTOR) === "/doctor/portal");
  check("an admin lands in admin", landingPathForRole(Role.ADMIN) === "/admin");

  // An explicit ask still wins: clicking "Sign in & scan" must still end at
  // the analyzer, or the home-page default would have broken that button.
  check(
    "an explicit callback still beats the default",
    postLoginPath("/patient/skin-analyzer", Role.PATIENT) === "/patient/skin-analyzer"
  );

  // An off-site callbackUrl must never be followed.
  check(
    "an absolute URL is refused as a callback",
    postLoginPath("https://evil.example/steal", Role.PATIENT) ===
      landingPathForRole(Role.PATIENT)
  );

  // ── 3. Existing accounts still resolve sensibly ───────────────────────
  console.log("\n3. Accounts in the database");

  const byRole = await prisma.user.groupBy({
    by: ["role"],
    _count: { _all: true },
  });
  for (const r of byRole) {
    console.log(`  ${r.role}: ${r._count._all}`);
  }

  const doctorsWithLogin = await prisma.doctor.count({
    where: { userId: { not: null } },
  });
  const doctorUsers = await prisma.user.count({ where: { role: Role.DOCTOR } });
  check(
    "every DOCTOR account has a practice record",
    doctorsWithLogin >= doctorUsers,
    `${doctorsWithLogin} linked practices vs ${doctorUsers} doctor logins`
  );

  if (fails.length) {
    console.log(`\n${fails.length} FAILED:`);
    for (const f of fails) console.log("  -", f);
    process.exitCode = 1;
  } else {
    console.log("\nAll role-routing rules hold.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
