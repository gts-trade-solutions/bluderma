"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import PatientHeader from "./PatientHeader";
import {
  CheckCircle2,
  ScanFace,
  CalendarClock,
  Sparkles,
} from "@/components/icons";
import { saveProfile } from "@/lib/actions/profile";
import type { AnalysisSummaryDTO, ProfileDTO } from "@/lib/queries/patient";
import { ratingForScore } from "@/data/skin";

const GENDERS = [
  { value: "", label: "Prefer not to say" },
  { value: "FEMALE", label: "Female" },
  { value: "MALE", label: "Male" },
  { value: "OTHER", label: "Other" },
];

export default function ProfileView({
  profile,
  analyses,
  appointmentCount,
}: {
  profile: ProfileDTO;
  analyses: AnalysisSummaryDTO[];
  appointmentCount: number;
}) {
  const [form, setForm] = useState(profile);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const latest = analyses[0] ?? null;
  const previous = analyses[1] ?? null;

  const update = (key: keyof ProfileDTO, value: string) => {
    setForm((p) => ({ ...p, [key]: value }));
    setSaved(false);
    setError(null);
  };

  function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFields({});

    startTransition(async () => {
      const res = await saveProfile({
        fullName: form.fullName,
        phone: form.phone,
        age: form.age === "" ? undefined : form.age,
        gender: form.gender === "" ? undefined : form.gender,
        city: form.city,
      });

      if (!res.ok) {
        setError(res.error ?? "Could not save your profile.");
        setFields(res.fields ?? {});
        return;
      }
      setSaved(true);
    });
  }

  return (
    <>
      <PatientHeader
        eyebrow="Your account"
        title="My Profile"
        subtitle="Manage your details and see your latest skin snapshot."
      />

      <section className="mx-auto max-w-5xl px-4 py-12">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Details form */}
          <form
            onSubmit={onSave}
            className="rounded-2xl border bg-white p-6 shadow-sm lg:col-span-2"
          >
            <h2 className="text-lg font-bold text-ink">Personal details</h2>
            <p className="text-sm text-ink-muted">
              Saved to your BluDerma account and used to pre-fill bookings.
            </p>

            {error && (
              <div
                role="alert"
                className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-inset ring-rose-100"
              >
                {error}
              </div>
            )}

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <TextField
                label="Full name"
                value={form.fullName}
                onChange={(v) => update("fullName", v)}
                placeholder="Your name"
                error={fields.fullName}
              />
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-ink-soft">
                  Email
                </span>
                <input
                  value={form.email}
                  readOnly
                  disabled
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-ink-muted"
                />
                <span className="mt-1 block text-xs text-ink-muted">
                  Your sign-in address — contact support to change it.
                </span>
              </label>
              <TextField
                label="Phone"
                value={form.phone}
                onChange={(v) => update("phone", v)}
                placeholder="+91 …"
                error={fields.phone}
              />
              <TextField
                label="Age"
                type="number"
                value={form.age}
                onChange={(v) => update("age", v)}
                placeholder="e.g. 28"
                error={fields.age}
              />
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-ink-soft">
                  Gender
                </span>
                <select
                  value={form.gender}
                  onChange={(e) => update("gender", e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                >
                  {GENDERS.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </label>
              <TextField
                label="City"
                value={form.city}
                onChange={(v) => update("city", v)}
                placeholder="e.g. Bengaluru"
                error={fields.city}
              />
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button
                type="submit"
                disabled={pending}
                className="btn-primary disabled:opacity-60"
              >
                {pending ? "Saving…" : "Save changes"}
              </button>
              {saved && !pending && (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" /> Saved
                </span>
              )}
            </div>
          </form>

          {/* Side column */}
          <div className="space-y-6">
            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-rose-500" />
                <h3 className="font-bold text-ink">Skin snapshot</h3>
              </div>

              {latest ? (
                <div className="mt-4">
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-3xl font-extrabold ${
                        ratingForScore(latest.overall).color
                      }`}
                    >
                      {latest.overall}
                    </span>
                    <div className="text-sm">
                      <div className="font-semibold text-ink">
                        {ratingForScore(latest.overall).label}
                      </div>
                      <div className="text-ink-muted">
                        {latest.skinType} · ~{latest.estimatedAge} yrs
                      </div>
                    </div>
                  </div>

                  {/* Now that every score is stored, progress is measurable. */}
                  {previous && (
                    <p className="mt-3 text-xs text-ink-muted">
                      {latest.overall === previous.overall
                        ? "No change since your last analysis."
                        : latest.overall > previous.overall
                        ? `Up ${latest.overall - previous.overall} points since your last analysis.`
                        : `Down ${previous.overall - latest.overall} points since your last analysis.`}
                    </p>
                  )}

                  {latest.topConcerns.length > 0 && (
                    <ul className="mt-3 space-y-1">
                      {latest.topConcerns.map((c) => (
                        <li
                          key={c.key}
                          className="flex justify-between text-xs text-ink-muted"
                        >
                          <span>{c.label}</span>
                          <span className="font-semibold text-ink-soft">
                            {c.score}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

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

            <Link
              href="/patient/appointments"
              className="flex items-center gap-4 rounded-2xl border bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                <CalendarClock className="h-6 w-6" />
              </span>
              <div>
                <div className="text-2xl font-extrabold text-ink">
                  {appointmentCount}
                </div>
                <div className="text-sm text-ink-muted">
                  Upcoming appointment{appointmentCount === 1 ? "" : "s"} →
                </div>
              </div>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-ink-soft">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
      />
      {error && (
        <span className="mt-1 block text-xs font-medium text-rose-600">
          {error}
        </span>
      )}
    </label>
  );
}
