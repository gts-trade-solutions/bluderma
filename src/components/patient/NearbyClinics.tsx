"use client";

import { MapPin, Navigation } from "lucide-react";

import { useClientLocation } from "@/hooks/useClientLocation";
import { byDistance } from "@/lib/queries/nearby";

export interface ClinicRow {
  id: string;
  name: string;
  area: string;
  city: string;
  addressLine1: string;
  pincode: string;
  phone: string | null;
  lat: number | null;
  lng: number | null;
}

/**
 * Listed clinics, nearest first.
 *
 * ── Why the ordering happens here and not on the server ──────────────────
 * The visitor's position lives in localStorage, put there by the location
 * button. It never reaches the server, which is the right arrangement: a
 * person's coordinates are not something to send and store because a list
 * needed sorting. So the rows arrive unordered with their points attached,
 * and the sorting happens where the position already is.
 *
 * ── What it claims, and what it does not ─────────────────────────────────
 * Straight-line distance. It is right about the ORDER far more often than it
 * is right about the number, so the order is trusted and the figure is always
 * hedged: "about 4 km", never "4.2 km", which would read as a drive time it
 * is not.
 *
 * With no shared location the list is left exactly as it came. A list
 * reshuffled on a guess is worse than one that is simply not sorted.
 */
export default function NearbyClinics({ clinics }: { clinics: ClinicRow[] }) {
  const { location } = useClientLocation();

  const from =
    // The hook stores it as lon, the geometry helper takes lng. Named
    // explicitly here rather than renamed in either place: both are correct in
    // their own file, and a silent mismatch would put every clinic at 0,0.
    typeof location?.lat === "number" && typeof location?.lon === "number"
      ? { lat: location.lat, lng: location.lon }
      : null;

  const ordered = byDistance(clinics, from);

  return (
    <>
      {from ? (
        <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-teal-400/[12%] px-3 py-1.5 text-xs font-semibold text-teal-200">
          <Navigation className="h-3.5 w-3.5" />
          Nearest to you first
        </p>
      ) : (
        <p className="mb-3 text-xs text-ink-muted">
          Share your location from the top of the page and these reorder by how
          near they are.
        </p>
      )}

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {ordered.map(({ item: c, label }, i) => (
          <li key={c.id} className="card-soft p-5">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 text-sm font-bold text-ink">
                {c.name.replace(/^BluDerma\s+/, "")}
              </p>
              {/* Only on the actual nearest, and only when a distance was
                  computable. A badge on every card says nothing. */}
              {i === 0 && label && (
                <span className="shrink-0 rounded-full bg-teal-400/[16%] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-teal-200">
                  Nearest
                </span>
              )}
            </div>

            <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-teal-300">
              {c.area}
            </p>

            {label && (
              <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-ink-soft">
                <MapPin className="h-3.5 w-3.5" />
                {label} away
              </p>
            )}

            <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
              {c.addressLine1}
              <br />
              {c.city}, {c.pincode}
            </p>
            {c.phone && <p className="mt-2 text-xs text-ink-muted">{c.phone}</p>}
          </li>
        ))}
      </ul>

      {from && (
        <p className="mt-3 text-[11px] leading-relaxed text-ink-muted">
          Distances are straight-line and approximate. The drive is usually
          longer.
        </p>
      )}
    </>
  );
}
