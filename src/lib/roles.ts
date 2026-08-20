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

/**
 * Where to send a user after signing in, when no callbackUrl was given.
 *
 * A client lands on the home page. It used to be /patient/skin-analyzer,
 * which put a sales page for one feature in front of somebody who had just
 * proved they are already a customer — and hid the appointments, reports and
 * profile they most likely signed in to reach. The analyzer is still the
 * loudest thing on the home page; it is now a choice rather than a wall.
 *
 * The two staff roles keep their own screens: an admin and a doctor sign in
 * to work, and the home page is marketing to both of them.
 */
export function landingPathForRole(role: Role): string {
  if (role === "ADMIN") return "/admin";
  if (role === "DOCTOR") return "/doctor/portal";
  return "/";
}

/**
 * Areas of the site that belong to one role.
 *
 * Mirrors the RULES table in middleware.ts. Kept in step by hand, which is
 * acceptable because the middleware is the enforcement and this is only used
 * to avoid sending someone somewhere they will immediately be bounced from.
 */
const ROLE_AREAS: { prefix: string; roles: Role[] }[] = [
  { prefix: "/admin", roles: ["ADMIN"] },
  { prefix: "/doctor/portal", roles: ["DOCTOR", "ADMIN"] },
  { prefix: "/doctor/join", roles: ["DOCTOR", "ADMIN"] },
];

/**
 * Would this role actually be allowed to open that path?
 *
 * Sign-in used to push straight to whatever callbackUrl it was given. A client
 * who clicked "Doctor sign in" on the practitioner home page was therefore
 * sent to /doctor/portal after logging in, where middleware bounced them to
 * /forbidden — a dead end reached by following an obvious-looking button.
 *
 * ADMIN passes everything, matching requireRole() in lib/session.ts.
 */
export function canRoleOpen(path: string, role: Role): boolean {
  if (role === "ADMIN") return true;
  const area = ROLE_AREAS.find((a) => path.startsWith(a.prefix));
  return !area || area.roles.includes(role);
}

/**
 * Where to actually send someone after they sign in.
 *
 * An explicit callbackUrl wins — being returned to the page that asked you to
 * sign in beats any default — but only if the account can open it. Otherwise
 * their own landing page, which is never a bounce.
 */
export function postLoginPath(callbackUrl: string, role: Role): string {
  const target = internalPath(callbackUrl) ?? "/";
  if (target === "/") return landingPathForRole(role);
  return canRoleOpen(target, role) ? target : landingPathForRole(role);
}

/**
 * A path we are willing to send a browser to, or null.
 *
 * Testing `startsWith("/")` alone is not enough, and that is what this used to
 * do: "//evil.com" and "/\evil.com" both begin with a slash and both are read
 * by browsers as protocol-relative URLs pointing at another host. That turned
 * any ?callbackUrl= into an open redirect — a phishing link that genuinely
 * lives on our own domain right up until the moment it lands somewhere else.
 */
export function internalPath(raw: string | null | undefined): string | null {
  if (!raw || !raw.startsWith("/")) return null;
  // Browsers normalise backslashes to forward slashes, so "/\host" is read as
  // "//host" and has to be rejected alongside it.
  if (/^\/[/\\]/.test(raw)) return null;
  return raw;
}
