import type { Metadata } from "next";
import Link from "next/link";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import JoinHero from "@/components/doctor/JoinHero";
import WhyList from "@/components/doctor/WhyList";
import SimpleSteps from "@/components/doctor/SimpleSteps";
import PortalPreview from "@/components/doctor/PortalPreview";
import DoctorFaq from "@/components/doctor/DoctorFaq";
import { buildDoctorMenu } from "@/lib/queries/nav";
import { doctorCta, doctorHasPortal } from "@/lib/doctor/viewer";
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

  const cta = doctorCta(viewer);

  return (
    /* No `.theme-light` here any more.
     *
     * The front door was the one page on the site that greeted a visitor with
     * a white screen, and it sat between a dark home page and a dark navbar —
     * so arriving felt like landing on a different product. The PORTAL stays
     * light, because a working tool wants a light canvas; the marketing page
     * in front of it now matches the rest of the site. The only light thing
     * left is the calendar sketch, which is meant to look like a screenshot
     * of the portal and is framed as one. */
    <div className="bg-[var(--surface)]">

      <Navbar
        role="doctor"
        menu={buildDoctorMenu({ hasPortal: doctorHasPortal(viewer) })}
        cta="none"
        showLocation={false}
      />

      <main>
        <JoinHero
          clinicianCount={clinicianCount}
          clinicCount={clinicCount}
          viewer={viewer}
        />

        <WhyList />

        <PortalPreview />

        <SimpleSteps viewer={viewer} />

        <DoctorFaq />

        {/* ── Closing ───────────────────────────────────────────────── */}
        <section className="container-page py-20">
          <div className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand-800 via-brand-900 to-teal-800 px-6 py-16 ring-1 ring-inset ring-white/15 sm:px-10">
          <div className="text-center">
            <h2 className="display mx-auto max-w-2xl text-balance text-3xl text-white sm:text-4xl">
              Free to list. Ten minutes to fill in. You can stop halfway.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-white/60">
              Everything saves as you go, so you can start on your phone between
              patients and finish it properly later.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href={cta.href}
                className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-base font-bold text-brand-900 transition hover:bg-teal-100"
              >
                {cta.label}
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
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
