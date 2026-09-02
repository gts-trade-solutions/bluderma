"use client";

import { useMemo, useState } from "react";

import {
  COUNTRIES,
  DEFAULT_COUNTRY,
  countryByIso,
  flagOf,
  splitPhone,
} from "@/data/countries";

/**
 * A phone number with the country it belongs to.
 *
 * ── Why this exists ──────────────────────────────────────────────────────
 * The field was a bare `type="tel"` with "+91 98765 43210" as its
 * placeholder, so a number's country was whatever somebody happened to type
 * in front of it — or nothing at all. That is fine until a reminder has to be
 * sent, at which point "9876543210" is not a number anyone can dial.
 *
 * ── Why the flag and not just the name ───────────────────────────────────
 * A list of two hundred country NAMES is read; a list of flags is scanned.
 * The flag is the thing the eye lands on, so it leads, with the dial code
 * beside it because that is what people actually recognise their own country
 * by in this control. The name is in the option text for search — typing "ind"
 * in an open native select still jumps to India.
 *
 * ── One value out ────────────────────────────────────────────────────────
 * The parent gets a single E.164-ish string, "+919876543210", so nothing
 * downstream has to know this control exists. On mount an existing value is
 * split back apart, longest dial code first, so editing a saved number does
 * not silently change its country.
 */
export default function PhoneField({
  value,
  onChange,
  label = "Phone",
  name = "phone",
  hint,
  error,
  disabled,
  required,
}: {
  value: string;
  onChange: (next: string) => void;
  label?: string;
  name?: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
}) {
  // Split ONCE, on mount. Adding `value` to the deps would re-split on every
  // keystroke and fight the person typing: a half-entered number re-parses to
  // a different country and the code jumps under their fingers.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initial = useMemo(() => splitPhone(value), []);
  const [iso, setIso] = useState(initial.country.iso);
  const [local, setLocal] = useState(initial.local);

  const country = countryByIso(iso);

  function emit(nextIso: string, nextLocal: string) {
    const digits = nextLocal.replace(/\D/g, "");
    // An empty local part means an empty field, not a bare dial code — a
    // stored "+91" is not a phone number and would pass a "not empty" check.
    onChange(digits ? `+${countryByIso(nextIso).dial}${digits}` : "");
  }

  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
        {required && <span className="text-brand-500"> *</span>}
      </span>

      {/* What a plain form POST sends. The visible input holds only the local
          part, so submitting THAT would drop the country code — which is the
          bug this component exists to fix. */}
      <input type="hidden" name={name} value={value} />

      <div
        className={`flex overflow-hidden rounded-xl ring-1 transition ${
          error ? "ring-rose-400" : "ring-[var(--hairline)] focus-within:ring-brand-400"
        }`}
      >
        <select
          aria-label="Country dialling code"
          value={iso}
          disabled={disabled}
          onChange={(e) => {
            setIso(e.target.value);
            emit(e.target.value, local);
          }}
          className="shrink-0 border-r border-[var(--hairline)] bg-transparent py-2.5 pl-3 pr-1.5 text-sm font-semibold outline-none"
        >
          {COUNTRIES.map((c) => (
            <option key={c.iso} value={c.iso}>
              {flagOf(c.iso)} {c.name} +{c.dial}
            </option>
          ))}
        </select>

        {/* The chosen flag and code, repeated outside the select because a
            native select shows its option text at whatever width it likes and
            on a phone truncates it to nothing useful. */}
        <span
          aria-hidden
          className="pointer-events-none flex shrink-0 items-center gap-1 border-r border-[var(--hairline)] px-2 text-sm font-semibold tabular-nums"
        >
          <span className="text-base leading-none">{flagOf(country.iso)}</span>
          +{country.dial}
        </span>

        <input
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder={country.iso === "IN" ? "98765 43210" : "Phone number"}
          value={local}
          disabled={disabled}
          required={required}
          onChange={(e) => {
            // Digits only. A pasted "+91 98765 43210" would otherwise end up
            // as "+91+919876543210".
            const next = e.target.value.replace(/[^\d\s-]/g, "");
            setLocal(next);
            emit(iso, next);
          }}
          className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm outline-none"
        />
      </div>

      {error ? (
        <span className="mt-1 block text-xs font-semibold text-rose-500">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-ink-muted">{hint}</span>
      ) : null}
    </label>
  );
}

export { DEFAULT_COUNTRY };
