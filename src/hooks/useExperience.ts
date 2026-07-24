"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

import {
  Experience,
  ROLE_STORAGE_KEY,
  experienceForRole,
  isExperience,
} from "@/lib/roles";

/**
 * Resolves which experience to render.
 *
 * A signed-in account's role always wins — a patient can't put themselves in
 * the clinical view by editing localStorage. The stored preference only
 * applies to anonymous visitors, who are still free to browse either side of
 * the public site.
 *
 * `ready` stays false until both the session and localStorage have been read,
 * so callers can avoid rendering the wrong experience on first paint.
 */
export function useExperience(fallback: Experience = "doctor"): {
  experience: Experience;
  ready: boolean;
  isAuthenticated: boolean;
} {
  const { data: session, status } = useSession();
  const [stored, setStored] = useState<Experience | null>(null);
  const [storageRead, setStorageRead] = useState(false);

  useEffect(() => {
    try {
      const value = window.localStorage.getItem(ROLE_STORAGE_KEY);
      if (isExperience(value)) setStored(value);
    } catch {
      /* storage unavailable — fall through to the default */
    }
    setStorageRead(true);
  }, []);

  const role = session?.user?.role;
  const experience: Experience = role
    ? experienceForRole(role)
    : stored ?? fallback;

  return {
    experience,
    ready: status !== "loading" && storageRead,
    isAuthenticated: status === "authenticated",
  };
}
