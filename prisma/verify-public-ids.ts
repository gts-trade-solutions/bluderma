/**
 * Every account and practice can be quoted by an identifier a human can read.
 *
 * A cuid is exactly right for a foreign key and useless on paper: nobody reads
 * `cmf3k2p9x0001qp7g8h2n4v6z` down a phone line, and it will not go in the
 * "Patient ID" box on an aftercare sheet. So there is a second identifier,
 * and this suite holds the three properties it has to have.
 *
 *   1. A patient and a doctor id cannot be mistaken for one another. They
 *      appear together on the same printed page.
 *   2. They are unguessable. BLU-P-000001 would announce the size of the
 *      client list and let anyone walk it.
 *   3. Nobody can be created without one, or the whole thing is decorative.
 *
 *   npx tsx prisma/verify-public-ids.ts
 */
import { readFileSync } from "node:fs";

import { PrismaClient } from "@prisma/client";

import {
  DOCTOR_PREFIX,
  PATIENT_PREFIX,
  claimId,
  isDoctorId,
  isPatientId,
  newDoctorId,
  newPatientId,
  normalise,
} from "../src/lib/publicId";

const prisma = new PrismaClient({ log: ["error"] });

let pass = 0;
const fails: string[] = [];
function check(name: string, ok: boolean, detail?: string) {
  if (ok) pass++;
  else fails.push(detail ? `${name} (${detail})` : name);
}
const codeOnly = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ");

async function main() {
  /* ── The two kinds cannot be confused ──────────────────────────────── */

  const p1 = newPatientId();
  const d1 = newDoctorId();
  check("a patient id is well formed", isPatientId(p1), p1);
  check("a doctor id is well formed", isDoctorId(d1), d1);
  check("a patient id is not a doctor id", !isDoctorId(p1), p1);
  check("a doctor id is not a patient id", !isPatientId(d1), d1);
  check(
    "they differ in length as well as prefix",
    p1.length !== d1.length,
    `${p1.length} vs ${d1.length}`
  );
  check("prefixes are distinct", !PATIENT_PREFIX.startsWith(DOCTOR_PREFIX));
  // BLU-P is a prefix of nothing, but BLU-D IS a prefix of BLU-DR, so a naive
  // startsWith check on the wrong one would classify every doctor as a patient.
  check(
    "a doctor id is not matched by the patient pattern",
    !new RegExp(`^${PATIENT_PREFIX}-`).test(d1)
  );

  /* ── Unguessable ───────────────────────────────────────────────────── */

  const many = Array.from({ length: 500 }, newPatientId);
  check("ids do not repeat across a run", new Set(many).size === 500);
  // A counter would produce a sorted set; random ids will not be in order.
  const sorted = [...many].sort();
  check(
    "and are not sequential",
    sorted.join() !== many.join(),
    "a counter leaks how many clients exist and lets anyone walk the list"
  );

  const alphabet = new Set(many.join("").replace(/BLU-P-/g, "").split(""));
  for (const bad of ["I", "L", "O", "U"]) {
    check(
      `the alphabet excludes ${bad}`,
      !alphabet.has(bad),
      bad === "U" ? "so no id can spell something unfortunate" : "misread when spoken"
    );
  }

  /* ── Forgiving on the way in ───────────────────────────────────────── */

  // The commonest use of one of these is somebody reading it off a printed
  // sheet, so refusing their transcription would be pedantry aimed at the
  // wrong person.
  check("lower case is accepted", isPatientId(p1.toLowerCase()));
  check("spaces are accepted", isPatientId(p1.replace(/-/g, " ")));
  check(
    "O is folded to zero",
    normalise("BLU-P-OOOOOO") === "BLU-P-000000"
  );
  check("I and L are folded to one", normalise("BLU-P-IL0000") === "BLU-P-110000");

  /* ── claimId retries rather than trusting a pre-flight check ───────── */

  let tries = 0;
  const got = await claimId(
    newPatientId,
    async () => {
      tries++;
      return tries >= 3; // first two "collide"
    }
  );
  check("a collision is retried", tries === 3 && isPatientId(got));
  let threw = false;
  try {
    await claimId(newPatientId, async () => false, 4);
  } catch {
    threw = true;
  }
  check(
    "and a broken index fails loudly rather than spinning",
    threw,
    "an unbounded retry would hang the request"
  );

  /* ── Nobody is created without one ─────────────────────────────────── */

  for (const [file, sym] of [
    ["src/app/api/auth/register/route.ts", "newPatientId"],
    ["src/lib/actions/doctorOnboarding.ts", "newDoctorId"],
    ["src/lib/doctor/ensurePractice.ts", "newDoctorId"],
  ] as const) {
    check(`${file.split("/").pop()} allocates one`, codeOnly(file).includes(sym));
  }

  /* ── And the live data is complete ─────────────────────────────────── */

  const [users, doctors, noUser, noDoctor] = await Promise.all([
    prisma.user.count(),
    prisma.doctor.count(),
    prisma.user.count({ where: { publicId: null } }),
    prisma.doctor.count({ where: { publicId: null } }),
  ]);
  check(`all ${users} accounts have an id`, noUser === 0, `${noUser} without`);
  check(`all ${doctors} practices have an id`, noDoctor === 0, `${noDoctor} without`);

  const sample = await prisma.user.findFirst({
    where: { publicId: { not: null } },
    select: { publicId: true },
  });
  check(
    "a stored account id is in the patient form",
    isPatientId(sample?.publicId ?? ""),
    sample?.publicId ?? "none"
  );
  const dsample = await prisma.doctor.findFirst({
    where: { publicId: { not: null } },
    select: { publicId: true },
  });
  check(
    "a stored practice id is in the doctor form",
    isDoctorId(dsample?.publicId ?? ""),
    dsample?.publicId ?? "none"
  );
}

main()
  .catch((e) => fails.push(`threw: ${e.message ?? e}`))
  .finally(async () => {
    await prisma.$disconnect();
    console.log(`\n${pass} passed, ${fails.length} failed`);
    if (fails.length) {
      fails.forEach((f) => console.log(`  FAIL  ${f}`));
      process.exit(1);
    }
  });
