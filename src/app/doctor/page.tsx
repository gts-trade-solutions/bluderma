import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import HeroVideo from "@/components/HeroVideo";
import TreatmentBrowser from "@/components/TreatmentBrowser";
import SolutionTiles from "@/components/SolutionTiles";
import { treatments, categoryOrder } from "@/data/treatments";

export const metadata: Metadata = {
  title: "Clinical Reference for Practitioners",
  description:
    "BluDerma clinical hub — an evidence-informed reference to dermatology and aesthetic treatments, indications, protocols and orderable solutions for practitioners.",
};

const heroPoster =
  "https://images.unsplash.com/photo-1728727267814-792db55ce678?auto=format&fit=crop&w=1600&q=80";

const whyPoints = [
  {
    t: "Genuine, traceable products",
    d: "Every solution maps to authentic, quality-assured products you can order with confidence.",
    icon: "shield",
  },
  {
    t: "Clinical expertise",
    d: "Indication-led content built around how clinicians actually assess and plan treatment.",
    icon: "clip",
  },
  {
    t: "Personalised protocols",
    d: "Sessions, downtime and timelines for every treatment, so plans fit the patient in front of you.",
    icon: "user",
  },
  {
    t: "Unique BluDerma solutions",
    d: "A one-to-one link from each treatment to a concrete, orderable BluDerma solution.",
    icon: "spark",
  },
];

export default function DoctorHome() {
  return (
    <>
      <Navbar role="doctor" />

      {/* 1 — Clean beauty-model video hero (no overlay) */}
      <HeroVideo poster={heroPoster} />

      <main>
        {/* Headline band */}
        <section className="bg-white pt-14">
          <div className="container-page max-w-3xl">
            <span className="chip">For doctors &amp; clinicians</span>
            <h1 className="mt-4 text-balance text-4xl font-bold leading-tight text-ink sm:text-5xl">
              A clinical reference for modern skin &amp; aesthetic treatments
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-ink-soft">
              Explore indications, mechanisms and protocols across injectables,
              lasers, lifting and skin-health treatments — inspired by the
              precision of Korean dermatology. Every treatment links to an
              orderable BluDerma solution.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#solutions" className="btn-primary">
                Explore solutions
              </a>
              <a href="#treatments" className="btn-ghost">
                All treatments
              </a>
            </div>
          </div>
        </section>

        {/* 2 — Philosophy / welcome */}
        <section id="about" className="scroll-mt-24 bg-white py-20">
          <div className="container-page grid gap-10 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-7">
              <p className="section-eyebrow">Welcome to BluDerma</p>
              <h2 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">
                Natural, healthy skin — delivered through precise, considered care
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-ink-soft">
                BluDerma organises dermatology and aesthetic treatments the way
                clinicians think — by concern and by modality. Each entry starts
                from the patient&apos;s indication, explains the mechanism and
                protocol, and pairs the treatment with a concrete solution you can
                order for your clinic.
              </p>
              <p className="mt-4 leading-relaxed text-ink-muted">
                The result is a reference you can move through quickly in
                consultation — and a straightforward path from &ldquo;this is the
                right treatment&rdquo; to &ldquo;here&apos;s how to order it.&rdquo;
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 lg:col-span-5">
              {[
                { v: `${treatments.length}`, l: "Treatments referenced" },
                { v: `${categoryOrder.length}`, l: "Clinical categories" },
                { v: "100%", l: "Indication-led" },
                { v: "1:1", l: "Treatment → solution" },
              ].map((s) => (
                <div
                  key={s.l}
                  className="rounded-2xl bg-gradient-to-br from-brand-50 to-teal-50 p-6 text-center ring-1 ring-brand-100"
                >
                  <p className="text-3xl font-extrabold text-brand-700">{s.v}</p>
                  <p className="mt-1 text-xs font-medium text-ink-muted">{s.l}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 3 — Exclusive solutions (category tiles) */}
        <section id="solutions" className="scroll-mt-24 py-20">
          <div className="container-page">
            <div className="mx-auto mb-10 max-w-2xl text-center">
              <p className="section-eyebrow">BluDerma&apos;s exclusive solutions</p>
              <h2 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">
                Browse treatments by category
              </h2>
              <p className="mt-3 text-ink-muted">
                Six clinical categories covering the full aesthetic spectrum —
                select one to jump to its treatments.
              </p>
            </div>
            <SolutionTiles hubPath="/doctor" />
          </div>
        </section>

        {/* 4 — Treatments grouped */}
        <section id="treatments" className="scroll-mt-24 bg-white py-20">
          <div className="container-page">
            <div className="mb-10 max-w-2xl">
              <p className="section-eyebrow">Treatment reference</p>
              <h2 className="mt-2 text-3xl font-bold text-ink">
                Every treatment, one click away
              </h2>
              <p className="mt-3 text-ink-muted">
                Select any treatment to open its dedicated page — the concern it
                addresses, how it works, benefits, clinical notes and the matched
                BluDerma solution you can enquire to order.
              </p>
            </div>
            <TreatmentBrowser treatments={treatments} audience="doctor" />
          </div>
        </section>

        {/* 5 — Why BluDerma (medical specialties) */}
        <section id="why" className="scroll-mt-24 py-20">
          <div className="container-page">
            <div className="mx-auto mb-12 max-w-2xl text-center">
              <p className="section-eyebrow">Why BluDerma</p>
              <h2 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">
                Reference-grade content, built for the clinic
              </h2>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {whyPoints.map((f) => (
                <div key={f.t} className="card p-7">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <WhyIcon name={f.icon} />
                  </span>
                  <h3 className="mt-5 text-base font-bold text-ink">{f.t}</h3>
                  <p className="mt-2 text-sm text-ink-muted">{f.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 6 — Pricing / order CTA */}
        <section id="pricing" className="scroll-mt-24 bg-white pb-24">
          <div className="container-page">
            <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 to-teal-600 p-10 text-white shadow-card sm:p-14">
              <div className="max-w-2xl">
                <h2 className="text-3xl font-bold sm:text-4xl">
                  Order a treatment solution
                </h2>
                <p className="mt-4 text-lg text-white/85">
                  Found the right treatment for your patient? Open its page and use
                  the <span className="font-semibold">Enquiry to order</span>{" "}
                  button to request the matched BluDerma product for your clinic —
                  pricing and availability follow by return.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <a
                    href="#treatments"
                    className="btn bg-white text-brand-700 hover:bg-brand-50"
                  >
                    Explore treatments
                  </a>
                  <a href="#contact" className="btn-outline-white">
                    Contact the team
                  </a>
                </div>
                <p className="mt-6 text-xs text-white/70">
                  This is a frontend MVP — enquiries are captured in-browser for
                  demonstration only.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}

function WhyIcon({ name }: { name: string }) {
  const common = {
    className: "h-6 w-6",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "shield":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Zm-2.5 8.5 2 2 3.5-3.5" />
        </svg>
      );
    case "clip":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M9 4h6v2H9zM7 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-1M8 11h8M8 15h5" />
        </svg>
      );
    case "user":
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-6 8a6 6 0 0 1 12 0" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2.5 2.5M18 6l-2.5 2.5M6 18l2.5-2.5M18 18l-2.5-2.5" />
        </svg>
      );
  }
}
