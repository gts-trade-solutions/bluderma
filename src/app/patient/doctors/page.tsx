import type { Metadata } from "next";
import JsonLd from "@/components/JsonLd";
import { prisma } from "@/lib/prisma";
import { absolute, itemListLd, medicalClinicLd } from "@/lib/seo";
import Link from "next/link";
import { ArrowLeft, CreditCard, ShieldCheck, Stethoscope } from "lucide-react";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { buildPatientMenu } from "@/lib/queries/nav";
import BeforeAfter from "@/components/hub/BeforeAfter";
import DoctorDirectory from "@/components/hub/DoctorDirectory";
import KnowYouCta from "@/components/hub/KnowYouCta";
import SectionHead from "@/components/hub/SectionHead";
import { BEFORE_AFTER } from "@/data/hub";
import type { Doctor } from "@/data/doctors";
import { getDoctors } from "@/lib/queries/doctors";

export const metadata: Metadata = {
  title: "Our doctors",
  description:
    "Dermatologists and aesthetic physicians available for consultation, their specialties, consultation fees, usual free slots and how to book, in clinic, by video or at home.",
};

/**
 * The doctor discovery block (C-25 … C-30) as a page: interested doctors,
 * consultation pricing, client before/after, usual available slots, and the
 * payment step inside the booking dialog.
 */
export default async function DoctorsPage() {
  // Real directory records; the DTO is already in the client Doctor shape.
  const doctors = (await getDoctors()) as unknown as Doctor[];

  /* ── The search this business actually lives on ────────────────────────
     "dermatologist in Adyar" is not answered by a treatment page, however
     well written. It is answered by a PLACE: a clinic with a postal address,
     a phone number and, where we hold it, a point on a map.

     None of that was published. The organisation entity on the home page
     nested its clinics, but a nested location inside a MedicalBusiness is
     read as an attribute of the business, not as a place in its own right —
     so every one of these clinics was invisible to local search.

     Queried here rather than taken from the doctor DTO because that query
     selects only what the cards render (area, city, coordinates) and a
     PostalAddress needs the street line, the state and the pincode. */
  const clinics = await prisma.clinic.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    take: 60,
    select: {
      id: true,
      name: true,
      addressLine1: true,
      area: true,
      city: true,
      state: true,
      pincode: true,
      phone: true,
      lat: true,
      lng: true,
    },
  });

  return (
    <>
      {clinics.map((c) => (
        <JsonLd
          key={c.id}
          data={medicalClinicLd({
            id: c.id,
            name: c.name,
            addressLine1: c.addressLine1,
            area: c.area,
            city: c.city,
            state: c.state,
            pincode: c.pincode,
            phone: c.phone,
            latitude: c.lat,
            longitude: c.lng,
          })}
        />
      ))}
      <JsonLd
        data={itemListLd(
          "Dermatologists on BluDerma",
          doctors.map((d) => ({
            name: d.name,
            url: absolute("/patient/doctors"),
          }))
        )}
      />
      <Navbar
        role="patient"
        menu={buildPatientMenu()}
      />

      <main className="bg-surface pb-20">
        <section className="border-b border-white/10 bg-white/[0.04]">
          <div className="container-page py-10">
            <Link
              href="/patient/explore"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted transition hover:text-brand-200"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to the hub
            </Link>

            <p className="section-eyebrow mt-6">Doctors</p>
            <h1 className="display mt-2 max-w-2xl text-3xl text-ink sm:text-5xl">
              The people who&apos;ll actually treat you
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-muted">
              Consultation fees are shown up front, the one place on this site
              a price appears before you speak to someone. What a treatment
              costs is quoted after an assessment, never from a menu.
            </p>

            <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs font-medium text-ink-muted">
              <li className="inline-flex items-center gap-1.5">
                <Stethoscope className="h-4 w-4 text-brand-500" /> Verified
                qualifications
              </li>
              <li className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-brand-500" /> Free
                rescheduling up to 4 hours before
              </li>
              <li className="inline-flex items-center gap-1.5">
                <CreditCard className="h-4 w-4 text-brand-500" /> Pay online or
                at the clinic
              </li>
            </ul>
          </div>
        </section>

        {/* Interested doctors + pricing + slots (C-26, C-27, C-29, C-30) */}
        <section className="container-page pt-10">
          <DoctorDirectory doctors={doctors} />
        </section>

        {/* Client before/after inside the doctor block (C-28) */}
        <section className="container-page pt-14">
          <SectionHead
            eyebrow="Their work"
            title="Client before &amp; after"
            sub="Drag the handle to compare each stage of a course."
          />
          <BeforeAfter cases={BEFORE_AFTER} />
        </section>

        <section className="container-page pt-14">
          <KnowYouCta variant="advice" />
        </section>
      </main>

      <Footer />
    </>
  );
}
