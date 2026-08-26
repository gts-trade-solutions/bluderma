"use client";

import { usePathname } from "next/navigation";

import ThemeToggle from "./ThemeToggle";

/**
 * The appearance control, as its own thing on the page.
 *
 * ── Why it left the navbar ───────────────────────────────────────────────
 * It sat in a row of small round glyphs beside the location pin and the
 * account avatar, and read as a fourth icon rather than as the control for
 * the feature it opens. Somebody who has never pressed it has no reason to
 * think a palette in that row does anything more interesting than the two
 * icons either side of it.
 *
 * Floating on its own it has no neighbours to be confused with. It also stops
 * competing with the bar for width on a phone, where four round buttons and a
 * wordmark is already more than fits comfortably.
 *
 * ── Bottom LEFT, and not by accident ─────────────────────────────────────
 * The assistant launcher is bottom right, and two floating circles in the
 * same corner is how one of them stops being pressable. Left also keeps it
 * clear of the pay-later modal's close button and of the iOS home indicator.
 *
 * ── Where it does not appear ─────────────────────────────────────────────
 * The professional console. Those screens are deliberately outside the theme
 * system — the doctor portal and the admin console are locked light so that
 * clinical work looks the same on every machine — so a control that changes
 * nothing there would be a button that appears broken.
 */
const HIDDEN_ON = ["/admin", "/doctor/portal", "/doctor/join"];

export default function ThemeFab() {
  const pathname = usePathname() ?? "";
  if (HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return null;
  }

  return (
    <div
      className="fixed bottom-5 left-5 z-[58]"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <ThemeToggle variant="floating" />
    </div>
  );
}
