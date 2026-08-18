"use client";

import { useEffect, useState } from "react";

/** Matches the fallback in getHomeVisitFee, for the moment before it loads. */
const DEFAULT_HOME_VISIT_FEE = 500;

/**
 * The admin-set home-visit surcharge, so the figure quoted in the booking
 * summary is the one the server will actually charge. Fetched once and shared
 * across consumers; falls back to the launch figure if the call fails.
 */
let inflight: Promise<number> | null = null;

function load(): Promise<number> {
  if (!inflight) {
    inflight = fetch("/api/settings/booking")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => Number(d?.homeVisitFee) || DEFAULT_HOME_VISIT_FEE)
      .catch(() => {
        inflight = null;
        return DEFAULT_HOME_VISIT_FEE;
      });
  }
  return inflight;
}

export function useHomeVisitFee(): number {
  const [fee, setFee] = useState(DEFAULT_HOME_VISIT_FEE);
  useEffect(() => {
    let alive = true;
    load().then((v) => alive && setFee(v));
    return () => {
      alive = false;
    };
  }, []);
  return fee;
}
