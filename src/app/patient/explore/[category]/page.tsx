import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Flame } from "lucide-react";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SmartImage from "@/components/SmartImage";
import { buildPatientMenu } from "@/lib/queries/nav";
import { BEFORE_AFTER, HUB_DEALS } from "@/data/hub";
import { getHubCategories, getHubCategory } from "@/lib/queries/hubCatalogue";
import BeforeAfter from "@/components/hub/BeforeAfter";
import CategoryPills from "@/components/hub/CategoryPills";
import DealCard from "@/components/hub/DealCard";
import HubTreatmentCard from "@/components/hub/HubTreatmentCard";
import KnowYouCta from "@/components/hub/KnowYouCta";
import Rail from "@/components/hub/Rail";
import SectionHead from "@/components/hub/SectionHead";
import SkinScanCard from "@/components/hub/SkinScanCard";
import { categoryIcon } from "@/components/hub/icons";

interface Params {
  params: { category: string };
}

export async function generateStaticParams() {
  const categories = await getHubCategories();
  return categories.map((c) => ({ category: c.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const category = await getHubCategory(params.category);
  if (!category) return { title: "Treatments" };
  return {
    title: category.name,
    description: category.intro,
  };
}

/**
 * A category's treatments. Treatment cards carry the name, what it does and a
 * session/downtime note only — no clinic, no location, no price.
 */
export default async function CategoryPage({ params }: Params) {
  const category = await getHubCategory(params.category);
  if (!category) notFound();

  const Icon = categoryIcon(category.icon);

  const deals = HUB_DEALS.filter((d) => d.categorySlug === category.slug);
  const hot = deals.filter((d) => d.hot);
  const regular = deals.filter((d) => !d.hot);

  // Category cases first, then the rest — the rail is never empty.
  const cases = BEFORE_AFTER.filter((c) => c.categorySlug === category.slug).slice(0, 6);

  const all = await getHubCategories();
  const related = all.filter((c) => c.slug !== category.slug);

  return (
    <>
      <Navbar
        role="patient"
        menu={buildPatientMenu()}
      />

      <main className="bg-[var(--surface)] pb-20">
        {/* ── Category header ───────────────────────────────────────── */}
        <section className="relative isolate overflow-hidden bg-[#070d1c]">
          <SmartImage
            src={category.image}
            alt=""
            sizes="100vw"
            priority
            className="object-right-top"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#070d1c] via-[#070d1c]/85 to-[#070d1c]/15" />

          <div className="container-page relative py-14 sm:py-20">
            <Link
              href="/patient/explore"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-white/70 transition hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              All categories
            </Link>

            <div className="mt-5 flex items-start gap-4">
              <span
                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br shadow-[0_10px_24px_-10px_rgba(0,0,0,0.7)] ring-1 ring-inset ring-white/25 ${category.tint}`}
              >
                <Icon className="h-7 w-7" strokeWidth={1.7} />
              </span>
              <div>
                <h1 className="display text-3xl text-white sm:text-5xl">
                  {category.name}
                </h1>
                <p className="mt-1 text-sm font-medium text-teal-300">
                  {category.treatments.length} treatments
                </p>
              </div>
            </div>

            <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/70">
              {category.intro}
            </p>
          </div>
        </section>

        {/* ── Category pills ────────────────────────────────────────── */}
        <section className="border-b border-white/10 bg-white/[0.04]">
          <div className="container-page py-5">
            <CategoryPills
              categories={all}
              activeSlug={category.slug}
            />
          </div>
        </section>

        {/* ── Treatments ────────────────────────────────────────────── */}
        <section className="container-page pt-12">
          <SectionHead
            eyebrow="Treatments"
            title={`What's available in ${category.name}`}
            sub="Names and what each one does. Suitability, sessions and cost are settled in consultation."
          />

          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {category.treatments.map((t) => (
              <HubTreatmentCard
                key={t.slug}
                treatment={t}
                categorySlug={category.slug}
              />
            ))}
          </div>

          <p className="card-soft mt-5 px-4 py-3 text-xs leading-relaxed text-ink-muted">
            Not every treatment here suits every skin. Which of these is right
            for you — and how many sessions it takes — is decided after an
            assessment, not from this list.
          </p>
        </section>

        {/* ── Deals in this category ────────────────────────────────── */}
        {hot.length > 0 && (
          <section className="container-page pt-12">
            <div className="mb-5">
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-rose-600">
                <Flame className="h-3.5 w-3.5" /> Hot right now
              </p>
              <h2 className="display-sm mt-1 text-xl text-ink sm:text-2xl">
                Hot deals in {category.name}
              </h2>
            </div>
            <Rail ariaLabel={`Hot deals in ${category.name}`}>
              {hot.map((d) => (
                <DealCard key={d.slug} deal={d} />
              ))}
            </Rail>
          </section>
        )}

        {regular.length > 0 && (
          <section className="container-page pt-12">
            <SectionHead eyebrow="Running now" title="Deals &amp; packages" />
            <Rail ariaLabel={`Deals in ${category.name}`}>
              {regular.map((d) => (
                <DealCard key={d.slug} deal={d} size="sm" />
              ))}
            </Rail>
          </section>
        )}

        {deals.length === 0 && (
          <section className="container-page pt-12">
            <SectionHead eyebrow="Running now" title="Deals &amp; packages" />
            <div className="rounded-2xl border border-dashed border-white/20 bg-white/[0.04] px-5 py-8 text-center">
              <p className="text-sm font-semibold text-ink">
                No offer running on {category.name} this fortnight.
              </p>
              <Link
                href="/patient/explore#deals"
                className="mt-1 inline-block text-sm font-semibold text-brand-200 underline"
              >
                See what&apos;s on across the clinic
              </Link>
            </div>
          </section>
        )}

        {/* ── Before & after ────────────────────────────────────────── */}
        {cases.length > 0 && (
          <section className="container-page pt-14">
            <SectionHead
              eyebrow="Results"
              title="Before &amp; after"
              sub="Drag the handle to compare each stage of a course."
            />
            <BeforeAfter cases={cases} />
          </section>
        )}

        {/* ── Analyse your skin ─────────────────────────────────────── */}
        <section className="container-page pt-14">
          <SkinScanCard />
        </section>

        {/* ── Get expert advice ─────────────────────────────────────── */}
        <section className="container-page pt-14">
          <KnowYouCta variant="advice" />
        </section>

        {/* ── Keep browsing ─────────────────────────────────────────── */}
        <section className="container-page pt-14">
          <SectionHead
            eyebrow="Keep browsing"
            title="Other categories"
            action={{ label: "Back to the hub", href: "/patient/explore" }}
          />
          <CategoryPills categories={related} />
        </section>
      </main>

      <Footer />
    </>
  );
}
