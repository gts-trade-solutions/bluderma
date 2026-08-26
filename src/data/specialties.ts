/**
 * The specialties an Indian dermatology practitioner is most likely to list.
 *
 * A convenience, not a whitelist — exactly like MEDICAL_COUNCILS in
 * doctorJoin.ts. `Doctor.specialty` is free text and stays free text; this
 * only saves the common case from being typed, and stops the same specialty
 * arriving as "Dermatology", "dermatology" and "Derma" across three profiles.
 *
 * Ordered by how often we expect them rather than alphabetically, because the
 * first two cover most practitioners and a dropdown is read top-down.
 */
export const DOCTOR_SPECIALTIES: string[] = [
  "Dermatology",
  "Cosmetic Dermatology",
  "Aesthetic Medicine",
  "Trichology",
  "Dermatosurgery",
  "Laser & Aesthetic Dermatology",
  "Paediatric Dermatology",
  "Venereology",
  "Hair Transplant Surgery",
  "Clinical Cosmetology",
  "Dermatopathology",
  "Plastic & Reconstructive Surgery",
  "General Medicine (Skin)",
];

/**
 * Sub-specialities: what a practitioner is known FOR.
 *
 * ── The third axis, and why it is not one of the other two ───────────────
 * `DOCTOR_SPECIALTIES` above is the qualification line on the card, and there
 * is exactly one of them. `DoctorService` is the list of procedures performed,
 * which is long and is what a client filters by. Neither answers the question
 * a referring doctor actually asks — "who do I send a difficult case of this
 * to" — because a hundred practitioners perform microneedling and four of them
 * are the ones you send a scarred face to.
 *
 * So this is areas of depth, not breadth, and the form says so: pick the two
 * or three you would want to be called about, not everything you can do. A
 * practitioner who selects fifteen has told a reader nothing.
 *
 * Free text is allowed for the same reason it is everywhere else here — this
 * is a suggestion list, not a whitelist.
 */
export const SPECIALTY_AREAS: string[] = [
  // Skin
  "Acne and acne scarring",
  "Pigmentation and melasma",
  "Anti-ageing and skin rejuvenation",
  "Rosacea and facial redness",
  "Eczema and atopic dermatitis",
  "Psoriasis",
  "Vitiligo",
  "Skin allergy and patch testing",
  "Fungal and bacterial skin infection",
  "Skin cancer and mole checks",
  "Scar revision",
  "Keloid management",
  "Sensitive and reactive skin",
  "Skin of colour",
  "Paediatric skin conditions",
  "Skin in pregnancy",
  "Occupational and contact dermatitis",

  // Hair
  "Hair loss and thinning",
  "Female pattern hair loss",
  "Alopecia areata",
  "Hair transplantation",
  "Scalp disorders and dandruff",
  "Beard and eyebrow restoration",

  // Aesthetic
  "Botulinum toxin",
  "Dermal fillers",
  "Thread lifts",
  "Lip and perioral aesthetics",
  "Under-eye rejuvenation",
  "Non-surgical rhinoplasty",
  "Jawline and chin contouring",
  "Skin boosters and biostimulators",
  "Body contouring",
  "Laser hair removal",
  "Tattoo removal",
  "Chemical peels",

  // Other
  "Nail disorders",
  "Sexually transmitted infections",
  "Excessive sweating",
  "Wound and ulcer care",
  "Bridal and event skin preparation",
  "Men's skin and grooming",
  "Teledermatology",
];
