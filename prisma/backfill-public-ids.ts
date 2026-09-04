/**
 * Give every existing record the identifier it is quoted by.
 *
 * The columns were added nullable so this could run against live rows without
 * a downtime window. New records get theirs at creation; this covers everyone
 * who was already here.
 *
 * Safe to re-run: it only ever fills a NULL, so an id somebody has already
 * been told, printed on an aftercare sheet or read down a phone line is never
 * silently replaced.
 *
 * Covers accounts and practices, and — since September 2026 — premises,
 * catalogue entries and equipment, which had no quotable id at all: "which
 * branch" and "which laser" are both asked over a phone.
 *
 *   npx tsx prisma/backfill-public-ids.ts
 */
import { PrismaClient, Prisma } from "@prisma/client";

import {
  claimId,
  newAssetId,
  newClinicId,
  newDoctorId,
  newPatientId,
  newTreatmentId,
} from "../src/lib/publicId";

const prisma = new PrismaClient({ log: ["error"] });

/** True when the write failed because the id was already taken. */
function isDuplicate(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

/**
 * Fill one table.
 *
 * The unique index is the arbiter, not a pre-flight SELECT: two runs could
 * both find an id free and then both insert it. `claimId` retries against the
 * failed write, so the check and the claim are the same operation.
 */
async function fill<T extends { id: string }>(
  label: string,
  rows: T[],
  make: () => string,
  write: (id: string, publicId: string) => Promise<unknown>,
  describe: (row: T) => string,
  /** Row-by-row logging is useful for people and noise for a catalogue. */
  verbose = true
) {
  for (const row of rows) {
    const id = await claimId(make, async (candidate) => {
      try {
        await write(row.id, candidate);
        return true;
      } catch (e) {
        if (isDuplicate(e)) return false;
        throw e;
      }
    });
    if (verbose) console.log(`  ${id}  ${describe(row)}`);
  }
  console.log(`${label}: ${rows.length} filled`);
}

async function main() {
  const [users, doctors, clinics, treatments, assets] = await Promise.all([
    prisma.user.findMany({ where: { publicId: null }, select: { id: true, email: true } }),
    prisma.doctor.findMany({ where: { publicId: null }, select: { id: true, name: true } }),
    prisma.clinic.findMany({ where: { publicId: null }, select: { id: true, name: true } }),
    prisma.treatment.findMany({ where: { publicId: null }, select: { id: true, name: true } }),
    prisma.practiceAsset.findMany({ where: { publicId: null }, select: { id: true, name: true } }),
  ]);

  console.log(
    `to fill — ${users.length} account(s), ${doctors.length} practice(s), ` +
      `${clinics.length} clinic(s), ${treatments.length} treatment(s), ` +
      `${assets.length} machine(s)\n`
  );

  await fill("accounts", users, newPatientId, (id, publicId) =>
    prisma.user.update({ where: { id }, data: { publicId } }), (u) => u.email ?? u.id);
  await fill("practices", doctors, newDoctorId, (id, publicId) =>
    prisma.doctor.update({ where: { id }, data: { publicId } }), (d) => d.name);
  await fill("clinics", clinics, newClinicId, (id, publicId) =>
    prisma.clinic.update({ where: { id }, data: { publicId } }), (c) => c.name);
  await fill("treatments", treatments, newTreatmentId, (id, publicId) =>
    prisma.treatment.update({ where: { id }, data: { publicId } }), (t) => t.name, false);
  await fill("equipment", assets, newAssetId, (id, publicId) =>
    prisma.practiceAsset.update({ where: { id }, data: { publicId } }), (a) => a.name);

  const left = await Promise.all([
    prisma.user.count({ where: { publicId: null } }),
    prisma.doctor.count({ where: { publicId: null } }),
    prisma.clinic.count({ where: { publicId: null } }),
    prisma.treatment.count({ where: { publicId: null } }),
    prisma.practiceAsset.count({ where: { publicId: null } }),
  ]);
  console.log(
    `\nremaining without an id — accounts ${left[0]}, practices ${left[1]}, ` +
      `clinics ${left[2]}, treatments ${left[3]}, equipment ${left[4]}`
  );
}

main()
  .catch((e) => {
    console.error(e.message ?? e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
