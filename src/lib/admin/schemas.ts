import { z } from "zod";

/**
 * Admin form schemas.
 *
 * Multi-line textareas (bullet lists, languages, services) arrive as a single
 * string; `lines` turns them into a trimmed array and drops blanks, so an
 * accidental trailing newline doesn't create an empty bullet.
 */

export const lines = z
  .string()
  .default("")
  .transform((v) =>
    v
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
  );

const slug = z
  .string()
  .trim()
  .min(1, "A slug is required.")
  .max(120)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers and hyphens only."
  );

/** Checkbox inputs are absent from FormData when unticked. */
const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.literal(""), z.undefined()])
  .transform((v) => v === "on" || v === "true");

const optionalUrl = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .or(z.literal(""))
  .transform((v) => v || null);

export const categorySchema = z.object({
  slug,
  name: z.string().trim().min(1, "A name is required.").max(120),
  blurb: z.string().trim().max(500).optional().or(z.literal("")),
  image: optionalUrl,
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  isActive: checkbox,
});

export const treatmentSchema = z.object({
  slug,
  name: z.string().trim().min(1, "A name is required.").max(160),
  categoryId: z.string().trim().min(1, "Pick a category."),
  tagline: z.string().trim().min(1, "A tagline is required.").max(400),
  image: z.string().trim().min(1, "An image URL is required.").max(2000),
  summary: z.string().trim().min(1, "A summary is required.").max(4000),
  concern: z.string().trim().min(1, "Describe the concern.").max(4000),
  howItWorks: z.string().trim().min(1, "Describe how it works.").max(4000),
  clinicalNote: z.string().trim().min(1, "A clinical note is required.").max(4000),
  factSessions: z.string().trim().min(1).max(120),
  factDowntime: z.string().trim().min(1).max(120),
  factResults: z.string().trim().min(1).max(120),
  factDuration: z.string().trim().min(1).max(120),
  productName: z.string().trim().min(1, "A product name is required.").max(200),
  productDescriptor: z.string().trim().min(1).max(1000),
  seoTitle: z.string().trim().max(200).optional().or(z.literal("")),
  seoDescription: z.string().trim().max(400).optional().or(z.literal("")),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  isPublished: checkbox,
  concernPoints: lines,
  procedureSteps: lines,
  benefits: lines,
  idealFor: lines,
});

export const doctorSchema = z.object({
  slug,
  name: z.string().trim().min(1, "A name is required.").max(160),
  title: z.string().trim().min(1).max(160),
  specialty: z.string().trim().min(1).max(160),
  clinic: z.string().trim().min(1).max(160),
  location: z.string().trim().min(1).max(160),
  image: z.string().trim().min(1, "An image URL is required.").max(2000),
  about: z.string().trim().min(1).max(2000),
  rating: z.coerce.number().min(0).max(5),
  reviews: z.coerce.number().int().min(0).max(1000000),
  experienceYears: z.coerce.number().int().min(0).max(80),
  fee: z.coerce.number().int().min(0).max(1000000),
  verified: checkbox,
  isGeneral: checkbox,
  isActive: checkbox,
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  /** Email of the login account to link (empty string unlinks). */
  linkedUserEmail: z.string().trim().max(254).optional().or(z.literal("")),
  languages: lines,
  services: lines,
  /** Concern keys, from the multi-select. */
  focus: z.array(z.string().trim()).default([]),
  offersClinic: checkbox,
  offersVideo: checkbox,
  /** Weekly hours, applied to every working day. */
  workStart: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Use HH:MM.")
    .default("09:00"),
  workEnd: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Use HH:MM.")
    .default("17:30"),
  slotMinutes: z.coerce.number().int().min(5).max(240).default(30),
  /** Day-of-week numbers, 0=Sun. */
  workDays: z.array(z.coerce.number().int().min(0).max(6)).default([]),
});

export const testimonialSchema = z.object({
  authorName: z.string().trim().min(1, "A name is required.").max(160),
  authorRole: z.string().trim().max(160).optional().or(z.literal("")),
  avatarUrl: optionalUrl,
  quote: z.string().trim().min(1, "A quote is required.").max(2000),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  treatmentId: z.string().trim().optional().or(z.literal("")),
  isPublished: checkbox,
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});

export const faqSchema = z.object({
  question: z.string().trim().min(1, "A question is required.").max(500),
  answer: z.string().trim().min(1, "An answer is required.").max(4000),
  category: z.string().trim().max(120).optional().or(z.literal("")),
  isPublished: checkbox,
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});

export const bannerSchema = z.object({
  placement: z.enum(["HOME_HERO", "DOCTOR_HERO", "PATIENT_HERO"]),
  title: z.string().trim().max(200).optional().or(z.literal("")),
  subtitle: z.string().trim().max(500).optional().or(z.literal("")),
  ctaLabel: z.string().trim().max(80).optional().or(z.literal("")),
  ctaHref: z.string().trim().max(500).optional().or(z.literal("")),
  mediaType: z.enum(["IMAGE", "VIDEO"]),
  mediaUrl: z.string().trim().min(1, "A media URL is required.").max(2000),
  posterUrl: optionalUrl,
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  isActive: checkbox,
});

export const productSchema = z.object({
  slug,
  name: z.string().trim().min(1, "A name is required.").max(200),
  brand: z.string().trim().max(120).optional().or(z.literal("")),
  category: z.string().trim().min(1, "A category is required.").max(120),
  origin: z.string().trim().max(120).optional().or(z.literal("")),
  tagline: z.string().trim().max(400).optional().or(z.literal("")),
  description: z.string().trim().max(6000).optional().or(z.literal("")),
  howItWorks: z.string().trim().max(6000).optional().or(z.literal("")),
  composition: z.string().trim().max(2000).optional().or(z.literal("")),
  usageNotes: z.string().trim().max(2000).optional().or(z.literal("")),
  // Internal only. Coerced from a text input; blank clears it.
  priceInr: z.coerce.number().int().min(0).max(100000000).optional(),
  priceNote: z.string().trim().max(200).optional().or(z.literal("")),
  isPublished: checkbox,
  sortOrder: z.coerce.number().int().min(0).max(99999).default(0),
  // Multi-line textareas → arrays.
  variants: lines,
  features: lines,
  benefits: lines,
  indications: lines,
  // One image URL per line, capped to 5 in the action.
  images: lines,
  // Treatment slugs (multi-select checkbox group).
  treatments: z.array(z.string().trim()).default([]),
  primaryTreatment: z.string().trim().optional().or(z.literal("")),
})
  .refine((v) => v.treatments.length > 0, {
    message: "Map the product to at least one treatment.",
    path: ["treatments"],
  });

export const treatmentImageSchema = z.object({
  kind: z.enum(["HERO", "BEFORE_AFTER", "RESULT", "HOW_IT_WORKS", "GALLERY"]),
  url: z.string().trim().min(1, "An image URL is required.").max(2000),
  caption: z.string().trim().max(300).optional().or(z.literal("")),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});

export type ProductInput = z.infer<typeof productSchema>;
export type TreatmentImageInput = z.infer<typeof treatmentImageSchema>;

export type CategoryInput = z.infer<typeof categorySchema>;
export type TreatmentInput = z.infer<typeof treatmentSchema>;
export type DoctorInput = z.infer<typeof doctorSchema>;
export type TestimonialInput = z.infer<typeof testimonialSchema>;
export type FaqInput = z.infer<typeof faqSchema>;
export type BannerInput = z.infer<typeof bannerSchema>;
