/**
 * Booking settings that staff can change without a deploy. Idempotent —
 * only missing keys are created, so admin edits survive a re-run.
 *
 * Run: npx tsx prisma/seed-booking-settings.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ROWS = [
  {
    key: "booking.home_visit_fee",
    value: "500",
    label: "Home-visit surcharge (₹), added to the consultation fee",
  },
];

async function main() {
  for (const r of ROWS) {
    await prisma.siteSetting.upsert({
      where: { key: r.key },
      create: { ...r, group: "booking", type: "NUMBER" },
      update: { label: r.label, group: "booking" },
    });
  }
  console.log(`booking settings present: ${ROWS.length}`);
}

main().finally(() => prisma.$disconnect());
