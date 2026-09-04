"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { addHoursStep, removeHours } from "@/lib/actions/doctorOnboarding";
import { WEEKDAYS, WEEKDAY_LABEL } from "@/data/doctorJoin";
import { swatchFor } from "@/components/doctor/clinicColors";
import { useFormValidation } from "@/hooks/useFormValidation";

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
  nextHref = "/doctor/join?step=5",
  backHref = "/doctor/join?step=3",
}: {
  doctor: { clinics: ClinicView[]; availability: Window[] };
  mode?: "join" | "manage";
  /** Overridden when this step is hosted inside the portal. */
  nextHref?: string;
  backHref?: string;
}) {
  if (doctor.clinics.length === 0) {
    return (
      <div className="rounded-[10px] border border-gold-200 bg-gold-50 p-6">
        <p className="font-bold text-gold-900">Add a location first</p>
        <p className="mt-1 text-sm text-gold-900">
          Hours belong to a clinic, so there is nothing to set them against yet.
        </p>
        <Link href={backHref} className="btn-primary mt-4 inline-flex">
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
        <div className="flex items-center gap-3 border-t border-graphite-100 pt-5">
          <Link
            href={nextHref}
            className={`btn-primary ${
              doctor.availability.length === 0 ? "pointer-events-none opacity-50" : ""
            }`}
          >
            Save and continue
          </Link>
          <Link href={backHref} className="btn-ghost">
            Back
          </Link>
          {doctor.availability.length === 0 && (
            <p className="text-sm text-graphite-500">Add at least one session to continue.</p>
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
  const formCheck = useFormValidation();
  const sw = swatchFor(clinic.colorKey);

  // Grouped by day so a doctor reads their week rather than a flat list.
  const byDay = new Map<number, Window[]>();
  for (const w of windows) {
    if (!byDay.has(w.dayOfWeek)) byDay.set(w.dayOfWeek, []);
    byDay.get(w.dayOfWeek)!.push(w);
  }

  return (
    <section className="rounded-[10px] border border-graphite-200 bg-white p-5">
      <div className="flex items-center gap-2.5">
        <span className={`h-3 w-3 rounded-full ${sw.dot}`} />
        <h3 className="font-bold text-graphite-900">{clinic.name}</h3>
        <span className="text-sm text-graphite-500">{clinic.area}</span>
      </div>

      {windows.length === 0 ? (
        <p className="mt-3 text-sm text-graphite-500">No hours set here yet.</p>
      ) : (
        <ul className="mt-4 space-y-1.5">
          {WEEKDAYS.filter((d) => byDay.has(d.value)).map((d) => (
            <li key={d.value} className="flex flex-wrap items-baseline gap-2 text-sm">
              <span className="w-24 shrink-0 font-semibold text-graphite-700">
                {WEEKDAY_LABEL[d.value]}
              </span>
              {byDay
                .get(d.value)!
                .sort((a, b) => a.startTime.localeCompare(b.startTime))
                .map((w) => (
                  <span
                    key={w.id}
                    className="group inline-flex items-center gap-1.5 rounded-full bg-graphite-100 px-2.5 py-1 text-xs font-semibold text-graphite-700"
                  >
                    {w.startTime}–{w.endTime}
                    <span className="font-normal text-graphite-500">{w.slotMinutes}m</span>
                    <button
                      onClick={() =>
                        start(async () => {
                          await removeHours(w.id);
                          router.refresh();
                        })
                      }
                      aria-label="Remove this session"
                      className="text-graphite-500 transition hover:text-coral-600"
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
          ref={formCheck.formRef}
          noValidate
          className="mt-4 space-y-4 rounded-xl border border-graphite-200 p-4"
          onSubmit={formCheck.guard((fd, form) => {
            setError(null);
            start(async () => {
              const res = await addHoursStep(fd);
              if (res.ok) {
                form.reset();
                router.refresh();
              } else {
                setError(res.error ?? "Could not add that session.");
              }
            });
          })}
        >
          {formCheck.summary}
          <input type="hidden" name="clinicId" value={clinic.id} />

          <div>
            <p className="text-sm font-semibold text-graphite-800">Days</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {WEEKDAYS.map((d) => (
                <label
                  key={d.value}
                  className="cursor-pointer select-none rounded-full border border-graphite-200 px-3 py-1.5 text-sm font-semibold text-graphite-600 transition has-[:checked]:border-azure-600 has-[:checked]:bg-azure-600 has-[:checked]:text-white"
                >
                  <input type="checkbox" name="days" value={d.value} className="sr-only" />
                  {d.label}
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-semibold text-graphite-800">From</label>
              <input
                type="time"
                name="startTime"
                required
                defaultValue="09:30"
                className="mt-1.5 w-full rounded-xl border border-graphite-200 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-graphite-800">To</label>
              <input
                type="time"
                name="endTime"
                required
                defaultValue="13:00"
                className="mt-1.5 w-full rounded-xl border border-graphite-200 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-graphite-800">
                Slot length
              </label>
              <select
                name="slotMinutes"
                defaultValue="30"
                className="mt-1.5 w-full rounded-xl border border-graphite-200 px-3 py-2"
              >
                {[10, 15, 20, 30, 45, 60].map((m) => (
                  <option key={m} value={m}>
                    {m} minutes
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && <p className="text-sm text-coral-600">{error}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-full bg-azure-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-azure-700 disabled:opacity-50"
            >
              {pending ? "Adding…" : "Add session"}
            </button>
            {windows.length > 0 && (
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full px-4 py-2 text-sm font-semibold text-graphite-500 hover:text-graphite-800"
              >
                Done
              </button>
            )}
          </div>
        </form>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="mt-4 text-sm font-bold text-azure-700 hover:underline"
        >
          + Add another session here
        </button>
      )}
    </section>
  );
}
