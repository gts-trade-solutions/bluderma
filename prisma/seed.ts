/**
 * Seeds the database from the hardcoded content that shipped with the frontend
 * MVP (src/data/*.ts). Idempotent — every write is an upsert keyed on a natural
 * key, so re-running only refreshes content and never duplicates rows.
 *
 * Run with: npm run db:seed
 */
import { PrismaClient, BulletKind, ConsultMode, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

import { treatments, categoryOrder } from "../src/data/treatments";
import { doctors } from "../src/data/doctors";
import { metrics, type MetricKey } from "../src/data/skin";
import { CONCERN_INFO } from "../src/lib/skinConcerns";

const prisma = new PrismaClient();

/** anchorFor() from src/data/nav.ts — keeps existing #anchors working. */
const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z]+/g, "-").replace(/(^-|-$)/g, "");

/** Category blurbs, lifted from src/data/nav.ts. */
const CATEGORY_BLURBS: Record<string, string> = {
  Injectables: "Skin boosters, anti-wrinkle and dermal fillers.",
  "Laser & Energy": "Laser toning and energy-based skin brightening.",
  "Lifting & Contouring": "Non-surgical lifting with threads and ultrasound.",
  "Peels & Resurfacing": "Peels, microneedling and scar resurfacing.",
  "Skin Health": "Pigmentation, acne, rosacea, melasma and anti-ageing.",
  "Hair Restoration": "Regenerative PRP therapy for thinning hair.",
};

/**
 * The analyzer used camelCase keys while the marketing grid used snake_case
 * for the same twelve concerns. This is the reconciliation.
 */
const LEGACY_CONCERN_KEY: Record<MetricKey, string> = {
  acne: "acne",
  wrinkles: "wrinkles",
  pores: "pores",
  hydration: "moisture",
  darkCircles: "dark_circle",
  redness: "redness",
  oiliness: "oiliness",
  radiance: "radiance",
  firmness: "firmness",
  texture: "texture",
  eyeBags: "eye_bag",
  ageSpots: "age_spot",
};

async function seedConcerns() {
  for (const [i, m] of metrics.entries()) {
    const legacyKey = LEGACY_CONCERN_KEY[m.key];
    const info = CONCERN_INFO[legacyKey];
    const data = {
      legacyKey,
      label: m.label,
      hint: m.hint,
      description: info?.description ?? null,
      sortOrder: i,
      isFeatured: true,
      isActive: true,
    };
    await prisma.skinConcern.upsert({
      where: { key: m.key },
      create: { key: m.key, ...data },
      update: data,
    });
  }
  console.log(`  skin_concerns      ${metrics.length}`);
}

async function seedCategories() {
  // One representative image per category — its first treatment's, matching
  // categoryTiles() in src/data/nav.ts.
  const firstImage = new Map<string, string>();
  for (const t of treatments) {
    if (!firstImage.has(t.category)) firstImage.set(t.category, t.image);
  }

  for (const [i, name] of categoryOrder.entries()) {
    const data = {
      name,
      blurb: CATEGORY_BLURBS[name] ?? null,
      image: firstImage.get(name) ?? null,
      sortOrder: i,
      isActive: true,
    };
    await prisma.category.upsert({
      where: { slug: slugify(name) },
      create: { slug: slugify(name), ...data },
      update: data,
    });
  }
  console.log(`  categories         ${categoryOrder.length}`);
}

async function seedTreatments() {
  let bulletCount = 0;

  for (const [i, t] of treatments.entries()) {
    const category = await prisma.category.findUniqueOrThrow({
      where: { slug: slugify(t.category) },
    });

    const data = {
      name: t.name,
      categoryId: category.id,
      tagline: t.tagline,
      image: t.image,
      summary: t.summary,
      concern: t.concern,
      howItWorks: t.howItWorks,
      clinicalNote: t.clinicalNote,
      factSessions: t.facts.sessions,
      factDowntime: t.facts.downtime,
      factResults: t.facts.results,
      factDuration: t.facts.duration,
      productName: t.product.name,
      productDescriptor: t.product.descriptor,
      seoTitle: `${t.name} — BluDerma`,
      seoDescription: t.summary.slice(0, 320),
      sortOrder: i,
      isPublished: true,
    };

    const treatment = await prisma.treatment.upsert({
      where: { slug: t.slug },
      create: { slug: t.slug, ...data },
      update: data,
    });

    // Bullets are positional, so replace wholesale rather than diffing.
    await prisma.treatmentBullet.deleteMany({
      where: { treatmentId: treatment.id },
    });

    const bullets: { kind: BulletKind; items: string[] }[] = [
      { kind: BulletKind.CONCERN_POINT, items: t.concernPoints },
      { kind: BulletKind.PROCEDURE_STEP, items: t.procedureSteps },
      { kind: BulletKind.BENEFIT, items: t.benefits },
      { kind: BulletKind.IDEAL_FOR, items: t.idealFor },
    ];

    const rows = bullets.flatMap(({ kind, items }) =>
      items.map((text, sortOrder) => ({
        treatmentId: treatment.id,
        kind,
        text,
        sortOrder,
      }))
    );
    await prisma.treatmentBullet.createMany({ data: rows });
    bulletCount += rows.length;
  }

  console.log(`  treatments         ${treatments.length}`);
  console.log(`  treatment_bullets  ${bulletCount}`);
}

async function seedDoctors() {
  const concerns = await prisma.skinConcern.findMany();
  const concernByKey = new Map(concerns.map((c) => [c.key, c.id]));

  for (const [i, d] of doctors.entries()) {
    const data = {
      name: d.name,
      title: d.title,
      specialty: d.specialty,
      rating: d.rating,
      reviews: d.reviews,
      experienceYears: d.experienceYears,
      clinic: d.clinic,
      location: d.location,
      image: d.image,
      fee: d.fee,
      about: d.about,
      verified: d.verified,
      isGeneral: d.general ?? false,
      isActive: true,
      sortOrder: i,
    };

    const doctor = await prisma.doctor.upsert({
      where: { slug: d.id },
      create: { slug: d.id, ...data },
      update: data,
    });

    // Child collections are small and order-sensitive — rewrite them.
    await prisma.$transaction([
      prisma.doctorConcern.deleteMany({ where: { doctorId: doctor.id } }),
      prisma.doctorLanguage.deleteMany({ where: { doctorId: doctor.id } }),
      prisma.doctorService.deleteMany({ where: { doctorId: doctor.id } }),
      prisma.doctorMode.deleteMany({ where: { doctorId: doctor.id } }),
      prisma.doctorAvailability.deleteMany({ where: { doctorId: doctor.id } }),
    ]);

    await prisma.doctorConcern.createMany({
      data: d.focus
        .map((k) => concernByKey.get(k))
        .filter((id): id is string => Boolean(id))
        .map((concernId) => ({ doctorId: doctor.id, concernId })),
    });

    await prisma.doctorLanguage.createMany({
      data: d.languages.map((name, sortOrder) => ({
        doctorId: doctor.id,
        name,
        sortOrder,
      })),
    });

    await prisma.doctorService.createMany({
      data: d.services.map((name, sortOrder) => ({
        doctorId: doctor.id,
        name,
        sortOrder,
      })),
    });

    await prisma.doctorMode.createMany({
      data: d.modes.map((m) => ({
        doctorId: doctor.id,
        mode: m === "video" ? ConsultMode.VIDEO : ConsultMode.CLINIC,
      })),
    });

    // Replaces slotsForDoctor()'s hashed PRNG with real working hours:
    // Mon–Sat, 09:00–17:30 in 30-minute slots (the grid the UI already renders).
    await prisma.doctorAvailability.createMany({
      data: [1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
        doctorId: doctor.id,
        dayOfWeek,
        startTime: "09:00",
        endTime: "17:30",
        slotMinutes: 30,
        isActive: true,
      })),
    });
  }

  console.log(`  doctors            ${doctors.length}  (+ focus/languages/services/modes/availability)`);
}

async function seedTestimonials() {
  // From the analyzer's TESTIMONIALS constant.
  const rows = [
    {
      authorName: "Ananya R.",
      authorRole: "Mumbai",
      avatarUrl: "https://randomuser.me/api/portraits/women/65.jpg",
      quote:
        "I finally understood why my skin felt so dry — and got matched to a doctor the same day.",
      rating: 5,
    },
    {
      authorName: "Rahul M.",
      authorRole: "Bengaluru",
      avatarUrl: "https://randomuser.me/api/portraits/men/46.jpg",
      quote:
        "Took a selfie, got real scores in seconds, and booked a slot that evening.",
      rating: 5,
    },
    {
      authorName: "Sana K.",
      authorRole: "Delhi",
      avatarUrl: "https://randomuser.me/api/portraits/women/12.jpg",
      quote:
        "Love that I can re-scan and compare — my pores score actually went up in a month!",
      rating: 5,
    },
  ];

  for (const [i, r] of rows.entries()) {
    const existing = await prisma.testimonial.findFirst({
      where: { authorName: r.authorName },
    });
    const data = { ...r, sortOrder: i, isPublished: true };
    if (existing) {
      await prisma.testimonial.update({ where: { id: existing.id }, data });
    } else {
      await prisma.testimonial.create({ data });
    }
  }
  console.log(`  testimonials       ${rows.length}`);
}

async function seedContentBlocks() {
  // The "Why BluDerma" cards from src/app/doctor/page.tsx.
  const whyPoints = [
    {
      key: "doctor.why.traceable",
      title: "Genuine, traceable products",
      body: "Every solution maps to authentic, quality-assured products you can order with confidence.",
      icon: "shield",
    },
    {
      key: "doctor.why.expertise",
      title: "Clinical expertise",
      body: "Indication-led content built around how clinicians actually assess and plan treatment.",
      icon: "clip",
    },
    {
      key: "doctor.why.protocols",
      title: "Personalised protocols",
      body: "Sessions, downtime and timelines for every treatment, so plans fit the patient in front of you.",
      icon: "user",
    },
    {
      key: "doctor.why.solutions",
      title: "Unique BluDerma solutions",
      body: "A one-to-one link from each treatment to a concrete, orderable BluDerma solution.",
      icon: "spark",
    },
  ];

  for (const [i, w] of whyPoints.entries()) {
    const data = {
      page: "doctor",
      section: "why",
      title: w.title,
      body: w.body,
      icon: w.icon,
      sortOrder: i,
      isActive: true,
    };
    await prisma.contentBlock.upsert({
      where: { key: w.key },
      create: { key: w.key, ...data },
      update: data,
    });
  }
  console.log(`  content_blocks     ${whyPoints.length}`);
}

async function seedSettings() {
  // Footer values, currently hardcoded in src/components/Footer.tsx.
  const settings = [
    { key: "contact.email", value: "enquiries@bluderma.example", group: "contact", label: "Enquiries email" },
    { key: "contact.phone", value: "+91 00000 00000", group: "contact", label: "Phone" },
    { key: "contact.hours", value: "Mon–Sat, 9:00–18:00 IST", group: "contact", label: "Opening hours" },
    { key: "site.name", value: "BluDerma", group: "general", label: "Site name" },
    { key: "site.tagline", value: "Dermatology & aesthetic reference platform", group: "general", label: "Tagline" },
    { key: "booking.requireLogin", value: "true", group: "booking", label: "Require login to book" },
    { key: "booking.slotMinutes", value: "30", group: "booking", label: "Default slot length (minutes)" },
    { key: "booking.advanceDays", value: "5", group: "booking", label: "Bookable days ahead" },
  ];

  for (const s of settings) {
    await prisma.siteSetting.upsert({
      where: { key: s.key },
      create: s,
      update: { value: s.value, group: s.group, label: s.label },
    });
  }
  console.log(`  site_settings      ${settings.length}`);
}

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.log("  users              0  (ADMIN_EMAIL/ADMIN_PASSWORD not set — skipped)");
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: process.env.ADMIN_NAME ?? "BluDerma Admin",
      passwordHash,
      role: Role.ADMIN,
      emailVerified: new Date(),
    },
    // Never silently reset an existing admin's password on re-seed.
    update: { role: Role.ADMIN },
  });
  console.log(`  users              1  (admin: ${email})`);
}

async function main() {
  console.log("Seeding BluDerma…\n");
  await seedConcerns();
  await seedCategories();
  await seedTreatments();
  await seedDoctors();
  await seedTestimonials();
  await seedContentBlocks();
  await seedSettings();
  await seedAdmin();
  console.log("\nDone.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
