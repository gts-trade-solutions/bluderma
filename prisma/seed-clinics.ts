/**
 * Clinics: purge the imported businesses, stand up a demo network.
 *
 * Two jobs, deliberately in one script because the second only makes sense
 * after the first.
 *
 * 1. REMOVE the 30 directory rows imported from prisma/clinics.json. Those are
 *    real Chennai and Kerala businesses that were stored as Doctor records —
 *    which was wrong twice over. They are companies, not practitioners, so
 *    they never belonged in a doctor directory; and carrying a rating, a fee
 *    and an availability grid we invented for them misrepresents real trading
 *    businesses. They come out.
 *
 * 2. CREATE a demo network under the BluDerma name. Invented clinics can hold
 *    invented numbers honestly, because nobody real is being described.
 *
 * The seeded network deliberately gives two practitioners three locations
 * each, with a morning session at one and an evening session at another on
 * the same weekday. That is the case the calendar and the travel buffer exist
 * to handle, so it needs to be present in dev data rather than imagined.
 *
 * Idempotent: clinics upsert on slug, links upsert on the composite key, and
 * a doctor's availability is rebuilt from scratch each run.
 *
 *   npx tsx prisma/seed-clinics.ts
 */
import { PrismaClient, ClinicPhotoKind } from "@prisma/client";

const prisma = new PrismaClient();

/** The avatar every imported business row carries. */
const IMPORTED_MARKER = "/brand/clinic-avatar.svg";

interface ClinicSeed {
  slug: string;
  name: string;
  addressLine1: string;
  area: string;
  city: string;
  state: string;
  pincode: string;
  lat: number;
  lng: number;
  phone: string;
  colorKey: string;
  about: string;
  facilities: string[];
}

/**
 * Coordinates are the real centre of each neighbourhood — the addresses are
 * invented, but "clinics near me" has to sort by something plausible or the
 * distance sort cannot be tested at all.
 */
const CLINICS: ClinicSeed[] = [
  {
    slug: "bluderma-aesthetics-nungambakkam",
    name: "BluDerma Aesthetics — Nungambakkam",
    addressLine1: "2nd Floor, 14 Sterling Road",
    area: "Nungambakkam",
    city: "Chennai",
    state: "Tamil Nadu",
    pincode: "600034",
    lat: 13.0604,
    lng: 80.2496,
    phone: "+91 44 4000 1201",
    colorKey: "blue",
    about:
      "The flagship. Six treatment rooms, two laser suites and the network's only on-site compounding pharmacy.",
    facilities: ["Parking", "Lift access", "Wheelchair access", "In-house pharmacy", "Lab collection"],
  },
  {
    slug: "bluderma-aesthetics-adyar",
    name: "BluDerma Aesthetics — Adyar",
    addressLine1: "31 Sardar Patel Road",
    area: "Adyar",
    city: "Chennai",
    state: "Tamil Nadu",
    pincode: "600020",
    lat: 13.0067,
    lng: 80.2572,
    phone: "+91 44 4000 1202",
    colorKey: "teal",
    about: "Evening-weighted clinic serving south Chennai, with late slots until 8pm on weekdays.",
    facilities: ["Parking", "Lift access", "Wheelchair access"],
  },
  {
    slug: "bluderma-skin-studio-anna-nagar",
    name: "BluDerma Skin Studio — Anna Nagar",
    addressLine1: "W-52, 3rd Avenue",
    area: "Anna Nagar",
    city: "Chennai",
    state: "Tamil Nadu",
    pincode: "600040",
    lat: 13.0878,
    lng: 80.2101,
    phone: "+91 44 4000 1203",
    colorKey: "violet",
    about: "Skin-only studio. No surgical work; consultations, peels, lasers and injectables.",
    facilities: ["Lift access", "Wheelchair access", "Card payment"],
  },
  {
    slug: "bluderma-skin-studio-indiranagar",
    name: "BluDerma Skin Studio — Indiranagar",
    addressLine1: "780 12th Main Road, HAL 2nd Stage",
    area: "Indiranagar",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560038",
    lat: 12.9784,
    lng: 77.6408,
    phone: "+91 80 4000 1204",
    colorKey: "emerald",
    about: "The Bengaluru flagship, and the network's teaching site for injectable technique.",
    facilities: ["Parking", "Lift access", "In-house pharmacy"],
  },
  {
    slug: "bluderma-care-koramangala",
    name: "BluDerma Care — Koramangala",
    addressLine1: "118 80 Feet Road, 4th Block",
    area: "Koramangala",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560034",
    lat: 12.9352,
    lng: 77.6245,
    phone: "+91 80 4000 1205",
    colorKey: "amber",
    about: "Weekend-heavy clinic built around working hours — open till 8pm Saturday.",
    facilities: ["Parking", "Wheelchair access", "Card payment"],
  },
  {
    slug: "bluderma-aesthetics-bandra",
    name: "BluDerma Aesthetics — Bandra West",
    addressLine1: "Ground Floor, 9 Turner Road",
    area: "Bandra West",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400050",
    lat: 19.0596,
    lng: 72.8295,
    phone: "+91 22 4000 1206",
    colorKey: "rose",
    about: "Mumbai's aesthetic surgery and laser centre.",
    facilities: ["Valet parking", "Lift access", "Wheelchair access", "Lab collection"],
  },
  {
    slug: "bluderma-laser-centre-jubilee-hills",
    name: "BluDerma Laser Centre — Jubilee Hills",
    addressLine1: "Plot 402, Road No. 36",
    area: "Jubilee Hills",
    city: "Hyderabad",
    state: "Telangana",
    pincode: "500033",
    lat: 17.4326,
    lng: 78.4071,
    phone: "+91 40 4000 1207",
    colorKey: "indigo",
    about: "Device-led clinic: six laser platforms, RF microneedling and body contouring.",
    facilities: ["Parking", "Lift access", "Card payment"],
  },
  {
    slug: "bluderma-care-koregaon-park",
    name: "BluDerma Care — Koregaon Park",
    addressLine1: "5 Lane 7, North Main Road",
    area: "Koregaon Park",
    city: "Pune",
    state: "Maharashtra",
    pincode: "411001",
    lat: 18.5362,
    lng: 73.8939,
    phone: "+91 20 4000 1208",
    colorKey: "orange",
    about: "General dermatology and hair restoration for west Pune.",
    facilities: ["Parking", "Wheelchair access"],
  },
  {
    slug: "bluderma-skin-studio-greater-kailash",
    name: "BluDerma Skin Studio — Greater Kailash",
    addressLine1: "M-24, GK-1 Main Market",
    area: "Greater Kailash",
    city: "New Delhi",
    state: "Delhi",
    pincode: "110048",
    lat: 28.5494,
    lng: 77.2426,
    phone: "+91 11 4000 1209",
    colorKey: "sky",
    about: "North India flagship. Pigmentation and acne-scar work is the bulk of the list.",
    facilities: ["Parking", "Lift access", "Wheelchair access", "In-house pharmacy"],
  },
];

/**
 * Which practitioner works where.
 *
 * `days` is JS getDay(): 0 = Sunday. Two doctors deliberately hold a morning
 * session at one clinic and an evening session at another on the SAME
 * weekday — the travel-buffer case.
 */
interface PracticeSeed {
  doctorSlug: string;
  /** First entry is the primary clinic — the one shown on their card. */
  practices: {
    clinicSlug: string;
    feeInr: number;
    days: number[];
    startTime: string;
    endTime: string;
    slotMinutes: number;
  }[];
  travelBufferMin: number;
}

const PRACTICES: PracticeSeed[] = [
  {
    // Three locations across Chennai — the full multi-clinic case.
    doctorSlug: "meera-iyer",
    travelBufferMin: 45,
    practices: [
      { clinicSlug: "bluderma-aesthetics-nungambakkam", feeInr: 1200, days: [1, 3, 5], startTime: "09:30", endTime: "13:00", slotMinutes: 30 },
      { clinicSlug: "bluderma-aesthetics-adyar", feeInr: 1000, days: [1, 3, 5], startTime: "17:00", endTime: "20:00", slotMinutes: 30 },
      { clinicSlug: "bluderma-skin-studio-anna-nagar", feeInr: 900, days: [2, 4], startTime: "10:00", endTime: "14:00", slotMinutes: 20 },
    ],
  },
  {
    // Three locations across Bengaluru.
    doctorSlug: "aarti-menon",
    travelBufferMin: 40,
    practices: [
      { clinicSlug: "bluderma-skin-studio-indiranagar", feeInr: 1500, days: [1, 2, 4], startTime: "10:00", endTime: "13:30", slotMinutes: 30 },
      { clinicSlug: "bluderma-care-koramangala", feeInr: 1200, days: [1, 4], startTime: "16:00", endTime: "19:30", slotMinutes: 30 },
      { clinicSlug: "bluderma-aesthetics-nungambakkam", feeInr: 1800, days: [6], startTime: "09:00", endTime: "13:00", slotMinutes: 45 },
    ],
  },
  {
    doctorSlug: "vikram-rao",
    travelBufferMin: 30,
    practices: [
      { clinicSlug: "bluderma-care-koramangala", feeInr: 1100, days: [1, 2, 3, 4, 5], startTime: "09:00", endTime: "13:00", slotMinutes: 30 },
      { clinicSlug: "bluderma-skin-studio-indiranagar", feeInr: 1300, days: [6], startTime: "10:00", endTime: "14:00", slotMinutes: 30 },
    ],
  },
  {
    doctorSlug: "rohan-verma",
    travelBufferMin: 0,
    practices: [
      { clinicSlug: "bluderma-aesthetics-bandra", feeInr: 2000, days: [1, 2, 3, 4, 5], startTime: "10:00", endTime: "17:00", slotMinutes: 30 },
    ],
  },
  {
    doctorSlug: "ananya-nair",
    travelBufferMin: 0,
    practices: [
      { clinicSlug: "bluderma-laser-centre-jubilee-hills", feeInr: 1400, days: [1, 2, 3, 4, 5, 6], startTime: "10:00", endTime: "18:00", slotMinutes: 30 },
    ],
  },
  {
    doctorSlug: "karan-malhotra",
    travelBufferMin: 0,
    practices: [
      { clinicSlug: "bluderma-care-koregaon-park", feeInr: 900, days: [1, 2, 3, 4, 5], startTime: "09:30", endTime: "16:30", slotMinutes: 30 },
    ],
  },
  {
    doctorSlug: "sneha-kapoor",
    travelBufferMin: 0,
    practices: [
      { clinicSlug: "bluderma-skin-studio-greater-kailash", feeInr: 1600, days: [1, 2, 3, 4, 5], startTime: "11:00", endTime: "18:00", slotMinutes: 30 },
    ],
  },
];

async function purgeImported() {
  const rows = await prisma.doctor.findMany({
    where: { image: IMPORTED_MARKER },
    select: { id: true, name: true, _count: { select: { appointments: true } } },
  });
  if (rows.length === 0) {
    console.log("purge: nothing to remove");
    return;
  }

  // A doctor row with appointments cannot simply be deleted — Appointment
  // requires its doctor. None of the imported rows was ever bookable, but
  // check rather than assume, and stop loudly if that changed.
  const booked = rows.filter((r) => r._count.appointments > 0);
  if (booked.length > 0) {
    throw new Error(
      `Refusing to delete: ${booked.length} imported rows have appointments ` +
        `(${booked.map((b) => b.name).join(", ")}). Move those bookings first.`
    );
  }

  const ids = rows.map((r) => r.id);
  const del = await prisma.doctor.deleteMany({ where: { id: { in: ids } } });
  console.log(`purge: removed ${del.count} imported business rows`);
}

async function seedClinics() {
  for (const [i, c] of CLINICS.entries()) {
    const { facilities, ...data } = c;
    const clinic = await prisma.clinic.upsert({
      where: { slug: c.slug },
      update: { ...data, sortOrder: i },
      create: { ...data, sortOrder: i },
    });

    for (const [j, name] of facilities.entries()) {
      await prisma.clinicFacility.upsert({
        where: { clinicId_name: { clinicId: clinic.id, name } },
        update: { sortOrder: j },
        create: { clinicId: clinic.id, name, sortOrder: j },
      });
    }

    // Premises photography. The onboarding wizard asks every new clinic for
    // these, so the demo network needs them too or the cards look broken.
    //
    // No EXTERIOR is seeded on purpose: there is no building photograph in the
    // stock set, and labelling a treatment-room shot as a shopfront would be a
    // lie in the data. The gap also exercises the missing-photo state, which
    // every real clinic will hit before it uploads one.
    const photos = [
      { kind: ClinicPhotoKind.INTERIOR, url: "/images/treatments/photo-1781513144825-aa1e284c5950.jpg", alt: `${c.name} reception` },
      { kind: ClinicPhotoKind.ROOM, url: "/images/treatments/photo-1552256031-811fa8f0a7b1.jpg", alt: `${c.name} treatment room` },
    ];
    const existing = await prisma.clinicPhoto.count({ where: { clinicId: clinic.id } });
    if (existing === 0) {
      await prisma.clinicPhoto.createMany({
        data: photos.map((p, k) => ({ ...p, clinicId: clinic.id, sortOrder: k })),
      });
    }
  }
  console.log(`clinics: ${CLINICS.length} upserted`);
}

async function seedPractices() {
  let links = 0;
  let windows = 0;

  for (const p of PRACTICES) {
    const doctor = await prisma.doctor.findUnique({
      where: { slug: p.doctorSlug },
      select: { id: true },
    });
    if (!doctor) {
      console.log(`  skip ${p.doctorSlug} — no such doctor`);
      continue;
    }

    // Rebuild rather than diff. Availability rows predating multi-clinic have
    // a null clinicId and no longer mean anything; leaving them would put
    // phantom slots on the calendar at no location at all.
    await prisma.doctorAvailability.deleteMany({ where: { doctorId: doctor.id } });

    await prisma.doctor.update({
      where: { id: doctor.id },
      data: { travelBufferMin: p.travelBufferMin },
    });

    for (const [i, prac] of p.practices.entries()) {
      const clinic = await prisma.clinic.findUnique({
        where: { slug: prac.clinicSlug },
        select: { id: true, name: true, area: true, city: true },
      });
      if (!clinic) throw new Error(`No clinic ${prac.clinicSlug}`);

      const isPrimary = i === 0;
      await prisma.doctorClinic.upsert({
        where: { doctorId_clinicId: { doctorId: doctor.id, clinicId: clinic.id } },
        update: { feeInr: prac.feeInr, isPrimary, sortOrder: i, isActive: true },
        create: {
          doctorId: doctor.id,
          clinicId: clinic.id,
          feeInr: prac.feeInr,
          isPrimary,
          sortOrder: i,
        },
      });
      links += 1;

      // Doctor.clinic / Doctor.location are denormalised display strings that
      // a great deal of UI still reads. Keep them pointing at the primary.
      if (isPrimary) {
        await prisma.doctor.update({
          where: { id: doctor.id },
          data: { clinic: clinic.name, location: clinic.city, fee: prac.feeInr },
        });
      }

      for (const day of prac.days) {
        await prisma.doctorAvailability.create({
          data: {
            doctorId: doctor.id,
            clinicId: clinic.id,
            dayOfWeek: day,
            startTime: prac.startTime,
            endTime: prac.endTime,
            slotMinutes: prac.slotMinutes,
          },
        });
        windows += 1;
      }
    }
  }

  console.log(`practices: ${links} doctor-clinic links, ${windows} weekly windows`);
}

async function main() {
  await purgeImported();
  await seedClinics();
  await seedPractices();

  const orphaned = await prisma.doctorAvailability.count({ where: { clinicId: null } });
  if (orphaned > 0) {
    console.log(`\nWARNING: ${orphaned} availability rows still have no clinic.`);
  }

  console.log("\ndone.");
  console.log("  doctors :", await prisma.doctor.count());
  console.log("  clinics :", await prisma.clinic.count());
  console.log("  links   :", await prisma.doctorClinic.count());
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
