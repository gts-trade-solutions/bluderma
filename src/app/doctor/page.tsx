import type { Metadata } from "next";
import Link from "next/link";

import Navbar from "@/components/Navbar";
import TestingShortcut from "@/components/TestingShortcut";
import Footer from "@/components/Footer";
import JoinHero from "@/components/doctor/JoinHero";
import SimpleSteps from "@/components/doctor/SimpleSteps";
import PortalPreview from "@/components/doctor/PortalPreview";
import DoctorFaq from "@/components/doctor/DoctorFaq";
import { buildDoctorMenu } from "@/lib/queries/nav";
import { prisma } from "@/lib/prisma";
import { PUBLIC_DOCTOR_WHERE } from "@/lib/queries/doctorAccess";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "List your practice on BluDerma",
  description:
    "Clients arrive having already scanned their skin and told us what they want treated. One calendar across every clinic you run, no commission on your consultation fee.",
};

export const dynamic = "force-dynamic";

/**
 * The practitioner front door.
 *
 * Rebuilt from scratch. What was here before was a clinical treatment
 * reference — a searchable catalogue of protocols and orderable solutions —
 * which was the wrong thing in the wrong place twice over: the catalogue
 * belongs on the client side where people are actually browsing it, and a
 * clinician landing on /doctor is deciding whether to list with us, not
 * looking up how a laser works.
 *
 * So this page now does exactly one job: explain what listing gets you, show
 * the portal you would be working in, and get you to /doctor/join.
 */
export default async function DoctorHome() {
  // Only used to decide whether the hero can honestly claim a network.
  const [clinicianCount, clinicCount, user] = await Promise.all([
    prisma.doctor.count({ where: PUBLIC_DOCTOR_WHERE }),
    prisma.clinic.count({ where: { isActive: true } }),
    getCurrentUser(),
  ]);

  // What the page offers depends on who is reading it. A signed-in
  // practitioner should not be shown "Doctor sign in", and a client should be
  // told plainly that their account cannot list a practice rather than
  // discovering it two clicks later.
  let viewer: "guest" | "client" | "doctor-pending" | "doctor-live" | "admin" =
    "guest";
  if (user?.role === "ADMIN") viewer = "admin";
  else if (user?.role === "PATIENT") viewer = "client";
  else if (user?.role === "DOCTOR") {
    const own = await prisma.doctor.findUnique({
      where: { userId: user.id },
      select: { status: true },
    });
    viewer = own?.status === "APPROVED" ? "doctor-live" : "doctor-pending";
  }

  return (
    <div className="theme-light bg-white">
      {/* Testing phase only — see TestingShortcut. */}
      <TestingShortcut from="clinic" />

      <Navbar
        role="doctor"
        menu={buildDoctorMenu()}
        cta="none"
        showLocation={false}
        chrome="light"
      />

      <main>
        <JoinHero
          clinicianCount={clinicianCount}
          clinicCount={clinicCount}
          viewer={viewer}
        />

        {/* ── Why this is worth ten minutes ─────────────────────────── */}
        <section className="bg-white py-20" id="why">
          <div className="container-page">
            <div className="max-w-2xl">
              <p className="section-eyebrow">Why list with us</p>
              <h2 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">
                A client who has already told us what is wrong
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-ink-soft">
                Most platforms sell you impressions. This one sends you people
                who have run a skin analysis, answered a clinical questionnaire
                and picked a concern — before they ever see your name.
              </p>
            </div>

            <div className="mt-12 grid gap-6 md:grid-cols-3">
              <Value
                title="No commission on consultations"
                body="Your fee is your fee. We do not take a cut of what a client pays you to see them, and we do not mark it up on the way through."
              />
              <Value
                title="Matched on what you treat"
                body="Recommendations come from the client's analysis against the concerns you told us you focus on — not from who paid most for placement."
              />
              <Value
                title="You control your diary"
                body="Confirm each booking yourself or let clients book straight in. Set travel time between your clinics. Change either whenever your week changes."
              />
              <Value
                title="Every clinic in one calendar"
                body="Work at three locations and see one week, colour-coded. A booking anywhere blocks that time everywhere, because you can only be in one place."
              />
              <Value
                title="Verified means something"
                body="We check your council registration before you go live. That is why the badge on your profile is worth having — and why listing takes two days rather than two minutes."
              />
              <Value
                title="The brief before the door opens"
                body="Their analysis, their questionnaire and their history with you, attached to the appointment. You read it in the drawer, not in the room."
              />
            </div>
          </div>
        </section>

        <PortalPreview />

        <SimpleSteps viewer={viewer} />

        <DoctorFaq />

        {/* ── Closing ───────────────────────────────────────────────── */}
        <section className="bg-brand-950 py-20">
          <div className="container-page text-center">
            <h2 className="mx-auto max-w-2xl text-balance text-3xl font-bold text-white sm:text-4xl">
              Free to list. Ten minutes to fill in. You can stop halfway.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-white/60">
              Everything saves as you go, so you can start on your phone between
              patients and finish it properly later.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href={
                  viewer === "doctor-live" || viewer === "admin"
                    ? "/doctor/portal"
                    : "/doctor/join"
                }
                className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-base font-bold text-brand-900 transition hover:bg-teal-50"
              >
                {viewer === "doctor-live" || viewer === "admin"
                  ? "Open your portal"
                  : viewer === "doctor-pending"
                  ? "Finish your listing"
                  : "List your practice"}
                <span aria-hidden>→</span>
              </Link>
              {viewer === "guest" && (
                <Link
                  href="/login?callbackUrl=/doctor/portal"
                  className="rounded-full px-5 py-3.5 text-base font-semibold text-white/80 transition hover:text-white"
                >
                  Already listed? Sign in
                </Link>
              )}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

function Value({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-6">
      <h3 className="text-lg font-bold text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">{body}</p>
    </div>
  );
}
