import { MetricKey, seedFromString } from "./skin";
import { assetUrl } from "@/lib/assetUrl";

export type ConsultMode = "clinic" | "video";

export interface DoctorClinic {
  id: string;
  name: string;
  area: string;
  city: string;
  feeInr: number;
  isPrimary: boolean;
}

export interface Doctor {
  id: string;
  name: string;
  title: string;
  specialty: string;
  /** Concerns this doctor focuses on — used to match analysis results. */
  focus: MetricKey[];
  rating: number;
  reviews: number;
  experienceYears: number;
  clinic: string;
  location: string;
  image: string;
  fee: number;
  languages: string[];
  services: string[];
  modes: ConsultMode[];
  about: string;
  verified: boolean;
  general?: boolean;
  /** Locations this doctor consults at. The booking form must send the
   *  chosen one — see the note on DoctorClinicDTO. */
  clinics?: DoctorClinic[];
}

// Resolved through assetUrl so these follow the rest of the imagery to S3;
// with no asset base configured they stay exactly as they were.
const DOCTOR_IMAGE = {
  female1: assetUrl("/images/korean/doctor-female-1-v2.png"),
  female2: assetUrl("/images/korean/doctor-female-2-v2.png"),
  female3: assetUrl("/images/korean/doctor-female-3-v2.png"),
  female4: assetUrl("/images/korean/doctor-female-4-v2.png"),
  male1: assetUrl("/images/korean/doctor-male-1-v2.png"),
  male2: assetUrl("/images/korean/doctor-male-2-v2.png"),
  male3: assetUrl("/images/korean/doctor-male-3-v2.png"),
} as const;

export const doctors: Doctor[] = [
  {
    id: "aarti-menon",
    name: "Dr. Aarti Menon",
    title: "MD, Dermatology",
    specialty: "Acne & Oil Control",
    focus: ["acne", "oiliness", "pores", "texture"],
    rating: 4.9,
    reviews: 412,
    experienceYears: 12,
    clinic: "BluDerma Skin Studio",
    location: "Bengaluru",
    image: DOCTOR_IMAGE.female3,
    fee: 800,
    languages: ["English", "Hindi", "Kannada"],
    services: ["Acne treatment", "Chemical peels", "Microneedling"],
    modes: ["clinic", "video"],
    about:
      "Acne and oily-skin specialist focused on clearing active breakouts and preventing scarring with barrier-safe protocols.",
    verified: true,
  },
  {
    id: "rohan-verma",
    name: "Dr. Rohan Verma",
    title: "MD, Aesthetic Dermatology",
    specialty: "Anti-Ageing & Firmness",
    focus: ["wrinkles", "firmness", "radiance"],
    rating: 4.8,
    reviews: 356,
    experienceYears: 15,
    clinic: "BluDerma Aesthetics",
    location: "Mumbai",
    image: DOCTOR_IMAGE.male1,
    fee: 1200,
    languages: ["English", "Hindi", "Marathi"],
    services: ["Anti-wrinkle", "Dermal fillers", "Thread lift", "HIFU"],
    modes: ["clinic", "video"],
    about:
      "Aesthetic dermatologist known for natural-looking anti-ageing results using injectables and energy devices.",
    verified: true,
  },
  {
    id: "sneha-kapoor",
    name: "Dr. Sneha Kapoor",
    title: "MD, Dermatology",
    specialty: "Pigmentation & Brightening",
    focus: ["ageSpots", "radiance", "redness"],
    rating: 4.9,
    reviews: 298,
    experienceYears: 10,
    clinic: "BluDerma Skin Studio",
    location: "Delhi",
    image: DOCTOR_IMAGE.female4,
    fee: 900,
    languages: ["English", "Hindi", "Punjabi"],
    services: ["Pigmentation", "Laser toning", "Melasma care"],
    modes: ["clinic", "video"],
    about:
      "Pigmentation expert with a gentle, relapse-aware approach to brightening and even tone across skin types.",
    verified: true,
  },
  {
    id: "karan-malhotra",
    name: "Dr. Karan Malhotra",
    title: "MD, Clinical Dermatology",
    specialty: "Hydration & Barrier Repair",
    focus: ["hydration", "texture", "redness"],
    rating: 4.7,
    reviews: 221,
    experienceYears: 9,
    clinic: "BluDerma Care",
    location: "Pune",
    image: DOCTOR_IMAGE.male2,
    fee: 700,
    languages: ["English", "Hindi"],
    services: ["Skin boosters", "Barrier repair", "Rosacea care"],
    modes: ["clinic", "video"],
    about:
      "Focuses on dry, sensitive and reactive skin, rebuilding a resilient barrier before targeted treatment.",
    verified: true,
  },
  {
    id: "meera-iyer",
    name: "Dr. Meera Iyer",
    title: "MD, Dermatology",
    specialty: "Under-Eye & Rejuvenation",
    focus: ["darkCircles", "eyeBags", "wrinkles"],
    rating: 4.8,
    reviews: 187,
    experienceYears: 11,
    clinic: "BluDerma Aesthetics",
    location: "Chennai",
    image: DOCTOR_IMAGE.female1,
    fee: 1000,
    languages: ["English", "Tamil", "Hindi"],
    services: ["Under-eye fillers", "PRP", "Skin boosters"],
    modes: ["clinic"],
    about:
      "Rejuvenation specialist for tired eyes, dark circles, hollows and puffiness with subtle, refreshed results.",
    verified: true,
  },
  {
    id: "ananya-nair",
    name: "Dr. Ananya Nair",
    title: "MD, Laser Dermatology",
    specialty: "Laser & Resurfacing",
    focus: ["pores", "texture", "ageSpots", "acne"],
    rating: 4.9,
    reviews: 264,
    experienceYears: 13,
    clinic: "BluDerma Laser Centre",
    location: "Hyderabad",
    image: DOCTOR_IMAGE.female2,
    fee: 1100,
    languages: ["English", "Telugu", "Hindi"],
    services: ["Laser resurfacing", "Scar revision", "Pore refining"],
    modes: ["clinic", "video"],
    about:
      "Laser and resurfacing expert improving texture, scars and pores across a full range of skin tones.",
    verified: true,
  },
  {
    id: "vikram-rao",
    name: "Dr. Vikram Rao",
    title: "MD, General Dermatology",
    specialty: "General Skin Health",
    focus: [
      "acne",
      "wrinkles",
      "pores",
      "hydration",
      "redness",
      "radiance",
      "texture",
    ],
    rating: 4.7,
    reviews: 503,
    experienceYears: 18,
    clinic: "BluDerma Care",
    location: "Bengaluru",
    image: DOCTOR_IMAGE.male3,
    fee: 600,
    languages: ["English", "Hindi", "Kannada", "Telugu"],
    services: ["Full skin check", "Acne", "General dermatology"],
    modes: ["clinic", "video"],
    about:
      "Experienced generalist for a complete skin assessment and a personalised plan across any concern.",
    verified: true,
    general: true,
  },
];

/**
 * Suggest doctors for a given analysis: rank by how well their focus overlaps
 * the patient's top concerns, always keeping a general dermatologist on the list.
 */
export function suggestDoctors(
  pool: Doctor[],
  topConcerns: MetricKey[],
  count = 4
): Doctor[] {
  const scored = pool.map((d) => {
    let score = 0;
    topConcerns.forEach((c, i) => {
      if (d.focus.includes(c)) score += (topConcerns.length - i) * 2;
    });
    if (d.general) score += 1;
    score += d.rating;
    return { d, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const picked = scored.slice(0, count).map((s) => s.d);
  if (!picked.some((d) => d.general)) {
    const gen = pool.find((d) => d.general);
    if (gen) picked[picked.length - 1] = gen;
  }
  return picked;
}

/** Count how many of a doctor's focus areas match the patient's top concerns. */
export function matchStrength(doctor: Doctor, topConcerns: MetricKey[]): number {
  return topConcerns.filter((c) => doctor.focus.includes(c)).length;
}

export interface Slot {
  label: string;
  available: boolean;
  period: "Morning" | "Afternoon" | "Evening";
}

/*
 * slotsForDoctor() and nextAvailable() were removed on 19 Aug 2026.
 *
 * They were a seeded linear-congruential generator: a hash of the doctor's
 * slug decided which half-hour slots were "free". Those invented times were
 * rendered on doctor cards as "Free today", and on the intake result and the
 * analyzer as "Next free 10:30" — against real practitioners, immediately
 * before a real booking. Doctors with no calendar at all showed availability;
 * doctors who were completely free showed "Fully booked today".
 *
 * Real availability comes from the doctor's DoctorAvailability rows, minus
 * bookings, time off and travel between clinics:
 *
 *   one doctor, one day   ->  GET /api/doctors/[slug]/slots
 *   many doctors at once  ->  GET /api/doctors/availability  (useDoctorAvailability)
 *
 * The `Slot` interface above is kept because the real API returns the same
 * shape. Do not reintroduce a generator here.
 */

export interface DayOption {
  daySeed: string;
  label: string; // "Today", "Tomorrow", weekday
  sub: string; // "16 Jun"
}

/** Build the next `count` day options starting today (labels computed client-side). */
export function buildDayOptions(base: Date, count = 5): DayOption[] {
  const out: DayOption[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const daySeed = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(d.getDate()).padStart(2, "0")}`;
    const label =
      i === 0
        ? "Today"
        : i === 1
        ? "Tomorrow"
        : d.toLocaleDateString(undefined, { weekday: "short" });
    const sub = d.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
    });
    out.push({ daySeed, label, sub });
  }
  return out;
}
