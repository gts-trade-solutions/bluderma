/**
 * Give every existing account and practice the identifier it is quoted by.
 *
 * The columns were added nullable so this could run against live rows without
 * a downtime window. New records get theirs at creation; this covers everyone
 * who was already here.
 *
 * Safe to re-run: it only ever fills a NULL, so an id somebody has already
 * been told, printed on an aftercare sheet or read down a phone line is never
 * silently replaced.
 *
 *   npx tsx prisma/backfill-public-ids.ts
 */
import { PrismaClient, Prisma } from "@prisma/client";

import { claimId, newDoctorId, newPatientId } from "../src/lib/publicId";

const prisma = new PrismaClient({ log: ["error"] });

/** True when the write failed because the id was already taken. */
function isDuplicate(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

async function main() {
  const users = await prisma.user.findMany({
    where: { publicId: null },
    select: { id: true, email: true },
  });
  const doctors = await prisma.doctor.findMany({
    where: { publicId: null },
    select: { id: true, name: true },
  });

  console.log(`${users.length} account(s) and ${doctors.length} practice(s) to fill\n`);

  for (const u of users) {
    // The unique index is the arbiter, not a pre-flight SELECT: two runs could
    // both find an id free and then both insert it.
    const id = await claimId(newPatientId, async (candidate) => {
      try {
        await prisma.user.update({
          where: { id: u.id },
          data: { publicId: candidate },
        });
        return true;
      } catch (e) {
        if (isDuplicate(e)) return false;
        throw e;
      }
    });
    console.log(`  ${id}  ${u.email}`);
  }

  for (const d of doctors) {
    const id = await claimId(newDoctorId, async (candidate) => {
      try {
        await prisma.doctor.update({
          where: { id: d.id },
          data: { publicId: candidate },
        });
        return true;
      } catch (e) {
        if (isDuplicate(e)) return false;
        throw e;
      }
    });
    console.log(`  ${id}  ${d.name}`);
  }

  const left = await Promise.all([
    prisma.user.count({ where: { publicId: null } }),
    prisma.doctor.count({ where: { publicId: null } }),
  ]);
  console.log(`\nremaining without an id: ${left[0]} account(s), ${left[1]} practice(s)`);
}

main()
  .catch((e) => {
    console.error(e.message ?? e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
