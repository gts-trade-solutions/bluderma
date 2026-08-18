"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

/**
 * The footer's clinician sign-in row, shown only to visitors who are not
 * already signed in.
 *
 * The footer renders on nearly every page, so this link was offering "Doctor
 * sign in" to signed-in doctors — and, worse, to clients, who followed it and
 * were then quietly redirected away from the portal they had just been invited
 * into. The hero on /doctor already gates the identical link; this is the same
 * gate for the version that appears everywhere else.
 *
 * A signed-in practitioner gets a link to their portal instead, which is what
 * they were looking for.
 */
export default function FooterSignIn() {
  const { data: session, status } = useSession();

  // Render nothing while the session resolves, rather than flashing the wrong
  // link on every page load.
  if (status === "loading") return null;

  const role = session?.user?.role;

  if (role === "DOCTOR" || role === "ADMIN") {
    return (
      <li>
        <Link href="/doctor/portal" className="hover:text-white">
          Your portal
        </Link>
      </li>
    );
  }

  // A client has no use for a doctor sign-in link — their account cannot open
  // the portal, so offering it only leads somewhere they will be turned away.
  if (role) return null;

  return (
    <li>
      <Link href="/login?callbackUrl=/doctor/portal" className="hover:text-white">
        Doctor sign in
      </Link>
    </li>
  );
}
