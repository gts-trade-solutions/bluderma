"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSession, signIn } from "next-auth/react";
import { postLoginPath } from "@/lib/roles";
import { useState } from "react";

import Field from "./Field";
import FormAlert from "./FormAlert";
import GoogleButton from "./GoogleButton";
import AuthDivider from "./AuthDivider";
import AudienceToggle, { type Audience } from "./AudienceToggle";

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

export default function LoginForm({ googleEnabled = false }: { googleEnabled?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();

  // Which side of the toggle we are on. Held in the URL so a refresh or a
  // Back press keeps it.
  const audience: Audience = params.get("role") === "doctor" ? "doctor" : "client";

  // An explicit request always wins: somebody who clicked "sign in to book
  // this appointment" goes back to that appointment whatever the toggle says.
  // With none, the toggle picks the destination.
  const explicitCallback = params.get("callbackUrl");
  const callbackUrl =
    explicitCallback || (audience === "doctor" ? "/doctor/portal" : "/");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(() => {
    const code = params.get("error");
    return code ? ERROR_COPY[code] ?? "Sign-in failed. Please try again." : null;
  });

  const justReset = params.get("reset") === "1";
  const justRegistered = params.get("registered") === "1";

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

    // Where they end up depends on what the account actually is.
    //
    // The callbackUrl used to be followed blindly. A client who clicked
    // "Doctor sign in" on the practitioner home page was therefore pushed to
    // /doctor/portal, where middleware bounced them to /forbidden — a dead
    // end reached by following a button that looked right. postLoginPath
    // keeps the callbackUrl when the role can open it and falls back to that
    // role's own landing page when it cannot.
    const session = await getSession();
    const role = session?.user?.role;
    if (!role) {
      setError(ERROR_COPY.CredentialsSignin);
      setBusy(false);
      return;
    }

    const target = postLoginPath(callbackUrl, role);
    router.push(target);
    router.refresh();
  }

  return (
    <>
      <h1 className="text-2xl font-bold text-ink sm:text-3xl">Welcome back</h1>
      <p className="mt-2 text-sm text-ink-muted">
        {audience === "doctor"
          ? "Sign in to your practice: your calendar, your requests and your dashboard."
          : "Sign in to book appointments and track your skin analysis over time."}
      </p>

      <AudienceToggle value={audience} />

      {/* One line, not the paragraph this used to be. The toggle above says
          which side you are on; the only thing left worth stating is that
          getting it wrong costs nothing, because the role lives on the
          account and postLoginPath() routes on that, not on the switch. */}
      <p className="mt-3 text-center text-xs text-ink-muted">
        One sign-in for clients and doctors. Either choice reaches the same
        box, and we take you where your account belongs.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        {justRegistered && (
          <FormAlert tone="success">
            Your account is ready, sign in to continue.
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

      {googleEnabled && (
        <>
          <AuthDivider />
          {/* Google returns to where they were headed; the account's role then
              decides what it can open (a Google sign-in creates a client). */}
          <GoogleButton callbackUrl={callbackUrl} label="Sign in with Google" />
        </>
      )}

      {/* The half that was genuinely breaking: a doctor who followed a plain
          "create an account" link got a CLIENT account and only discovered it
          at /doctor/join. The link now carries the toggle's answer. */}
      <p className="mt-8 text-center text-sm text-ink-muted">
        {audience === "doctor" ? "Not listed yet?" : "New to BluDerma?"}{" "}
        <Link
          href={
            audience === "doctor"
              ? "/register?as=doctor&callbackUrl=%2Fdoctor%2Fportal"
              : `/register?callbackUrl=${encodeURIComponent(callbackUrl)}`
          }
          className="font-semibold text-brand-600 hover:text-brand-700"
        >
          {audience === "doctor"
            ? "Create a doctor account"
            : "Create an account"}
        </Link>
      </p>

      <p className="hidden">
        New to BluDerma?{" "}
        <Link
          href={`/register?callbackUrl=${encodeURIComponent(callbackUrl)}${
            // Someone who arrived here heading for the practitioner side needs
            // a PRACTITIONER account. Without this the "create an account"
            // link silently made them a client, and /doctor/join then told
            // them so with nothing they could do about it.
            callbackUrl.startsWith("/doctor") ? "&as=doctor" : ""
          }`}
          className="font-semibold text-brand-600 hover:text-brand-700"
        >
          Create an account
        </Link>
      </p>
    </>
  );
}
