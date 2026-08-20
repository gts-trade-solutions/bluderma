"use client";

import { useEffect, useRef, useState } from"react";
import { Check, Loader2, LocateFixed, MapPin, X } from"lucide-react";

import { useClientLocation } from"@/hooks/useClientLocation";

/**
 * Navbar location control. Lives globally so any page can greet the client by
 * city; the value is the client's own choice and never leaves the browser.
 */
export default function LocationButton({
  variant ="bar",
}: {
  /**"bar" is the compact navbar pill,"block" is the full-width drawer row. */
  variant?:"bar" |"block";
}) {
  const { location, status, ready, detect, setCity, clear } = useClientLocation();
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key ==="Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Close once a city lands, so picking one feels like it committed.
  const label = location?.label ??"Set location";
  const locating = status ==="locating";

  const trigger =
    variant ==="bar" ? (
      // Solid white for the same reason as Sign in: in the bar it sits over
      // the hero photograph, where a translucent pill disappears.
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex max-w-[10.5rem] items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-sm font-semibold text-[#070d1c] shadow-[0_2px_12px_-2px_rgba(0,0,0,0.35)] transition hover:bg-teal-100"
        aria-label="Choose your location"
        aria-expanded={open}
      >
        {locating ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-brand-600" />
        ) : (
          <MapPin
            className={`h-4 w-4 shrink-0 ${ location ?"text-brand-600" :"text-slate-500"
            }`}
          />
        )}
        <span className="truncate">{ready ? label :"…"}</span>
      </button>
    ) : (
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-xl bg-white/[0.04] ring-1 ring-white/10 px-3.5 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-ink">
          <MapPin className="h-4 w-4 text-brand-300" />
          {ready ? label :"…"}
        </span>
        <span className="text-xs font-medium text-brand-300">Change</span>
      </button>
    );

  return (
    <div className="relative" ref={ref}>
      {trigger}

      {open && (
        <div
          className={`absolute z-50 mt-2 w-[19rem] animate-scale-in rounded-2xl sheet p-4 ${
            variant ==="bar" ?"right-0" :"left-0 right-0 w-auto"
          }`}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-ink">Your location</p>
              <p className="mt-0.5 text-xs text-ink-muted">
                Anywhere in the world. Used to show what is available near
                you, stored on this device only and never sent to us.
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="-mr-1 -mt-1 rounded-lg p-1 text-ink-muted hover:bg-white/10"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={detect}
            disabled={locating}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-70"
          >
            {locating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LocateFixed className="h-4 w-4" />
            )}
            {locating ?"Finding you…" :"Use my current location"}
          </button>

          {status ==="denied" && (
            <p className="mt-2 rounded-lg bg-amber-400/[12%] px-3 py-2 text-xs text-amber-800">
              Location permission was blocked. Allow it in your browser&apos;s
              site settings, or pick a city below.
            </p>
          )}
          {status ==="unsupported" && (
            <p className="mt-2 rounded-lg bg-white/10 px-3 py-2 text-xs text-ink-muted">
              This browser can&apos;t share location. Pick a city below instead.
            </p>
          )}
          {status ==="error" && (
            <p className="mt-2 rounded-lg bg-rose-500/[12%] px-3 py-2 text-xs text-rose-300">
              Couldn&apos;t get a fix. Try again, or pick a city below.
            </p>
          )}

          {/* The curated lists of Indian cities and states are gone.
              The client's note: "do not give any city name, it gives an India
              feeling". Naming a dozen Indian cities in the chooser is the site
              telling a visitor where it thinks they are, and where it thinks
              it belongs. Detection reads the device, and the field below takes
              anywhere in the world — both of which let the visitor say where
              they are without us proposing it. */}
          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!custom.trim()) return;
              setCity(custom);
              setCustom("");
              setOpen(false);
            }}
          >
            <input
              autoFocus
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="Enter your city or area…"
              className="min-w-0 flex-1 rounded-xl border border-white/10 px-3 py-2 text-sm outline-none focus:border-brand-400"
            />
            <button
              type="submit"
              className="rounded-xl border border-brand-300/30 px-3 py-2 text-sm font-semibold text-brand-200 hover:bg-brand-400/[12%]"
            >
              Set
            </button>
          </form>

          {location && (
            <button
              onClick={() => {
                clear();
                setOpen(false);
              }}
              className="mt-3 w-full text-center text-xs font-medium text-ink-muted underline hover:text-rose-600"
            >
              Clear location
            </button>
          )}
        </div>
      )}
    </div>
  );
}
