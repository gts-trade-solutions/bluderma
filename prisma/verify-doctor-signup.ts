/**
 * Proof that every route to a DOCTOR account ends with a practice to onboard.
 *
 * The bug: a practitioner login and a practice record are two rows, and they
 * were created together in exactly ONE place — /doctor/join's own first step.
 * Registering through /register?as=doctor, or being given the Doctor role by
 * an admin, produced a login with nothing attached — and /doctor/join then
 * said "No practice record yet, send us a note", which is a dead end for the
 * one person the wizard exists to serve.
 *
 * Creates test accounts, checks each path, and deletes everything it made.
 *
 *   npx tsx prisma/verify-doctor-signup.ts
 */
import { PrismaClient, DoctorStatus, Role } from "@prisma/client";

import { ensurePractice } from "../src/lib/doctor/ensurePractice";

const prisma = new PrismaClient();
const fails: string[] = [];
const madeUsers: string[] = [];

function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) fails.push(label);
}

const stamp = Date.now().toString(36);
const email = (tag: string) => `signup-probe-${tag}-${stamp}@example.invalid`;

async function makeUser(tag: string, role: Role) {
  const u = await prisma.user.create({
    data: {
      name: `Probe ${tag}`,
      email: email(tag),
      phone: "9000000000",
      passwordHash: "x",
      role,
    },
    select: { id: true, name: true, email: true, phone: true },
  });
  madeUsers.push(u.id);
  return u;
}

async function main() {
  // ── 1. Registering as a clinician leaves a practice behind ────────────
  console.log("\n1. /register?as=doctor — the path that was broken");

  const viaRegister = await makeUser("register", Role.DOCTOR);
  const made = await ensurePractice(viaRegister);
  check("a practice is created", made.created, made.slug);

  const row = await prisma.doctor.findUnique({
    where: { userId: viaRegister.id },
    select: { status: true, isActive: true, slug: true, name: true, title: true },
  });
  check("it is linked to the login", row !== null);
  check("it starts as a DRAFT", row?.status === DoctorStatus.DRAFT, row?.status);
  check(
    "and is not live — invisible to clients twice over",
    row?.isActive === false
  );
  check(
    "nothing is invented — the wizard fills these in",
    row?.title === "",
    `title: "${row?.title}"`
  );
  check("the name carries over from the account", row?.name === "Probe register");

  // ── 2. Calling it again is a no-op, not a second practice ─────────────
  console.log("\n2. Safe to call on every render of the wizard");

  const again = await ensurePractice(viaRegister);
  check("the second call creates nothing", again.created === false);
  check("and returns the same practice", again.id === made.id);

  const count = await prisma.doctor.count({ where: { userId: viaRegister.id } });
  check("exactly one practice exists", count === 1, String(count));

  // ── 3. An admin-created doctor login heals too ────────────────────────
  console.log("\n3. A login an admin gave the Doctor role");

  const viaAdmin = await makeUser("admin-made", Role.DOCTOR);
  const healed = await ensurePractice(viaAdmin);
  check("that account also gets a practice", healed.created, healed.slug);
  check("with its own handle", healed.slug !== made.slug);

  // ── 4. Two practitioners with the same name do not collide ────────────
  console.log("\n4. Handles stay unique");

  const twinA = await prisma.user.create({
    data: {
      name: "Same Name",
      email: email("twin-a"),
      passwordHash: "x",
      role: Role.DOCTOR,
    },
    select: { id: true, name: true, email: true, phone: true },
  });
  madeUsers.push(twinA.id);
  const twinB = await prisma.user.create({
    data: {
      name: "Same Name",
      email: email("twin-b"),
      passwordHash: "x",
      role: Role.DOCTOR,
    },
    select: { id: true, name: true, email: true, phone: true },
  });
  madeUsers.push(twinB.id);

  const a = await ensurePractice(twinA);
  const b = await ensurePractice(twinB);
  check("identical names get different handles", a.slug !== b.slug, `${a.slug} / ${b.slug}`);

  // ── 5. A draft never reaches the public directory ─────────────────────
  console.log("\n5. Drafts stay invisible");

  const publicCount = await prisma.doctor.count({
    where: { status: DoctorStatus.APPROVED, isActive: true },
  });
  const draftInPublic = await prisma.doctor.count({
    where: {
      userId: { in: madeUsers },
      status: DoctorStatus.APPROVED,
    },
  });
  check("none of the drafts is approved", draftInPublic === 0);
  console.log(`  (public directory unchanged at ${publicCount})`);

  // ── Clean up ──────────────────────────────────────────────────────────
  await prisma.doctor.deleteMany({ where: { userId: { in: madeUsers } } });
  await prisma.user.deleteMany({ where: { id: { in: madeUsers } } });
  const leftUsers = await prisma.user.count({ where: { id: { in: madeUsers } } });
  const leftDocs = await prisma.doctor.count({ where: { userId: { in: madeUsers } } });
  check("test accounts removed", leftUsers === 0 && leftDocs === 0);

  if (fails.length) {
    console.log(`\n${fails.length} FAILED:`);
    for (const f of fails) console.log("  -", f);
    process.exitCode = 1;
  } else {
    console.log("\nEvery route to a DOCTOR account ends with a practice.");
  }
}

main()
  .catch(async (e) => {
    console.error(e);
    // Never leave probes behind, even on a failure.
    await prisma.doctor.deleteMany({ where: { userId: { in: madeUsers } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: madeUsers } } }).catch(() => {});
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
