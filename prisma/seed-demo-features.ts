/**
 * Demo data for everything built in this round.
 *
 * Fills the existing demo doctor and demo client with realistic rows for
 * aftercare, treatment plans, the gallery, photographs and markup, chart
 * notes, practice finance, machine recovery, gift cards, medicines and
 * seller applications, so all of it can be looked at rather than described.
 *
 * ── The rules this obeys ─────────────────────────────────────────────────
 * 1. It only ever touches the DEMO accounts. Nothing here can reach a real
 *    patient or a real practice.
 * 2. Every row it writes carries a `demo` id prefix, so `--purge` removes
 *    exactly what it added and re-running it never doubles anything.
 * 3. Nothing invents a figure the product would otherwise compute. The
 *    machine recovery, the net profit and the gift card balances are all
 *    derived by the same code the screens use; this only supplies the inputs
 *    a clinic would have typed.
 *
 * Photographs are GENERATED here rather than pulled from anywhere: they are
 * plain labelled panels, so nothing in the demo is a picture of a real
 * person's skin.
 *
 *   npx tsx prisma/seed-demo-features.ts [--purge]
 */
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";

import { buildKey, isConfigured, uploadObject, publicUrlFor } from "../src/lib/storage";
import { newGiftCardCode, newOrderId } from "../src/lib/publicId";
import { STANDARD_AFTERCARE, treatmentKey } from "../src/lib/aftercare/standard";

const prisma = new PrismaClient({ log: ["error"] });
const PURGE_ONLY = process.argv.includes("--purge");

const CLIENT_EMAIL = "demo.client@bluderma.local";
const DOCTOR_EMAIL = "demo.doctor@bluderma.local";

/** Every id this script writes starts with one of these. */
const P = {
  photo: "demophoto",
  markup: "demomarkup",
  note: "demonote",
  sheet: "demosheet",
  aftercareNote: "demoacnote",
  plan: "demoplan",
  planItem: "demoplanitem",
  gallery: "demogallery",
  financing: "demofin",
  expense: "demoexp",
  asset: "demoasset",
  usage: "demousage",
  offer: "demooffer",
  card: "democard",
  redemption: "demoredeem",
  medicine: "demomed",
  order: "demoorder",
  orderItem: "demoorderitem",
  vendor: "demovendor",
} as const;

const days = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};

/**
 * Delete everything this script has ever written.
 *
 * Ordered so children go before parents: the schema would cascade most of
 * these, but relying on cascade to clean up means a change to an onDelete
 * rule silently starts leaving rows behind.
 */
async function purge() {
  await prisma.photoMarkup.deleteMany({ where: { id: { startsWith: P.markup } } });
  await prisma.patientPhoto.deleteMany({ where: { id: { startsWith: P.photo } } });
  await prisma.patientNote.deleteMany({ where: { id: { startsWith: P.note } } });
  await prisma.aftercareSheet.deleteMany({ where: { id: { startsWith: P.sheet } } });
  await prisma.aftercareNote.deleteMany({ where: { id: { startsWith: P.aftercareNote } } });
  await prisma.treatmentPlanItem.deleteMany({ where: { id: { startsWith: P.planItem } } });
  await prisma.treatmentPlan.deleteMany({ where: { id: { startsWith: P.plan } } });
  await prisma.doctorGalleryCase.deleteMany({ where: { id: { startsWith: P.gallery } } });
  await prisma.financingRequest.deleteMany({ where: { id: { startsWith: P.financing } } });
  await prisma.assetUsage.deleteMany({ where: { id: { startsWith: P.usage } } });
  await prisma.practiceAsset.deleteMany({ where: { id: { startsWith: P.asset } } });
  await prisma.practiceExpense.deleteMany({ where: { id: { startsWith: P.expense } } });
  await prisma.giftCardRedemption.deleteMany({ where: { id: { startsWith: P.redemption } } });
  await prisma.giftCard.deleteMany({ where: { id: { startsWith: P.card } } });
  await prisma.giftCardOffer.deleteMany({ where: { id: { startsWith: P.offer } } });
  await prisma.medicineOrderItem.deleteMany({ where: { id: { startsWith: P.orderItem } } });
  await prisma.medicineOrder.deleteMany({ where: { id: { startsWith: P.order } } });
  await prisma.medicine.deleteMany({ where: { id: { startsWith: P.medicine } } });
  await prisma.medicineVendor.deleteMany({ where: { id: { startsWith: P.vendor } } });
}

/**
 * A labelled panel, uploaded to the private prefix.
 *
 * Deliberately not a photograph of anybody. A demo that ships pictures of a
 * real person's skin is a demo nobody can safely show, and a plain panel makes
 * the same point about angles, comparison and markup.
 */
async function makePanel(label: string, tint: string): Promise<{ url: string; key: string }> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000">
    <rect width="800" height="1000" fill="${tint}"/>
    <circle cx="400" cy="380" r="190" fill="rgba(255,255,255,0.14)"/>
    <text x="400" y="700" font-family="sans-serif" font-size="54" font-weight="700"
          fill="rgba(255,255,255,0.92)" text-anchor="middle">${label}</text>
    <text x="400" y="760" font-family="sans-serif" font-size="26"
          fill="rgba(255,255,255,0.6)" text-anchor="middle">Demo image, not a patient</text>
  </svg>`;

  const body = await sharp(Buffer.from(svg)).jpeg({ quality: 78 }).toBuffer();
  const key = buildKey("patients", `demo-${label.toLowerCase().replace(/\s+/g, "-")}.jpg`);
  const url = await uploadObject({ key, body, contentType: "image/jpeg" });
  return { url, key };
}

async function main() {
  if (!isConfigured()) {
    console.log("S3 is not configured; photographs and gallery cases will be skipped.");
  }

  const [client, doctor] = await Promise.all([
    prisma.user.findUnique({
      where: { email: CLIENT_EMAIL },
      select: { id: true, name: true },
    }),
    prisma.doctor.findFirst({
      where: { user: { email: DOCTOR_EMAIL } },
      select: { id: true, name: true, publicId: true, userId: true },
    }),
  ]);

  if (!client || !doctor) {
    throw new Error(
      `Need both demo accounts. Run the demo seeds first (${CLIENT_EMAIL}, ${DOCTOR_EMAIL}).`
    );
  }

  await purge();
  if (PURGE_ONLY) {
    console.log("Purged. Nothing seeded.");
    return;
  }

  const clientPublic = await prisma.user.findUnique({
    where: { id: client.id },
    select: { publicId: true },
  });

  const clinic = await prisma.doctorClinic.findFirst({
    where: { doctorId: doctor.id, isPrimary: true },
    select: { clinicId: true, clinic: { select: { name: true, phone: true } } },
  });

  const scan = await prisma.skinScan.findFirst({
    where: { userId: client.id, status: "done" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  /* ── Photographs, markup and chart notes ──────────────────────────── */

  let photoIds: string[] = [];
  if (isConfigured()) {
    const panels = await Promise.all([
      makePanel("Front", "#1f6fd6"),
      makePanel("Left side", "#0fa08e"),
      makePanel("Right side", "#7c3aed"),
      makePanel("Close-up", "#f59e0b"),
    ]);

    const angles = ["FRONT", "LEFT", "RIGHT", "CLOSE_UP"] as const;
    for (let i = 0; i < panels.length; i++) {
      const id = `${P.photo}${String(i).padStart(4, "0")}`;
      await prisma.patientPhoto.create({
        data: {
          id,
          patientUserId: client.id,
          // The first two are the client's own; the rest were taken in clinic,
          // so the demo shows both halves of the feature.
          doctorId: i < 2 ? null : doctor.id,
          angle: angles[i],
          url: panels[i].url,
          storageKey: panels[i].key,
          note: i === 3 ? "Left cheek, before the third session." : null,
          capturedAt: days(60 - i * 14),
        },
      });
      photoIds.push(id);
    }

    // Marks on the close-up: a ring round the area and a short underline.
    await prisma.photoMarkup.create({
      data: {
        id: `${P.markup}0001`,
        photoId: photoIds[3],
        doctorId: doctor.id,
        strokes: [
          {
            // A rough circle, in normalised coordinates.
            points: Array.from({ length: 28 }, (_, k) => {
              const t = (k / 27) * Math.PI * 2;
              return [0.42 + 0.13 * Math.cos(t), 0.36 + 0.11 * Math.sin(t)];
            }),
            color: "#f43f5e",
            width: 3,
          },
          {
            points: [
              [0.3, 0.62],
              [0.58, 0.62],
            ],
            color: "#facc15",
            width: 3,
          },
        ],
        note: "Circled: the deeper boxcar scars. Underlined: texture responding well.",
      },
    });
    console.log(`  photographs      ${photoIds.length} (1 with markup)`);
  }

  const notes = [
    "Third session of the acne scar course. Erythema settling faster than after the second.",
    "Discussed sun protection again; she is using the SPF 50 daily now.",
    "Considering one more session, then a review in three months.",
  ];
  for (let i = 0; i < notes.length; i++) {
    await prisma.patientNote.create({
      data: {
        id: `${P.note}${String(i).padStart(4, "0")}`,
        doctorId: doctor.id,
        patientUserId: client.id,
        body: notes[i],
        createdAt: days(45 - i * 15),
      },
    });
  }
  console.log(`  chart notes      ${notes.length}`);

  /* ── Aftercare ────────────────────────────────────────────────────── */

  const procedures = [
    { name: "Fractional CO2 laser", when: 40, acked: true },
    { name: "Medium-depth chemical peel", when: 8, acked: false },
  ];
  const standing =
    "Use the barrier cream I gave you every 4 hours for the first 3 days, not just morning and night. Do not restart your retinol until we have seen each other.";

  for (let i = 0; i < procedures.length; i++) {
    const proc = procedures[i];
    await prisma.aftercareSheet.create({
      data: {
        id: `${P.sheet}${String(i).padStart(4, "0")}`,
        doctorId: doctor.id,
        patientUserId: client.id,
        patientName: client.name ?? "Demo Client",
        patientPublicId: clientPublic?.publicId ?? null,
        doctorName: doctor.name,
        doctorPublicId: doctor.publicId,
        clinicName: clinic?.clinic.name ?? null,
        clinicContact: clinic?.clinic.phone ?? null,
        procedure: proc.name,
        procedureDate: days(proc.when),
        reviewOn: days(proc.when - 14),
        intro: STANDARD_AFTERCARE.intro,
        dos: STANDARD_AFTERCARE.dos,
        donts: STANDARD_AFTERCARE.donts,
        warnings: STANDARD_AFTERCARE.warnings,
        doctorNotes: i === 0 ? standing : null,
        emergencyContact: clinic?.clinic.phone ?? null,
        issuedAt: days(proc.when),
        acknowledgedAt: proc.acked ? days(proc.when - 1) : null,
      },
    });
  }

  // The standing additions that come back next time this doctor issues for
  // the same treatment. This is the feature the clinic asked for.
  await prisma.aftercareNote.create({
    data: {
      id: `${P.aftercareNote}0001`,
      doctorId: doctor.id,
      treatmentKey: treatmentKey("Fractional CO2 laser"),
      treatmentName: "Fractional CO2 laser",
      body: standing,
    },
  });
  console.log(`  aftercare        ${procedures.length} sheets, 1 standing note`);

  /* ── Treatment plan ───────────────────────────────────────────────── */

  const planItems = [
    { t: "Acne Scar Resurfacing", why: "Acne scarring scored 78 (high) in this analysis.", src: "AI", st: "ACCEPTED" },
    { t: "Chemical Peel", why: "Texture scored 64 (moderate).", src: "AI", st: "ACCEPTED" },
    { t: "Hydrafacial", why: "Suggested from the analysis.", src: "AI", st: "DECLINED" },
    { t: "Topical tretinoin, nightly", why: "Between sessions, to hold the gains.", src: "DOCTOR", st: "ACCEPTED" },
  ] as const;

  await prisma.treatmentPlan.create({
    data: {
      id: `${P.plan}0001`,
      doctorId: doctor.id,
      patientUserId: client.id,
      scanId: scan?.id ?? null,
      sharedAt: days(30),
      createdAt: days(32),
      items: {
        create: planItems.map((it, i) => ({
          id: `${P.planItem}${String(i).padStart(4, "0")}`,
          treatment: it.t,
          rationale: it.why,
          source: it.src,
          state: it.st,
          sortOrder: i,
        })),
      },
    },
  });
  console.log(`  treatment plan   1 shared, ${planItems.length} lines`);

  /* ── Gallery ──────────────────────────────────────────────────────── */

  if (isConfigured()) {
    const before = await makePanel("Before", "#334155");
    const after = await makePanel("After", "#0f766e");

    await prisma.doctorGalleryCase.create({
      data: {
        id: `${P.gallery}0001`,
        doctorId: doctor.id,
        patientUserId: client.id,
        treatmentName: "Acne scar resurfacing",
        detail: "4 sessions over 3 months",
        caption: "Texture and shallow boxcar scarring on the left cheek.",
        beforeUrl: before.url,
        beforeKey: before.key,
        afterUrl: after.url,
        afterKey: after.key,
        consentRequestedAt: days(25),
        consentGivenAt: days(24),
        status: "PUBLISHED",
        sortOrder: 0,
      },
    });

    // A second one still waiting, so the consent state is visible on both
    // sides of the flow rather than only in its finished form.
    const b2 = await makePanel("Before", "#4c1d95");
    const a2 = await makePanel("After", "#155e75");
    await prisma.doctorGalleryCase.create({
      data: {
        id: `${P.gallery}0002`,
        doctorId: doctor.id,
        patientUserId: client.id,
        treatmentName: "Medium-depth peel",
        detail: "2 sessions, 6 weeks apart",
        beforeUrl: b2.url,
        beforeKey: b2.key,
        afterUrl: a2.url,
        afterKey: a2.key,
        consentRequestedAt: days(3),
        status: "DRAFT",
        sortOrder: 1,
      },
    });
    console.log("  gallery          1 published, 1 awaiting consent");
  }

  /* ── Financing enquiries ──────────────────────────────────────────── */

  await prisma.financingRequest.createMany({
    data: [
      {
        id: `${P.financing}0001`,
        userId: client.id,
        treatment: "Acne scar resurfacing, remaining 3 sessions",
        estimatedInr: 24000,
        note: "Would rather spread it over a few months if that is possible.",
        status: "CONTACTED",
        staffNote:
          "Rang on Tuesday. We do not run a credit programme yet, but the clinic can split a course across visits. She is going to think about it.",
        createdAt: days(20),
        respondedAt: days(18),
      },
      {
        id: `${P.financing}0002`,
        userId: client.id,
        treatment: "Laser hair reduction, full face",
        estimatedInr: 12000,
        status: "NEW",
        createdAt: days(2),
      },
    ],
  });
  console.log("  financing        2 enquiries");

  /* ── Practice finance ─────────────────────────────────────────────── */

  const expenses: [string, string, number, number][] = [
    ["RENT", "Clinic rent", 65000, 20],
    ["SALARY", "Two nurses and reception", 118000, 20],
    ["CONSUMABLES", "Needles, gauze, cannulae", 22400, 16],
    ["CONSUMABLES", "Topical anaesthetic restock", 14800, 9],
    ["UTILITIES", "Electricity and water", 9600, 18],
    ["MARKETING", "Local listings and photography", 18000, 12],
    ["MAINTENANCE", "Laser service visit", 12500, 7],
    ["TAX", "Quarterly advance tax", 40000, 5],
    ["OTHER", "Linen and laundry", 4200, 4],
  ];
  for (let i = 0; i < expenses.length; i++) {
    const [category, label, amountInr, ago] = expenses[i];
    await prisma.practiceExpense.create({
      data: {
        id: `${P.expense}${String(i).padStart(4, "0")}`,
        doctorId: doctor.id,
        clinicId: clinic?.clinicId ?? null,
        category: category as never,
        label,
        amountInr,
        spentOn: days(ago),
      },
    });
  }

  // The clinic's own worked example: a ₹5,00,000 laser charged at ₹8,000 a use.
  await prisma.practiceAsset.create({
    data: {
      id: `${P.asset}0001`,
      doctorId: doctor.id,
      clinicId: clinic?.clinicId ?? null,
      name: "Fractional CO2 laser",
      purpose: "Resurfacing, scar revision",
      costInr: 500000,
      upkeepInr: 40000,
      purchasedOn: days(210),
      uses: {
        create: Array.from({ length: 9 }, (_, k) => ({
          id: `${P.usage}${String(k).padStart(4, "0")}`,
          usedOn: days(200 - k * 20),
          // One included touch-up, so the average is visibly computed from
          // charged uses rather than from all of them.
          chargedInr: k === 4 ? 0 : 8000,
          treatment: "Laser resurfacing",
        })),
      },
    },
  });

  await prisma.practiceAsset.create({
    data: {
      id: `${P.asset}0002`,
      doctorId: doctor.id,
      clinicId: clinic?.clinicId ?? null,
      name: "Q-switched Nd:YAG",
      purpose: "Pigment and tattoo removal",
      costInr: 320000,
      purchasedOn: days(120),
      uses: {
        create: Array.from({ length: 3 }, (_, k) => ({
          id: `${P.usage}1${String(k).padStart(3, "0")}`,
          usedOn: days(90 - k * 25),
          chargedInr: 6500,
          treatment: "Pigment session",
        })),
      },
    },
  });
  console.log(`  finance          ${expenses.length} costs, 2 machines, 12 uses`);

  /* ── Gift cards ───────────────────────────────────────────────────── */

  await prisma.giftCardOffer.create({
    data: {
      id: `${P.offer}0001`,
      doctorId: doctor.id,
      clinicId: clinic?.clinicId ?? null,
      title: "₹5,000 treatment credit",
      description: "Towards any consultation or treatment at the clinic.",
      terms: "Not redeemable for cash. Usable across several visits.",
      valueInr: 5000,
      priceInr: 4500,
      validMonths: 12,
      status: "APPROVED",
      reviewedAt: days(35),
      createdAt: days(38),
    },
  });

  await prisma.giftCardOffer.create({
    data: {
      id: `${P.offer}0002`,
      doctorId: doctor.id,
      title: "₹10,000 course credit",
      description: "For somebody starting a full treatment course.",
      valueInr: 10000,
      priceInr: 9000,
      validMonths: 18,
      status: "PENDING",
      createdAt: days(2),
    },
  });

  await prisma.giftCard.create({
    data: {
      id: `${P.card}0001`,
      offerId: `${P.offer}0001`,
      code: newGiftCardCode(),
      buyerUserId: client.id,
      recipientName: "Meghna P.",
      message: "Happy birthday. Go and be looked after properly.",
      valueInr: 5000,
      // Part-spent, so the balance is visibly a live figure rather than the
      // face value repeated.
      balanceInr: 3500,
      paidAt: days(30),
      paymentId: "demo-payment",
      expiresAt: days(-335),
      createdAt: days(30),
      redemptions: {
        create: [
          {
            id: `${P.redemption}0001`,
            amountInr: 1500,
            doctorId: doctor.id,
            note: "Towards a peel",
            redeemedAt: days(12),
          },
        ],
      },
    },
  });
  console.log("  gift cards       2 offers, 1 card part-redeemed");

  /* ── Medicines ────────────────────────────────────────────────────── */

  const meds: [string, string | null, string, string, number, number | null, number | null, boolean][] = [
    ["Tretinoin cream", "Retino-A", "Cream", "0.025%", 420, 480, 24, true],
    ["Clindamycin gel", "Clindac-A", "Gel", "1%", 180, 210, 40, true],
    ["Adapalene gel", "Differin", "Gel", "0.1%", 350, 395, null, true],
    ["Hydroquinone cream", "Melalite", "Cream", "4%", 290, 320, 12, true],
    ["Ceramide moisturiser", "Cetaphil", "Cream", "", 640, 690, 18, false],
    ["Broad-spectrum sunscreen", "La Shield", "Gel", "SPF 50+", 720, 780, 30, false],
  ];
  for (let i = 0; i < meds.length; i++) {
    const [name, brand, form, strength, priceInr, mrpInr, stock, rx] = meds[i];
    await prisma.medicine.create({
      data: {
        id: `${P.medicine}${String(i).padStart(4, "0")}`,
        doctorId: doctor.id,
        name,
        brand,
        form,
        strength: strength || null,
        priceInr,
        mrpInr,
        stock,
        prescriptionOnly: rx,
        about: i === 0 ? "Apply a pea-sized amount at night. Avoid sun." : null,
      },
    });
  }

  const address = await prisma.patientAddress.findFirst({
    where: { userId: client.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: { label: true, line1: true, line2: true, city: true, pincode: true },
  });
  const deliverTo = address
    ? [address.line1, address.line2, address.city, address.pincode].filter(Boolean).join(", ")
    : "12 Example Street, 600040";

  await prisma.medicineOrder.create({
    data: {
      id: `${P.order}0001`,
      publicId: newOrderId(),
      userId: client.id,
      doctorId: doctor.id,
      status: "DELIVERED",
      deliverTo,
      subtotalInr: 420 + 180 * 2,
      totalInr: 420 + 180 * 2,
      createdAt: days(26),
      items: {
        create: [
          { id: `${P.orderItem}0001`, medicineId: `${P.medicine}0000`, name: "Tretinoin cream", priceInr: 420, qty: 1 },
          { id: `${P.orderItem}0002`, medicineId: `${P.medicine}0001`, name: "Clindamycin gel", priceInr: 180, qty: 2 },
        ],
      },
    },
  });

  await prisma.medicineOrder.create({
    data: {
      id: `${P.order}0002`,
      publicId: newOrderId(),
      userId: client.id,
      doctorId: doctor.id,
      status: "DISPATCHED",
      deliverTo,
      subtotalInr: 720,
      totalInr: 720,
      createdAt: days(3),
      items: {
        create: [
          { id: `${P.orderItem}0003`, medicineId: `${P.medicine}0005`, name: "Broad-spectrum sunscreen", priceInr: 720, qty: 1 },
        ],
      },
    },
  });
  console.log(`  medicines        ${meds.length} listed, 2 orders`);

  /* ── Seller applications ──────────────────────────────────────────── */

  await prisma.medicineVendor.createMany({
    data: [
      {
        id: `${P.vendor}0001`,
        publicId: "BLU-V-DEMO1",
        businessName: "Meridian Pharma Distributors",
        contactName: "Suresh Iyer",
        email: "orders@demo-meridian.local",
        phone: "+91 44 4000 1111",
        addressLine1: "14 Wallajah Road",
        area: "Triplicane",
        city: "Chennai",
        state: "Tamil Nadu",
        pincode: "600005",
        drugLicenceNo: "TN/CH/20B/DEMO-4417",
        gstin: "33ABCDE1234F1Z5",
        categories: "Dermatology topicals, oral antibiotics, sunscreens",
        status: "SUBMITTED",
        submittedAt: days(4),
      },
      {
        id: `${P.vendor}0002`,
        publicId: "BLU-V-DEMO2",
        businessName: "Coastal Medical Supplies",
        contactName: "Anita Raghavan",
        email: "hello@demo-coastal.local",
        phone: "+91 44 4000 2222",
        addressLine1: "8 Beach Road",
        area: "Besant Nagar",
        city: "Chennai",
        state: "Tamil Nadu",
        pincode: "600090",
        drugLicenceNo: "TN/CH/21B/DEMO-9902",
        categories: "Wound care, dressings, post-procedure kits",
        status: "REJECTED",
        reviewNote:
          "Thanks for applying. We could not open the licence you attached; please send a clearer scan and we will look again.",
        submittedAt: days(30),
        reviewedAt: days(27),
      },
    ],
  });
  console.log("  vendors          2 applications");

  console.log(
    `\nSeeded against ${client.name} (${clientPublic?.publicId}) and ${doctor.name} (${doctor.publicId}).`
  );
  console.log("Re-run any time; it purges its own rows first. `--purge` removes them.");
}

main()
  .catch((e) => {
    console.error(e.message ?? e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
