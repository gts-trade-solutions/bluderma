import type { Role } from "@prisma/client";

/**
 * Which *experience* of the site is being shown. This is a presentation
 * concern, not an identity one — an anonymous visitor picks it from the
 * entry modal and it lives in localStorage.
 *
 * Do not confuse it with the `Role` enum from Prisma, which is the account's
 * real, server-verified permission level. When a user is signed in their Role
 * decides the experience; only anonymous visitors fall back to the stored
 * preference. See `useExperience()`.
 */
export type Experience = "doctor" | "patient";

export const ROLE_STORAGE_KEY = "bluderma-role";

interface ExperienceMeta {
  label: string;
  /** Landing page after the experience is chosen (and for the logo link). */
  path: string;
  /** Where the marketing/content sections live (menu anchors resolve here). */
  hubPath: string;
  badge: string;
}

export const roleMeta: Record<Experience, ExperienceMeta> = {
  doctor: {
    label: "Medical Professional",
    path: "/doctor",
    hubPath: "/doctor",
    badge: "Clinical view",
  },
  patient: {
    label: "Consultation",
    path: "/patient/skin-analyzer",
    hubPath: "/patient",
    badge: "Consultation view",
  },
};

/** The experience a signed-in account should land in, based on its role. */
export function experienceForRole(role: Role): Experience {
  return role === "PATIENT" ? "patient" : "doctor";
}

export function isExperience(value: unknown): value is Experience {
  return value === "doctor" || value === "patient";
}

/** Where to send a user after signing in, when no callbackUrl was given. */
export function landingPathForRole(role: Role): string {
  if (role === "ADMIN") return "/admin";
  if (role === "DOCTOR") return "/doctor";
  return "/patient/skin-analyzer";
}
