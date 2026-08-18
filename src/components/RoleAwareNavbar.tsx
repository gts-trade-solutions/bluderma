"use client";

import Navbar from "./Navbar";
import { Experience } from "@/lib/roles";
import type { NavNode } from "@/lib/queries/nav";
import { useExperience } from "@/hooks/useExperience";

/**
 * Renders the Navbar using the visitor's experience. A signed-in account's
 * role decides it; anonymous visitors fall back to their stored preference.
 *
 * Both menus are built on the server and passed in, because which one applies
 * is only known once the session and localStorage have been read on the client.
 */
export default function RoleAwareNavbar({
  doctorMenu,
  patientMenu,
  fallback = "doctor",
}: {
  doctorMenu: NavNode[];
  patientMenu: NavNode[];
  fallback?: Experience;
}) {
  const { experience } = useExperience(fallback);
  const clinical = experience === "doctor";

  // Both of these were falling back to their defaults, which are the CLIENT
  // defaults. A doctor or admin reading a treatment page was therefore shown
  // the "Know About You" pill — a client questionnaire CTA — and the dark
  // chrome, which is what made the account dropdown unreadable on these
  // .theme-light pages.
  return (
    <Navbar
      role={experience}
      menu={clinical ? doctorMenu : patientMenu}
      cta={clinical ? "none" : "know-you"}
      chrome={clinical ? "light" : "dark"}
      showLocation={!clinical}
    />
  );
}
