"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import { promoteCurrentUserToDoctor } from "@/lib/actions/doctorOnboarding";

/**
 * Post-Google bridge for the doctor sign-up.
 *
 * Google always returns a PATIENT (the NextAuth adapter cannot know the intent
 * behind the click), so the "Sign up as a doctor with Google" button lands
 * here. We flip the role to DOCTOR, refresh the JWT so middleware and the
 * server both see it on the next request, then hand off to /doctor/join —
 * which creates the draft practice and forwards to the portal wizard.
 *
 * Safe to interrupt or re-run: it only ever advances a client to a
 * not-yet-live doctor draft, which an admin still has to approve.
 */
export default function DoctorGoogleBootstrap() {
  const router = useRouter();
  const { status, update } = useSession();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (status === "loading" || ran.current) return;
    ran.current = true;

    (async () => {
      if (status === "unauthenticated") {
        // Google hasn't run yet (or the session dropped) — send them to sign in
        // and return straight back here.
        router.replace("/login?callbackUrl=/doctor/join/start");
        return;
      }

      const res = await promoteCurrentUserToDoctor();
      if (!res.ok) {
        setError(res.error ?? "We could not set up your practitioner account.");
        return;
      }

      // Re-mint the token so the new DOCTOR role is visible to middleware and
      // getServerSession on the very next navigation.
      await update();
      router.replace("/doctor/join");
    })();
  }, [status, router, update]);

  return (
    <div className="theme-light pro-surface flex min-h-screen items-center justify-center bg-[var(--surface)] px-6">
      <div className="max-w-md text-center">
        {error ? (
          <>
            <h1 className="text-lg font-bold text-rose-900">Something went wrong</h1>
            <p className="mt-2 text-sm text-rose-800">{error}</p>
            <button
              onClick={() => router.replace("/doctor/join")}
              className="btn-primary mt-5"
            >
              Back to sign-up
            </button>
          </>
        ) : (
          <>
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            <h1 className="mt-4 text-lg font-bold text-slate-900">
              Setting up your practitioner account…
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              One moment: taking you to your application.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
