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
  return (
    <Navbar
      role={experience}
      menu={experience === "patient" ? patientMenu : doctorMenu}
    />
  );
}
