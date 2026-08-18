import { IMG } from "./hubImages";

/**
 * The client's own record, as My Profile shows it.
 *
 * Static for the approval build. Every one of these lists is a real table
 * once the backend is switched on — analyses, appointments, prescriptions,
 * orders, procedures and redemptions — so the shape here is the shape the
 * queries will return, not a mock invented for the page.
 *
 * Note this is the one place amounts appear outside the three the brief
 * allows (G-3). A person's own receipt has to say what they paid; the rule
 * is about the catalogue, not about their own history. Flagged for the
 * client rather than assumed.
 */

export interface SkinReport {
  id: string;
  date: string;
  score: number;
  skinType: string;
  topConcerns: string[];
}

export interface AppointmentRecord {
  id: string;
  doctor: string;
  specialty: string;
  date: string;
  time: string;
  mode: "In clinic" | "Video" | "Home visit";
  status: "Upcoming" | "Completed" | "Cancelled";
}

export interface ConsultedDoctor {
  id: string;
  name: string;
  specialty: string;
  image: string;
  visits: number;
  lastSeen: string;
}

export interface Prescription {
  id: string;
  issued: string;
  doctor: string;
  items: string[];
  validTill: string;
}

export interface Purchase {
  id: string;
  date: string;
  item: string;
  kind: "Product" | "Package";
  amount: number;
  status: "Delivered" | "Shipped" | "Processing";
}

export interface ProcedureRecord {
  id: string;
  name: string;
  category: string;
  date: string;
  sessions: string;
  doctor: string;
}

export interface DiscountRecord {
  id: string;
  label: string;
  detail: string;
  usedOn: string;
  saved: string;
}

export const CLIENT = {
  name: "Ananya Rao",
  since: "March 2026",
  city: "Chennai",
  skinType: "Combination · sensitive",
};

export const SKIN_REPORTS: SkinReport[] = [
  {
    id: "sr-4",
    date: "2 Aug 2026",
    score: 82,
    skinType: "Combination",
    topConcerns: ["Pores", "Dark circles", "Texture"],
  },
  {
    id: "sr-3",
    date: "14 Jun 2026",
    score: 76,
    skinType: "Combination · sensitive",
    topConcerns: ["Acne", "Redness", "Pores"],
  },
  {
    id: "sr-2",
    date: "9 Apr 2026",
    score: 71,
    skinType: "Oily",
    topConcerns: ["Acne", "Oiliness", "Texture"],
  },
];

export const APPOINTMENTS: AppointmentRecord[] = [
  {
    id: "ap-5",
    doctor: "Dr. Meera Iyer",
    specialty: "Under-Eye & Rejuvenation",
    date: "19 Aug 2026",
    time: "11:30",
    mode: "In clinic",
    status: "Upcoming",
  },
  {
    id: "ap-4",
    doctor: "Dr. Aarti Menon",
    specialty: "Acne & Oil Control",
    date: "27 Jul 2026",
    time: "16:00",
    mode: "Video",
    status: "Completed",
  },
  {
    id: "ap-3",
    doctor: "Dr. Aarti Menon",
    specialty: "Acne & Oil Control",
    date: "12 Jun 2026",
    time: "10:00",
    mode: "In clinic",
    status: "Completed",
  },
  {
    id: "ap-2",
    doctor: "Dr. Sneha Kapoor",
    specialty: "Pigmentation & Brightening",
    date: "3 May 2026",
    time: "18:30",
    mode: "Home visit",
    status: "Cancelled",
  },
];

export const CONSULTED_DOCTORS: ConsultedDoctor[] = [
  {
    id: "aarti-menon",
    name: "Dr. Aarti Menon",
    specialty: "Acne & Oil Control",
    image: IMG.portraitSmile,
    visits: 3,
    lastSeen: "27 Jul 2026",
  },
  {
    id: "meera-iyer",
    name: "Dr. Meera Iyer",
    specialty: "Under-Eye & Rejuvenation",
    image: IMG.portraitGlow,
    visits: 1,
    lastSeen: "Upcoming 19 Aug",
  },
  {
    id: "sneha-kapoor",
    name: "Dr. Sneha Kapoor",
    specialty: "Pigmentation & Brightening",
    image: IMG.portraitCream,
    visits: 1,
    lastSeen: "18 Apr 2026",
  },
];

export const PRESCRIPTIONS: Prescription[] = [
  {
    id: "rx-3",
    issued: "27 Jul 2026",
    doctor: "Dr. Aarti Menon",
    items: [
      "Adapalene 0.1% gel — nightly, alternate days for 2 weeks",
      "Niacinamide 10% serum — morning",
      "Broad-spectrum SPF 50 — every morning, reapplied",
    ],
    validTill: "27 Oct 2026",
  },
  {
    id: "rx-2",
    issued: "12 Jun 2026",
    doctor: "Dr. Aarti Menon",
    items: [
      "Benzoyl peroxide 2.5% — short contact, alternate evenings",
      "Ceramide barrier cream — twice daily",
    ],
    validTill: "12 Sep 2026",
  },
];

export const PURCHASES: Purchase[] = [
  {
    id: "or-6",
    date: "29 Jul 2026",
    item: "Barrier repair cream · 50ml",
    kind: "Product",
    amount: 1450,
    status: "Delivered",
  },
  {
    id: "or-5",
    date: "29 Jul 2026",
    item: "Mineral sunscreen SPF 50 · 50ml",
    kind: "Product",
    amount: 1190,
    status: "Delivered",
  },
  {
    id: "or-4",
    date: "14 Jun 2026",
    item: "Medi-facial course · 3 sessions",
    kind: "Package",
    amount: 11400,
    status: "Delivered",
  },
  {
    id: "or-3",
    date: "2 Aug 2026",
    item: "Gentle foaming cleanser · 150ml",
    kind: "Product",
    amount: 890,
    status: "Shipped",
  },
];

export const PROCEDURES: ProcedureRecord[] = [
  {
    id: "pr-3",
    name: "Medi-Facial (Hydra)",
    category: "Glass Skin & Glow",
    date: "26 Jul 2026",
    sessions: "3 of 3 complete",
    doctor: "Dr. Aarti Menon",
  },
  {
    id: "pr-2",
    name: "Chemical Peel — superficial",
    category: "Acne & Scars",
    date: "12 Jun 2026",
    sessions: "2 of 4 complete",
    doctor: "Dr. Aarti Menon",
  },
  {
    id: "pr-1",
    name: "Laser Toning",
    category: "Pigmentation & Melasma",
    date: "18 Apr 2026",
    sessions: "1 of 6 complete",
    doctor: "Dr. Sneha Kapoor",
  },
];

export const DISCOUNTS: DiscountRecord[] = [
  {
    id: "dc-3",
    label: "First scan free",
    detail: "Launch offer on your first AI skin analysis",
    usedOn: "9 Apr 2026",
    saved: "100%",
  },
  {
    id: "dc-2",
    label: "Medi-facial course",
    detail: "Fortnight offer — 3-session bundle",
    usedOn: "14 Jun 2026",
    saved: "25%",
  },
  {
    id: "dc-1",
    label: "Home-care bundle",
    detail: "Cleanser and sunscreen bought together",
    usedOn: "29 Jul 2026",
    saved: "15%",
  },
];
