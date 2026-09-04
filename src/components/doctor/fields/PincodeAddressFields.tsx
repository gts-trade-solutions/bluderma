"use client";

import { useEffect, useRef, useState } from "react";

import Combobox from "./Combobox";
import { useFieldError } from "@/components/admin/formContext";

/**
 * PIN code, area, city and state — filled from India Post.
 *
 * The doctor types six digits and the rest arrives: real post-office names for
 * the area, and the district and state that PIN code belongs to. It saves the
 * typing, and more usefully it makes the spelling consistent across clinics so
 * "Anna Nagar", "annanagar" and "Anna nagar" stop being three places.
 *
 * All four remain ordinary editable inputs. The lookup is a head start, not an
 * authority — a clinic may sit on the edge of a PIN code, and the doctor knows
 * their own address better than a postal database does.
 *
 * Nothing here is generated: an address is the one field a reader cannot
 * sanity-check by looking at it, so no model is ever asked to produce one.
 */

type State =
  | { kind: "idle" }
  | { kind: "looking" }
  | { kind: "found"; areas: string[] }
  | { kind: "unknown" }
  | { kind: "failed" };

export default function PincodeAddressFields({
  defaults,
  errors,
  onPincodeChange,
  readOnly = false,
}: {
  defaults: {
    pincode: string;
    area: string;
    city: string;
    state: string;
  };
  /**
   * Explicit errors win over the form context, the same way admin/ui.tsx does
   * it — ClinicForm keeps its own `fields` state rather than using
   * EntityForm's provider, so context alone would show nothing there.
   */
  errors?: Record<string, string | undefined>;
  /**
   * Reported upward as it is typed.
   *
   * ClinicsStep needs the PIN code to ask whether the clinic already exists,
   * and this component owns that state. Lifting it entirely would mean the
   * India Post lookup living at the call site, which is the one thing this
   * component is for.
   */
  onPincodeChange?: (pincode: string) => void;
  /**
   * Set on a clinic shared with other practitioners: the premises' address is
   * not one practice's to change. Shown rather than hidden, because a doctor
   * checking they joined the right building needs to read it.
   */
  readOnly?: boolean;
}) {
  const [pincode, setPincode] = useState(defaults.pincode);
  const [area, setArea] = useState(defaults.area);
  const [city, setCity] = useState(defaults.city);
  const [stateName, setStateName] = useState(defaults.state);
  const [status, setStatus] = useState<State>({ kind: "idle" });

  // The hooks must run unconditionally — see the note in admin/ui.tsx.
  const pinContext = useFieldError("pincode");
  const cityContext = useFieldError("city");
  const stateContext = useFieldError("state");
  const pinError = errors?.pincode ?? pinContext;
  const cityError = errors?.city ?? cityContext;
  const stateError = errors?.state ?? stateContext;

  // Only look up a PIN the doctor actually finished typing, and only once.
  const lastLooked = useRef<string | null>(null);

  useEffect(() => {
    const pin = pincode.trim();
    if (readOnly) return;
    if (!/^\d{6}$/.test(pin) || lastLooked.current === pin) return;
    lastLooked.current = pin;

    let alive = true;
    setStatus({ kind: "looking" });
    (async () => {
      try {
        const res = await fetch(`/api/doctor/pincode?pin=${pin}`, {
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (!alive) return;

        if (!res.ok || !data?.ok) return setStatus({ kind: "failed" });
        if (!data.found) return setStatus({ kind: "unknown" });

        setStatus({ kind: "found", areas: data.areas ?? [] });
        // Never overwrite something the doctor already typed.
        if (data.city && !city.trim()) setCity(data.city);
        if (data.state && !stateName.trim()) setStateName(data.state);
        if (!area.trim() && data.areas?.length === 1) setArea(data.areas[0]);
      } catch {
        if (alive) setStatus({ kind: "failed" });
      }
    })();

    return () => {
      alive = false;
    };
    // Deliberately keyed on the pincode alone: re-running when the doctor
    // edits the city would re-fetch on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pincode]);

  const note = (() => {
    switch (status.kind) {
      case "looking":
        return "Looking it up…";
      case "found":
        return "Filled in from India Post. Correct anything that is not right.";
      case "unknown":
        return "We do not recognise that PIN code. Fill the rest in yourself.";
      case "failed":
        return "Could not look that up just now. Fill the rest in yourself.";
      default:
        return "Six digits. We will fill in the area, city and state.";
    }
  })();

  return (
    <>
      <div>
        <label
          htmlFor="pincode"
          className="mb-1.5 block text-sm font-semibold text-ink"
        >
          PIN code<span className="text-azure-600"> *</span>
        </label>
        <input
          id="pincode"
          name="pincode"
          value={pincode}
          onChange={(e) => {
            const next = e.target.value.replace(/\D/g, "").slice(0, 6);
            setPincode(next);
            onPincodeChange?.(next);
          }}
          readOnly={readOnly}
          inputMode="numeric"
          autoComplete="postal-code"
          required
          aria-invalid={pinError ? true : undefined}
          className={`w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition focus:border-azure-400 focus:ring-2 focus:ring-azure-100 ${
            readOnly
              ? "border-graphite-200 bg-graphite-50 text-graphite-500"
              : pinError
                ? "border-coral-300 bg-white text-graphite-900"
                : "border-graphite-200 bg-white text-graphite-900"
          }`}
        />
        {pinError ? (
          <p className="mt-1.5 text-xs font-medium text-coral-600">{pinError}</p>
        ) : (
          <p
            className={`mt-1.5 text-xs ${
              status.kind === "failed" || status.kind === "unknown"
                ? "text-gold-800"
                : "text-ink-muted"
            }`}
            aria-live="polite"
          >
            {note}
          </p>
        )}
      </div>

      <Combobox
        name="area"
        label="Area"
        required
        defaultValue={area}
        options={status.kind === "found" ? status.areas : []}
        onPick={setArea}
        readOnly={readOnly}
        error={errors?.area}
        hint="The neighbourhood clients navigate by."
        emptyText="Type the neighbourhood: your own wording is fine"
      />

      <div>
        <label htmlFor="city" className="mb-1.5 block text-sm font-semibold text-ink">
          City<span className="text-azure-600"> *</span>
        </label>
        <input
          id="city"
          name="city"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          readOnly={readOnly}
          required
          aria-invalid={cityError ? true : undefined}
          className={`w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition focus:border-azure-400 focus:ring-2 focus:ring-azure-100 ${
            readOnly
              ? "border-graphite-200 bg-graphite-50 text-graphite-500"
              : cityError
                ? "border-coral-300 bg-white text-graphite-900"
                : "border-graphite-200 bg-white text-graphite-900"
          }`}
        />
        {cityError && (
          <p className="mt-1.5 text-xs font-medium text-coral-600">{cityError}</p>
        )}
      </div>

      <div>
        <label htmlFor="state" className="mb-1.5 block text-sm font-semibold text-ink">
          State<span className="text-azure-600"> *</span>
        </label>
        <input
          id="state"
          name="state"
          value={stateName}
          onChange={(e) => setStateName(e.target.value)}
          readOnly={readOnly}
          required
          aria-invalid={stateError ? true : undefined}
          className={`w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition focus:border-azure-400 focus:ring-2 focus:ring-azure-100 ${
            readOnly
              ? "border-graphite-200 bg-graphite-50 text-graphite-500"
              : stateError
                ? "border-coral-300 bg-white text-graphite-900"
                : "border-graphite-200 bg-white text-graphite-900"
          }`}
        />
        {stateError && (
          <p className="mt-1.5 text-xs font-medium text-coral-600">{stateError}</p>
        )}
      </div>
    </>
  );
}
