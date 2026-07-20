import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import RoleAwareNavbar from "@/components/RoleAwareNavbar";
import Footer from "@/components/Footer";
import SmartImage from "@/components/SmartImage";
import EnquiryButton from "@/components/EnquiryButton";
import DoctorOnly from "@/components/DoctorOnly";
import TreatmentCard from "@/components/TreatmentCard";
import {
  getAllSlugs,
  getTreatment,
  getRelated,
} from "@/data/treatments";

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Metadata {
  const t = getTreatment(params.slug);
  if (!t) return { title: "Treatment not found" };
  return {
    title: t.name,
    description: t.summary,
  };
}

export default function TreatmentPage({
  params,
}: {
  params: { slug: string };
}) {
  const treatment = getTreatment(params.slug);
  if (!treatment) notFound();

  const related = getRelated(treatment.slug, 3);
  const facts = [
    { label: "Sessions", value: treatment.facts.sessions },
    { label: "Downtime", value: treatment.facts.downtime },
    { label: "Results", value: treatment.facts.results },
    { label: "Lasts", value: treatment.facts.duration },
  ];

  return (
    <>
      <RoleAwareNavbar />

      {/* Hero */}
      <section className="relative">
        <div className="relative h-[52vh] min-h-[380px] w-full overflow-hidden">
          <SmartImage
            src={treatment.image}
            alt={treatment.name}
            sizes="100vw"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-brand-950/90 via-brand-950/45 to-brand-950/25" />
          <div className="absolute inset-0 flex items-end">
            <div className="container-page pb-10">
              <nav className="mb-4 flex items-center gap-2 text-sm text-white/75">
                <Link href="/doctor" className="hover:text-white">
                  Treatments
                </Link>
                <span>/</span>
                <span className="text-white">{treatment.category}</span>
              </nav>
              <span className="chip !bg-white/15 !text-white !ring-white/25">
                {treatment.category}
              </span>
              <h1 className="mt-4 max-w-3xl text-balance text-3xl font-bold text-white sm:text-5xl">
                {treatment.name}
              </h1>
              <p className="mt-3 max-w-2xl text-lg text-white/85">
                {treatment.tagline}
              </p>
            </div>
          </div>
        </div>

        {/* Quick facts strip */}
        <div className="container-page relative z-10 -mt-8">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-slate-200 shadow-card sm:grid-cols-4">
            {facts.map((f) => (
              <div key={f.label} className="bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-600">
                  {f.label}
                </p>
                <p className="mt-1 text-sm font-medium text-ink">{f.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Body */}
      <main className="container-page grid gap-12 py-14 lg:grid-cols-3">
        <article className="space-y-12 lg:col-span-2">
          <Block eyebrow="Overview">
            <p className="text-lg leading-relaxed text-ink-soft">
              {treatment.summary}
            </p>
          </Block>

          <Block eyebrow="The concern" title="What it addresses">
            <p className="leading-relaxed text-ink-soft">{treatment.concern}</p>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {treatment.concernPoints.map((p) => (
                <li
                  key={p}
                  className="flex items-start gap-2.5 rounded-xl bg-brand-50/60 p-3 text-sm text-ink-soft"
                >
                  <Dot />
                  {p}
                </li>
              ))}
            </ul>
          </Block>

          <Block eyebrow="The solution" title="How the treatment works">
            <p className="leading-relaxed text-ink-soft">
              {treatment.howItWorks}
            </p>
            <ol className="mt-6 space-y-4">
              {treatment.procedureSteps.map((step, i) => (
                <li key={step} className="flex gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
                    {i + 1}
                  </span>
                  <p className="pt-1 text-ink-soft">{step}</p>
                </li>
              ))}
            </ol>
          </Block>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="card p-6">
              <h3 className="text-base font-bold text-ink">Key benefits</h3>
              <ul className="mt-4 space-y-2.5">
                {treatment.benefits.map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-sm text-ink-soft">
                    <CheckIcon />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
            <div className="card p-6">
              <h3 className="text-base font-bold text-ink">Ideal for</h3>
              <ul className="mt-4 space-y-2.5">
                {treatment.idealFor.map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-sm text-ink-soft">
                    <Dot />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <DoctorOnly>
            <div className="rounded-2xl border border-brand-200 bg-brand-50/50 p-6">
              <div className="flex items-center gap-2">
                <span className="chip">Clinical note</span>
                <span className="text-xs text-ink-muted">For practitioners</span>
              </div>
              <p className="mt-3 leading-relaxed text-ink-soft">
                {treatment.clinicalNote}
              </p>
            </div>
          </DoctorOnly>
        </article>

        {/* Sidebar: product + enquiry */}
        <aside className="lg:col-span-1">
          <div className="lg:sticky lg:top-24">
            <div className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-black/[0.04]">
              <div className="bg-gradient-to-br from-brand-600 to-teal-600 p-6 text-white">
                <p className="text-xs font-semibold uppercase tracking-wide text-white/80">
                  Matched solution
                </p>
                <h3 className="mt-1 text-xl font-bold">
                  {treatment.product.name}
                </h3>
                <p className="mt-2 text-sm text-white/85">
                  {treatment.product.descriptor}
                </p>
              </div>
              <div className="space-y-4 p-6">
                <p className="text-sm text-ink-muted">
                  Interested in this treatment&apos;s solution? Send an enquiry
                  and we&apos;ll follow up with details and ordering.
                </p>
                <EnquiryButton
                  treatmentName={treatment.name}
                  productName={treatment.product.name}
                  full
                />
                <Link
                  href="/doctor#treatments"
                  className="btn-ghost w-full"
                >
                  Back to all treatments
                </Link>
              </div>
            </div>

            <div className="mt-5 rounded-2xl bg-white p-5 text-xs text-ink-muted shadow-soft ring-1 ring-black/[0.04]">
              <p className="font-semibold text-ink-soft">Please note</p>
              <p className="mt-1.5 leading-relaxed">
                Information here is for reference and does not replace an
                individual medical consultation. Suitability, risks and outcomes
                vary per patient.
              </p>
            </div>
          </div>
        </aside>
      </main>

      {/* Related */}
      <section className="border-t border-slate-100 bg-white py-16">
        <div className="container-page">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <p className="section-eyebrow">Explore more</p>
              <h2 className="mt-2 text-2xl font-bold text-ink">
                Related treatments
              </h2>
            </div>
            <Link
              href="/doctor#treatments"
              className="hidden text-sm font-semibold text-brand-600 hover:text-brand-700 sm:block"
            >
              View all →
            </Link>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((t) => (
              <TreatmentCard key={t.slug} treatment={t} />
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}

function Block({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <p className="section-eyebrow">{eyebrow}</p>
      {title && (
        <h2 className="mt-2 text-2xl font-bold text-ink">{title}</h2>
      )}
      <div className={title ? "mt-4" : "mt-3"}>{children}</div>
    </section>
  );
}

function Dot() {
  return (
    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500" />
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="mt-0.5 h-4 w-4 shrink-0 text-teal-500"
      fill="currentColor"
    >
      <path d="M8.2 13.3 5 10.1l1.2-1.2 2 2 5-5L14.4 7l-6.2 6.3Z" />
    </svg>
  );
}
