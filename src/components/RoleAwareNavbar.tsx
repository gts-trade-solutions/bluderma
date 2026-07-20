"use client";

import { useEffect, useState } from "react";
import Navbar from "./Navbar";
import { ROLE_STORAGE_KEY, Role } from "@/lib/roles";

/**
 * Renders the Navbar using the visitor's stored role (defaults to doctor).
 * Used on shared pages such as treatment detail, where the server cannot
 * know which experience the visitor came from.
 */
export default function RoleAwareNavbar({
  fallback = "doctor",
}: {
  fallback?: Role;
}) {
  const [role, setRole] = useState<Role>(fallback);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(ROLE_STORAGE_KEY);
      if (stored === "doctor" || stored === "patient") setRole(stored);
    } catch {
      /* ignore */
    }
  }, []);

  return <Navbar role={role} />;
}
