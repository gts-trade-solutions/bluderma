/**
 * White Collar — the two membership terms.
 *
 * Prices and benefits are editable in the admin afterwards; this only creates
 * the rows if they are missing, so a re-run never overwrites a decision
 * somebody made in the CMS. Same discipline as the other settings seeders.
 *
 *   npx tsx prisma/seed-subscription-plans.ts
 */
import { PrismaClient, SubscriptionInterval } from "@prisma/client";

const prisma = new PrismaClient();

const PLANS = [
  {
    slug: "white-collar-monthly",
    name: "White Collar",
    interval: SubscriptionInterval.MONTHLY,
    priceInr: 499,
    compareAtInr: null,
    discountPercent: 10,
    scanCredits: 1,
    priorityBooking: true,
    waiveCancellationFee: true,
    sortOrder: 0,
    perks: [
      "10% off every consultation at any listed clinic",
      "One skin analysis included each month",
      "Priority slots held back for members",
      "Never charged a late-cancellation fee",
      "Your appointments are protected from being moved",
    ],
  },
  {
    slug: "white-collar-annual",
    name: "White Collar Annual",
    interval: SubscriptionInterval.ANNUAL,
    priceInr: 4990,
    // Two months free against the monthly price, stated plainly rather than
    // dressed up as a percentage.
    compareAtInr: 5988,
    discountPercent: 15,
    scanCredits: 12,
    priorityBooking: true,
    waiveCancellationFee: true,
    sortOrder: 1,
    perks: [
      "15% off every consultation at any listed clinic",
      "Twelve skin analyses included",
      "Priority slots held back for members",
      "Never charged a late-cancellation fee",
      "Your appointments are protected from being moved",
      "Two months free compared with paying monthly",
    ],
  },
];

async function main() {
  let created = 0;
  for (const p of PLANS) {
    const existing = await prisma.subscriptionPlan.findUnique({
      where: { slug: p.slug },
      select: { id: true },
    });
    if (existing) {
      console.log(`  kept  ${p.slug} (already configured)`);
      continue;
    }
    await prisma.subscriptionPlan.create({ data: { ...p, perks: p.perks } });
    created += 1;
    console.log(`  added ${p.slug}  ₹${p.priceInr}/${p.interval.toLowerCase()}`);
  }
  console.log(`\n${created} plan(s) created, ${PLANS.length - created} left alone.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
