"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSession, signIn } from "next-auth/react";
import { postLoginPath } from "@/lib/roles";
import { useState } from "react";

import Field from "./Field";
import FormAlert from "./FormAlert";

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
  /**
   * Which kind of account this creates.
   *
   * It used to be hardcoded to "patient". Everyone who registered got a client
   * account, including clinicians who had arrived from the practitioner side —
   * which is why they then saw "You are signed in as a client" on /doctor/join
   * and had no way forward.
   *
   * Practitioners normally register through /doctor/join, which creates the
   * DOCTOR account and the draft practice together. `?as=doctor` exists so a
   * link from the clinician side can never land somebody on the wrong form.
   */
  const isDoctor = params.get("as") === "doctor";
  const callbackUrl =
    params.get("callbackUrl") || (isDoctor ? "/doctor/portal" : "/patient/explore");

  const [form, setForm] = useState<FormState>(EMPTY);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
      body: JSON.stringify({
        ...form,
        accountType: isDoctor ? "doctor" : "patient",
      }),
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
      router.push(
        `/login?registered=1&callbackUrl=${encodeURIComponent(callbackUrl)}`
      );
      return;
    }

    // Route by what the account actually is, not by where they came from.
    // A callbackUrl of /doctor/portal on a client account would otherwise push
    // them straight into a middleware bounce to /forbidden.
    const session = await getSession();
    router.push(
      session?.user?.role
        ? postLoginPath(callbackUrl, session.user.role)
        : callbackUrl
    );
    router.refresh();
  }

  return (
    <>
      <h1 className="text-2xl font-bold text-ink sm:text-3xl">
        {isDoctor ? "Create your doctor account" : "Create your account"}
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        {isDoctor
          ? "This is a practitioner account — separate from a client account. You will list your practice next."
          : "Save your skin analyses, book appointments and track your progress over time."}
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        {error && <FormAlert>{error}</FormAlert>}

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
