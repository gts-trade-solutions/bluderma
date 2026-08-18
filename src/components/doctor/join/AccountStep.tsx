"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";

import { startDoctorSignup } from "@/lib/actions/doctorOnboarding";

/**
 * Step 0 — the login.
 *
 * Creates the account and the DRAFT practice, then signs in immediately so the
 * next step already has a session to save against. The sign-in is a separate
 * call because NextAuth owns the cookie; doing it inside the server action
 * would mean reimplementing that.
 */
export default function AccountStep() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setFields({});
        const fd = new FormData(e.currentTarget);
        const email = String(fd.get("email") ?? "");
        const password = String(fd.get("password") ?? "");

        start(async () => {
          const res = await startDoctorSignup(fd);
          if (!res.ok) {
            setError(res.error ?? "Could not create your account.");
            setFields(res.fields ?? {});
            return;
          }
          const signedIn = await signIn("credentials", {
            email,
            password,
            redirect: false,
          });
          if (signedIn?.error) {
            // The account exists either way, so send them to sign in rather
            // than making them register again.
            router.push("/login?callbackUrl=/doctor/join");
            return;
          }
          router.push("/doctor/join?step=1");
          router.refresh();
        });
      }}
    >
      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </p>
      )}

      <Field name="name" label="Your full name" error={fields.name} autoComplete="name" required />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          name="email"
          label="Email"
          type="email"
          error={fields.email}
          autoComplete="email"
          required
        />
        <Field
          name="phone"
          label="Mobile"
          type="tel"
          error={fields.phone}
          autoComplete="tel"
          hint="We only use this to reach you about your listing."
          required
        />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          name="password"
          label="Password"
          type="password"
          error={fields.password}
          autoComplete="new-password"
          hint="At least 8 characters."
          required
        />
        <Field
          name="confirm"
          label="Confirm password"
          type="password"
          error={fields.confirm}
          autoComplete="new-password"
          required
        />
      </div>

      <div className="flex flex-wrap items-center gap-4 border-t border-slate-100 pt-5">
        <button type="submit" disabled={pending} className="btn-primary disabled:opacity-60">
          {pending ? "Creating your account…" : "Create account and continue"}
        </button>
        <p className="text-sm text-slate-500">
          Already listed with us?{" "}
          <Link
            href="/login?callbackUrl=/doctor/portal"
            className="font-semibold text-brand-700 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </form>
  );
}

function Field({
  name,
  label,
  error,
  hint,
  ...rest
}: {
  name: string;
  label: string;
  error?: string;
  hint?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-semibold text-slate-800">
        {label}
      </label>
      <input
        id={name}
        name={name}
        aria-invalid={error ? true : undefined}
        className={`mt-1.5 w-full rounded-xl border bg-white px-3.5 py-2.5 text-slate-900 outline-none transition focus:ring-4 ${
          error
            ? "border-rose-300 focus:border-rose-400 focus:ring-rose-500/15"
            : "border-slate-200 focus:border-brand-400 focus:ring-brand-500/15"
        }`}
        {...rest}
      />
      {error ? (
        <p className="mt-1 text-sm text-rose-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}
