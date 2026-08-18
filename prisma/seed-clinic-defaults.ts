/**
 * Fills in the operational fields on directory records that were imported
 * with nothing: consultation fee, years in practice, and a working schedule.
 *
 * Deliberately NOT touched: rating and review count.
 *
 * These are real, named Chennai businesses. Inventing "4.7 ★ from 128
 * reviews" for a real clinic is a claim about someone else's business that
 * nobody has made — misleading to clients and unfair to the clinic. It is
 * also technically pointless now, because ratings are recomputed from
 * published Review rows, so any number written here would be wiped the first
 * time a genuine review is moderated. The cards show "Newly listed" until
 * real reviews arrive, which is true.
 *
 * The fees and experience below ARE placeholders — plausible for the Chennai
 * market, and every one of them is editable in Admin → Doctors. They exist so
 * the directory is usable, not because they are researched facts.
 *
 * Run: npx tsx prisma/seed-clinic-defaults.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Deterministic per-clinic spread, so re-running does not reshuffle values. */
function seededPick<T>(seed: string, options: T[]): T {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return options[h % options.length];
}

/** Typical Chennai dermatology consultation fees. */
const FEES = [500, 600, 700, 750, 800, 900, 1000, 1200, 1500];
/** Years the practice has been running. */
const YEARS = [3, 4, 5, 6, 7, 8, 10, 12, 15];

async function main() {
  const doctors = await prisma.doctor.findMany({
    where: { OR: [{ fee: 0 }, { experienceYears: 0 }] },
    select: { id: true, slug: true, fee: true, experienceYears: true },
  });

  let updated = 0;
  for (const d of doctors) {
    await prisma.doctor.update({
      where: { id: d.id },
      data: {
        fee: d.fee > 0 ? d.fee : seededPick(d.slug, FEES),
        experienceYears:
          d.experienceYears > 0
            ? d.experienceYears
            : seededPick(`${d.slug}-yrs`, YEARS),
      },
    });
    updated += 1;
  }

  // A directory record with no working hours generates no slots, so its
  // "Book" button leads to an empty calendar.
  const withoutHours = await prisma.doctor.findMany({
    where: { availability: { none: {} } },
    select: { id: true },
  });

  for (const d of withoutHours) {
    await prisma.doctorAvailability.createMany({
      // Monday to Saturday, a normal clinic day.
      data: [1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
        doctorId: d.id,
        dayOfWeek,
        startTime: "09:00",
        endTime: "18:00",
        slotMinutes: 30,
      })),
      skipDuplicates: true,
    });
  }

  // Every directory record needs at least one consultation mode or it can
  // never be booked.
  const withoutModes = await prisma.doctor.findMany({
    where: { modes: { none: {} } },
    select: { id: true },
  });
  for (const d of withoutModes) {
    await prisma.doctorMode.createMany({
      data: [{ doctorId: d.id, mode: "CLINIC" as const }],
      skipDuplicates: true,
    });
  }

  console.log(
    `fees/experience filled: ${updated} | schedules added: ${withoutHours.length} | modes added: ${withoutModes.length}`
  );
  console.log(
    "ratings left at zero on purpose — they come from real reviews, not from here"
  );
}

main().finally(() => prisma.$disconnect());
