import { Role } from "@prisma/client";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import type { SessionUser } from "@/lib/session";

export class ForbiddenError extends Error {
  constructor(message = "You don't have permission to do that.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Guard for admin *server actions*.
 *
 * Middleware already blocks non-admins from /admin pages, but a server action
 * is a public POST endpoint — anyone who knows its id can invoke it directly,
 * from any page. Every mutating admin action must call this itself; the route
 * guard is not a substitute.
 */
export async function requireAdminUser(): Promise<SessionUser> {
  const session = await getServerSession(authOptions);
  const user = session?.user;

  if (!user?.id || !user.role) {
    throw new ForbiddenError("Please sign in.");
  }
  if (user.role !== Role.ADMIN) {
    throw new ForbiddenError();
  }
  return user as SessionUser;
}
