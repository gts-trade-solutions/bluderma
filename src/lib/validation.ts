import { z } from "zod";

/**
 * Shared input schemas. Every route handler and server action validates with
 * these — never trust a client-side check.
 */

export const emailSchema = z
  .email("Enter a valid email address.")
  .trim()
  .toLowerCase()
  .max(254);

/**
 * Deliberately permissive on composition (no forced symbols/digits) but strict
 * on length — length is what actually resists offline cracking, and complexity
 * rules mostly drive users to predictable substitutions.
 */
export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(200, "That password is too long.");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password."),
});

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your name.").max(120),
    // The account type chosen at the entry modal. Only doctor/patient are
    // self-selectable — admin is never accepted from the request.
    accountType: z.enum(["doctor", "patient"]).default("patient"),
    email: emailSchema,
    phone: z
      .string()
      .trim()
      .max(20)
      .regex(/^[0-9+\-()\s]*$/, "Enter a valid phone number.")
      .optional()
      .or(z.literal("")),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(20, "This reset link is not valid."),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

/* ----------------------------- Domain writes ----------------------------- */

export const enquirySchema = z.object({
  audience: z.enum(["doctor", "patient"]),
  name: z.string().trim().min(2, "Enter your name.").max(120),
  email: emailSchema,
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  organisation: z.string().trim().max(160).optional().or(z.literal("")),
  // Comes off a number input, so it arrives as a string.
  quantity: z.coerce.number().int().min(1).max(100000).optional(),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
  treatmentSlug: z.string().trim().max(120).optional().or(z.literal("")),
  productName: z.string().trim().max(200).optional().or(z.literal("")),
});

export const bookingSchema = z.object({
  doctorSlug: z.string().trim().min(1),
  /** YYYY-MM-DD */
  daySeed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date."),
  /** HH:MM, 24h */
  time: z.string().regex(/^\d{2}:\d{2}$/, "Pick a valid time."),
  mode: z.enum(["clinic", "video"]),
  patientName: z.string().trim().min(2, "Enter your name.").max(120),
  patientPhone: z.string().trim().max(20).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const analysisSchema = z.object({
  overall: z.number().int().min(0).max(100),
  skinType: z.string().trim().min(1).max(80),
  estimatedAge: z.number().int().min(0).max(120),
  seed: z.string().trim().max(200).optional(),
  scores: z
    .array(
      z.object({
        key: z.string().trim().min(1).max(40),
        score: z.number().int().min(0).max(100),
      })
    )
    .min(1)
    .max(40),
  topConcerns: z.array(z.string().trim().max(40)).max(10),
});

export const profileSchema = z.object({
  fullName: z.string().trim().max(120).optional().or(z.literal("")),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  age: z.coerce.number().int().min(0).max(120).optional(),
  gender: z.enum(["FEMALE", "MALE", "OTHER", "UNDISCLOSED"]).optional(),
  city: z.string().trim().max(120).optional().or(z.literal("")),
});

export type EnquiryInput = z.infer<typeof enquirySchema>;
export type BookingInput = z.infer<typeof bookingSchema>;
export type AnalysisInput = z.infer<typeof analysisSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/** Flattens a ZodError into `{ fieldName: "first message" }` for form display. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !out[key]) out[key] = issue.message;
  }
  return out;
}
