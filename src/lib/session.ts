import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";

import { authOptions } from "./auth";

export interface SessionUser {
  id: string;
  role: Role;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

/** The signed-in user, or null. Safe to call from any server component. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.role) return null;
  return session.user as SessionUser;
}

/**
 * Guards a server component. Redirects to the login page (preserving where the
 * user was headed) instead of returning null, so callers can treat the result
 * as always present.
 */
export async function requireUser(callbackUrl?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    const target = callbackUrl
      ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`
      : "/login";
    redirect(target);
  }
  return user;
}

/**
 * Guards a server component on role. ADMIN passes every check — it is a
 * superset of the others by design.
 */
export async function requireRole(
  roles: Role | Role[],
  callbackUrl?: string
): Promise<SessionUser> {
  const allowed = Array.isArray(roles) ? roles : [roles];
  const user = await requireUser(callbackUrl);
  if (user.role !== Role.ADMIN && !allowed.includes(user.role)) {
    // Same hand-off middleware makes: the refusal page can only explain itself
    // if it knows what was being asked for.
    redirect(
      callbackUrl
        ? `/forbidden?from=${encodeURIComponent(callbackUrl)}`
        : "/forbidden"
    );
  }
  return user;
}

export function hasRole(
  user: SessionUser | null,
  roles: Role | Role[]
): boolean {
  if (!user) return false;
  if (user.role === Role.ADMIN) return true;
  const allowed = Array.isArray(roles) ? roles : [roles];
  return allowed.includes(user.role);
}

/** Clinicians and admins — the audience for clinical notes and B2B ordering. */
export function isClinician(user: SessionUser | null): boolean {
  return hasRole(user, Role.DOCTOR);
}
