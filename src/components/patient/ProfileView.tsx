"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PatientHeader from "./PatientHeader";
import {
  CheckCircle2,
  ScanFace,
  CalendarClock,
  Sparkles,
} from "@/components/icons";
import {
  PatientProfile,
  SavedAnalysis,
  getAnalysis,
  getAppointments,
  getProfile,
  saveProfile,
} from "@/lib/patientStore";
import { ratingForScore } from "@/data/skin";

const FIELDS: Array<{ key: keyof PatientProfile; label: string; type?: string; placeholder: string }> = [
  { key: "name", label: "Full name", placeholder: "Your name" },
  { key: "email", label: "Email", type: "email", placeholder: "you@email.com" },
  { key: "phone", label: "Phone", placeholder: "+91 …" },
  { key: "age", label: "Age", type: "number", placeholder: "e.g. 28" },
  { key: "gender", label: "Gender", placeholder: "e.g. Female" },
  { key: "city", label: "City", placeholder: "e.g. Bengaluru" },
];

export default function ProfileView() {
  const [mounted, setMounted] = useState(false);
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [analysis, setAnalysis] = useState<SavedAnalysis | null>(null);
  const [apptCount, setApptCount] = useState(0);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setMounted(true);
    setProfile(getProfile());
    setAnalysis(getAnalysis());
    setApptCount(getAppointments().length);
  }, []);

  const update = (key: keyof PatientProfile, value: string) => {
    setProfile((p) => (p ? { ...p, [key]: value } : p));
    setSaved(false);
  };

  const onSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (profile) saveProfile(profile);
    setSaved(true);
  };

  return (
    <>
      <PatientHeader
        eyebrow="Your account"
        title="My Profile"
        subtitle="Manage your details and see your latest skin snapshot."
      />

      <section className="mx-auto max-w-5xl px-4 py-12">
        {!mounted || !profile ? null : (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Details form */}
            <form
              onSubmit={onSave}
              className="rounded-2xl border bg-white p-6 shadow-sm lg:col-span-2"
            >
              <h2 className="text-lg font-bold text-ink">Personal details</h2>
              <p className="text-sm text-ink-muted">
                Saved to this browser only — no account or server needed.
              </p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {FIELDS.map((f) => (
                  <label key={f.key} className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-ink-soft">
                      {f.label}
                    </span>
                    <input
                      type={f.type ?? "text"}
                      value={profile[f.key]}
                      onChange={(e) => update(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                    />
                  </label>
                ))}
              </div>
              <div className="mt-6 flex items-center gap-3">
                <button type="submit" className="btn-primary">
                  Save changes
                </button>
                {saved && (
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" /> Saved
                  </span>
                )}
              </div>
            </form>

            {/* Side column */}
            <div className="space-y-6">
              {/* Skin snapshot */}
              <div className="rounded-2xl border bg-white p-6 shadow-sm">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-rose-500" />
                  <h3 className="font-bold text-ink">Skin snapshot</h3>
                </div>
                {analysis ? (
                  <div className="mt-4">
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-3xl font-extrabold ${ratingForScore(analysis.overall).color}`}
                      >
                        {analysis.overall}
                      </span>
                      <div className="text-sm">
                        <div className="font-semibold text-ink">
                          {ratingForScore(analysis.overall).label}
                        </div>
                        <div className="text-ink-muted">
                          {analysis.skinType} · ~{analysis.estimatedAge} yrs
                        </div>
                      </div>
                    </div>
                    <Link
                      href="/patient/skin-analyzer"
                      className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-rose-600 hover:text-rose-700"
                    >
                      <ScanFace className="h-4 w-4" /> Re-analyse my skin
                    </Link>
                  </div>
                ) : (
                  <div className="mt-3">
                    <p className="text-sm text-ink-muted">
                      No analysis yet. Run one to see your score here.
                    </p>
                    <Link
                      href="/patient/skin-analyzer"
                      className="btn-primary mt-4 !px-4 !py-2 text-sm"
                    >
                      <ScanFace className="h-4 w-4" /> Analyze now
                    </Link>
                  </div>
                )}
              </div>

              {/* Appointments summary */}
              <Link
                href="/patient/appointments"
                className="flex items-center gap-4 rounded-2xl border bg-white p-6 shadow-sm transition hover:shadow-md"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                  <CalendarClock className="h-6 w-6" />
                </span>
                <div>
                  <div className="text-2xl font-extrabold text-ink">{apptCount}</div>
                  <div className="text-sm text-ink-muted">
                    Booked appointment{apptCount === 1 ? "" : "s"} →
                  </div>
                </div>
              </Link>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
