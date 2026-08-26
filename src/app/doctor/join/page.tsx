import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import BrandLogo from "@/components/BrandLogo";
import AccountStep from "@/components/doctor/join/AccountStep";
import SwitchToDoctor from "@/components/auth/SwitchToDoctor";
import { JOIN_STEPS } from "@/data/doctorJoin";
import { getCurrentUser } from "@/lib/session";
import { getOwnDoctor } from "@/lib/doctor/guard";
import { ensurePractice } from "@/lib/doctor/ensurePractice";
import { googleConfigured } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Join BluDerma",
  description: "List your practice on BluDerma.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * The practitioner onboarding wizard.
 *
 * One URL with a ?step= rather than seven routes, so "come back and finish it"
 * is a single bookmark and the progress rail has somewhere to live. Each step
 * saves to the server on its way past, which is the whole reason the account
 * is created first — see the note in lib/actions/doctorOnboarding.ts.
 */
export default async function JoinPage({
  searchParams,
}: {
  searchParams?: { step?: string };
}) {
  const user = await getCurrentUser();

  // Nobody signed in, or a client who wandered in: start at the account step.
  if (!user) return <Shell step={0}><AccountStep googleEnabled={googleConfigured} /></Shell>;

  if (user.role === "PATIENT") {
    return (
      <Shell step={0}>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <h2 className="text-lg font-bold text-slate-900">
            You are signed in as a client
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
            Practitioner accounts are separate from client accounts, so this
            one cannot list a practice. Sign out and register as a doctor.
            You can use the same email address.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <SwitchToDoctor />
            <Link href="/patient/explore" className="btn-ghost">
              Back to BluDerma
            </Link>
          </div>
        </div>
      </Shell>
    );
  }

  // A DOCTOR account with no practice IS somebody who needs to onboard, so
  // make the draft and let them get on with it. This screen used to say "no
  // practice record yet — send us a note", which was a dead end for exactly
  // the person this wizard exists to serve. It happened to anyone who
  // registered through /register?as=doctor, and to any login an admin gave
  // the Doctor role.
  //
  // ADMIN is excluded deliberately. Administrators can reach this page (the
  // middleware treats ADMIN as a superset of DOCTOR), and creating a practice
  // for them would put a staff account into the practitioner directory.
  if (user.role === "DOCTOR") await ensurePractice(user);

  const owner = await getOwnDoctor();
  if (!owner) {
    // Creation genuinely failed — a database problem, not a missing row. Say
    // so honestly rather than blaming the account.
    return (
      <Shell step={0}>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center">
          <h2 className="text-lg font-bold text-rose-900">
            We could not open your application
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-rose-800">
            Something went wrong at our end. Try again in a moment, and tell us
            if it keeps happening.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <Link href="/doctor/join" className="btn-primary">
              Try again
            </Link>
            <a
              href="mailto:info@bluderma.kr?subject=Cannot%20start%20my%20doctor%20application"
              className="btn-ghost"
            >
              Email us
            </a>
          </div>
        </div>
      </Shell>
    );
  }

  // Onboarding lives in the portal now. This page stays public so a stranger
  // can still create an account at step 0, but a signed-in practitioner is
  // sent where the steps actually render — carrying ?step= across, so every
  // deep link we have ever emailed still lands on the right screen.
  const requested = Number(searchParams?.step ?? NaN);
  redirect(
    Number.isFinite(requested)
      ? `/doctor/portal?step=${Math.min(Math.max(requested, 1), 6)}`
      : "/doctor/portal"
  );
}

function Shell({
  step,
  rejection,
  children,
}: {
  step: number;
  rejection?: string | null;
  children: React.ReactNode;
}) {
  const current = JOIN_STEPS[step];
  const pct = Math.round((step / (JOIN_STEPS.length - 1)) * 100);

  return (
    <div className="theme-light pro-surface min-h-screen bg-[var(--surface)]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5 sm:px-8">
          <BrandLogo href="/doctor" size={44} />
          <Link href="/doctor" className="text-sm font-semibold text-slate-500 hover:text-slate-800">
            Exit
          </Link>
        </div>
        <div className="h-1 bg-slate-100">
          <div
            className="h-full bg-gradient-to-r from-brand-500 to-teal-500 transition-all duration-500"
            style={{ width: `${Math.max(pct, 4)}%` }}
          />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
        {rejection && (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <p className="text-sm font-bold text-rose-900">
              We asked for some changes
            </p>
            <p className="mt-1 text-sm text-rose-800">{rejection}</p>
            <p className="mt-2 text-xs text-rose-700">
              Make them below and submit again. Nothing you entered has been lost.
            </p>
          </div>
        )}

        <p className="text-[11px] font-bold uppercase tracking-widest text-brand-600">
          {step === 0 ? "Get started" : `Step ${step} of ${JOIN_STEPS.length - 1}`}
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          {current.title}
        </h1>
        <p className="mt-2 max-w-xl text-slate-600">{current.sub}</p>

        <div className="mt-8">{children}</div>
      </main>
    </div>
  );
}
