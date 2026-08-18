"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

/**
 * The way out of "you are signed in as a client" on /doctor/join.
 *
 * That screen used to state the problem and then offer only "Back to
 * BluDerma" — telling a clinician to sign out and register again while giving
 * them no button that does it. This is that button.
 *
 * Signing out returns them to /doctor/join, so the moment the session clears
 * they are looking at the practitioner sign-up form rather than being dropped
 * on the home page to find their way back.
 */
export default function SwitchToClinician() {
  const [busy, setBusy] = useState(false);

  return (
    <button
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void signOut({ callbackUrl: "/doctor/join" });
      }}
      className="btn-primary disabled:opacity-60"
    >
      {busy ? "Signing out…" : "Sign out and register as a clinician"}
    </button>
  );
}
