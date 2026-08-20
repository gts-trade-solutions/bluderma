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
