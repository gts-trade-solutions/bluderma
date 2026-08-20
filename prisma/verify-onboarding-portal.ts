/**
 * The onboarding-first portal flow.
 *
 * A practitioner used to sign up and land on a marketing page asking them to
 * list their practice — having just done exactly that — then be walked through
 * a wizard on a separate route while the portal sat behind it showing three
 * empty tiles. Signup now lands in the portal, and the portal IS the
 * application until the listing is approved.
 *
 * Also covers the security fix that came with it: `applicationGaps` was an
 * exported server action taking a doctorId, so any caller could ask which
 * fields any practitioner was missing.
 */
import { readFileSync } from "node:fs";
import { PrismaClient, DoctorStatus } from "@prisma/client";

import {
  advisoryGaps,
  blockingGaps,
  firstIncompleteStep,
  getApplicationGaps,
} from "../src/lib/doctor/gaps";
import { doctorCta, doctorHasPortal } from "../src/lib/doctor/viewer";
import { clinicTodayBounds, clinicWallClock } from "../src/lib/queries/availability";

const prisma = new PrismaClient({ log: ["warn", "error"] });

let pass = 0;
const fails: string[] = [];
function check(name: string, ok: boolean) {
  if (ok) pass++;
  else fails.push(name);
}
const read = (p: string) => readFileSync(p, "utf8");

// ── Routing: every door leads to the portal ────────────────────────────────
const account = read("src/components/doctor/join/AccountStep.tsx");
check("signup lands in the portal", /router\.push\("\/doctor\/portal"\)/.test(account));
check(
  "no step-1 push remains",
  !/router\.push\("\/doctor\/join\?step=1"\)/.test(account)
);

const register = read("src/components/auth/RegisterForm.tsx");
check(
  "doctor registration defaults to the portal",
  /isDoctor \? "\/doctor\/portal"/.test(register)
);

const join = read("src/app/doctor/join/page.tsx");
check("the join page redirects signed-in doctors", /redirect\(\s*Number\.isFinite/.test(join));
check("the redirect preserves ?step=", /\/doctor\/portal\?step=\$\{/.test(join));
check("the join page keeps step 0 public", /<AccountStep/.test(join));
check("the wizard body no longer lives there", !/<ConsultStep/.test(join));

const portalPage = read("src/app/doctor/portal/page.tsx");
check("the portal home branches on status", /OnboardingHome/.test(portalPage));
check("PENDING gets its own screen", /PendingPreview/.test(portalPage));

// ── The wall-clock rule lives in one place ────────────────────────────────
check("the portal page no longer hardcodes the offset", !/330/.test(portalPage));
check(
  "availability.ts owns the day bounds",
  /export function clinicTodayBounds/.test(read("src/lib/queries/availability.ts"))
);
const bounds = clinicTodayBounds();
check("day bounds span exactly 24h", bounds.to.getTime() - bounds.from.getTime() === 86_400_000);
check("the seed matches the window start", bounds.seed === bounds.from.toISOString().slice(0, 10));
check("the clinic clock runs ahead of UTC", clinicWallClock().getTime() > Date.now());

// ── The gaps hole is closed ───────────────────────────────────────────────
const onboarding = read("src/lib/actions/doctorOnboarding.ts");
check(
  "applicationGaps is no longer an exported action",
  !/export async function applicationGaps/.test(onboarding)
);
check("submitApplication uses the shared module", /blockingGaps\(await getApplicationGaps/.test(onboarding));
const gapsLib = read("src/lib/doctor/gaps.ts");
check("the gaps module is not a server action", !/^"use server"/m.test(gapsLib));
check(
  "the profile page no longer derives its own gaps",
  !/gaps\.push\(/.test(read("src/app/doctor/portal/profile/page.tsx"))
);

// ── The rail states ───────────────────────────────────────────────────────
const layout = read("src/app/doctor/portal/layout.tsx");
check("the layout creates a missing practice", /ensurePractice\(user\)/.test(layout));
check("ADMIN is excluded from that", /user\.role === "DOCTOR"/.test(layout));
check("the rail locks pages during setup", /locked: setup/.test(layout));
check("the DRAFT nag is suppressed on the wizard itself", /&& !setup/.test(layout));
const rail = read("src/components/doctor/PortalRail.tsx");
check("locked items are not links", /aria-disabled="true"/.test(rail));
check("a lock glyph exists", /lock:/.test(read("src/components/doctor/portalUi.tsx")));

// ── Steps take their navigation as props ──────────────────────────────────
for (const [file, prop] of [
  ["AboutStep", "redirectTo"],
  ["CredentialsStep", "redirectTo"],
  ["ConsultStep", "redirectTo"],
  ["ClinicsStep", "nextHref"],
  ["HoursStep", "nextHref"],
  ["ReviewStep", "backHref"],
] as const) {
  const src = read(`src/components/doctor/join/${file}.tsx`);
  check(`${file} accepts ${prop}`, new RegExp(`${prop}\\??:`).test(src));
  check(`${file} defaults to today's route`, /\/doctor\/join\?step=|"\/doctor"/.test(src));
}

// ── The viewer vocabulary agrees with itself ──────────────────────────────
check("a live doctor is sent to the portal", doctorCta("doctor-live").href === "/doctor/portal");
check("a pending doctor is sent to the portal", doctorCta("doctor-pending").href === "/doctor/portal");
check("a guest is sent to the wizard", doctorCta("guest").href === "/doctor/join");
check("a client is sent to the wizard", doctorCta("client").href === "/doctor/join");
check("nobody is told to 'finish your listing' any more",
  !["guest", "client", "doctor-pending", "doctor-live", "admin"]
    .some((v) => doctorCta(v as never).label.includes("Finish")));
check("a pending doctor has a portal", doctorHasPortal("doctor-pending"));
check("a client does not", !doctorHasPortal("client"));
for (const f of [
  "src/app/doctor/page.tsx",
  "src/components/doctor/JoinHero.tsx",
  "src/components/doctor/SimpleSteps.tsx",
]) {
  check(`${f.split("/").pop()} uses the shared CTA`, /doctorCta/.test(read(f)));
}

// ── Live data: the gap list is real ───────────────────────────────────────
async function dbChecks() {
  // Deliberately a doctor who went through the application, not just any
  // APPROVED row: the seeded demo practitioners were created live without ever
  // applying (Doctor.status defaults to APPROVED), so they genuinely gap on
  // registration and asserting otherwise would test the seed, not the code.
  const applied = await prisma.doctor.findFirst({
    where: {
      status: DoctorStatus.APPROVED,
      isActive: true,
      regNumber: { not: null },
      regCouncil: { not: null },
    },
    select: { id: true },
  });
  if (applied) {
    const gaps = await getApplicationGaps(applied.id);
    check("a doctor who applied has no blocking gaps", blockingGaps(gaps).length === 0);
    check("gaps carry a step to fix them", gaps.every((g) => g.step >= 1 && g.step <= 5));
    check("blocking and advisory partition the list",
      blockingGaps(gaps).length + advisoryGaps(gaps).length === gaps.length);
    check("a complete profile lands on review", firstIncompleteStep(gaps) === 6);
  }

  // The other half of the same fact: a live row with no registration on file
  // is flagged, which is what the admin approval gate exists to prevent.
  const unregistered = await prisma.doctor.findFirst({
    where: { status: DoctorStatus.APPROVED, regNumber: null },
    select: { id: true },
  });
  if (unregistered) {
    const keys = blockingGaps(await getApplicationGaps(unregistered.id)).map((g) => g.key);
    check("a live doctor with no registration is flagged", keys.includes("registration"));
  }

  // An empty practice should be blocked on the earliest step, not step 6.
  const draft = await prisma.doctor.findFirst({
    where: { status: DoctorStatus.DRAFT },
    select: { id: true, title: true },
  });
  if (draft && !draft.title.trim()) {
    const gaps = await getApplicationGaps(draft.id);
    check("a blank draft is blocked", blockingGaps(gaps).length > 0);
    check("a blank draft starts at step 1", firstIncompleteStep(gaps) === 1);
  }

  // The progress counter counts STEPS, not gaps — step 1 alone holds four of
  // them, and the naive subtraction rendered "-2 of 6 done" on a new practice.
  if (draft) {
    const blocking = blockingGaps(await getApplicationGaps(draft.id));
    const stepsWithWork = new Set(blocking.map((g) => g.step));
    const done = 6 - stepsWithWork.size;
    check("progress never goes negative", done >= 0);
    check("progress never exceeds the step count", done <= 6);
    check("more gaps than steps is possible", blocking.length >= stepsWithWork.size);
  }

  const missing = await getApplicationGaps("does-not-exist");
  check("an unknown doctor fails closed", blockingGaps(missing).length === 1);
}

dbChecks()
  .catch((e) => fails.push(`db checks threw: ${(e as Error).message}`))
  .finally(async () => {
    await prisma.$disconnect();
    console.log(`\n${pass} passed, ${fails.length} failed`);
    if (fails.length) {
      fails.forEach((f) => console.log(`  FAIL  ${f}`));
      process.exit(1);
    }
  });
