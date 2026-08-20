/**
 * Removes the raceautoindia test accounts and their listings.
 *
 * Two of them, `raceautoindia@gmail.com` ("Dr. Arun") and
 * `info@raceautoindia.com` ("Asif"), both with the DOCTOR role and both
 * APPROVED — which is the part that matters, because an approved doctor is a
 * doctor the public directory lists and a client can book. Neither has a
 * single appointment, review, purchase or prescription behind it.
 *
 * ── What this does NOT touch, and why ────────────────────────────────────
 * EMAIL_FROM in .env is `noreply@raceautoindia.com`, and that is the live SES
 * sender. It is set to that address because raceautoindia.com is a verified
 * domain identity in the SES account and bluderma.kr is not. Changing it here
 * would not "remove an email", it would stop every booking confirmation,
 * reminder and password reset from being delivered — SES rejects a From it
 * cannot verify. That swap has to happen after the BluDerma domain is
 * verified, and it is a deployment change, not a data one.
 *
 * Refuses rather than guesses: an account with history is reported and left
 * alone, because deleting a practitioner who has seen patients would take
 * their appointments' doctor reference with it.
 *
 *   npx tsx prisma/remove-race-accounts.ts --dry
 *   npx tsx prisma/remove-race-accounts.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ log: ["error"] });
const DRY = process.argv.includes("--dry");

const EMAILS = ["raceautoindia@gmail.com", "info@raceautoindia.com"];

async function main(): Promise<void> {
  const users = await prisma.user.findMany({
    where: { email: { in: EMAILS } },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      doctor: { select: { id: true, slug: true, name: true, status: true } },
      _count: {
        select: {
          appointments: true,
          reviews: true,
          purchases: true,
          prescriptions: true,
          subscriptions: true,
        },
      },
    },
  });

  if (!users.length) {
    console.log("Nothing to remove: neither address exists in this database.");
    return;
  }

  for (const u of users) {
    const history =
      u._count.appointments +
      u._count.reviews +
      u._count.purchases +
      u._count.prescriptions +
      u._count.subscriptions;

    console.log(`\n${u.email}  (${u.name ?? "no name"}, ${u.role})`);
    if (u.doctor) {
      console.log(`  listing: ${u.doctor.name} [${u.doctor.slug}] ${u.doctor.status}`);
    }
    console.log(`  history: ${history} rows`);

    if (history > 0) {
      // Deleting a practitioner who has seen patients would take the doctor
      // reference off their appointments with it. That is a decision for a
      // person, not for this script.
      console.log("  SKIPPED: this account has history. Deactivate it instead.");
      continue;
    }

    if (DRY) {
      console.log("  would delete the listing and the account");
      continue;
    }

    if (u.doctor) {
      const id = u.doctor.id;
      // Dependency order: Appointment.doctorId has no cascade on purpose.
      await prisma.appointment.deleteMany({ where: { doctorId: id } });
      await prisma.review.deleteMany({ where: { doctorId: id } });
      await prisma.prescription.deleteMany({ where: { doctorId: id } });
      await prisma.doctorTimeOff.deleteMany({ where: { doctorId: id } });
      await prisma.doctorAvailability.deleteMany({ where: { doctorId: id } });
      await prisma.doctorDailyInsight.deleteMany({ where: { doctorId: id } });
      await prisma.doctorClinic.deleteMany({ where: { doctorId: id } });
      await prisma.doctor.delete({ where: { id } });
      console.log("  listing deleted");
    }

    await prisma.user.delete({ where: { id: u.id } });
    console.log("  account deleted");
  }

  // Anything else still carrying the address in a public field.
  const stragglers = await prisma.doctor.findMany({
    where: {
      OR: [
        { email: { contains: "raceautoindia" } },
        { website: { contains: "raceautoindia" } },
        { phone: { contains: "raceautoindia" } },
      ],
    },
    select: { slug: true, email: true, website: true },
  });
  if (stragglers.length) {
    console.log(`\n${stragglers.length} listing(s) still show the address publicly:`);
    for (const s of stragglers) console.log(`  ${s.slug}: ${s.email ?? s.website}`);
    if (!DRY) {
      await prisma.doctor.updateMany({
        where: { email: { contains: "raceautoindia" } },
        data: { email: null },
      });
      await prisma.doctor.updateMany({
        where: { website: { contains: "raceautoindia" } },
        data: { website: null },
      });
      console.log("  cleared");
    }
  }

  console.log(
    "\nNOTE: EMAIL_FROM in .env is still noreply@raceautoindia.com. That is the\n" +
      "      live SES sender and the only verified domain available. Changing it\n" +
      "      before bluderma.kr is verified in SES would stop all outbound mail."
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
