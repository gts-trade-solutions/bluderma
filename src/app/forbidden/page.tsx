import type { Metadata } from "next";
import Link from "next/link";

import { getCurrentUser } from "@/lib/session";
import { internalPath, landingPathForRole } from "@/lib/roles";
import SwitchAccount from "./SwitchAccount";

export const metadata: Metadata = {
  title: "Access denied",
  robots: { index: false, follow: false },
};

/**
 * The refusal page.
 *
 * It used to say only "your account doesn't have the right permissions —
 * contact your administrator", which is wrong twice over on a consumer
 * platform: there is no administrator to contact, and the reader is almost
 * never a stranger. They are usually one person holding both a client and a
 * practitioner login, signed in with the wrong one. So this page names the
 * account that was refused, says what the destination actually needs, and
 * offers the switch instead of leaving them to work it out.
 */

const AREAS: { prefix: string; name: string; needs: string }[] = [
  { prefix: "/admin", name: "the admin console", needs: "an administrator account" },
  { prefix: "/doctor/portal", name: "the doctor portal", needs: "a doctor account" },
];

const ROLE_WORD: Record<string, string> = {
  PATIENT: "a client account",
  DOCTOR: "a doctor account",
  ADMIN: "an administrator account",
};

export default async function ForbiddenPage({
  searchParams,
}: {
  searchParams?: { from?: string };
}) {
  const user = await getCurrentUser();
  const home = user ? landingPathForRole(user.role) : "/";
  const from = internalPath(searchParams?.from);
  const area = from ? AREAS.find((a) => from.startsWith(a.prefix)) : undefined;

  return (
    <main className="flex min-h-screen items-center justify-center bg-white/[0.04] px-5 py-16">
      <div className="w-full max-w-md text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/[12%] text-rose-600">
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none">
            <path
              d="M12 9v4m0 3h.01M10.3 3.9 2.5 17.4A2 2 0 0 0 4.2 20.4h15.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>

        <h1 className="mt-6 text-2xl font-bold text-ink sm:text-3xl">
          {area
            ? `This account can't open ${area.name}`
            : "You don't have access to this area"}
        </h1>

        <p className="mt-3 text-sm text-ink-muted">
          {!user
            ? "Sign in with an account that has access to continue."
            : area
              ? `${area.name[0].toUpperCase()}${area.name.slice(1)} needs ${area.needs}.`
              : "This page needs a different kind of account."}
        </p>

        {/* Naming the account is the whole point — "no permission" is not
            actionable when you cannot see which login is being refused. */}
        {user && (
          <p className="mt-5 rounded-xl bg-ink/[0.04] px-4 py-3 text-sm text-ink-muted">
            You are signed in as{" "}
            <strong className="font-semibold text-ink">
              {user.name || user.email}
            </strong>
            {user.name && user.email ? ` (${user.email})` : ""} is{" "}
            {ROLE_WORD[user.role] ?? "a different kind of account"}.
          </p>
        )}

        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {user ? (
            <>
              <SwitchAccount
                to={from ?? home}
                label="Sign in with a different account"
              />
              <Link href={home} className="btn-ghost">
                Go to my home
              </Link>
            </>
          ) : (
            <>
              <Link
                href={`/login${from ? `?callbackUrl=${encodeURIComponent(from)}` : ""}`}
                className="btn-primary"
              >
                Sign in
              </Link>
              <Link href="/" className="btn-ghost">
                Go home
              </Link>
            </>
          )}
        </div>

        {/* A client refused at the portal is often a practitioner who has not
            registered as one yet. Give them that door rather than nothing. */}
        {user?.role === "PATIENT" && area?.prefix === "/doctor/portal" && (
          <p className="mt-6 text-xs text-ink-muted">
            Are you a doctor?{" "}
            <Link href="/doctor" className="font-semibold text-ink underline">
              List your practice on BluDerma
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
