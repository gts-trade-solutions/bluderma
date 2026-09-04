"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import "leaflet/dist/leaflet.css";

/**
 * The landmark, and optionally the exact point on the map.
 *
 * ── Why a landmark field exists at all ───────────────────────────────────
 * In most Indian cities the postal address is not how anyone actually gets
 * anywhere. Door numbers are frequently not displayed, buildings are known by
 * what they are next to, and the sentence a receptionist says on the phone is
 * "opposite the Krishna temple, above Saravana Stores". Asking for that
 * sentence is worth more to a client than any other single line of the
 * address, and it is the thing a practitioner can supply in four seconds.
 *
 * ── Why the map is optional and secondary ────────────────────────────────
 * Coordinates are strictly better data — they make "clinics near me" real, and
 * Clinic.lat/lng have existed unused since the multi-clinic work because
 * nothing ever wrote them. But a map is a heavy, fiddly thing to put in front
 * of somebody mid-form on a phone, and a clinic that never drops a pin must
 * not be a clinic that cannot finish onboarding. So it loads on request, not
 * on arrival: the tiles, the library and the ~40KB it costs are all deferred
 * behind "Pin it on the map".
 *
 * ── Why OpenStreetMap ────────────────────────────────────────────────────
 * No API key, no billing account, no per-load charge, and nothing to expire
 * quietly in production. Nominatim is used only for the one-off geocode of an
 * address the practitioner has already typed, at most once per interaction —
 * well inside its usage policy, and it degrades to "drag the pin yourself"
 * rather than failing.
 */

export default function LocationPicker({
  landmarkName = "landmark",
  latName = "lat",
  lngName = "lng",
  defaultLandmark = "",
  defaultLat = null,
  defaultLng = null,
  /** Used to centre the map before a pin exists. */
  addressHint,
}: {
  landmarkName?: string;
  latName?: string;
  lngName?: string;
  defaultLandmark?: string;
  defaultLat?: number | null;
  defaultLng?: number | null;
  addressHint?: () => string;
}) {
  const id = useId();
  const [landmark, setLandmark] = useState(defaultLandmark);
  const [lat, setLat] = useState<number | null>(defaultLat);
  const [lng, setLng] = useState<number | null>(defaultLng);
  const [showMap, setShowMap] = useState(defaultLat !== null && defaultLng !== null);

  return (
    <div className="space-y-3">
      <div>
        <label
          htmlFor={id}
          className="block text-sm font-semibold text-graphite-800"
        >
          Landmark
        </label>
        <input
          id={id}
          name={landmarkName}
          value={landmark}
          onChange={(e) => setLandmark(e.target.value)}
          placeholder="Opposite the Krishna temple, above Saravana Stores"
          maxLength={160}
          className="mt-1.5 w-full rounded-xl border border-graphite-200 bg-white px-3.5 py-2.5 text-graphite-900 outline-none transition focus:border-azure-400 focus:ring-4 focus:ring-azure-500/15"
        />
        <p className="mt-1 text-xs text-graphite-500">
          How you would describe the way there on the phone. This is what most
          people navigate by, and it is shown right under your address.
        </p>
      </div>

      {/* Always submitted, so clearing a pin actually clears it server-side. */}
      <input type="hidden" name={latName} value={lat ?? ""} />
      <input type="hidden" name={lngName} value={lng ?? ""} />

      {!showMap ? (
        <button
          type="button"
          onClick={() => setShowMap(true)}
          className="inline-flex items-center gap-2 rounded-full border border-graphite-200 bg-white px-3.5 py-2 text-xs font-bold text-graphite-700 transition hover:border-azure-300 hover:text-azure-700"
        >
          <PinIcon /> Pin it on the map
          <span className="font-normal text-graphite-500">
            so &ldquo;clinics near me&rdquo; can find you
          </span>
        </button>
      ) : (
        <MapPane
          lat={lat}
          lng={lng}
          onPick={(a, b) => {
            setLat(a);
            setLng(b);
          }}
          onClear={() => {
            setLat(null);
            setLng(null);
          }}
          onHide={() => setShowMap(false)}
          addressHint={addressHint}
        />
      )}
    </div>
  );
}

/* ------------------------------ The map ---------------------------------- */

function MapPane({
  lat,
  lng,
  onPick,
  onClear,
  onHide,
  addressHint,
}: {
  lat: number | null;
  lng: number | null;
  onPick: (lat: number, lng: number) => void;
  onClear: () => void;
  onHide: () => void;
  addressHint?: () => string;
}) {
  const holder = useRef<HTMLDivElement>(null);
  // Typed loosely on purpose: importing Leaflet's types at module scope would
  // pull the library into the bundle that this component exists to defer.
  const map = useRef<any>(null);
  const marker = useRef<any>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Chennai. Somewhere is better than the middle of the Atlantic, which is
  // where a 0,0 default puts a practitioner who has not typed an address yet.
  const FALLBACK: [number, number] = [13.0827, 80.2707];

  const place = useCallback(
    (a: number, b: number, zoom?: number) => {
      const L = (window as any).__bdLeaflet;
      if (!L || !map.current) return;
      if (marker.current) marker.current.setLatLng([a, b]);
      else {
        marker.current = L.marker([a, b], { draggable: true })
          .addTo(map.current)
          .on("dragend", () => {
            const p = marker.current.getLatLng();
            onPick(round(p.lat), round(p.lng));
          });
      }
      map.current.setView([a, b], zoom ?? Math.max(map.current.getZoom(), 16));
      onPick(round(a), round(b));
    },
    [onPick]
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !holder.current || map.current) return;
      (window as any).__bdLeaflet = L;

      // Leaflet's default marker points at image files by relative URL, which
      // resolves against the page rather than the bundle and 404s. A divIcon
      // avoids the whole problem and takes our brand colour.
      const icon = L.divIcon({
        className: "",
        html:
          '<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;' +
          "background:#1f6fd6;border:2.5px solid #fff;transform:rotate(-45deg);" +
          'box-shadow:0 3px 10px rgba(15,23,42,.45)"></div>',
        iconSize: [26, 26],
        iconAnchor: [13, 26],
      });
      L.Marker.prototype.options.icon = icon;

      const start: [number, number] = lat !== null && lng !== null ? [lat, lng] : FALLBACK;
      map.current = L.map(holder.current, { attributionControl: true }).setView(
        start,
        lat !== null ? 16 : 11
      );

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap contributors",
      }).addTo(map.current);

      map.current.on("click", (e: any) => place(e.latlng.lat, e.latlng.lng));

      if (lat !== null && lng !== null) {
        marker.current = L.marker([lat, lng], { draggable: true })
          .addTo(map.current)
          .on("dragend", () => {
            const p = marker.current.getLatLng();
            onPick(round(p.lat), round(p.lng));
          });
      }

      // Leaflet measures its container on creation, and inside a form that is
      // still laying out it frequently measures zero — which paints grey.
      setTimeout(() => map.current?.invalidateSize(), 60);
    })();

    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
    // Built once. Later lat/lng changes are driven by this component itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** The browser's own geolocation. The fastest correct answer when in clinic. */
  function useMyLocation() {
    if (!navigator.geolocation) {
      setStatus("This browser cannot share a location.");
      return;
    }
    setBusy(true);
    setStatus(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false);
        place(pos.coords.latitude, pos.coords.longitude, 17);
        setStatus("Pinned where you are now. Drag it if the door is elsewhere.");
      },
      (err) => {
        setBusy(false);
        setStatus(
          err.code === err.PERMISSION_DENIED
            ? "Location permission was refused. Search the address instead, or drag the pin."
            : "Could not get a location. Search the address instead, or drag the pin."
        );
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 }
    );
  }

  /** Geocodes the address already typed into the form above. */
  async function findAddress() {
    const q = addressHint?.().trim();
    if (!q) {
      setStatus("Fill in the address above first and this will find it.");
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const url =
        "https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=" +
        encodeURIComponent(q);
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      const rows = (await res.json()) as { lat: string; lon: string }[];
      if (!rows.length) {
        setStatus("Could not find that address. Drag the pin to where you are.");
        return;
      }
      place(Number(rows[0].lat), Number(rows[0].lon), 16);
      setStatus("Found it. Drag the pin to the exact door.");
    } catch {
      setStatus("The map search is unavailable. Drag the pin instead.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-[10px] border border-graphite-200 bg-white p-3">
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={useMyLocation}
          className="rounded-full bg-azure-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-azure-700 disabled:opacity-50"
        >
          {busy ? "Working…" : "Use my current location"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={findAddress}
          className="rounded-full border border-graphite-200 px-3 py-1.5 text-xs font-bold text-graphite-700 transition hover:bg-graphite-50 disabled:opacity-50"
        >
          Find the address above
        </button>
        {lat !== null && (
          <button
            type="button"
            onClick={() => {
              if (marker.current && map.current) {
                map.current.removeLayer(marker.current);
                marker.current = null;
              }
              onClear();
              setStatus("Pin removed.");
            }}
            className="text-xs font-semibold text-coral-600 hover:text-coral-800"
          >
            Remove pin
          </button>
        )}
        <button
          type="button"
          onClick={onHide}
          className="ml-auto text-xs font-semibold text-graphite-500 hover:text-graphite-800"
        >
          Hide map
        </button>
      </div>

      <div
        ref={holder}
        className="h-64 w-full overflow-hidden rounded-xl bg-graphite-100"
        // Leaflet's own controls sit above form fields otherwise.
        style={{ zIndex: 0 }}
      />

      <p className="mt-2 text-xs text-graphite-500">
        {lat !== null && lng !== null ? (
          <>
            Pinned at {lat.toFixed(5)}, {lng.toFixed(5)}. Tap the map or drag
            the pin to move it.
          </>
        ) : (
          <>Tap the map to drop a pin, or use one of the buttons above.</>
        )}
        {status ? ` ${status}` : ""}
      </p>
    </div>
  );
}

/** Five decimals is about a metre. More is noise dressed as precision. */
const round = (n: number) => Math.round(n * 1e5) / 1e5;

function PinIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="h-4 w-4"
    >
      <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}
