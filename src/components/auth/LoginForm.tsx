"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";

import Field from "./Field";
import FormAlert from "./FormAlert";
import { ROLE_STORAGE_KEY, isExperience, type Experience } from "@/lib/roles";

/** NextAuth surfaces failures as opaque codes; translate the ones users hit. */
const ERROR_COPY: Record<string, string> = {
  CredentialsSignin: "Incorrect email or password.",
  OAuthAccountNotLinked:
    "This email is already registered with a password. Sign in with your password instead.",
  OAuthSignin: "Could not start Google sign-in. Please try again.",
  OAuthCallback: "Google sign-in failed. Please try again.",
  AccessDenied: "This account has been deactivated. Contact your administrator.",
  SessionRequired: "Please sign in to continue.",
};

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(() => {
    const code = params.get("error");
    return code ? ERROR_COPY[code] ?? "Sign-in failed. Please try again." : null;
  });

  const justReset = params.get("reset") === "1";
  const justRegistered = params.get("registered") === "1";

  // Reflect the experience chosen at the entry modal.
  const [experience, setExperience] = useState<Experience | null>(null);
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(ROLE_STORAGE_KEY);
      if (isExperience(stored)) setExperience(stored);
    } catch {
      /* ignore */
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (!res || res.error) {
      setError(ERROR_COPY[res?.error ?? ""] ?? ERROR_COPY.CredentialsSignin);
      setBusy(false);
      return;
    }

    // The server decides where each role lands; "/" resolves it.
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <>
      <h1 className="text-2xl font-bold text-ink sm:text-3xl">Welcome back</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Sign in to book appointments, track your skin analysis and access
        clinical content.
      </p>

      {experience && (
        <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-50 px-3.5 py-1.5 text-sm font-medium text-brand-700 ring-1 ring-inset ring-brand-100">
          <span className="h-2 w-2 rounded-full bg-brand-500" />
          Continuing as {experience === "doctor" ? "a Doctor" : "a Client"}
        </div>
      )}

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        {justRegistered && (
          <FormAlert tone="success">
            Your account is ready — sign in to continue.
          </FormAlert>
        )}
        {justReset && (
          <FormAlert tone="success">
            Your password has been updated. Sign in with your new password.
          </FormAlert>
        )}
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

        <div>
          <Field
            label="Password"
            type="password"
            name="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
          />
          <div className="mt-2 text-right">
            <Link
              href="/forgot-password"
              className="text-xs font-semibold text-brand-600 hover:text-brand-700"
            >
              Forgot your password?
            </Link>
          </div>
        </div>

        <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-60">
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-ink-muted">
        New to BluDerma?{" "}
        <Link
          href={`/register?callbackUrl=${encodeURIComponent(callbackUrl)}`}
          className="font-semibold text-brand-600 hover:text-brand-700"
        >
          Create an account
        </Link>
      </p>
      <p className="mt-3 text-center text-xs text-ink-muted">
        Are you a clinician?{" "}
        <Link href="/doctor" className="font-semibold text-teal-600 hover:text-teal-700">
          Request clinical access
        </Link>
      </p>
    </>
  );
}
