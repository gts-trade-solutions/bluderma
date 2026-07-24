import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Edge route guard. Roles are plain strings here on purpose — importing the
 * Prisma enum would pull the client into the edge bundle.
 *
 * This is the coarse gate. Server components and route handlers still check
 * authorisation themselves via `requireRole()`; middleware alone is never the
 * only thing standing between a user and someone else's data.
 */
const RULES: { prefix: string; roles: string[] }[] = [
  { prefix: "/admin", roles: ["ADMIN"] },
  { prefix: "/doctor/portal", roles: ["DOCTOR", "ADMIN"] },
  { prefix: "/patient/appointments", roles: ["PATIENT", "DOCTOR", "ADMIN"] },
  { prefix: "/patient/profile", roles: ["PATIENT", "DOCTOR", "ADMIN"] },
];

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  const rule = RULES.find(
    (r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`)
  );
  if (!rule) return NextResponse.next();

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // The jwt callback empties the token when an account is deactivated, so a
  // missing role means "not signed in" even if a cookie is still present.
  if (!token?.role) {
    const login = new URL("/login", req.url);
    login.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }

  if (!rule.roles.includes(token.role as string)) {
    return NextResponse.redirect(new URL("/forbidden", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Everything except Next internals, the auth API (which must stay
     * reachable to sign in) and static assets.
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico|icon.svg|videos|.*\\.(?:png|jpg|jpeg|gif|webp|svg|mp4)$).*)",
  ],
};
