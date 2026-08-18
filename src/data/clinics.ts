import { IMG } from "./hubImages";

/**
 * Partner clinics suggested at the end of the intake flow (C-38).
 *
 * Note the deliberate scope: clinic names never appear on a treatment or a
 * deal card (G-2). They appear here, and only here, because the client has
 * finished the questionnaire and is choosing where to be seen.
 *
 * Static for the approval build — the real list comes from the doctor/clinic
 * tables once the backend is signed off.
 */

export interface PartnerClinic {
  slug: string;
  name: string;
  area: string;
  city: string;
  /** Straight-line distance shown when we know the client's city. */
  distanceKm: number;
  image: string;
  facilities: string[];
  homeVisit: boolean;
  openToday: string;
}

export const PARTNER_CLINICS: PartnerClinic[] = [
  {
    slug: "bd-anna-nagar",
    name: "BluDerma Skin Studio",
    area: "Anna Nagar",
    city: "Chennai",
    distanceKm: 3.2,
    image: IMG.clinic6,
    facilities: ["Laser suite", "Minor OT", "Wheelchair access"],
    homeVisit: true,
    openToday: "9:00am – 8:00pm",
  },
  {
    slug: "bd-alwarpet",
    name: "BluDerma Aesthetics",
    area: "Alwarpet",
    city: "Chennai",
    distanceKm: 6.8,
    image: IMG.clinic2,
    facilities: ["Injectables bar", "Day care", "Parking"],
    homeVisit: true,
    openToday: "10:00am – 7:30pm",
  },
  {
    slug: "bd-indiranagar",
    name: "BluDerma Derm & Laser",
    area: "Indiranagar",
    city: "Bengaluru",
    distanceKm: 4.1,
    image: IMG.clinic3,
    facilities: ["Laser suite", "Hair transplant OT"],
    homeVisit: false,
    openToday: "9:30am – 7:00pm",
  },
  {
    slug: "bd-jubilee",
    name: "BluDerma Advanced Skin",
    area: "Jubilee Hills",
    city: "Hyderabad",
    distanceKm: 5.5,
    image: IMG.clinic4,
    facilities: ["Body contouring", "IV lounge", "Parking"],
    homeVisit: true,
    openToday: "10:00am – 8:00pm",
  },
  {
    slug: "bd-bandra",
    name: "BluDerma Aesthetic Clinic",
    area: "Bandra West",
    city: "Mumbai",
    distanceKm: 2.9,
    image: IMG.clinic5,
    facilities: ["Laser suite", "Minor OT"],
    homeVisit: true,
    openToday: "11:00am – 8:00pm",
  },
  {
    slug: "bd-kochi",
    name: "BluDerma Skin & Hair",
    area: "Panampilly Nagar",
    city: "Kochi",
    distanceKm: 7.4,
    image: IMG.clinic1,
    facilities: ["Hair restoration", "Day care"],
    homeVisit: false,
    openToday: "9:00am – 6:30pm",
  },
];

/**
 * Clinics nearest a client. Falls back to the full list when the city is
 * unknown, so the section is never empty on a first visit.
 */
export function clinicsNear(city?: string | null, limit = 3): PartnerClinic[] {
  if (!city) return PARTNER_CLINICS.slice(0, limit);
  const needle = city.trim().toLowerCase();
  const local = PARTNER_CLINICS.filter((c) =>
    c.city.toLowerCase().includes(needle)
  );
  const rest = PARTNER_CLINICS.filter((c) => !local.includes(c));
  return [...local, ...rest].slice(0, limit);
}
