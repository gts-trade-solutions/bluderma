/**
 * Moves the shipped deals, promos and concern tiles into the database so
 * marketing can edit them. Idempotent, keyed on slug; never deletes, so an
 * admin-created offer survives a re-run.
 *
 * Run: npx tsx prisma/seed-marketing.ts
 */
import { PrismaClient } from "@prisma/client";

import { HOT_DEALS, HUB_CONCERNS, HUB_PROMOS, REGULAR_DEALS } from "../src/data/hub";

const prisma = new PrismaClient();

async function main() {
  const deals = [
    ...HOT_DEALS.map((d) => ({ ...d, isHot: true })),
    ...REGULAR_DEALS.map((d) => ({ ...d, isHot: false })),
  ];

  for (const [i, d] of deals.entries()) {
    const data = {
      title: d.title,
      treatment: d.treatment,
      categorySlug: d.categorySlug,
      categoryLabel: d.categoryLabel,
      image: d.image,
      discount: d.discount,
      perk: d.perk,
      claimed: d.claimed,
      endsIn: d.endsIn,
      isHot: d.isHot,
      sortOrder: i,
    };
    await prisma.hubDeal.upsert({
      where: { slug: d.slug },
      create: { slug: d.slug, ...data },
      update: data,
    });
  }

  for (const [i, p] of HUB_PROMOS.entries()) {
    const data = {
      eyebrow: p.eyebrow,
      title: p.title,
      body: p.body,
      image: p.image,
      cta: p.cta,
      href: p.href,
      sortOrder: i,
    };
    await prisma.hubPromo.upsert({
      where: { slug: p.slug },
      create: { slug: p.slug, ...data },
      update: data,
    });
  }

  for (const [i, c] of HUB_CONCERNS.entries()) {
    const data = {
      label: c.label,
      hint: c.hint,
      image: c.image,
      category: c.category,
      sortOrder: i,
    };
    await prisma.hubConcern.upsert({
      where: { slug: c.slug },
      create: { slug: c.slug, ...data },
      update: data,
    });
  }

  const [d, p, c] = await Promise.all([
    prisma.hubDeal.count(),
    prisma.hubPromo.count(),
    prisma.hubConcern.count(),
  ]);
  console.log(`marketing seeded — ${d} deals, ${p} promos, ${c} concerns`);
}

main().finally(() => prisma.$disconnect());
