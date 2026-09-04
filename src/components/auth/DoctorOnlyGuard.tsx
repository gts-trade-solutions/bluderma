"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import { isDoctorArea } from "@/lib/roles";

/**
 * The second half of the doctor confinement rule, in the browser.
 *
 * ── Why the middleware is not enough ─────────────────────────────────────
 * It is enough for anything that asks the server: every client-side path
 * returns a 307 to /doctor/portal for a signed-in DOCTOR, and that was
 * verified. But a browser does not ask the server for everything.
 *
 *   THE BACK BUTTON. A doctor who was on the home page before signing in —
 *   which is where the sign-in link is — presses Back afterwards and the
 *   browser restores its own snapshot of that page from bfcache. No request
 *   is made, so no middleware runs, and the client site is on screen.
 *
 *   THE ROUTER CACHE. The App Router prefetches links and keeps their payload.
 *   A transition to something already in that cache can render without a
 *   round trip.
 *
 * Both are the browser doing exactly what it is supposed to. Closing them
 * needs code that runs on render, which is this.
 *
 * ── It is navigation, not authorisation ──────────────────────────────────
 * Nothing here protects data — every client page is public, and the pages
 * that are not have their own server-side guards. This is the product rule:
 * a practitioner account belongs on the practitioner side. So it redirects
 * silently rather than refusing, and it covers the page while it does, or a
 * doctor sees a flash of somebody else's shop on the way out.
 *
 * ADMIN is deliberately exempt, as everywhere else: an administrator has to be
 * able to see what clients see.
 */
export default function DoctorOnlyGuard() {
  const { data: session, status } = useSession();
  const pathname = usePathname() ?? "/";
  const router = useRouter();

  const role = session?.user?.role;
  const stray =
    status === "authenticated" && role === "DOCTOR" && !isDoctorArea(pathname);

  useEffect(() => {
    if (!stray) return;
    // `replace`, not `push`: the page being left should not be somewhere Back
    // can return to, or this fires again on every press.
    router.replace("/doctor/portal");
  }, [stray, router]);

  if (!stray) return null;

  return (
    <div
      // Over everything, including the assistant launcher and the theme
      // control, both of which sit in the high sixties.
      className="fixed inset-0 z-[100] grid place-items-center bg-white"
      role="status"
      aria-live="polite"
    >
      <p className="text-sm font-semibold text-graphite-600">
        Taking you back to your portal…
      </p>
    </div>
  );
}
