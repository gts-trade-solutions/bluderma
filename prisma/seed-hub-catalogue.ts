/**
 * Lifts the client-facing catalogue out of the static files and into the
 * database so marketing can edit it: 18 categories, 108 treatments, and the
 * clinical protocol behind every treatment page.
 *
 * Idempotent — keyed on slug, so re-running updates rather than duplicating.
 * It deliberately does NOT delete rows the static files no longer contain:
 * once this is the source of truth, an admin-created category must survive a
 * re-run. Removing something is an admin action, not a seed side effect.
 *
 * Run: npx tsx prisma/seed-hub-catalogue.ts
 */
import { Prisma, PrismaClient } from "@prisma/client";

import { HUB_CATEGORIES } from "../src/data/hub";
import { getTreatmentDetail } from "../src/data/treatmentDetail";

const prisma = new PrismaClient();

async function main() {
  let categories = 0;
  let treatments = 0;

  for (const [i, c] of HUB_CATEGORIES.entries()) {
    const category = await prisma.hubCategory.upsert({
      where: { slug: c.slug },
      create: {
        slug: c.slug,
        name: c.name,
        icon: c.icon,
        blurb: c.blurb,
        intro: c.intro,
        image: c.image,
        tint: c.tint,
        sortOrder: i,
      },
      update: {
        name: c.name,
        icon: c.icon,
        blurb: c.blurb,
        intro: c.intro,
        image: c.image,
        tint: c.tint,
        sortOrder: i,
      },
      select: { id: true },
    });
    categories += 1;

    for (const [j, t] of c.treatments.entries()) {
      await prisma.hubTreatment.upsert({
        where: { categoryId_slug: { categoryId: category.id, slug: t.slug } },
        create: {
          categoryId: category.id,
          slug: t.slug,
          name: t.name,
          blurb: t.blurb,
          image: t.image,
          meta: t.meta ?? null,
          sortOrder: j,
        },
        update: {
          name: t.name,
          blurb: t.blurb,
          image: t.image,
          meta: t.meta ?? null,
          sortOrder: j,
        },
      });
      treatments += 1;
    }

    // The protocol is per category; read it through the same resolver the
    // pages use, so what lands in the database is exactly what shipped.
    const d = getTreatmentDetail(c.slug, c.treatments[0]);
    // Prisma's Json input wants plain structural values; the interfaces in
    // treatmentDetail carry no index signature, so widen them here.
    const json = (v: unknown) => v as Prisma.InputJsonValue;

    const protocol = {
      recommendedFor: json(d.recommendedFor),
      summary: d.summary,
      howItWorks: d.howItWorks,
      options: json(d.options),
      areas: json(d.areas),
      duration: d.duration,
      anaesthesia: d.anaesthesia,
      sessions: d.sessions,
      downtime: d.downtime,
      results: d.results,
      includes: json(d.includes),
      excludes: json(d.excludes),
      precautions: json(d.precautions),
      sideEffects: json(d.sideEffects),
      notSuitable: json(d.notSuitable),
      aftercare: json(d.aftercare),
      faqs: json(d.faqs),
    };

    await prisma.treatmentProtocol.upsert({
      where: { categoryId: category.id },
      create: { categoryId: category.id, ...protocol },
      update: protocol,
    });
  }

  console.log(
    `hub catalogue seeded — ${categories} categories, ${treatments} treatments, ${categories} protocols`
  );
}

main().finally(() => prisma.$disconnect());
