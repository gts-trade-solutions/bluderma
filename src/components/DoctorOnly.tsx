"use client";

import { useEffect, useState } from "react";
import { ROLE_STORAGE_KEY } from "@/lib/roles";

/**
 * Shows its children only to visitors in the doctor (clinical) experience.
 * Renders nothing until the role is known to avoid a flash for patients.
 */
export default function DoctorOnly({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isDoctor, setIsDoctor] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      setIsDoctor(window.localStorage.getItem(ROLE_STORAGE_KEY) !== "patient");
    } catch {
      setIsDoctor(true);
    }
  }, []);

  if (!isDoctor) return null;
  return <>{children}</>;
}
