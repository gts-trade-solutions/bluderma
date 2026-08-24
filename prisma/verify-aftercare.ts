/**
 * Post-procedure aftercare sheets.
 *
 * Two rules carry this feature and both are easy to get subtly wrong:
 *
 *   1. A doctor's own additions come back the next time they issue for the
 *      SAME treatment. That is what the clinic asked for.
 *   2. An issued sheet never changes afterwards. A doctor refining their laser
 *      instructions in March must not rewrite what a patient was handed in
 *      January and is still following. Clinical instruction stops being a
 *      living document the moment it is in somebody's hands.
 *
 * Rule 2 is the one a reasonable implementation gets wrong, by joining the
 * sheet to the note instead of copying. So it is exercised, not read.
 *
 *   npx tsx prisma/verify-aftercare.ts
 */
import { readFileSync } from "node:fs";

import { PrismaClient } from "@prisma/client";

import { STANDARD_AFTERCARE, treatmentKey } from "../src/lib/aftercare/standard";

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
  /* ── The standard content is complete ──────────────────────────────── */

  const c = STANDARD_AFTERCARE;
  check("the do's are all there", c.dos.length === 11, `${c.dos.length}`);
  check("the don'ts are all there", c.donts.length === 11, `${c.donts.length}`);
  check("the warning signs are all there", c.warnings.length === 6, `${c.warnings.length}`);
  // The clinical specifics are the reason this is transcribed rather than
  // reworded. If any of these drift, the sheet is telling somebody something
  // different from what the clinic wrote.
  for (const [what, needle] of [
    ["the SPF is named", "SPF 50+"],
    ["the active-ingredient window is 7 days", "for 7 days"],
    ["the fever threshold is given", "38"],
    ["other treatments are 2 to 4 weeks", "2 to 4 weeks"],
    ["picking is called out as the scarring cause", "leading cause of scarring"],
  ] as const) {
    check(what, JSON.stringify(c).includes(needle), needle);
  }

  /* ── The treatment key folds what should be the same drawer ────────── */

  check(
    "casing and spacing do not split a treatment",
    treatmentKey("CO2 Laser") === treatmentKey("  co2   laser  ")
  );
  check(
    "punctuation does not split it either",
    treatmentKey("CO2-Laser") === treatmentKey("CO2 Laser")
  );
  check(
    "but different treatments stay apart",
    treatmentKey("CO2 Laser") !== treatmentKey("Erbium Laser")
  );

  /* ── The action copies rather than joins ───────────────────────────── */

  const action = codeOnly("src/lib/actions/aftercare.ts");
  check(
    "the sheet snapshots the standard content",
    /dos: STANDARD_AFTERCARE\.dos/.test(action),
    "joining to the source would let a later edit rewrite an issued sheet"
  );
  check(
    "the standing note is upserted per doctor and treatment",
    /doctorId_treatmentKey/.test(action)
  );
  check(
    "remembering can be declined",
    /rememberNotes/.test(action),
    "a one-off instruction must not become standing advice"
  );
  check(
    "an appointment id from the caller is checked against the doctor",
    /appointment\.findFirst[\s\S]{0,200}doctorId: owner\.doctorId/.test(action)
  );
  check(
    "acknowledging is scoped to the patient and to unconfirmed sheets",
    /patientUserId: user\.id,\s*acknowledgedAt: null/.test(action),
    "re-confirming would move the timestamp and lose when they actually did"
  );

  /* ── Live: issue, remember, and prove the snapshot holds ───────────── */

  const [doctor, patient] = await Promise.all([
    prisma.doctor.findFirst({ select: { id: true, name: true, publicId: true } }),
    prisma.user.findFirst({
      where: { role: "PATIENT" },
      select: { id: true, publicId: true },
    }),
  ]);
  if (!doctor || !patient) {
    fails.push("need a doctor and a patient to exercise the flow");
    return;
  }

  const KEY = treatmentKey("vfy-procedure");
  const made: string[] = [];
  try {
    // First sheet: the doctor writes their own instruction.
    const first = await prisma.aftercareSheet.create({
      data: {
        doctorId: doctor.id,
        patientUserId: patient.id,
        patientName: "Verify Patient",
        patientPublicId: patient.publicId,
        doctorName: doctor.name,
        doctorPublicId: doctor.publicId,
        procedure: "vfy-procedure",
        procedureDate: new Date(),
        intro: c.intro,
        dos: c.dos,
        donts: c.donts,
        warnings: c.warnings,
        doctorNotes: "Original instruction",
      },
    });
    made.push(first.id);

    await prisma.aftercareNote.upsert({
      where: { doctorId_treatmentKey: { doctorId: doctor.id, treatmentKey: KEY } },
      create: {
        doctorId: doctor.id,
        treatmentKey: KEY,
        treatmentName: "vfy-procedure",
        body: "Original instruction",
      },
      update: { body: "Original instruction" },
    });

    const note = await prisma.aftercareNote.findUnique({
      where: { doctorId_treatmentKey: { doctorId: doctor.id, treatmentKey: KEY } },
      select: { body: true },
    });
    check("the doctor's addition is remembered for next time", note?.body === "Original instruction");

    // The doctor revises their standing advice.
    await prisma.aftercareNote.update({
      where: { doctorId_treatmentKey: { doctorId: doctor.id, treatmentKey: KEY } },
      data: { body: "Revised instruction" },
    });

    const held = await prisma.aftercareSheet.findUnique({
      where: { id: first.id },
      select: { doctorNotes: true, dos: true },
    });
    check(
      "revising it does NOT change the sheet already issued",
      held?.doctorNotes === "Original instruction",
      "the patient is still following the January sheet"
    );
    check(
      "and the standard content on that sheet is its own copy",
      Array.isArray(held?.dos) && (held?.dos as string[]).length === 11
    );

    // One doctor's standing note is not another's.
    const other = await prisma.doctor.findFirst({
      where: { id: { not: doctor.id } },
      select: { id: true },
    });
    if (other) {
      const theirs = await prisma.aftercareNote.findUnique({
        where: { doctorId_treatmentKey: { doctorId: other.id, treatmentKey: KEY } },
      });
      check("another doctor does not inherit these notes", theirs === null);
    }

    // Acknowledgement is a deliberate act and happens once.
    const ack = await prisma.aftercareSheet.updateMany({
      where: { id: first.id, patientUserId: patient.id, acknowledgedAt: null },
      data: { acknowledgedAt: new Date() },
    });
    check("a patient can confirm their own sheet", ack.count === 1);
    const again = await prisma.aftercareSheet.updateMany({
      where: { id: first.id, patientUserId: patient.id, acknowledgedAt: null },
      data: { acknowledgedAt: new Date() },
    });
    check("and confirming twice changes nothing", again.count === 0);

    const notMine = await prisma.aftercareSheet.findFirst({
      where: { id: first.id, patientUserId: "someone-else" },
    });
    check("another client cannot read it", notMine === null);
  } finally {
    await prisma.aftercareSheet.deleteMany({ where: { id: { in: made } } });
    await prisma.aftercareNote.deleteMany({ where: { treatmentKey: KEY } });
    const left = await prisma.aftercareSheet.count({
      where: { procedure: "vfy-procedure" },
    });
    check("the fixture cleaned up after itself", left === 0, `${left} left`);
  }
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
