"use client";

import { useCallback, useEffect, useState } from "react";

export const LOCATION_STORAGE_KEY = "bluderma-location";

export interface ClientLocation {
  /** What we show in the pill, e.g. "Chennai". */
  label: string;
  /** Longer line for the popover, e.g. "Chennai, Tamil Nadu". */
  detail?: string;
  source: "gps" | "manual";
  lat?: number;
  lon?: number;
  /** ISO timestamp — a GPS fix older than a day is re-offered, not trusted. */
  savedAt: string;
}

type Status = "idle" | "locating" | "denied" | "unsupported" | "error";

function read(): ClientLocation | null {
  try {
    const raw = window.localStorage.getItem(LOCATION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ClientLocation;
    return typeof parsed?.label === "string" ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Reverse-geocodes a fix to a city name. BigDataCloud's client endpoint needs
 * no key and no attribution header; if it is unreachable we still keep the
 * coordinates and show them, rather than throwing the fix away.
 */
async function reverseGeocode(
  lat: number,
  lon: number
): Promise<{ label: string; detail?: string }> {
  const url =
    `https://api.bigdatacloud.net/data/reverse-geocode-client` +
    `?latitude=${lat}&longitude=${lon}&localityLanguage=en`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("reverse geocode failed");

  const data = (await res.json()) as {
    city?: string;
    locality?: string;
    principalSubdivision?: string;
    countryName?: string;
  };

  const label = data.city || data.locality || data.principalSubdivision;
  if (!label) throw new Error("no locality in response");

  const detail = [data.principalSubdivision, data.countryName]
    .filter(Boolean)
    .join(", ");

  return { label, detail: detail || undefined };
}

/**
 * The client's own location, remembered in localStorage. Shared by the navbar
 * pill and anything else that wants to greet or filter by city.
 */
export function useClientLocation() {
  const [location, setLocation] = useState<ClientLocation | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLocation(read());
    setReady(true);

    // Keep other tabs (and the mobile drawer copy of this pill) in sync.
    const onStorage = (e: StorageEvent) => {
      if (e.key === LOCATION_STORAGE_KEY) setLocation(read());
    };
    const onLocal = () => setLocation(read());

    window.addEventListener("storage", onStorage);
    window.addEventListener("bluderma:location", onLocal);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("bluderma:location", onLocal);
    };
  }, []);

  const save = useCallback((next: ClientLocation | null) => {
    try {
      if (next) {
        window.localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(next));
      } else {
        window.localStorage.removeItem(LOCATION_STORAGE_KEY);
      }
    } catch {
      /* private mode — the in-memory value still works for this session */
    }
    setLocation(next);
    window.dispatchEvent(new Event("bluderma:location"));
  }, []);

  const detect = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unsupported");
      return;
    }
    setStatus("locating");

    const fix = await new Promise<GeolocationPosition | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        resolve,
        (err) => {
          setStatus(err.code === err.PERMISSION_DENIED ? "denied" : "error");
          resolve(null);
        },
        { enableHighAccuracy: false, timeout: 12_000, maximumAge: 300_000 }
      );
    });
    if (!fix) return;

    const { latitude, longitude } = fix.coords;
    let named: { label: string; detail?: string };
    try {
      named = await reverseGeocode(latitude, longitude);
    } catch {
      named = { label: `${latitude.toFixed(2)}, ${longitude.toFixed(2)}` };
    }

    save({
      ...named,
      source: "gps",
      lat: latitude,
      lon: longitude,
      savedAt: new Date().toISOString(),
    });
    setStatus("idle");
  }, [save]);

  const setCity = useCallback(
    (label: string) => {
      const trimmed = label.trim();
      if (!trimmed) return;
      save({ label: trimmed, source: "manual", savedAt: new Date().toISOString() });
      setStatus("idle");
    },
    [save]
  );

  const clear = useCallback(() => {
    save(null);
    setStatus("idle");
  }, [save]);

  return { location, status, ready, detect, setCity, clear };
}
