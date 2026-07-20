import { MetricKey, seedFromString } from "./skin";

export type ConsultMode = "clinic" | "video";

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
}

const U = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=600&q=80`;

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
    image: U("photo-1659353888906-adb3e0041693"),
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
    image: U("photo-1637059824899-a441006a6875"),
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
    image: U("photo-1673865641073-4479f93a7776"),
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
    image: U("photo-1645066928295-2506defde470"),
    fee: 700,
    languages: ["English", "Hindi"],
    services: ["Skin boosters", "Barrier repair", "Rosacea care"],
    modes: ["clinic", "video"],
    about:
      "Focuses on dry, sensitive and reactive skin — rebuilding a resilient barrier before targeted treatment.",
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
    image: U("photo-1643297654416-05795d62e39c"),
    fee: 1000,
    languages: ["English", "Tamil", "Hindi"],
    services: ["Under-eye fillers", "PRP", "Skin boosters"],
    modes: ["clinic"],
    about:
      "Rejuvenation specialist for tired eyes — dark circles, hollows and puffiness with subtle, refreshed results.",
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
    image: U("photo-1594824476967-48c8b964273f"),
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
    image: U("photo-1642975967602-653d378f3b5b"),
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
export function suggestDoctors(topConcerns: MetricKey[], count = 4): Doctor[] {
  const scored = doctors.map((d) => {
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
    const gen = doctors.find((d) => d.general);
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

/** Deterministic slot list for a doctor on a given day (9:00–18:00, 30-min). */
export function slotsForDoctor(doctorId: string, daySeed: string): Slot[] {
  const seed = seedFromString(doctorId + "|" + daySeed);
  const slots: Slot[] = [];
  let n = seed;
  const next = () => {
    n = (n * 1103515245 + 12345) & 0x7fffffff;
    return n / 0x7fffffff;
  };
  for (let h = 9; h <= 17; h++) {
    for (const m of [0, 30]) {
      const label = `${String(h).padStart(2, "0")}:${m === 0 ? "00" : "30"}`;
      const period: Slot["period"] =
        h < 12 ? "Morning" : h < 16 ? "Afternoon" : "Evening";
      slots.push({ label, available: next() > 0.42, period });
    }
  }
  return slots;
}

/** First available slot label for a doctor on a day, or null. */
export function nextAvailable(doctorId: string, daySeed: string): string | null {
  const s = slotsForDoctor(doctorId, daySeed).find((x) => x.available);
  return s ? s.label : null;
}

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
