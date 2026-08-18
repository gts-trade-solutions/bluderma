"use client";

import { useEffect, useState } from "react";

/**
 * Real next-free times for a set of doctors.
 *
 * The three components that show availability on a doctor card used to call
 * `slotsForDoctor()` / `nextAvailable()` from `@/data/doctors` — a seeded
 * pseudo-random generator that made the times up. This replaces all three with
 * one batched request against the actual calendar.
 *
 * `null` for a doctor means "nothing free in the next week", which is a real
 * answer. `undefined` means the request has not landed yet — the UI must show
 * nothing at all in that state rather than guessing.
 */

export interface FreeTime {
  label: string;
  clinicId: string | null;
  clinicName: string | null;
}

export interface DoctorAvailability {
  daySeed: string;
  /** "Today", "Tomorrow", or a weekday name. */
  dayLabel: string;
  times: FreeTime[];
}

export function useDoctorAvailability(slugs: string[]) {
  const [map, setMap] = useState<Record<string, DoctorAvailability | null>>({});
  const [loaded, setLoaded] = useState(false);

  // Sorted and joined so a re-render with the same doctors in a different
  // order does not refetch.
  const key = [...slugs].filter(Boolean).sort().join(",");

  useEffect(() => {
    if (!key) {
      setLoaded(true);
      return;
    }
    let live = true;
    setLoaded(false);

    fetch(`/api/doctors/availability?slugs=${encodeURIComponent(key)}`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((d) => {
        if (!live || !d?.ok) return;
        setMap(d.availability ?? {});
        setLoaded(true);
      })
      .catch(() => {
        // Leave the map empty. Showing nothing is correct; the previous
        // behaviour on failure was to invent times.
        if (live) setLoaded(true);
      });

    return () => {
      live = false;
    };
  }, [key]);

  return { availability: map, loaded };
}
