import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock, Flame } from "lucide-react";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SmartImage from "@/components/SmartImage";
import { buildPatientMenu } from "@/lib/queries/nav";
import { BEFORE_AFTER } from "@/data/hub";
import type { Doctor } from "@/data/doctors";
import { getDoctors } from "@/lib/queries/doctors";
import { getHubCategories } from "@/lib/queries/hubCatalogue";
import {
  getHubConcerns,
  getHubDeals,
  getHubPromos,
} from "@/lib/queries/marketing";
import { ARTICLES } from "@/data/knowYourself";
import AnalyzerRail from "@/components/hub/AnalyzerRail";
import BeforeAfter from "@/components/hub/BeforeAfter";
import CategoryExplorer from "@/components/hub/CategoryExplorer";
import CategoryRows from "@/components/hub/CategoryRows";
import ConcernRail from "@/components/hub/ConcernRail";
import DealCard from "@/components/hub/DealCard";
import KnowYouCta from "@/components/hub/KnowYouCta";
import LocationButton from "@/components/hub/LocationButton";
import PromoCarousel from "@/components/hub/PromoCarousel";
import Rail from "@/components/hub/Rail";
import RxSkinShowcase from "@/components/hub/RxSkinShowcase";
import SectionHead from "@/components/hub/SectionHead";

export const metadata: Metadata = {
  title: "Explore Treatments",
  description:
    "Browse every skin, hair and aesthetic treatment BluDerma covers — by category, sub-category or concern — with a free AI skin analysis alongside.",
};

export const dynamic = "force-dynamic";

/**
 * The browse page — where "Scan your skin" lands.
 *
 * Structured like the marketplaces it competes with: a persistent left rail
 * that keeps the analyzer in reach at any scroll depth, and a main column
 * that opens with the category row, drills into sub-categories, and only
 * then moves on to offers and editorial.
 *
 * Deliberately not a second home page — the pitch, the pricing rule and the
 * carousel live on `/` and are not repeated here.
 */
export default async function ExplorePage({
  searchParams,
}: {
  searchParams?: { c?: string };
}) {
  // Real directory records; the DTO is already in the client Doctor shape.
  const doctors = (await getDoctors()) as unknown as Doctor[];
  // The catalogue is admin-managed; counts and rails follow the database.
  const [categories, deals, promos, concerns] = await Promise.all([
    getHubCategories(),
    getHubDeals(),
    getHubPromos(),
    getHubConcerns(),
  ]);
  const treatmentCount = categories.reduce((n, c) => n + c.treatments.length, 0);

  return (
    <>
      <Navbar role="patient" menu={buildPatientMenu()} cta="know-you" />

      <main className="bg-[var(--surface)] pb-20">
        {/* ── Page head ─────────────────────────────────────────────── */}
        <section className="border-b border-white/10 bg-white/[0.04]">
          <div className="container-page flex flex-wrap items-end justify-between gap-4 py-7">
            <div>
              <p className="section-eyebrow">Browse</p>
              <h1 className="display mt-1.5 text-3xl text-ink sm:text-4xl">
                Every treatment we cover
              </h1>
              <p className="mt-2 max-w-xl text-sm text-ink-muted">
                {categories.length} categories, {treatmentCount}{" "}
                treatments. No prices and no clinic names on the cards — that
                comes from a doctor, after an assessment.
              </p>
            </div>
            <div className="shrink-0">
              <LocationButton />
            </div>
          </div>
        </section>

        {/* ── Rail + content ────────────────────────────────────────── */}
        {/* The rail sits on the right on desktop, but stays FIRST in the
            document so it is still the first thing on a phone, where the
            layout collapses to one column. `order` moves it, not the markup. */}
        <div className="container-page grid gap-8 pt-8 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-10">
          <aside className="lg:order-2 lg:sticky lg:top-24 lg:self-start">
            <AnalyzerRail />
          </aside>

          <div className="min-w-0 space-y-16 lg:order-1">
            {/* Categories → sub-categories → treatments */}
            <section id="categories" className="scroll-mt-24">
              <CategoryExplorer initialSlug={searchParams?.c} />
            </section>

            {/* Every category as a row of labels */}
            <section>
              <SectionHead
                eyebrow="The whole catalogue"
                title="Every category, at a glance"
                sub="Each row scrolls. Names and what they do — no prices, no clinic names."
              />
              <CategoryRows />
            </section>

            {/* Concerns */}
            <section>
              <SectionHead
                eyebrow="Start from the problem"
                title="What's bothering you?"
                sub="Pick a concern and we'll take you to what treats it."
              />
              <ConcernRail concerns={concerns} />
            </section>

            {/* Trending */}
            <section>
              <SectionHead
                eyebrow="Trending right now"
                title="Running this fortnight"
              />
              <PromoCarousel slides={promos} />
            </section>

            {/* Hot deals — hidden entirely when none are running, rather
                than a heading over an empty rail. */}
            {deals.hot.length > 0 && (
            <section id="deals" className="scroll-mt-24">
              <div className="mb-5">
                <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-rose-600">
                  <Flame className="h-3.5 w-3.5" /> Hot right now
                </p>
                <h2 className="display-sm mt-1 text-xl text-ink sm:text-2xl">
                  Hot deals
                </h2>
                <p className="mt-1 text-sm text-ink-muted">
                  Highest-demand courses this fortnight. Enquire to lock the
                  rate.
                </p>
              </div>
              <Rail ariaLabel="Hot deals">
                {deals.hot.map((d) => (
                  <DealCard key={d.slug} deal={d} />
                ))}
              </Rail>
            </section>
            )}

            {/* All deals */}
            {deals.regular.length > 0 && (
              <section>
                <SectionHead
                  eyebrow="Running now"
                  title="Deals &amp; packages"
                  sub="Course bundles and seasonal offers, open to everyone."
                />
                <Rail ariaLabel="Deals and packages">
                  {deals.regular.map((d) => (
                    <DealCard key={d.slug} deal={d} size="sm" />
                  ))}
                </Rail>
              </section>
            )}

            {/* Rx Skin */}
            <section id="rx-skin" className="scroll-mt-24">
              <RxSkinShowcase />
            </section>

            {/* Expert advice — directly below Rx Skin */}
            <section>
              <KnowYouCta variant="advice" />
            </section>

            {/* Results */}
            <section>
              <SectionHead
                eyebrow="Results"
                title="Before &amp; after"
                sub="Drag the handle to compare each stage of a course."
                action={{ label: "See all results", href: "/patient/before-after" }}
              />
              <BeforeAfter cases={BEFORE_AFTER.slice(0, 4)} />
            </section>

            {/* Doctors */}
            <section>
              <SectionHead
                eyebrow="Doctors"
                title="Who you'd be seeing"
                sub="Consultation fees up front. Treatment cost is quoted after an assessment."
                action={{ label: "See all doctors", href: "/patient/doctors" }}
              />
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {doctors.slice(0, 4).map((d) => (
                  <li
                    key={d.id}
                    className="flex flex-col rounded-2xl bg-white/[0.04] ring-1 ring-white/10 p-4"
                  >
                    <div className="flex items-start gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={d.image}
                        alt={d.name}
                        className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-white/10"
                        loading="lazy"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-ink">
                          {d.name}
                        </p>
                        <p className="truncate text-xs text-ink-muted">
                          {d.specialty}
                        </p>
                      </div>
                    </div>
                    <div className="mt-auto flex items-baseline justify-between border-t border-white/10 pt-3">
                      <span>
                        <span className="display-sm text-base text-ink">
                          ₹{d.fee}
                        </span>
                        <span className="ml-1 text-[11px] text-ink-muted">
                          consult
                        </span>
                      </span>
                      <Link
                        href="/patient/doctors"
                        className="text-xs font-semibold text-brand-200 hover:underline"
                      >
                        Book
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {/* Know Yourself */}
            <section>
              <SectionHead
                eyebrow="Know Yourself"
                title="Read before you book"
                sub="Direct answers to what clients actually ask, each tied to a service."
                action={{ label: "Read the issue", href: "/patient/know-yourself" }}
              />
              <Rail ariaLabel="Know Yourself articles">
                {ARTICLES.slice(0, 6).map((a) => (
                  <Link
                    key={a.slug}
                    href={`/patient/know-yourself/${a.slug}`}
                    className="group flex w-[17rem] shrink-0 snap-start flex-col overflow-hidden rounded-2xl bg-white/[0.04] ring-1 ring-white/10 transition hover:border-brand-300/50 hover:shadow-soft"
                  >
                    <div className="relative h-36 overflow-hidden">
                      <SmartImage
                        src={a.image}
                        alt=""
                        sizes="17rem"
                        className="object-top transition-transform duration-700 group-hover:scale-105"
                      />
                    </div>
                    <div className="flex flex-1 flex-col p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-300">
                        {a.categoryLabel}
                      </p>
                      <h3 className="display-sm mt-1.5 text-sm leading-snug text-ink">
                        {a.title}
                      </h3>
                      <p className="mt-2 flex-1 text-xs leading-relaxed text-ink-muted">
                        {a.dek}
                      </p>
                      <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-ink-muted">
                        <Clock className="h-3 w-3" /> {a.readMins} min read
                      </span>
                    </div>
                  </Link>
                ))}
              </Rail>
            </section>

            {/* Closing */}
            <section>
              <div className="flex flex-col items-start justify-between gap-5 rounded-3xl bg-gradient-to-r from-brand-700 to-teal-600 p-7 text-white sm:flex-row sm:items-center sm:p-9">
                <div>
                  <h2 className="display-sm text-xl sm:text-2xl">
                    Still scrolling?
                  </h2>
                  <p className="mt-1.5 max-w-lg text-sm text-white/80">
                    The scan takes half a minute and turns all{" "}
                    {treatmentCount} of these into a shortlist of three.
                  </p>
                </div>
                <Link
                  href="/patient/skin-analyzer"
                  className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white/[0.04] px-6 py-3.5 text-sm font-bold text-brand-100 transition hover:bg-teal-400/[12%]"
                >
                  Scan my skin — free
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
