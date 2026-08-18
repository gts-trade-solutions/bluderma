import type { Metadata } from "next";
import Link from "next/link";

import { getCurrentUser } from "@/lib/session";
import { landingPathForRole } from "@/lib/roles";

export const metadata: Metadata = {
  title: "Access denied",
  robots: { index: false, follow: false },
};

export default async function ForbiddenPage() {
  const user = await getCurrentUser();
  const home = user ? landingPathForRole(user.role) : "/";

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
          You don&apos;t have access to this area
        </h1>
        <p className="mt-3 text-sm text-ink-muted">
          {user
            ? "Your account doesn't have the right permissions for this page. If you think that's wrong, contact your administrator."
            : "Sign in with an account that has access to continue."}
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href={home} className="btn-primary">
            Go to my home
          </Link>
          {!user && (
            <Link href="/login" className="btn-ghost">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
