"use client";

import { signOut } from "next-auth/react";

/**
 * Sign out and come straight back to where they were headed.
 *
 * The common case behind this page is not an intruder — it is one person with
 * two accounts who is signed in with the wrong one. Making them find sign-out,
 * sign in again and re-navigate is three steps to fix our own routing message.
 */
export default function SwitchAccount({
  to,
  label,
}: {
  to: string;
  label: string;
}) {
  return (
    <button
      onClick={() =>
        signOut({ callbackUrl: `/login?callbackUrl=${encodeURIComponent(to)}` })
      }
      className="btn-primary"
    >
      {label}
    </button>
  );
}
