"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";

import Field from "./Field";
import FormAlert from "./FormAlert";
import { ROLE_STORAGE_KEY, isExperience, type Experience } from "@/lib/roles";

interface FormState {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

const EMPTY: FormState = {
  name: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
};

export default function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/patient/skin-analyzer";

  const [form, setForm] = useState<FormState>(EMPTY);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Pre-select the account type from the experience chosen at the entry modal.
  const [accountType, setAccountType] = useState<Experience>("patient");
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(ROLE_STORAGE_KEY);
      if (isExperience(stored)) setAccountType(stored);
    } catch {
      /* storage unavailable — default to patient */
    }
  }, []);

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setFields((f) => ({ ...f, [key]: "" }));
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, accountType }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(data.error ?? "Could not create your account.");
      setFields(data.fields ?? {});
      setBusy(false);
      return;
    }

    // Sign the new user straight in rather than bouncing them to /login.
    const signInRes = await signIn("credentials", {
      email: form.email,
      password: form.password,
      redirect: false,
    });

    if (!signInRes || signInRes.error) {
      router.push("/login?registered=1");
      return;
    }

    // Land doctors in the clinical hub, patients in their tools.
    const landing =
      accountType === "doctor" ? "/doctor" : callbackUrl;
    router.push(landing);
    router.refresh();
  }

  return (
    <>
      <h1 className="text-2xl font-bold text-ink sm:text-3xl">
        Create your account
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        Save your skin analyses, book appointments and track your progress over
        time.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        {error && <FormAlert>{error}</FormAlert>}

        {/* Account type — pre-selected from the entry-modal choice */}
        <div>
          <span className="mb-1.5 block text-sm font-semibold text-ink">
            I&apos;m registering as
          </span>
          <div className="grid grid-cols-2 gap-2.5">
            {(["doctor", "patient"] as Experience[]).map((t) => {
              const selected = accountType === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setAccountType(t)}
                  aria-pressed={selected}
                  disabled={busy}
                  className={`flex items-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm font-semibold transition ${
                    selected
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-slate-200 text-ink-soft hover:border-brand-300"
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                      selected ? "border-brand-600 bg-brand-600" : "border-slate-300"
                    }`}
                  >
                    {selected && (
                      <span className="h-1.5 w-1.5 rounded-full bg-white" />
                    )}
                  </span>
                  {t === "doctor" ? "A Doctor" : "Consultation"}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-xs text-ink-muted">
            {accountType === "doctor"
              ? "Clinical reference, protocols and product ordering."
              : "Treatment guides, skin analysis and clinic enquiries."}
          </p>
        </div>

        <Field
          label="Full name"
          name="name"
          autoComplete="name"
          required
          placeholder="Priya Sharma"
          value={form.name}
          onChange={set("name")}
          error={fields.name}
          disabled={busy}
        />
        <Field
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          value={form.email}
          onChange={set("email")}
          error={fields.email}
          disabled={busy}
        />
        <Field
          label="Phone"
          type="tel"
          name="phone"
          autoComplete="tel"
          placeholder="+91 98765 43210"
          hint="Optional — used only for appointment reminders."
          value={form.phone}
          onChange={set("phone")}
          error={fields.phone}
          disabled={busy}
        />
        <Field
          label="Password"
          type="password"
          name="password"
          autoComplete="new-password"
          required
          placeholder="At least 10 characters"
          hint="At least 10 characters. A short phrase works well."
          value={form.password}
          onChange={set("password")}
          error={fields.password}
          disabled={busy}
        />
        <Field
          label="Confirm password"
          type="password"
          name="confirmPassword"
          autoComplete="new-password"
          required
          placeholder="Re-enter your password"
          value={form.confirmPassword}
          onChange={set("confirmPassword")}
          error={fields.confirmPassword}
          disabled={busy}
        />

        <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-60">
          {busy ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-ink-muted">
        Already have an account?{" "}
        <Link
          href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
          className="font-semibold text-brand-600 hover:text-brand-700"
        >
          Sign in
        </Link>
      </p>
    </>
  );
}
