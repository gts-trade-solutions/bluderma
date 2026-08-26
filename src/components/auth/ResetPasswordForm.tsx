"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import Field from "./Field";
import FormAlert from "./FormAlert";
import { focusField, validateForm } from "@/lib/formValidation";

export default function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // The same pass every other form in the app runs. `noValidate` is on the
    // form below, so without this nothing would check the fields at all.
    const check = validateForm(e.currentTarget);
    if (!check.ok) {
      setFields(check.fields);
      focusField(e.currentTarget, check.problems[0].name);
      return;
    }

    setBusy(true);
    setError(null);
    setFields({});

    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password, confirmPassword }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(data.error ?? "Could not reset your password.");
      setFields(data.fields ?? {});
      setBusy(false);
      return;
    }

    router.push("/login?reset=1");
  }

  if (!token) {
    return (
      <>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">
          Link not valid
        </h1>
        <div className="mt-6">
          <FormAlert>
            This reset link is missing its token. Request a new one to continue.
          </FormAlert>
        </div>
        <Link href="/forgot-password" className="btn-primary mt-6 w-full">
          Request a new link
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-bold text-ink sm:text-3xl">
        Choose a new password
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        Signing in on other devices will be reset once you save this.
      </p>

      <form noValidate onSubmit={onSubmit} className="mt-8 space-y-4">
        {error && <FormAlert>{error}</FormAlert>}

        <Field
          label="New password"
          type="password"
          name="password"
          autoComplete="new-password"
          required
          placeholder="At least 10 characters"
          hint="At least 10 characters. A short phrase works well."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fields.password}
          disabled={busy}
        />
        <Field
          label="Confirm new password"
          type="password"
          name="confirmPassword"
          autoComplete="new-password"
          required
          placeholder="Re-enter your password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          error={fields.confirmPassword}
          disabled={busy}
        />

        <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-60">
          {busy ? "Saving…" : "Save new password"}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-ink-muted">
        <Link href="/login" className="font-semibold text-brand-600 hover:text-brand-700">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
