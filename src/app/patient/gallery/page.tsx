import Link from "next/link";
import { GalleryStatus } from "@prisma/client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { buildPatientMenu } from "@/lib/queries/nav";
import { prisma } from "@/lib/prisma";
import { PUBLIC_DOCTOR_WHERE } from "@/lib/queries/doctorAccess";

export const metadata = {
  title: "Before and after",
  description:
    "Real results from BluDerma doctors, shown with the patient's permission.",
};
export const dynamic = "force-dynamic";

/**
 * The public before-and-after gallery.
 *
 * ── Everything here is consented, and stays that way ─────────────────────
 * A case reaches this page only when the patient has agreed AND has not
 * withdrawn. The images themselves are private objects served by
 * /api/gallery/[id]/[side], which re-checks that on every single request, so
 * withdrawing consent takes a picture down on the next load rather than
 * whenever a cache happens to expire.
 *
 * The doctor filter also honours PUBLIC_DOCTOR_WHERE. A practitioner who has
 * been suspended should not keep a shopfront here.
 *
 * ── What is deliberately not shown ───────────────────────────────────────
 * No patient names, no ages, no dates of treatment. The pair, the treatment,
 * how many sessions it took, and who did it. Anything more identifies
 * somebody who agreed to have their skin shown, not themselves.
 */
export default async function GalleryPage({
  searchParams,
}: {
  searchParams?: { doctor?: string };
}) {
  const doctorSlug = searchParams?.doctor?.trim() || "";

  const cases = await prisma.doctorGalleryCase.findMany({
    where: {
      status: GalleryStatus.PUBLISHED,
      consentGivenAt: { not: null },
      consentWithdrawnAt: null,
      doctor: {
        ...PUBLIC_DOCTOR_WHERE,
        ...(doctorSlug ? { slug: doctorSlug } : {}),
      },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    take: 60,
    select: {
      id: true,
      treatmentName: true,
      detail: true,
      caption: true,
      doctor: { select: { name: true, slug: true, specialty: true } },
    },
  });

  // Built from what is actually on the page, so the filter can never offer a
  // doctor with nothing to show.
  const doctors = [...new Map(cases.map((c) => [c.doctor.slug, c.doctor])).values()];
  const active = doctors.find((d) => d.slug === doctorSlug) ?? null;

  return (
    <>
      <Navbar role="patient" menu={buildPatientMenu()} cta="know-you" />

      <main className="bg-surface pb-20">
        <section className="border-b border-white/10 bg-white/[0.04]">
          <div className="container-page py-9">
            <p className="section-eyebrow">Before and after</p>
            <h1 className="display mt-1.5 text-3xl text-ink sm:text-4xl">
              {active ? `Work by ${active.name}` : "Real results, real patients"}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
              Every pair here is shown with the patient&apos;s written
              permission, which they can withdraw at any time. Results vary
              between people, and what a treatment can do for you is something
              only a doctor can tell you after an assessment.
            </p>
          </div>
        </section>

        {doctors.length > 1 && (
          <div className="container-page pt-6">
            <div className="flex flex-wrap gap-2">
              <Link
                href="/patient/gallery"
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${
                  active
                    ? "bg-white/[0.06] text-ink-soft ring-1 ring-inset ring-white/10"
                    : "bg-white text-[var(--on-sheet)]"
                }`}
              >
                Everyone
              </Link>
              {doctors.map((d) => (
                <Link
                  key={d.slug}
                  href={`/patient/gallery?doctor=${encodeURIComponent(d.slug)}`}
                  className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${
                    active?.slug === d.slug
                      ? "bg-white text-[var(--on-sheet)]"
                      : "bg-white/[0.06] text-ink-soft ring-1 ring-inset ring-white/10"
                  }`}
                >
                  {d.name}
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="container-page pt-6">
          {cases.length === 0 ? (
            <div className="card-soft px-6 py-16 text-center">
              <p className="text-base font-bold text-ink">Nothing here yet</p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-muted">
                Cases appear once a doctor has added one and the patient has
                agreed to it being shown. We do not publish anything without
                that.
              </p>
              <Link href="/patient/doctors" className="btn-primary mt-6">
                See our doctors
              </Link>
            </div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cases.map((c) => (
                <li key={c.id} className="card-soft overflow-hidden">
                  <div className="grid grid-cols-2 gap-px bg-white/10">
                    {(["before", "after"] as const).map((side) => (
                      <figure key={side} className="relative aspect-[4/5] bg-[var(--panel)]">
                        {/* Served through the consent-checking route, never as
                            a direct object URL. See the note at the top. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/gallery/${c.id}/${side}`}
                          alt={`${c.treatmentName}, ${side}`}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                        <figcaption className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                          {side}
                        </figcaption>
                      </figure>
                    ))}
                  </div>

                  <div className="p-4">
                    <p className="text-sm font-bold text-ink">{c.treatmentName}</p>
                    {c.detail && (
                      <p className="mt-0.5 text-xs font-semibold text-teal-300">
                        {c.detail}
                      </p>
                    )}
                    {c.caption && (
                      <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
                        {c.caption}
                      </p>
                    )}
                    <Link
                      href={`/patient/book/${c.doctor.slug}`}
                      className="mt-3 block text-xs font-semibold text-ink-muted transition hover:text-ink"
                    >
                      {c.doctor.name}
                      {c.doctor.specialty ? ` · ${c.doctor.specialty}` : ""}
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}
