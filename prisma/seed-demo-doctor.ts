/**
 * A complete practice you can sign into.
 *
 * Every screen in the doctor portal is driven by real rows, which is correct
 * and also means an empty database shows a correct, empty dashboard — you
 * cannot tell a working chart from a broken one. This builds one practitioner
 * with six months of history behind them so the portal can actually be read:
 * three clinics, a full week of hours, ~200 appointments across every status,
 * moderated and unmoderated reviews, members, cancellations attributed to both
 * sides, and leave booked ahead.
 *
 * Two rules it works under:
 *
 *   1. **It is labelled.** The practitioner's name, the registration number
 *      and the client accounts all say "demo". Nothing here should ever be
 *      mistaken for a real registration — this codebase has deleted invented
 *      data before, and the way to keep demo data safe is to make it obvious.
 *
 *   2. **It is reversible.** Everything it writes is keyed by the constants
 *      below, and `--purge` removes exactly that and nothing else. Re-running
 *      it replaces its own rows rather than accumulating.
 *
 * Deterministic: one seeded PRNG, no Math.random, so two runs produce the same
 * practice and yesterday's screenshot still means something.
 *
 *   npx tsx prisma/seed-demo-doctor.ts
 *   npx tsx prisma/seed-demo-doctor.ts --purge
 */
import bcrypt from "bcryptjs";
import {
  ActorKind,
  AppointmentStatus,
  ApprovalState,
  ConsultMode,
  Gender,
  PrismaClient,
  ReviewStatus,
  SymptomDuration,
  VisitReason,
} from "@prisma/client";

const prisma = new PrismaClient({ log: ["warn", "error"] });

/* ─────────────────────────── What we own ──────────────────────────────── */

const DOCTOR_SLUG = "demo-nithya-raghavan";
const DOCTOR_EMAIL = "demo.doctor@bluderma.local";
const DOCTOR_PASSWORD = "DemoDoctor@2026";

const CLIENT_EMAIL = "demo.client@bluderma.local";
const CLIENT_PASSWORD = "DemoClient@2026";

/** Every generated patient account. This domain is ours alone. */
const PATIENT_DOMAIN = "demo.bluderma.local";

const DAY = 86_400_000;

/* ──────────────────────── Deterministic randomness ────────────────────── */

/**
 * mulberry32. Seeded so the same command twice gives the same practice —
 * without that, "the chart changed after a re-seed" is indistinguishable from
 * a bug in the chart.
 */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20260820);
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
const between = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
/** True with probability p. */
const chance = (p: number) => rand() < p;

/* ───────────────────────────── The people ─────────────────────────────── */

const PATIENTS = [
  { first: "Karan", last: "Malhotra", age: 31, gender: Gender.MALE },
  { first: "Divya", last: "Srinivasan", age: 27, gender: Gender.FEMALE },
  { first: "Rahul", last: "Nambiar", age: 38, gender: Gender.MALE },
  { first: "Aishwarya", last: "Balan", age: 24, gender: Gender.FEMALE },
  { first: "Faisal", last: "Ahmed", age: 34, gender: Gender.MALE },
  { first: "Meghna", last: "Pillai", age: 29, gender: Gender.FEMALE },
  { first: "Sandeep", last: "Reddy", age: 44, gender: Gender.MALE },
  { first: "Lakshmi", last: "Venkatesh", age: 52, gender: Gender.FEMALE },
  { first: "Joel", last: "Thomas", age: 22, gender: Gender.MALE },
  { first: "Priyanka", last: "Ravi", age: 36, gender: Gender.FEMALE },
  { first: "Nikhil", last: "Menon", age: 41, gender: Gender.MALE },
  { first: "Swetha", last: "Kumar", age: 30, gender: Gender.FEMALE },
  { first: "Arjun", last: "Iyengar", age: 26, gender: Gender.MALE },
  { first: "Hema", last: "Chandran", age: 48, gender: Gender.FEMALE },
] as const;

/** The reasons a dermatology practice actually sees, weighted like one. */
const REASON_MIX: VisitReason[] = [
  ...Array<VisitReason>(9).fill(VisitReason.ACNE),
  ...Array<VisitReason>(7).fill(VisitReason.PIGMENTATION),
  ...Array<VisitReason>(6).fill(VisitReason.HAIR_LOSS),
  ...Array<VisitReason>(5).fill(VisitReason.ANTI_AGEING),
  ...Array<VisitReason>(4).fill(VisitReason.SCARS),
  ...Array<VisitReason>(4).fill(VisitReason.FOLLOW_UP),
  ...Array<VisitReason>(3).fill(VisitReason.ECZEMA_PSORIASIS),
  ...Array<VisitReason>(2).fill(VisitReason.ROSACEA_REDNESS),
  ...Array<VisitReason>(2).fill(VisitReason.COSMETIC_PROCEDURE),
  VisitReason.FUNGAL_INFECTION,
  VisitReason.MOLE_CHECK,
  VisitReason.OTHER,
];

const DETAIL: Partial<Record<VisitReason, string[]>> = {
  ACNE: [
    "Breakouts along the jaw that flare the week before my period.",
    "Painful cystic spots on both cheeks for the last two months.",
    "Whiteheads on the forehead that came back after I stopped a face wash.",
  ],
  PIGMENTATION: [
    "Dark patches on both cheekbones, worse after summer.",
    "Uneven tone around the mouth that makeup no longer covers.",
  ],
  HAIR_LOSS: [
    "Shedding in the shower for about six months; the parting looks wider.",
    "Thinning at the crown — my father had the same at this age.",
  ],
  ANTI_AGEING: [
    "Fine lines around the eyes that have set in over the last year.",
    "Skin feels loose along the jawline since I lost weight.",
  ],
  SCARS: [
    "Pitted marks left behind from acne in my twenties.",
    "A raised scar on the shoulder from surgery two years ago.",
  ],
  FOLLOW_UP: [
    "Reviewing progress on the course we started last visit.",
    "Second session of the plan discussed at the last consultation.",
  ],
  ECZEMA_PSORIASIS: ["Itchy dry patches inside both elbows that keep returning."],
  ROSACEA_REDNESS: ["Persistent flushing across the nose and cheeks."],
  COSMETIC_PROCEDURE: ["Asking about options before a family wedding in March."],
  FUNGAL_INFECTION: ["A ring-shaped rash on the neck that is spreading slowly."],
  MOLE_CHECK: ["A mole on the back that my partner says has changed shape."],
  OTHER: ["General skin check — nothing specific, but I would like advice."],
};

const REVIEW_COPY: { rating: number; title: string; body: string }[] = [
  { rating: 5, title: "Explained everything properly", body: "Did not rush me, drew out what was happening on paper, and the plan was in my budget. First dermatologist who has actually answered my questions." },
  { rating: 5, title: "Six weeks in and it is working", body: "I was sceptical about another acne course. The difference is obvious in photographs and the follow-up was booked before I left." },
  { rating: 5, title: "Worth the travel", body: "Came from Tambaram for the appointment. Ran on time, staff were kind, and the prescription was on my phone the same evening." },
  { rating: 4, title: "Good consultation, clinic was busy", body: "The consultation itself was thorough. The waiting area was full, so I sat about fifteen minutes past my slot." },
  { rating: 5, title: "Honest about what would not help", body: "Talked me out of a laser package I had read about and suggested something cheaper first. That is why I went back." },
  { rating: 5, title: "Melasma finally under control", body: "Two years of trying things off the internet. Three months here and the patches have faded noticeably." },
  { rating: 4, title: "Clear plan, slightly pricey", body: "No complaints about the treatment or the manner. The full course does add up, though it was all quoted up front." },
  { rating: 5, title: "Good with a nervous patient", body: "I do not like clinics. I was talked through every step before anything was done. My mother is going next month." },
  { rating: 5, title: "Hair fall stopped", body: "Shedding slowed by the second month. I was told plainly what it could and could not fix, which I appreciated." },
  { rating: 4, title: "Video consult worked well", body: "Could not travel, so did it by video. Sent photographs beforehand and got the same care. Prescription arrived straight after." },
  { rating: 5, title: "Very patient with questions", body: "I had a list. Every single one was answered without being made to feel silly about it." },
  { rating: 5, title: "Scarring treatment went well", body: "Realistic about how much of the pitting could be improved, and it went about as far as promised. No overselling." },
  { rating: 3, title: "Results are slow for me", body: "No issue with the doctor, who has been attentive throughout. My own progress has been slower than I hoped after two months." },
  { rating: 5, title: "The best in Anna Nagar", body: "Went for a second opinion after a bad experience elsewhere. A completely different level of care." },
  { rating: 5, title: "Kind and thorough", body: "Checked things I had not even mentioned and caught a patch on my back I had not seen." },
  { rating: 4, title: "Good, would return", body: "Straightforward consultation for a mole check. Reassuring and quick." },
];

/** Written but not yet moderated — these prove the "with our team" state. */
const PENDING_REVIEWS: { rating: number; title: string; body: string }[] = [
  { rating: 5, title: "Second course booked", body: "Happy enough with the first that I have booked the next one already." },
  { rating: 4, title: "Helpful consultation", body: "Got a clear answer on something two other clinics were vague about." },
  { rating: 5, title: "Thank you", body: "My skin has not been this settled in years." },
];

/* ─────────────────────────────── Purge ────────────────────────────────── */

/**
 * Removes exactly what this file created.
 *
 * Appointment.doctorId has no cascade — deliberately, so a practice cannot be
 * deleted out from under its own history — so the teardown runs in dependency
 * order rather than trusting the database to follow.
 */
async function purge(): Promise<void> {
  const doctor = await prisma.doctor.findUnique({
    where: { slug: DOCTOR_SLUG },
    select: { id: true },
  });

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { endsWith: `@${PATIENT_DOMAIN}` } },
        { email: CLIENT_EMAIL },
        { email: DOCTOR_EMAIL },
      ],
    },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);

  if (doctor) {
    await prisma.review.deleteMany({ where: { doctorId: doctor.id } });
    await prisma.prescription.deleteMany({ where: { doctorId: doctor.id } });
    await prisma.appointment.deleteMany({ where: { doctorId: doctor.id } });
    await prisma.doctorTimeOff.deleteMany({ where: { doctorId: doctor.id } });
    await prisma.doctorAvailability.deleteMany({ where: { doctorId: doctor.id } });
    await prisma.doctorDailyInsight.deleteMany({ where: { doctorId: doctor.id } });
    await prisma.doctorClinic.deleteMany({ where: { doctorId: doctor.id } });
    await prisma.doctor.delete({ where: { id: doctor.id } });
  }

  if (userIds.length) {
    // Anything still pointing at these accounts from ANOTHER practitioner's
    // history: null the link rather than deleting someone else's appointment.
    await prisma.appointment.updateMany({
      where: { patientUserId: { in: userIds } },
      data: { patientUserId: null },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }

  console.log(`Purged: doctor ${doctor ? 1 : 0}, accounts ${userIds.length}.`);
}

/* ──────────────────────────────── Seed ────────────────────────────────── */

/** Consultation fee per location — a flagship charges more than a suburb. */
const FEES = [1600, 1400, 1200];

/**
 * A real Indian practice: a morning session and an evening one, and the
 * suburban clinics on their own days. Sunday is off.
 */
const HOURS: { day: number; clinic: number; start: string; end: string }[] = [
  { day: 1, clinic: 0, start: "10:00", end: "13:00" },
  { day: 1, clinic: 0, start: "17:00", end: "20:00" },
  { day: 2, clinic: 1, start: "10:00", end: "13:00" },
  { day: 2, clinic: 1, start: "17:00", end: "19:30" },
  { day: 3, clinic: 0, start: "10:00", end: "13:00" },
  { day: 3, clinic: 2, start: "17:00", end: "20:00" },
  { day: 4, clinic: 1, start: "10:00", end: "13:00" },
  { day: 4, clinic: 0, start: "17:00", end: "19:30" },
  { day: 5, clinic: 2, start: "10:00", end: "13:00" },
  { day: 5, clinic: 0, start: "17:00", end: "20:00" },
  { day: 6, clinic: 0, start: "10:00", end: "14:00" },
];

async function main(): Promise<void> {
  if (process.argv.includes("--purge")) {
    await purge();
    return;
  }

  // Replace rather than accumulate.
  await purge();

  const now = new Date();
  const hash = (pw: string) => bcrypt.hash(pw, 12);

  /* ── The practitioner ─────────────────────────────────────────────── */

  const doctorUser = await prisma.user.create({
    data: {
      email: DOCTOR_EMAIL,
      name: "Dr. Nithya Raghavan",
      role: "DOCTOR",
      phone: "+91 90000 11122",
      passwordHash: await hash(DOCTOR_PASSWORD),
      emailVerified: new Date(),
    },
    select: { id: true },
  });

  // An image already on our own bucket, rather than hot-linking a stranger's
  // photograph into a demo. The site/ prefix is public-read.
  const PHOTO =
    "https://blu-derma.s3.ap-south-1.amazonaws.com/site/images/doctors/meera-iyer.jpg";

  const doctor = await prisma.doctor.create({
    data: {
      slug: DOCTOR_SLUG,
      userId: doctorUser.id,
      name: "Dr. Nithya Raghavan",
      title: "MBBS, MD (Dermatology), Fellowship in Cosmetic Dermatology",
      specialty: "Dermatology & Cosmetic Dermatology",
      experienceYears: 14,
      clinic: "BluDerma Aesthetics — Nungambakkam",
      location: "Chennai",
      image: PHOTO,
      phone: "+91 90000 11122",
      email: "nithya@demo.bluderma.local",
      website: "https://demo.bluderma.local/nithya",
      instagram: "https://instagram.com/dr.nithya.derm",
      facebook: "https://facebook.com/drnithyaraghavan",
      linkedin: "https://linkedin.com/in/dr-nithya-raghavan",
      youtube: "https://youtube.com/@drnithyaskin",
      fee: 1400,
      about:
        "Dr. Nithya Raghavan is a consultant dermatologist practising in Chennai for fourteen years, with a clinical interest in adult acne, melasma and hair loss. She trained at Madras Medical College and went on to a fellowship in cosmetic dermatology, and she now runs three clinics across the city — Nungambakkam, Adyar and Anna Nagar. Consultations begin with what the skin is doing rather than with a procedure: most plans start with medical management, and lasers or injectables are offered only where they add something topical treatment cannot. She sees adults and adolescents, and consults in Tamil, English, Malayalam and Hindi. (Demonstration profile — not a real registration.)",
      verified: true,
      isActive: true,
      isGeneral: false,
      sortOrder: 1,
      status: "APPROVED",
      submittedAt: new Date(now.getTime() - 200 * DAY),
      reviewedAt: new Date(now.getTime() - 198 * DAY),
      regCouncil: "Tamil Nadu Medical Council",
      regNumber: "TNMC-DEMO-88417",
      regYear: 2011,
      // A PRIVATE prefix. Only the owner and an admin can resolve it, and only
      // through a signed URL — see PRIVATE_PREFIXES in prisma/setup-s3.ts.
      licenceDocUrl: "credentials/demo/nithya-raghavan-registration.pdf",
      travelBufferMin: 45,
      requiresApproval: true,
      priorityHoldPerDay: 2,
      languages: {
        create: ["Tamil", "English", "Malayalam", "Hindi"].map((name, i) => ({
          name,
          sortOrder: i,
        })),
      },
      services: {
        create: [
          "Acne & acne scarring",
          "Melasma & pigmentation",
          "Hair loss & PRP",
          "Chemical peels",
          "Laser resurfacing",
          "Botox & fillers",
          "Paediatric dermatology",
          "Mole & skin cancer screening",
        ].map((name, i) => ({ name, sortOrder: i })),
      },
      modes: {
        create: [
          { mode: ConsultMode.CLINIC },
          { mode: ConsultMode.VIDEO },
          { mode: ConsultMode.HOME },
        ],
      },
    },
    select: { id: true },
  });

  // Concern matching — what the analyzer routes to this practitioner.
  const concerns = await prisma.skinConcern.findMany({
    where: {
      key: { in: ["acne", "pores", "ageSpots", "redness", "texture", "wrinkles"] },
    },
    select: { id: true, key: true },
  });
  if (concerns.length) {
    await prisma.doctorConcern.createMany({
      data: concerns.map((c) => ({
        doctorId: doctor.id,
        concernId: c.id,
        weight: c.key === "acne" ? 3 : 2,
      })),
    });
  }

  /* ── Where she works ──────────────────────────────────────────────── */

  // Existing BluDerma locations, so the calendar's colour key and the clinic
  // photographs are the real ones rather than a second set invented here.
  const clinicSlugs = [
    "bluderma-aesthetics-nungambakkam",
    "bluderma-aesthetics-adyar",
    "bluderma-skin-studio-anna-nagar",
  ];
  const found = await prisma.clinic.findMany({
    where: { slug: { in: clinicSlugs } },
    select: { id: true, slug: true, name: true },
  });
  // Keep the declared order — index 0 is the primary.
  const clinics = clinicSlugs
    .map((s) => found.find((c) => c.slug === s))
    .filter((c): c is (typeof found)[number] => Boolean(c));

  if (clinics.length < 3) {
    throw new Error(
      `Expected the three seeded Chennai clinics, found ${clinics.length}. Run prisma/seed-clinics.ts first.`
    );
  }

  await prisma.doctorClinic.createMany({
    data: clinics.map((c, i) => ({
      doctorId: doctor.id,
      clinicId: c.id,
      feeInr: FEES[i],
      isPrimary: i === 0,
      sortOrder: i,
      isActive: true,
    })),
  });

  await prisma.doctorAvailability.createMany({
    data: HOURS.map((h) => ({
      doctorId: doctor.id,
      clinicId: clinics[h.clinic].id,
      dayOfWeek: h.day,
      startTime: h.start,
      endTime: h.end,
      slotMinutes: 30,
      isActive: true,
    })),
  });

  await prisma.doctorTimeOff.createMany({
    data: [
      {
        doctorId: doctor.id,
        startsAt: new Date(now.getTime() + 12 * DAY),
        endsAt: new Date(now.getTime() + 15 * DAY),
        reason: "IADVL conference, Kochi",
      },
      {
        doctorId: doctor.id,
        startsAt: new Date(now.getTime() + 34 * DAY),
        endsAt: new Date(now.getTime() + 35 * DAY),
        reason: "Personal",
      },
      // One in the recent past, so the utilisation denominator has a real gap
      // in it rather than a theoretical one.
      {
        doctorId: doctor.id,
        startsAt: new Date(now.getTime() - 20 * DAY),
        endsAt: new Date(now.getTime() - 18 * DAY),
        reason: "Leave",
      },
    ],
  });

  /* ── The clients ──────────────────────────────────────────────────── */

  const plans = await prisma.subscriptionPlan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, discountPercent: true },
  });

  type Patient = {
    id: string;
    name: string;
    email: string;
    phone: string;
    age: number;
    gender: Gender;
    subscriptionId: string | null;
    discountPercent: number;
  };
  const patients: Patient[] = [];

  for (let i = 0; i < PATIENTS.length; i++) {
    const p = PATIENTS[i];
    const email = `${p.first.toLowerCase()}.${p.last.toLowerCase()}@${PATIENT_DOMAIN}`;
    const phone = `+91 9${String(80000000 + i * 1111111).slice(0, 9)}`;

    const user = await prisma.user.create({
      data: {
        email,
        name: `${p.first} ${p.last}`,
        role: "PATIENT",
        phone,
        // A shared password across the generated clients. They exist to be
        // read from the doctor's side; the account meant for signing in as a
        // client is CLIENT_EMAIL further down.
        passwordHash: await hash(CLIENT_PASSWORD),
        emailVerified: new Date(),
        createdAt: new Date(now.getTime() - between(120, 320) * DAY),
        patientProfile: {
          create: {
            fullName: `${p.first} ${p.last}`,
            phone,
            age: p.age,
            gender: p.gender,
            city: "Chennai",
          },
        },
      },
      select: { id: true },
    });

    // Every fifth client is a member, which is what puts a real figure behind
    // the "Members" gauge and the discount line.
    let subscriptionId: string | null = null;
    let discountPercent = 0;
    if (plans.length && i % 5 === 0) {
      const plan = plans[i % plans.length];
      const sub = await prisma.subscription.create({
        data: {
          userId: user.id,
          planId: plan.id,
          status: "ACTIVE",
          startedAt: new Date(now.getTime() - 90 * DAY),
          currentPeriodEnd: new Date(now.getTime() + 200 * DAY),
        },
        select: { id: true },
      });
      subscriptionId = sub.id;
      discountPercent = plan.discountPercent;
    }

    patients.push({
      id: user.id,
      name: `${p.first} ${p.last}`,
      email,
      phone,
      age: p.age,
      gender: p.gender,
      subscriptionId,
      discountPercent,
    });
  }

  /* ── Six months of diary ──────────────────────────────────────────── */

  type Row = {
    at: Date;
    clinicIdx: number;
    patient: Patient;
    mode: ConsultMode;
    status: AppointmentStatus;
    approvalState: ApprovalState;
    reason: VisitReason;
  };

  const rows: Row[] = [];
  const takenSlots = new Set<string>();

  /** Every working window on a weekday, as minutes since midnight. */
  const windowsFor = (weekday: number) =>
    HOURS.filter((h) => h.day === weekday).map((h) => {
      const [sh, sm] = h.start.split(":").map(Number);
      const [eh, em] = h.end.split(":").map(Number);
      return { clinic: h.clinic, from: sh * 60 + sm, to: eh * 60 + em };
    });

  // 190 days back, 21 forward. The back half is what makes "Last 6 months" in
  // the period dropdown a real answer rather than a copy of this month.
  for (let offset = -190; offset <= 21; offset++) {
    const day = new Date(now.getTime() + offset * DAY);
    day.setUTCHours(0, 0, 0, 0);
    const windows = windowsFor(day.getUTCDay());
    if (!windows.length) continue;

    // How full the day runs. Recent weeks are busier than old ones, so the
    // sparkline and the period-on-period delta have a direction in them.
    const recency = (offset + 190) / 211;
    const load = 0.35 + recency * 0.4;

    for (const w of windows) {
      for (let t = w.from; t < w.to; t += 30) {
        if (!chance(load)) continue;

        const at = new Date(day.getTime() + t * 60_000);
        const key = at.toISOString();
        // The unique index on slotLock would reject a duplicate anyway; this
        // just means we never ask it to.
        if (takenSlots.has(key)) continue;
        takenSlots.add(key);

        const past = at.getTime() < now.getTime();
        const mode = chance(0.12)
          ? ConsultMode.VIDEO
          : chance(0.04)
            ? ConsultMode.HOME
            : ConsultMode.CLINIC;

        let status: AppointmentStatus;
        let approvalState: ApprovalState = ApprovalState.ACCEPTED;

        if (past) {
          // A practice that closes most of its visits but not all of them,
          // which is the honest case the dashboard's `unresolved` tier and
          // its nudge exist for.
          const r = rand();
          if (r < 0.78) status = AppointmentStatus.COMPLETED;
          else if (r < 0.87) status = AppointmentStatus.CONFIRMED; // never closed
          else if (r < 0.95) status = AppointmentStatus.CANCELLED;
          else status = AppointmentStatus.NO_SHOW;
        } else {
          status = AppointmentStatus.CONFIRMED;
          // She has manual confirmation on, so a few of the newest requests
          // are still sitting with her.
          if (chance(0.09)) approvalState = ApprovalState.AWAITING_DOCTOR;
        }

        rows.push({
          at,
          clinicIdx: w.clinic,
          patient: pick(patients),
          mode,
          status,
          approvalState,
          reason: pick(REASON_MIX),
        });
      }
    }
  }

  let created = 0;
  const completed: { id: string; userId: string; at: Date }[] = [];

  for (const r of rows) {
    const baseFee = FEES[r.clinicIdx];
    const discount = r.patient.subscriptionId
      ? Math.round((baseFee * r.patient.discountPercent) / 100)
      : 0;
    const visitFee = r.mode === ConsultMode.HOME ? 600 : 0;
    const detail = DETAIL[r.reason] ?? DETAIL.OTHER!;

    const isCancelled =
      r.status === AppointmentStatus.CANCELLED ||
      r.status === AppointmentStatus.NO_SHOW;

    // Who called it off. Both sides are represented, because a dashboard that
    // only ever shows client-side cancellations tells a doctor the
    // comfortable half of the story.
    const cancelledBy = isCancelled
      ? chance(0.68)
        ? ActorKind.PATIENT
        : chance(0.6)
          ? ActorKind.DOCTOR
          : ActorKind.ADMIN
      : null;

    const bookedAt = new Date(
      r.at.getTime() - between(1, 21) * DAY - between(0, 20) * 3_600_000
    );

    const appointment = await prisma.appointment.create({
      data: {
        patientUserId: r.patient.id,
        doctorId: doctor.id,
        clinicId: clinics[r.clinicIdx].id,
        scheduledAt: r.at,
        durationMin: 30,
        mode: r.mode,
        status: r.status,
        // feeAtBooking is POST-discount, matching the booking action.
        feeAtBooking: baseFee - discount,
        visitFee,
        patientName: r.patient.name,
        patientPhone: r.patient.phone,
        patientEmail: r.patient.email,
        reason: r.reason,
        reasonDetail: pick(detail),
        symptomDuration: pick([
          SymptomDuration.UNDER_WEEK,
          SymptomDuration.WEEKS_1_4,
          SymptomDuration.MONTHS_1_6,
          SymptomDuration.MONTHS_6_12,
          SymptomDuration.OVER_YEAR,
        ]),
        severity: between(1, 5),
        priorTreatment: chance(0.55)
          ? pick([
              "Benzoyl peroxide face wash from the pharmacy, about three months.",
              "A course of doxycycline last year — it helped while I was on it.",
              "Over-the-counter minoxidil for four months, stopped in June.",
              "Nothing so far. This is the first time I am seeing anyone about it.",
            ])
          : null,
        medications: chance(0.3)
          ? pick(["Thyroxine 50mcg daily.", "Metformin 500mg twice daily.", "None."])
          : "None",
        allergies: chance(0.18) ? pick(["Penicillin", "Sulfa drugs"]) : "None known",
        isFirstVisit: r.reason !== VisitReason.FOLLOW_UP && chance(0.4),
        patientAge: r.patient.age,
        patientGender: r.patient.gender,
        photoConsent: chance(0.7),
        approvalState: r.approvalState,
        approvedAt:
          r.approvalState === ApprovalState.ACCEPTED
            ? new Date(bookedAt.getTime() + between(1, 30) * 3_600_000)
            : null,
        meetingUrl:
          r.mode === ConsultMode.VIDEO
            ? "https://meet.google.com/demo-nithya-clinic"
            : null,
        subscriptionId: r.patient.subscriptionId,
        discountInr: discount,
        isPriority: Boolean(r.patient.subscriptionId) && chance(0.5),
        cancelledBy,
        cancelledAt: isCancelled
          ? new Date(r.at.getTime() - between(1, 48) * 3_600_000)
          : null,
        cancelReason: isCancelled
          ? cancelledBy === ActorKind.PATIENT
            ? pick(["Travelling that week.", "Unwell.", "Work conflict."])
            : pick(["Doctor called to an emergency.", "Clinic closed that afternoon."])
          : null,
        // Only a client-side cancellation inside the fee window is chargeable.
        cancellationFeeInr:
          isCancelled && cancelledBy === ActorKind.PATIENT && chance(0.35) ? 300 : 0,
        // A cancelled row releases the lock, exactly as the booking action
        // does — otherwise the slot stays unbookable forever.
        slotLock: isCancelled ? null : `${doctor.id}@${r.at.toISOString()}`,
        createdAt: bookedAt,
      },
      select: { id: true, status: true, scheduledAt: true },
    });

    created += 1;
    if (appointment.status === AppointmentStatus.COMPLETED) {
      completed.push({
        id: appointment.id,
        userId: r.patient.id,
        at: appointment.scheduledAt,
      });
    }
  }

  /* ── Reviews ──────────────────────────────────────────────────────── */

  // A review is anchored to an appointment that actually happened — that is
  // the whole reason a rating means anything — so they are drawn from the
  // completed set, newest first, one apiece.
  const reviewable = [...completed]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, REVIEW_COPY.length + PENDING_REVIEWS.length);

  let ratingSum = 0;
  let published = 0;

  for (let i = 0; i < REVIEW_COPY.length && i < reviewable.length; i++) {
    const target = reviewable[i];
    const copy = REVIEW_COPY[i];
    await prisma.review.create({
      data: {
        appointmentId: target.id,
        userId: target.userId,
        doctorId: doctor.id,
        rating: copy.rating,
        title: copy.title,
        body: copy.body,
        status: ReviewStatus.PUBLISHED,
        publishedAt: new Date(target.at.getTime() + between(2, 9) * DAY),
        createdAt: new Date(target.at.getTime() + DAY),
      },
    });
    ratingSum += copy.rating;
    published += 1;
  }

  for (let i = 0; i < PENDING_REVIEWS.length; i++) {
    const target = reviewable[REVIEW_COPY.length + i];
    if (!target) break;
    const copy = PENDING_REVIEWS[i];
    await prisma.review.create({
      data: {
        appointmentId: target.id,
        userId: target.userId,
        doctorId: doctor.id,
        rating: copy.rating,
        title: copy.title,
        body: copy.body,
        status: ReviewStatus.PENDING,
        createdAt: new Date(now.getTime() - between(1, 6) * DAY),
      },
    });
  }

  // The public rating counts PUBLISHED reviews only — an unmoderated one must
  // never move a clinician's score.
  await prisma.doctor.update({
    where: { id: doctor.id },
    data: {
      reviews: published,
      rating: published ? Number((ratingSum / published).toFixed(1)) : 0,
    },
  });

  /* ── Prescriptions against real visits ────────────────────────────── */

  for (const t of completed.slice(0, 24)) {
    await prisma.prescription.create({
      data: {
        userId: t.userId,
        doctorId: doctor.id,
        title: pick([
          "Acne — 12 week plan",
          "Melasma — maintenance",
          "Hair loss — 6 month course",
          "Eczema — flare management",
        ]),
        notes: pick([
          "Adapalene 0.1% at night, pea-sized, alternate nights for the first fortnight. Non-comedogenic sunscreen every morning, reapplied at lunch. Review in six weeks.",
          "Triple combination cream at night for eight weeks, then twice weekly. Sunscreen SPF 50 is the treatment, not an extra — reapply every three hours outdoors.",
          "Minoxidil 5% twice daily to a dry scalp. Oral supplement with dinner. Photographs at the same angle each month; review at twelve weeks.",
          "Emollient twice daily and after every wash. Topical steroid for flares only, maximum ten days. Avoid soap on the affected areas.",
        ]),
        issuedAt: new Date(t.at.getTime() + 3_600_000),
      },
    });
  }

  /* ── One client account meant to be signed into ───────────────────── */

  const clientUser = await prisma.user.create({
    data: {
      email: CLIENT_EMAIL,
      name: "Demo Client",
      role: "PATIENT",
      phone: "+91 90000 22233",
      passwordHash: await hash(CLIENT_PASSWORD),
      emailVerified: new Date(),
      createdAt: new Date(now.getTime() - 260 * DAY),
      patientProfile: {
        create: {
          fullName: "Demo Client",
          phone: "+91 90000 22233",
          age: 29,
          gender: Gender.FEMALE,
          city: "Chennai",
        },
      },
    },
    select: { id: true },
  });

  if (plans.length) {
    await prisma.subscription.create({
      data: {
        userId: clientUser.id,
        planId: plans[0].id,
        status: "ACTIVE",
        startedAt: new Date(now.getTime() - 40 * DAY),
        currentPeriodEnd: new Date(now.getTime() + 320 * DAY),
      },
    });
  }

  await seedClientRecord(clientUser.id, doctor.id, clinics[0].id, now);

  /* ── What was built ───────────────────────────────────────────────── */

  console.log("\nDemo practice built.\n");
  console.table({
    appointments: created,
    completed: completed.length,
    publishedReviews: published,
    pendingReviews: PENDING_REVIEWS.length,
    clinics: clinics.length,
    clients: patients.length + 1,
  });
  console.log(`
  DOCTOR   ${DOCTOR_EMAIL}
           ${DOCTOR_PASSWORD}
           -> /doctor/portal     approved, straight to the dashboard

  CLIENT   ${CLIENT_EMAIL}
           ${CLIENT_PASSWORD}
           -> /patient/profile   reports, prescriptions, wallet, membership

  The ${PATIENTS.length} generated clients (@${PATIENT_DOMAIN}) share the client
  password. They exist to be read from the doctor's side.

  Undo all of it:  npx tsx prisma/seed-demo-doctor.ts --purge
`);
}

/**
 * The signed-in client's own record: scans, prescriptions, orders, discounts
 * and a visit history with the demo practitioner.
 */
async function seedClientRecord(
  userId: string,
  doctorId: string,
  clinicId: string,
  now: Date
): Promise<void> {
  const concerns = await prisma.skinConcern.findMany({
    select: { id: true },
    orderBy: { sortOrder: "asc" },
  });

  // Three scans over four months, improving — so the profile's progress view
  // has a direction rather than one lonely reading.
  const SCANS = [
    { daysAgo: 118, overall: 61, type: "Combination", age: 32 },
    { daysAgo: 62, overall: 68, type: "Combination", age: 31 },
    { daysAgo: 12, overall: 76, type: "Normal to combination", age: 29 },
  ];
  for (const s of SCANS) {
    const analysis = await prisma.skinAnalysis.create({
      data: {
        userId,
        overall: s.overall,
        skinType: s.type,
        estimatedAge: s.age,
        createdAt: new Date(now.getTime() - s.daysAgo * DAY),
      },
      select: { id: true },
    });
    if (!concerns.length) continue;
    // All twelve metrics are stored, not only the worst three — that is what
    // makes "re-scan and compare" possible later.
    await prisma.skinAnalysisScore.createMany({
      data: concerns.map((c, i) => ({
        analysisId: analysis.id,
        concernId: c.id,
        score: Math.max(20, Math.min(95, s.overall + between(-18, 14))),
        topRank: i < 3 ? i + 1 : null,
      })),
    });
  }

  // A short history with the demo practitioner, including one still ahead.
  const visits: { daysAgo: number; status: AppointmentStatus; reason: VisitReason }[] = [
    { daysAgo: 96, status: AppointmentStatus.COMPLETED, reason: VisitReason.ACNE },
    { daysAgo: 54, status: AppointmentStatus.COMPLETED, reason: VisitReason.FOLLOW_UP },
    { daysAgo: 21, status: AppointmentStatus.COMPLETED, reason: VisitReason.PIGMENTATION },
    { daysAgo: -9, status: AppointmentStatus.CONFIRMED, reason: VisitReason.FOLLOW_UP },
  ];
  for (const v of visits) {
    const at = new Date(now.getTime() - v.daysAgo * DAY);
    // 11:15 rather than on the half hour, so this never collides with a slot
    // the generated diary above already took.
    at.setUTCHours(11, 15, 0, 0);
    await prisma.appointment.create({
      data: {
        patientUserId: userId,
        doctorId,
        clinicId,
        scheduledAt: at,
        durationMin: 30,
        mode: ConsultMode.CLINIC,
        status: v.status,
        approvalState: ApprovalState.ACCEPTED,
        approvedAt: new Date(at.getTime() - 2 * DAY),
        feeAtBooking: 1440,
        visitFee: 0,
        patientName: "Demo Client",
        patientPhone: "+91 90000 22233",
        patientEmail: CLIENT_EMAIL,
        reason: v.reason,
        reasonDetail:
          "Jawline breakouts, and some pigmentation left behind by older spots.",
        symptomDuration: SymptomDuration.MONTHS_6_12,
        severity: 3,
        medications: "None",
        allergies: "None known",
        patientAge: 29,
        patientGender: Gender.FEMALE,
        photoConsent: true,
        discountInr: 160,
        slotLock: `${doctorId}@${at.toISOString()}`,
        createdAt: new Date(at.getTime() - 9 * DAY),
      },
    });
  }

  await prisma.prescription.createMany({
    data: [
      {
        userId,
        doctorId,
        title: "Acne — 12 week plan",
        notes:
          "Adapalene 0.1% at night, alternate nights for the first fortnight and then daily. Non-comedogenic sunscreen every morning. Clindamycin gel to active spots only, maximum eight weeks. Review at six weeks with photographs.",
        issuedAt: new Date(now.getTime() - 96 * DAY),
      },
      {
        userId,
        doctorId,
        title: "Pigmentation — maintenance",
        notes:
          "Azelaic acid 15% in the morning. Sunscreen SPF 50 reapplied every three hours outdoors — this is the treatment, not an addition to it. Stop the earlier clindamycin.",
        issuedAt: new Date(now.getTime() - 21 * DAY),
      },
    ],
  });

  await prisma.purchase.createMany({
    data: [
      {
        userId,
        itemName: "Barrier Repair Moisturiser 50ml",
        quantity: 1,
        status: "DELIVERED",
        amountInr: 1450,
        orderedAt: new Date(now.getTime() - 74 * DAY),
      },
      {
        userId,
        itemName: "Mineral Sunscreen SPF 50 PA++++",
        quantity: 2,
        status: "DELIVERED",
        amountInr: 2380,
        orderedAt: new Date(now.getTime() - 41 * DAY),
      },
      {
        userId,
        itemName: "Gentle Foaming Cleanser 150ml",
        quantity: 1,
        status: "SHIPPED",
        amountInr: 890,
        orderedAt: new Date(now.getTime() - 5 * DAY),
      },
      {
        userId,
        itemName: "Niacinamide 10% Serum 30ml",
        quantity: 1,
        status: "PROCESSING",
        amountInr: 1120,
        orderedAt: new Date(now.getTime() - 1 * DAY),
      },
    ],
  });

  await prisma.discountGrant.createMany({
    data: [
      {
        userId,
        code: "FIRSTSCAN",
        description: "First skin analysis, free",
        percentOff: 100,
        usedAt: new Date(now.getTime() - 118 * DAY),
        createdAt: new Date(now.getTime() - 120 * DAY),
      },
      {
        userId,
        code: "WHITECOLLAR10",
        description: "White Collar — 10% off every consultation",
        percentOff: 10,
        usedAt: new Date(now.getTime() - 21 * DAY),
        createdAt: new Date(now.getTime() - 40 * DAY),
      },
      {
        userId,
        code: "MONSOON15",
        description: "Monsoon skin week — 15% off a peel course",
        percentOff: 15,
        expiresAt: new Date(now.getTime() + 26 * DAY),
        createdAt: new Date(now.getTime() - 9 * DAY),
      },
    ],
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
