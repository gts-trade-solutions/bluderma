import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ChevronDown,
  ClipboardList,
  ScanFace,
  ShieldCheck,
} from "lucide-react";

import Navbar from "@/components/Navbar";
import RoleChooser from "@/components/RoleChooser";
import WhiteCollarBanner from "@/components/home/WhiteCollarBanner";
import Footer from "@/components/Footer";
import { buildPatientMenu } from "@/lib/queries/nav";
import ComingSoonTicker from "@/components/hub/ComingSoonTicker";
import HeroCarousel, {
  type HeroSlideData,
} from "@/components/home/HeroCarousel";
import { getActiveBanners, getSettings } from "@/lib/queries/content";
import TopTreatments from "@/components/home/TopTreatments";
import OfferBanner, { OFFER_DEFAULTS } from "@/components/home/OfferBanner";
import { HUB_CATEGORIES, TOTAL_TREATMENTS } from "@/data/hub";
import JsonLd from "@/components/JsonLd";
import { organisationLd, webSiteLd } from "@/lib/seo";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "BluDerma: skin care that starts with your skin",
  description:
    "Scan your skin free, browse every skin, hair and aesthetic treatment with no prices on the cards, and book the doctor who matches what you actually need.",
};

/**
 * The client home page.
 *
 * It is a front door, not a second hub: everything with a page of its own —
 * the categories, deals, conditions, results, doctors, the magazine — is
 * pointed at rather than repeated here. What lives on this page and nowhere
 * else is the carousel, what the platform is, and how the pricing rule works.
 */
export default async function Home() {
  // Admin-managed hero slides. With none published the carousel falls back
  // to its built-in set, so an empty CMS never blanks the top of the site.
  const [banners, settings, clinics] = await Promise.all([
    getActiveBanners("HOME_HERO"),
    getSettings(),
    prisma.clinic.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        name: true,
        addressLine1: true,
        area: true,
        city: true,
        state: true,
        pincode: true,
        phone: true,
      },
    }),
  ]);
  const offerEnabled = settings["offer.enabled"] !== "false";
  const offer = {
    badge: settings["offer.badge"] || OFFER_DEFAULTS.badge,
    headline: settings["offer.headline"] || OFFER_DEFAULTS.headline,
    regularLabel: settings["offer.regular_label"] || OFFER_DEFAULTS.regularLabel,
    regularPrice: settings["offer.regular_price"] || OFFER_DEFAULTS.regularPrice,
    freeLabel: settings["offer.free_label"] || OFFER_DEFAULTS.freeLabel,
    freePrice: settings["offer.free_price"] || OFFER_DEFAULTS.freePrice,
    discountTag: settings["offer.discount_tag"] || OFFER_DEFAULTS.discountTag,
    cta: settings["offer.cta"] || OFFER_DEFAULTS.cta,
    footnote: settings["offer.footnote"] || OFFER_DEFAULTS.footnote,
  };
  const slides: HeroSlideData[] = banners
    .filter((b) => b.mediaType === "IMAGE")
    .map((b) => ({
      key: b.id,
      eyebrow: b.eyebrow ?? "",
      title: b.title ?? "",
      titleAccent: b.titleAccent,
      body: b.subtitle ?? "",
      image: {
        desktop: b.mediaUrl,
        tablet: b.mediaUrlTablet,
        mobile: b.mediaUrlMobile,
      },
      cta: {
        label: b.ctaLabel ?? "Explore treatments",
        href: b.ctaHref ?? "/patient/explore",
      },
    }));

  return (
    <>

      {/* Two entities, both keyed by @id so any other page can reference them
          rather than restate them. Read from the same tables the clinic pages
          use: structured data that disagrees with the page it sits on is a
          manual penalty, not a bug. */}
      <JsonLd data={webSiteLd()} />
      <JsonLd data={organisationLd({ clinics })} />

      {/* Asked once, after the page has painted. See the component for why
          this is safe to do without hurting search indexing. */}
      <RoleChooser />

      <Navbar
        role="patient"
        menu={buildPatientMenu()}
        cta="none"
        overlay
        chrome="dark"
      />

      <main className="relative isolate overflow-hidden bg-[#070d1c] pb-20">
        {/* Atmosphere. A dark theme goes generic the moment the background is
            one flat neutral; this keeps a hue and a light source. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-[#070d1c] via-[#0a1226] to-[#070d1c]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-40 top-[28%] -z-10 h-[38rem] w-[38rem] rounded-full bg-brand-600/15 blur-[150px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-40 top-[62%] -z-10 h-[34rem] w-[34rem] rounded-full bg-teal-500/[0.12] blur-[150px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(146,234,217,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(146,234,217,.5) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />

        <HeroCarousel slides={slides.length ? slides : undefined} />

        {/* The offer sits under the hero, not above it: the hero is what the
            page is about, the offer is the reason to act on it. */}
        {offerEnabled && <OfferBanner copy={offer} />}

        {/* The running banner the brief asks for (C-3) — the same promise the
            second slide makes, kept moving across every visit. */}
        <ComingSoonTicker />

        {/* ── Top treatments ────────────────────────────────────────── */}
        <section className="container-page pt-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-300">
                Most asked for
              </p>
              <h2 className="display mt-2 max-w-2xl text-3xl text-white sm:text-4xl">
                Top treatments
              </h2>
            </div>
            <Link
              href="/patient/explore"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-300 hover:text-teal-200"
            >
              See all treatments
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-8">
            <TopTreatments />
          </div>
        </section>

        {/* ── The catalogue, in one line ────────────────────────────── */}
        <section className="pt-16">
          <div className="relative">
            <div className="container-page relative">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-300">
                    What we cover
                  </p>
                  <h2 className="display mt-2 text-3xl text-white sm:text-4xl">
                    {HUB_CATEGORIES.length} categories, {TOTAL_TREATMENTS}{" "}
                    treatments
                  </h2>
                </div>
                <Link
                  href="/patient/explore"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-300 hover:text-teal-200"
                >
                  Open the hub
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              {/* A grid, not a wrap. Eighteen names of wildly different
                  lengths ("Acne & Scars" against "Body & Fat Reduction") left
                  a ragged right edge and a last row of two, which read as a
                  layout accident on every width. Equal cells make the block
                  read as one object, and the label centres inside its cell
                  rather than the cell shrinking to the label. */}
              <ul className="mt-7 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {HUB_CATEGORIES.map((c) => (
                  <li key={c.slug} className="min-w-0">
                    <Link
                      href={`/patient/explore?c=${c.slug}`}
                      className="flex h-full min-h-[3.25rem] items-center justify-center text-balance rounded-2xl bg-white px-3 py-2.5 text-center text-[13px] font-semibold leading-tight text-[#070d1c] transition hover:bg-teal-400/[12%] hover:text-brand-200 sm:text-sm"
                    >
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── White Collar ──────────────────────────────────────────── */}
        {/* A section rather than a nav item: a membership is sold once, then
            lived with on the profile. Renders nothing when no plan is live. */}
        <WhiteCollarBanner />

        {/* ── Know about you ────────────────────────────────────────── */}
        <section className="container-page pt-14">
          <div className="flex flex-col items-start justify-between gap-6 rounded-[2rem] bg-gradient-to-r from-brand-700 to-teal-600 p-8 text-white sm:p-11 lg:flex-row lg:items-center">
            <div className="flex items-start gap-5">
              <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 sm:flex">
                <ClipboardList className="h-6 w-6" strokeWidth={1.7} />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-200">
                  Help us to know you
                </p>
                <h2 className="display-sm mt-2 text-2xl sm:text-3xl">
                  Seven questions, and the guesswork goes away
                </h2>
                <p className="mt-2 max-w-xl text-sm text-white/80">
                  Your skin, your routine, what you&apos;ve already tried, and
                  a skin report if you have one, optional. At the end you see
                  the doctors who match you.
                </p>
              </div>
            </div>
            <Link
              href="/patient/know-you"
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white/[0.04] px-6 py-3.5 text-sm font-bold text-brand-100 transition hover:bg-teal-400/[12%]"
            >
              Start the questionnaire
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* ── FAQ about the platform ────────────────────────────────── */}
        <section className="container-page pt-16">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-300">
            Before you start
          </p>
          <h2 className="display mt-2 text-3xl text-white sm:text-4xl">
            How this works
          </h2>

          <div className="mt-7 max-w-3xl divide-y divide-white/10 overflow-hidden rounded-3xl ring-1 ring-white/10">
            {[
              {
                q: "Is BluDerma a clinic or a marketplace?",
                a: "Both, in that order. The doctors are ours or partnered, the assessment is real, and the catalogue exists so you can see what is possible before you walk in. Not so you can order a procedure like a takeaway.",
              },
              {
                q: "What does the free scan actually give me?",
                a: "An overall score, twelve-plus individual signals, and the three that need attention first. It is a measurement, not a diagnosis. What it means for you is settled with a doctor.",
              },
              {
                q: "Do I have to book anything to get advice?",
                a: "No. The questionnaire is free and ends with a shortlist of doctors, their fees and their next free slots. Whether you book is up to you.",
              },
              {
                q: "Can I be seen at home, or by video?",
                a: "Yes to both, where the doctor offers it. Every doctor lists which modes they take, and the home visit carries a stated visit charge.",
              },
            ].map((f) => (
              <details key={f.q} className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 text-sm font-bold text-white transition hover:text-teal-200">
                  {f.q}
                  <ChevronDown className="h-4 w-4 shrink-0 text-white/50 transition-transform group-open:rotate-180" />
                </summary>
                <p className="px-6 pb-5 text-sm leading-relaxed text-white/60">
                  {f.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* ── Closing ───────────────────────────────────────────────── */}
        <section className="container-page pt-14">
          <div className="flex flex-col items-start justify-between gap-5 rounded-[2rem] p-8 ring-1 ring-white/10 sm:flex-row sm:items-center sm:p-11">
            <div className="flex items-start gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-teal-300 ring-1 ring-inset ring-white/15">
                <ShieldCheck className="h-5 w-5" strokeWidth={1.8} />
              </span>
              <div>
                <h2 className="display-sm text-xl text-white sm:text-2xl">
                  Start with the scan. It costs nothing.
                </h2>
                <p className="mt-1.5 max-w-lg text-sm text-white/60">
                  Half a minute, no card, and the rest of the site turns into a
                  shortlist of three instead of a menu of {TOTAL_TREATMENTS}.
                </p>
              </div>
            </div>
            <Link
              href="/patient/explore"
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-bold text-[#070d1c] transition hover:bg-teal-100"
            >
              <ScanFace className="h-4 w-4" />
              Scan your skin
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
