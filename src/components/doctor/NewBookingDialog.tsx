"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import { createBookingByDoctor } from "@/lib/actions/doctorAppointments";
import { portalBtnPrimary, portalBtnQuiet } from "./portalUi";

/**
 * Booking somebody in from this side of the desk.
 *
 * ── The two kinds of person ──────────────────────────────────────────────
 * Somebody the practice has seen, who has an account and a history worth
 * attaching this visit to; and somebody who has just walked in, who has
 * neither. The form does both without asking which: type a name, and if the
 * practice already knows them they are offered. Choosing one links the
 * booking to their record — which is the whole point, because a second,
 * accountless copy of an existing patient is how a history gets split in two.
 *
 * ── What it does not ask for ─────────────────────────────────────────────
 * The intake. A client booking online is asked why they are coming, for how
 * long, how bad it is and what they have tried, because the doctor is not
 * there to ask. Here the doctor IS there, so the form asks for a time, a
 * place and a name, and leaves the note free.
 */

interface Clinic {
  id: string;
  name: string;
  /** The consultation fee for this location, prefilled and editable. */
  feeInr?: number;
}

interface Match {
  userId: string | null;
  name: string;
  publicId: string | null;
  phone: string | null;
  visits: number;
}

export default function NewBookingDialog({
  clinics,
  /** The day the calendar is showing, so the form opens on it. */
  defaultDaySeed,
  defaultFeeInr = 0,
  label = "Add booking",
}: {
  clinics: Clinic[];
  defaultDaySeed: string;
  defaultFeeInr?: number;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={portalBtnPrimary}
      >
        <span aria-hidden className="text-base leading-none">+</span>
        {label}
      </button>
      {mounted && open && (
        <Dialog
          clinics={clinics}
          defaultDaySeed={defaultDaySeed}
          defaultFeeInr={defaultFeeInr}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function Dialog({
  clinics,
  defaultDaySeed,
  defaultFeeInr,
  onClose,
}: {
  clinics: Clinic[];
  defaultDaySeed: string;
  defaultFeeInr: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [linked, setLinked] = useState<Match | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [searching, setSearching] = useState(false);
  const [mode, setMode] = useState<"CLINIC" | "VIDEO" | "HOME">("CLINIC");
  const [clinicId, setClinicId] = useState(clinics[0]?.id ?? "");

  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    nameRef.current?.focus();
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onEsc);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onEsc);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  /* Look the name up as it is typed, once there is enough of it to mean
     anything. Debounced, because this fires on every keystroke and the
     endpoint runs four grouped queries. */
  useEffect(() => {
    if (linked || name.trim().length < 2) {
      setMatches([]);
      return;
    }
    setSearching(true);
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/doctor/patients?q=${encodeURIComponent(name.trim())}`,
          { cache: "no-store" }
        );
        const data = await res.json();
        setMatches(Array.isArray(data?.rows) ? data.rows.slice(0, 5) : []);
      } catch {
        setMatches([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => window.clearTimeout(t);
  }, [name, linked]);

  function submit(formData: FormData) {
    setError(null);
    // The linked account rides alongside the typed name: the booking always
    // carries a name of its own (see Appointment.patientName), and the id is
    // what ties it to a record.
    if (linked?.userId) formData.set("patientUserId", linked.userId);
    formData.set("patientName", linked?.name ?? name);
    if (mode !== "CLINIC") formData.delete("clinicId");

    start(async () => {
      const res = await createBookingByDoctor(formData);
      if (res.ok) {
        router.refresh();
        onClose();
      } else {
        setError(res.error ?? "Could not save that.");
      }
    });
  }

  return createPortal(
    // pro-surface: this renders to document.body, outside the portal layout
    // that carries it, and a booking form inverting colour is not something
    // to leave to a theme.
    <div className="theme-light pro-surface fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-graphite-900/40 backdrop-blur-[2px]"
      />

      <div className="relative flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[14px] border border-graphite-200 bg-white shadow-2xl sm:rounded-[14px]">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-graphite-200 px-5 py-4">
          <div>
            <h2 className="font-portal text-lg font-extrabold tracking-[-0.02em] text-graphite-900">
              Book somebody in
            </h2>
            <p className="text-[13px] text-graphite-600">
              A walk-in, or somebody who rang. It goes straight into your diary —
              no confirmation needed.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-graphite-500 transition hover:bg-graphite-100 hover:text-graphite-900"
          >
            ✕
          </button>
        </header>

        <form action={submit} className="thin-scroll min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {/* ── Who ──────────────────────────────────────────────────── */}
          <div>
            <Label>Who is it for</Label>
            {linked ? (
              <div className="flex items-center gap-2 rounded-lg border border-azure-200 bg-azure-50 px-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-graphite-900">
                    {linked.name}
                  </span>
                  <span className="block text-[11px] text-graphite-600">
                    {linked.publicId ? `${linked.publicId} · ` : ""}
                    {linked.visits} visit{linked.visits === 1 ? "" : "s"} with you
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setLinked(null);
                    setName("");
                  }}
                  className="shrink-0 rounded-md px-2 py-1 text-[12px] font-bold text-azure-700 hover:bg-azure-100"
                >
                  Change
                </button>
              </div>
            ) : (
              <>
                <input
                  ref={nameRef}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Their name"
                  autoComplete="off"
                  className={FIELD}
                />
                {/* Offered, never chosen for them: linking the wrong record is
                    worse than not linking one. */}
                {(matches.length > 0 || searching) && (
                  <div className="mt-1.5 overflow-hidden rounded-lg border border-graphite-200">
                    {searching && matches.length === 0 && (
                      <p className="px-3 py-2 text-[12px] text-graphite-500">
                        Looking…
                      </p>
                    )}
                    {matches.map((m) => (
                      <button
                        key={`${m.userId ?? "guest"}-${m.name}`}
                        type="button"
                        disabled={!m.userId}
                        onClick={() => {
                          setLinked(m);
                          if (m.phone) setPhone(m.phone);
                        }}
                        className="flex w-full items-center gap-2 border-b border-graphite-100 px-3 py-2 text-left last:border-b-0 hover:bg-graphite-50 disabled:opacity-50"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-bold text-graphite-900">
                            {m.name}
                          </span>
                          <span className="block text-[11px] text-graphite-600">
                            {m.publicId ?? "no account"}
                            {m.phone ? ` · ${m.phone}` : ""}
                          </span>
                        </span>
                        <span className="shrink-0 text-[11px] font-semibold text-graphite-500">
                          {m.visits} visit{m.visits === 1 ? "" : "s"}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                <p className="mt-1 text-[11px] text-graphite-500">
                  If they have been before, pick them from the list — the visit
                  then lands on their record.
                </p>
              </>
            )}
          </div>

          <div>
            <Label>Phone</Label>
            <input
              name="patientPhone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              placeholder="Optional, but it is how you reach them"
              className={FIELD}
            />
          </div>

          {/* ── When ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Date</Label>
              <input
                type="date"
                name="daySeed"
                defaultValue={defaultDaySeed}
                required
                className={FIELD}
              />
            </div>
            <div>
              <Label>Time</Label>
              <input type="time" name="time" required step={300} className={FIELD} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>How long</Label>
              <select name="durationMin" defaultValue="30" className={FIELD}>
                {[15, 20, 30, 45, 60, 90].map((n) => (
                  <option key={n} value={n}>
                    {n} minutes
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Fee</Label>
              <input
                type="number"
                name="feeInr"
                min={0}
                step={50}
                defaultValue={defaultFeeInr}
                className={FIELD}
              />
            </div>
          </div>

          {/* ── Where ────────────────────────────────────────────────── */}
          <div>
            <Label>Kind of visit</Label>
            <div className="flex items-center gap-0.5 rounded-lg bg-graphite-100 p-0.5">
              {(
                [
                  ["CLINIC", "In clinic"],
                  ["VIDEO", "Video"],
                  ["HOME", "Home visit"],
                ] as const
              ).map(([value, text]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  aria-pressed={mode === value}
                  className={`flex-1 rounded-md px-3 py-1.5 text-[13px] font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-azure-500 ${
                    mode === value
                      ? "bg-graphite-900 text-white"
                      : "text-graphite-600 hover:text-graphite-900"
                  }`}
                >
                  {text}
                </button>
              ))}
            </div>
            <input type="hidden" name="mode" value={mode} />
          </div>

          {mode === "CLINIC" && (
            <div>
              <Label>Which location</Label>
              <select
                name="clinicId"
                value={clinicId}
                onChange={(e) => setClinicId(e.target.value)}
                className={FIELD}
              >
                {clinics.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <Label>Note</Label>
            <textarea
              name="notes"
              rows={2}
              placeholder="What it is for, in your own words. Optional."
              className={FIELD}
            />
          </div>

          {error && (
            <p className="rounded-lg border-l-4 border-l-coral-500 border border-coral-200 bg-coral-50 px-3 py-2 text-sm font-semibold text-coral-800">
              {error}
            </p>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button type="submit" disabled={pending} className={`${portalBtnPrimary} flex-1`}>
              {pending ? "Booking…" : "Put it in the diary"}
            </button>
            <button type="button" onClick={onClose} className={portalBtnQuiet}>
              Cancel
            </button>
          </div>

          <p className="pb-1 text-[11px] leading-relaxed text-graphite-500">
            Your published hours are not checked — a walk-in at eight in the
            evening is exactly what this is for. Two visits at the same time
            are: you cannot be in two places at once, at any location.
          </p>
        </form>
      </div>
    </div>,
    document.body
  );
}

const FIELD =
  // 16px on a phone: iOS Safari zooms the page in on anything smaller.
  "w-full rounded-lg border border-graphite-300 bg-white px-3 py-2 text-[16px] text-graphite-900 placeholder:text-graphite-500 focus:border-azure-500 focus:outline-none focus:ring-2 focus:ring-azure-100 sm:text-sm";

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.1em] text-graphite-600">
      {children}
    </span>
  );
}
