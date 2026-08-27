/**
 * What a clinic has, offered as a picker rather than asked for as a sentence.
 *
 * ── What this replaces ───────────────────────────────────────────────────
 * A textarea with the placeholder "Parking, Lift access, Wheelchair access,
 * In-house pharmacy" and the instruction "comma separated". Three things went
 * wrong with it every time. Practitioners typed two or three items and moved
 * on, because recalling a list from memory is work and the field did not look
 * important. Everyone spelled things differently — "car parking", "Parking
 * available", "parking (free)" — so nothing could ever be filtered or
 * compared across clinics. And the equipment a clinic owns, which is the most
 * persuasive thing on the whole page for an aesthetics patient, was never
 * mentioned at all because the placeholder never suggested it.
 *
 * So: a grouped, curated list you tap through, with the equipment section
 * present precisely because nobody thinks to type it. Anything not here can
 * still be typed — the custom entry is a first-class part of this, not a
 * fallback — and it is stored with a null category.
 *
 * ── Why not an enum ──────────────────────────────────────────────────────
 * ClinicFacility.name stays free text. This file is a suggestion list that a
 * content edit can grow; an enum would need a migration to add "valet", and
 * the moment one clinic has something genuinely unusual the enum is a wall.
 */

export type FacilityCategory =
  | "ACCESS"
  | "COMFORT"
  | "CLINICAL"
  | "EQUIPMENT"
  | "PAYMENT";

export interface FacilityGroup {
  category: FacilityCategory;
  label: string;
  /** One line saying what belongs here, shown above the chips. */
  hint: string;
  items: string[];
}

export const FACILITY_GROUPS: FacilityGroup[] = [
  {
    category: "ACCESS",
    label: "Parking and access",
    hint: "How a patient reaches you and gets inside. All optional.",
    items: [
      "Free parking",
      "Paid parking",
      "Valet parking",
      "Two-wheeler parking",
      "Lift access",
      "Wheelchair access",
      "Step-free entrance",
      "Accessible toilet",
      "Ground floor",
      "On a main road",
      "Near a metro station",
      "Near a bus stop",
      "Ambulance access",
    ],
  },
  {
    category: "COMFORT",
    label: "Waiting area and comfort",
    hint: "What the wait is like. All optional.",
    items: [
      "Air conditioned",
      "Separate waiting area",
      "Private consultation room",
      "Women-only hours",
      "Female attendant available",
      "Changing room",
      "Drinking water",
      "Wi-Fi",
      "Children's play area",
      "Attached washroom",
      "Prayer room",
      "Refreshments",
    ],
  },
  {
    category: "CLINICAL",
    label: "Services at this clinic",
    hint: "What a patient can have done here without going elsewhere.",
    items: [
      "In-house pharmacy",
      "Sample collection for labs",
      "On-site laboratory",
      "Minor procedure room",
      "Day-care recovery room",
      "Dermatopathology tie-up",
      "Patch testing",
      "Dermoscopy",
      "Trichoscopy",
      "Skin biopsy",
      "Cryotherapy",
      "Phototherapy",
      "Emergency crash cart",
      "Sterilisation and autoclave",
      "Teleconsultation room",
    ],
  },
  {
    category: "EQUIPMENT",
    label: "Machines and equipment",
    hint: "The lasers and devices you have on site. Patients read this one hardest.",
    items: [
      "Fractional CO2 laser",
      "Er:YAG laser",
      "Q-switched Nd:YAG laser",
      "Pico laser",
      "Diode laser hair removal",
      "Alexandrite laser",
      "Long-pulsed Nd:YAG",
      "IPL / photofacial",
      "Excimer lamp",
      "NB-UVB chamber",
      "Radiofrequency microneedling",
      "Microneedling pen",
      "HIFU",
      "Monopolar radiofrequency",
      "Cryolipolysis",
      "Hydrafacial system",
      "Microdermabrasion",
      "Chemical peel bar",
      "Electrocautery / radiofrequency cautery",
      "Hair transplant suite",
      "PRP centrifuge",
      "Vampire facial setup",
      "Body contouring platform",
      "LED phototherapy panel",
      "Digital skin analyser",
      "Clinical photography setup",
      "Dermatoscope",
      "Wood's lamp",
      "Operating microscope",
      "Ultrasound skin scanner",
    ],
  },
  {
    category: "PAYMENT",
    label: "Payment options",
    hint: "How a patient can pay you.",
    items: [
      "Card payment",
      "UPI",
      "Cash",
      "Net banking",
      "EMI available",
      "Insurance accepted",
      "Cashless TPA",
      "GST invoice",
      "Corporate billing",
    ],
  },
];

/** Every suggested facility, flattened. For validating a submitted set. */
export const ALL_FACILITIES = FACILITY_GROUPS.flatMap((g) => g.items);

/** The group a suggested facility came from, or null if the doctor typed it. */
export function categoryOf(name: string): FacilityCategory | null {
  const needle = name.trim().toLowerCase();
  for (const g of FACILITY_GROUPS) {
    if (g.items.some((i) => i.toLowerCase() === needle)) return g.category;
  }
  return null;
}

export const CATEGORY_LABEL: Record<FacilityCategory, string> = {
  ACCESS: "Access",
  COMFORT: "Comfort",
  CLINICAL: "Clinical services",
  EQUIPMENT: "Equipment",
  PAYMENT: "Payment",
};

/**
 * The old flat list, kept because the seed data and a couple of admin screens
 * still reference it. Everything in it appears in a group above.
 */
export const COMMON_FACILITIES = [
  "Free parking",
  "Lift access",
  "Wheelchair access",
  "In-house pharmacy",
  "Sample collection for labs",
  "Card payment",
  "Valet parking",
];
