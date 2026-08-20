import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import RoleAwareNavbar from "@/components/RoleAwareNavbar";
import Footer from "@/components/Footer";
import SmartImage from "@/components/SmartImage";
import EnquiryButton from "@/components/EnquiryButton";
import ClinicalNote from "@/components/ClinicalNote";
import TreatmentCard from "@/components/TreatmentCard";
import RelatedProducts from "@/components/RelatedProducts";
import TreatmentRow from "@/components/treatment/TreatmentRow";
import {
  getAllTreatmentSlugs,
  getTreatment,
  getRelated,
  getTreatmentImages,
} from "@/lib/queries/treatments";
import { getProductsForTreatment } from "@/lib/queries/products";
import { buildDoctorMenu, buildPatientMenu } from "@/lib/queries/nav";

export async function generateStaticParams() {
  const slugs = await getAllTreatmentSlugs();
  return slugs.map((slug) => ({ slug }));
}

/** Treatments are admin-editable, so re-render every 5 minutes. */
export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const t = await getTreatment(params.slug);
  if (!t) return { title: "Treatment not found" };
  return {
    title: t.seoTitle ?? t.name,
    description: t.seoDescription ?? t.summary,
  };
}

export default async function TreatmentPage({
  params,
}: {
  params: { slug: string };
}) {
  const treatment = await getTreatment(params.slug);
  if (!treatment) notFound();

  const [related, doctorMenu, products, images] = await Promise.all([
    getRelated(treatment.slug, 3),
    buildDoctorMenu(),
    getProductsForTreatment(treatment.slug),
    getTreatmentImages(treatment.slug),
  ]);
  const patientMenu = buildPatientMenu();

  const facts = [
    { label: "Sessions", value: treatment.facts.sessions },
    { label: "Downtime", value: treatment.facts.downtime },
    { label: "Results", value: treatment.facts.results },
    { label: "Lasts", value: treatment.facts.duration },
  ];

  // Section images: the ordered GALLERY slots feed the alternating rows; the
  // hero image is the fallback so a treatment without extra photos still reads
  // as a full layout rather than empty frames.
  const gallery = images.filter((i) => i.kind === "GALLERY");
  const resultShots = images.filter((i) => i.kind === "RESULT");
  const rowImage = (i: number) => gallery[i]?.url ?? treatment.image;

  return (
    <div className="theme-light bg-white">
      <RoleAwareNavbar doctorMenu={doctorMenu} patientMenu={patientMenu} />

      {/* Hero */}
      <section className="relative">
        <div className="relative h-[56vh] min-h-[420px] w-full overflow-hidden">
          <SmartImage src={treatment.image} alt={treatment.name} sizes="100vw" priority />
          <div className="absolute inset-0 bg-gradient-to-t from-brand-950/92 via-brand-950/50 to-brand-950/25" />
          <div className="absolute inset-0 flex items-end">
            <div className="container-page pb-12">
              <nav className="mb-4 flex items-center gap-2 text-sm text-white/75">
                <Link href="/patient/explore" className="hover:text-white">
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
              <div className="mt-6">
                <EnquiryButton
                  treatmentName={treatment.name}
                  productName={treatment.product.name}
                  treatmentSlug={treatment.slug}
                  label="Enquire about this treatment"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Quick-facts strip, overlapping the hero */}
        <div className="container-page relative z-10 -mt-9">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-slate-200 shadow-card sm:grid-cols-4">
            {facts.map((f) => (
              <div key={f.label} className="bg-white p-4 sm:p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-600">
                  {f.label}
                </p>
                <p className="mt-1 text-sm font-medium text-ink">{f.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Overview lead */}
      <section className="bg-white pt-16 sm:pt-20">
        <div className="container-page max-w-3xl text-center">
          <p className="section-eyebrow">Overview</p>
          <p className="mt-3 text-xl leading-relaxed text-ink-soft sm:text-2xl">
            {treatment.summary}
          </p>
        </div>
      </section>

      {/* Alternating content ↔ image rows */}
      <div className="bg-white">
        {/* How we can help — comparison / image left, support bullets right */}
        <section className="py-16 sm:py-20">
          <div className="container-page">
            <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
              <div>
                <div className="relative aspect-[4/3] overflow-hidden rounded-3xl shadow-card ring-1 ring-black/[0.04]">
                  <SmartImage
                    src={rowImage(0)}
                    alt={`${treatment.name}: what it addresses`}
                    sizes="(max-width: 1024px) 100vw, 45vw"
                    className="transition-transform duration-700 hover:scale-[1.03]"
                  />
                </div>
              </div>

              <div>
                <p className="section-eyebrow">The concern</p>
                <h2 className="mt-2 text-2xl font-bold text-ink sm:text-3xl">
                  How we can help
                </h2>
                <p className="mt-4 leading-relaxed text-ink-soft">
                  {treatment.concern}
                </p>
                {treatment.concernPoints.length > 0 && (
                  <>
                    <p className="mt-6 font-semibold text-ink">
                      Our team can support you in:
                    </p>
                    <ul className="mt-3 space-y-3">
                      {treatment.concernPoints.map((p) => (
                        <li
                          key={p}
                          className="flex items-start gap-2.5 text-ink-soft"
                        >
                          <Dot />
                          {p}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* How it works — image on the right */}
        <section className="bg-slate-50 py-16 sm:py-20">
          <div className="container-page">
            <TreatmentRow
              eyebrow="The solution"
              title="How the treatment works"
              image={rowImage(1)}
              imageAlt={`${treatment.name}: how it works`}
            >
              <p className="leading-relaxed text-ink-soft">
                {treatment.howItWorks}
              </p>
              {treatment.procedureSteps.length > 0 && (
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
              )}
            </TreatmentRow>
          </div>
        </section>

        {/* Ideal for */}
        <section className="py-16 sm:py-20">
          <div className="container-page">
            <TreatmentRow
              eyebrow="Suitability"
              title="Who it's ideal for"
              image={rowImage(2)}
              imageAlt={`${treatment.name}: who it's for`}
              reverse
            >
              <p className="leading-relaxed text-ink-soft">
                A good fit for clients looking to address{" "}
                {treatment.concern.charAt(0).toLowerCase() +
                  treatment.concern.slice(1).replace(/\.$/, "")}
                .
              </p>
              <ul className="mt-5 space-y-3">
                {treatment.idealFor.map((b) => (
                  <li
                    key={b}
                    className="flex items-start gap-2.5 text-ink-soft"
                  >
                    <CheckIcon />
                    {b}
                  </li>
                ))}
              </ul>
            </TreatmentRow>
          </div>
        </section>
      </div>

      {/* Matched product solutions — surfaced mid-page so it's easy to reach
          and interact with, rather than buried at the very bottom. */}
      <RelatedProducts
        products={products}
        subheading={`Korean solutions our team can source for ${treatment.name.toLowerCase()}. Prices on enquiry.`}
      />

      {/* Benefits — table band */}
      <section className="border-y border-slate-100 bg-gradient-to-br from-brand-50/60 to-teal-50/50 py-16 sm:py-20">
        <div className="container-page">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <p className="section-eyebrow">Why choose it</p>
            <h2 className="mt-2 text-2xl font-bold text-ink sm:text-3xl">
              Benefits of {treatment.name}
            </h2>
          </div>
          <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2">
            {treatment.benefits.map((b, i) => (
              <div
                key={b}
                className="flex items-start gap-4 rounded-2xl bg-white p-6 shadow-soft ring-1 ring-black/[0.04] transition-shadow hover:shadow-card"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-teal-500 text-white">
                  <CheckIcon big className="text-white" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-teal-600">
                    Benefit {i + 1}
                  </p>
                  <p className="mt-1 font-medium text-ink-soft">{b}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Results gallery (only when genuine result images exist) */}
      {resultShots.length > 0 && (
        <section className="bg-white py-16 sm:py-20">
          <div className="container-page">
            <div className="mb-8 max-w-2xl">
              <p className="section-eyebrow">Results</p>
              <h2 className="mt-2 text-2xl font-bold text-ink sm:text-3xl">
                What to expect
              </h2>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {resultShots.map((img, i) => (
                <figure
                  key={i}
                  className="overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-black/[0.04]"
                >
                  <div className="relative aspect-[4/3]">
                    <SmartImage
                      src={img.url}
                      alt={img.caption ?? `${treatment.name} result`}
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                  </div>
                  {img.caption && (
                    <figcaption className="p-3 text-xs text-ink-muted">
                      {img.caption}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Clinical note (clinicians only) */}
      <section className="bg-slate-50 py-14">
        <div className="container-page max-w-4xl">
          <ClinicalNote slug={treatment.slug} />
        </div>
      </section>

      {/* Matched solution + enquiry CTA band */}
      <section className="relative overflow-hidden bg-brand-950 py-16 sm:py-20">
        <div className="container-page">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-300">
                Matched solution
              </p>
              <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
                {treatment.product.name}
              </h2>
              <p className="mt-4 max-w-xl text-lg text-white/80">
                {treatment.product.descriptor}
              </p>
              <p className="mt-3 max-w-xl text-sm text-white/60">
                Interested in this treatment&apos;s solution? Send an enquiry and
                we&apos;ll follow up with details and ordering.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <EnquiryButton
                  treatmentName={treatment.name}
                  productName={treatment.product.name}
                  treatmentSlug={treatment.slug}
                />
                <Link href="/patient/explore" className="btn-outline-white">
                  Back to all treatments
                </Link>
              </div>
            </div>
            <div className="lg:justify-self-end">
              <div className="max-w-md rounded-2xl bg-white/5 p-6 text-sm leading-relaxed text-white/70 ring-1 ring-white/10 backdrop-blur">
                <p className="font-semibold text-white/90">Please note</p>
                <p className="mt-2">
                  Information here is for reference and does not replace an
                  individual medical consultation. Suitability, risks and
                  outcomes vary per client.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Related treatments */}
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
              href="/patient/explore"
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
    </div>
  );
}

function Dot() {
  return (
    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500" />
  );
}

function CheckIcon({
  big = false,
  className = "text-teal-500",
}: {
  big?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={`${big ? "h-5 w-5" : "mt-0.5 h-4 w-4"} shrink-0 ${className}`}
      fill="currentColor"
    >
      <path d="M8.2 13.3 5 10.1l1.2-1.2 2 2 5-5L14.4 7l-6.2 6.3Z" />
    </svg>
  );
}
