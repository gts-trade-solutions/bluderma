"use client";

import Link from "next/link";
import { useState } from "react";

import Field from "./Field";
import FormAlert from "./FormAlert";
import { focusField, validateForm } from "@/lib/formValidation";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // The same pass every other form in the app runs. `noValidate` is on the
    // form below, so without this nothing would check the fields at all.
    const check = validateForm(e.currentTarget);
    if (!check.ok) {
      
      focusField(e.currentTarget, check.problems[0].name);
      return;
    }

    setBusy(true);
    setError(null);

    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(data.error ?? "Something went wrong. Please try again.");
      setBusy(false);
      return;
    }

    setSent(data.message);
    setBusy(false);
  }

  if (sent) {
    return (
      <>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">Check your inbox</h1>
        <div className="mt-6">
          <FormAlert tone="success">{sent}</FormAlert>
        </div>
        <p className="mt-6 text-sm text-ink-muted">
          The link expires in 60 minutes. Didn&apos;t get it? Check your spam
          folder, or{" "}
          <button
            onClick={() => setSent(null)}
            className="font-semibold text-brand-600 hover:text-brand-700"
          >
            try a different address
          </button>
          .
        </p>
        <p className="mt-8 text-center text-sm text-ink-muted">
          <Link href="/login" className="font-semibold text-brand-600 hover:text-brand-700">
            Back to sign in
          </Link>
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-bold text-ink sm:text-3xl">
        Reset your password
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        Enter the email you signed up with and we&apos;ll send you a link to
        choose a new password.
      </p>

      <form noValidate onSubmit={onSubmit} className="mt-8 space-y-4">
        {error && <FormAlert>{error}</FormAlert>}

        <Field
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
        />

        <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-60">
          {busy ? "Sending…" : "Send reset link"}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-ink-muted">
        Remembered it?{" "}
        <Link href="/login" className="font-semibold text-brand-600 hover:text-brand-700">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
