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

/**
 * Everywhere a signed-in DOCTOR may be.
 *
 * Duplicated from lib/roles.ts rather than imported: this file runs on the
 * edge runtime, and roles.ts imports the Prisma `Role` type, which drags the
 * client into the bundle. Two short lists that must agree — the one there
 * decides where sign-in sends somebody, this one is the enforcement.
 */
const DOCTOR_AREAS = ["/doctor", "/api", "/forbidden"];
const DOCTOR_HOME = "/doctor/portal";

function doctorMayOpen(pathname: string): boolean {
  // A dot means a file — the push service worker, robots.txt — never a page.
  if (pathname.includes(".")) return true;
  return DOCTOR_AREAS.some((a) => pathname === a || pathname.startsWith(`${a}/`));
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  const rule = RULES.find(
    (r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`)
  );

  /*
   * The token is now read on every matched request, not only on the guarded
   * prefixes, because the doctor confinement below applies to the whole site.
   * It is a JWT decrypt with no database round trip — the same thing NextAuth
   * middleware does by default.
   */
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (rule) {
    // The jwt callback empties the token when an account is deactivated, so a
    // missing role means "not signed in" even if a cookie is still present.
    if (!token?.role) {
      const login = new URL("/login", req.url);
      login.searchParams.set("callbackUrl", `${pathname}${search}`);
      return NextResponse.redirect(login);
    }

    if (!rule.roles.includes(token.role as string)) {
      // Carry where they were headed. Without it the refusal page can only say
      // "no access", which is exactly the dead end a client hits after clicking
      // a practitioner link with the wrong account signed in.
      const denied = new URL("/forbidden", req.url);
      denied.searchParams.set("from", pathname);
      return NextResponse.redirect(denied);
    }
  }

  /*
   * ── A doctor stays on the practitioner side ────────────────────────────
   * Not a permission check — nothing on the client side would leak anything —
   * but a product rule: a practitioner account has no business in a shop
   * built for clients, and every route out of the portal used to lead into
   * one. Signing in, clicking the wordmark and typing the bare domain all
   * land on the dashboard now.
   *
   * The redirect is silent and lands on the portal rather than /forbidden,
   * because there is nothing to forbid and nothing to explain: this is
   * navigation, not refusal.
   */
  if (token?.role === "DOCTOR" && !doctorMayOpen(pathname)) {
    return NextResponse.redirect(new URL(DOCTOR_HOME, req.url));
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
