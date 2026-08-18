"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { addHoursStep, removeHours } from "@/lib/actions/doctorOnboarding";
import { WEEKDAYS, WEEKDAY_LABEL } from "@/data/doctorJoin";
import { swatchFor } from "@/components/doctor/clinicColors";

/**
 * Step 4 — working hours, per location.
 *
 * Windows accumulate rather than replace, because a morning session at one
 * clinic and an evening session at another on the same weekday is the normal
 * Indian pattern — and it is exactly the arrangement the calendar's travel
 * buffer exists to protect.
 */

interface ClinicView {
  clinic: { id: string; name: string; area: string; colorKey: string };
}

interface Window {
  id: string;
  clinicId: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotMinutes: number;
}

export default function HoursStep({
  doctor,
  mode = "join",
}: {
  doctor: { clinics: ClinicView[]; availability: Window[] };
  mode?: "join" | "manage";
}) {
  if (doctor.clinics.length === 0) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <p className="font-bold text-amber-900">Add a location first</p>
        <p className="mt-1 text-sm text-amber-800">
          Hours belong to a clinic, so there is nothing to set them against yet.
        </p>
        <Link href="/doctor/join?step=3" className="btn-primary mt-4 inline-flex">
          Back to locations
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {doctor.clinics.map((c) => (
        <ClinicHours
          key={c.clinic.id}
          clinic={c.clinic}
          windows={doctor.availability.filter((w) => w.clinicId === c.clinic.id)}
        />
      ))}

      {mode === "join" && (
        <div className="flex items-center gap-3 border-t border-slate-100 pt-5">
          <Link
            href="/doctor/join?step=5"
            className={`btn-primary ${
              doctor.availability.length === 0 ? "pointer-events-none opacity-50" : ""
            }`}
          >
            Save and continue
          </Link>
          <Link href="/doctor/join?step=3" className="btn-ghost">
            Back
          </Link>
          {doctor.availability.length === 0 && (
            <p className="text-sm text-slate-500">Add at least one session to continue.</p>
          )}
        </div>
      )}
    </div>
  );
}

function ClinicHours({
  clinic,
  windows,
}: {
  clinic: { id: string; name: string; area: string; colorKey: string };
  windows: Window[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(windows.length === 0);
  const sw = swatchFor(clinic.colorKey);

  // Grouped by day so a doctor reads their week rather than a flat list.
  const byDay = new Map<number, Window[]>();
  for (const w of windows) {
    if (!byDay.has(w.dayOfWeek)) byDay.set(w.dayOfWeek, []);
    byDay.get(w.dayOfWeek)!.push(w);
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-2.5">
        <span className={`h-3 w-3 rounded-full ${sw.dot}`} />
        <h3 className="font-bold text-slate-900">{clinic.name}</h3>
        <span className="text-sm text-slate-500">{clinic.area}</span>
      </div>

      {windows.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No hours set here yet.</p>
      ) : (
        <ul className="mt-4 space-y-1.5">
          {WEEKDAYS.filter((d) => byDay.has(d.value)).map((d) => (
            <li key={d.value} className="flex flex-wrap items-baseline gap-2 text-sm">
              <span className="w-24 shrink-0 font-semibold text-slate-700">
                {WEEKDAY_LABEL[d.value]}
              </span>
              {byDay
                .get(d.value)!
                .sort((a, b) => a.startTime.localeCompare(b.startTime))
                .map((w) => (
                  <span
                    key={w.id}
                    className="group inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700"
                  >
                    {w.startTime}–{w.endTime}
                    <span className="font-normal text-slate-400">{w.slotMinutes}m</span>
                    <button
                      onClick={() =>
                        start(async () => {
                          await removeHours(w.id);
                          router.refresh();
                        })
                      }
                      aria-label="Remove this session"
                      className="text-slate-400 transition hover:text-rose-600"
                    >
                      ✕
                    </button>
                  </span>
                ))}
            </li>
          ))}
        </ul>
      )}

      {open ? (
        <form
          className="mt-4 space-y-4 rounded-xl border border-slate-200 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            const fd = new FormData(e.currentTarget);
            start(async () => {
              const res = await addHoursStep(fd);
              if (res.ok) {
                (e.target as HTMLFormElement).reset();
                router.refresh();
              } else {
                setError(res.error ?? "Could not add that session.");
              }
            });
          }}
        >
          <input type="hidden" name="clinicId" value={clinic.id} />

          <div>
            <p className="text-sm font-semibold text-slate-800">Days</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {WEEKDAYS.map((d) => (
                <label
                  key={d.value}
                  className="cursor-pointer select-none rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 transition has-[:checked]:border-brand-600 has-[:checked]:bg-brand-600 has-[:checked]:text-white"
                >
                  <input type="checkbox" name="days" value={d.value} className="sr-only" />
                  {d.label}
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-semibold text-slate-800">From</label>
              <input
                type="time"
                name="startTime"
                required
                defaultValue="09:30"
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-800">To</label>
              <input
                type="time"
                name="endTime"
                required
                defaultValue="13:00"
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-800">
                Slot length
              </label>
              <select
                name="slotMinutes"
                defaultValue="30"
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2"
              >
                {[10, 15, 20, 30, 45, 60].map((m) => (
                  <option key={m} value={m}>
                    {m} minutes
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && <p className="text-sm text-rose-600">{error}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-full bg-brand-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-50"
            >
              {pending ? "Adding…" : "Add session"}
            </button>
            {windows.length > 0 && (
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-800"
              >
                Done
              </button>
            )}
          </div>
        </form>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="mt-4 text-sm font-bold text-brand-700 hover:underline"
        >
          + Add another session here
        </button>
      )}
    </section>
  );
}
