"use client";

import { useEffect, useState } from "react";

import type { Doctor } from "@/data/doctors";

/**
 * The doctor directory for client components that cannot take it as a server
 * prop. One fetch per page load, shared by every consumer through a
 * module-level promise; the API response is already in the client `Doctor`
 * shape (`id` is the public slug, modes are "clinic" | "video").
 *
 * `focus` arrives as plain strings but is typed MetricKey[] on the client:
 * the DoctorConcern keys were seeded from the same metric list, so the cast
 * states an invariant rather than hiding a conversion.
 */

let inflight: Promise<Doctor[]> | null = null;

function load(): Promise<Doctor[]> {
  if (!inflight) {
    inflight = fetch("/api/doctors")
      .then((r) => {
        if (!r.ok) throw new Error(`doctors ${r.status}`);
        return r.json();
      })
      .then((data) => data.doctors as Doctor[])
      .catch((err) => {
        // A failed fetch should not poison every later consumer.
        inflight = null;
        throw err;
      });
  }
  return inflight;
}

export function useDoctors(): { doctors: Doctor[]; ready: boolean } {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    load()
      .then((list) => {
        if (alive) {
          setDoctors(list);
          setReady(true);
        }
      })
      .catch(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  return { doctors, ready };
}
