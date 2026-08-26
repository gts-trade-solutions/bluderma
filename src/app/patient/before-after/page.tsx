import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { buildPatientMenu } from "@/lib/queries/nav";
import BeforeAfter from "@/components/hub/BeforeAfter";
import CategoryPills from "@/components/hub/CategoryPills";
import KnowYouCta from "@/components/hub/KnowYouCta";
import SectionHead from "@/components/hub/SectionHead";
import { BEFORE_AFTER, HUB_CATEGORIES } from "@/data/hub";

export const metadata: Metadata = {
  title: "Before & After",
  description:
    "Paired photographs showing what each course of treatment is aimed at, acne, melasma, scarring, lifting and hair, with the session count and timeframe for each.",
};

/**
 * Before & After as its own section (C-23). Grouped by the concern being
 * treated rather than by clinic, and carrying the same disclaimer the rail
 * on the hub does — these show what a course aims at, not a promise.
 */
export default function BeforeAfterPage() {
  const byCategory = HUB_CATEGORIES.map((c) => ({
    category: c,
    cases: BEFORE_AFTER.filter((b) => b.categorySlug === c.slug),
  })).filter((g) => g.cases.length > 0);

  return (
    <>
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

            <p className="section-eyebrow mt-6">Results</p>
            <h1 className="display mt-2 max-w-2xl text-3xl text-ink sm:text-5xl">
              Before &amp; after
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-muted">
              Every pair below carries the number of sessions and the time it
              took. No clinic, no branch, no price. What a course costs is
              settled in consultation.
            </p>
          </div>
        </section>

        <section className="container-page pt-10">
          <SectionHead
            eyebrow="All results"
            title="Every case, side by side"
            sub="Drag the handle across any photograph to compare."
          />
          <BeforeAfter cases={BEFORE_AFTER} />
        </section>

        {byCategory.map((g) => (
          <section key={g.category.slug} className="container-page pt-14">
            <SectionHead
              eyebrow={g.category.name}
              title={`What ${g.category.name.toLowerCase()} looks like`}
              action={{
                label: "See treatments",
                href: `/patient/explore/${g.category.slug}`,
              }}
            />
            <BeforeAfter cases={g.cases} />
          </section>
        ))}

        <section className="container-page pt-14">
          <SectionHead
            eyebrow="Keep browsing"
            title="By category"
          />
          <CategoryPills categories={HUB_CATEGORIES} />
        </section>

        <section className="container-page pt-14">
          <KnowYouCta variant="advice" />
        </section>
      </main>

      <Footer />
    </>
  );
}
