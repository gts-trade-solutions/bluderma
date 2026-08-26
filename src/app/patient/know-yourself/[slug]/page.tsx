import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Clock } from "lucide-react";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SmartImage from "@/components/SmartImage";
import { buildPatientMenu } from "@/lib/queries/nav";
import KnowYouCta from "@/components/hub/KnowYouCta";
import SectionHead from "@/components/hub/SectionHead";
import { ARTICLES, ARTICLE_BY_SLUG } from "@/data/knowYourself";
import { getHubCategory } from "@/data/hub";

interface Params {
  params: { slug: string };
}

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export function generateMetadata({ params }: Params): Metadata {
  const article = ARTICLE_BY_SLUG.get(params.slug);
  if (!article) return { title: "Know Yourself" };
  return { title: article.title, description: article.dek };
}

/**
 * A Know Yourself article (C-22). The opening answer is deliberately a
 * single self-contained paragraph directly under a question-shaped heading —
 * that is what makes it quotable by AI search (A-2) as well as skimmable.
 *
 * The tie to a service is not a footnote: it's the card at the end.
 */
export default function ArticlePage({ params }: Params) {
  const article = ARTICLE_BY_SLUG.get(params.slug);
  if (!article) notFound();

  const category = getHubCategory(article.category);
  const more = ARTICLES.filter((a) => a.slug !== article.slug).slice(0, 3);

  return (
    <>
      <Navbar
        role="patient"
        menu={buildPatientMenu()}
      />

      <main className="bg-surface pb-20">
        <article>
          {/* ── Header ─────────────────────────────────────────────────── */}
          <header className="border-b border-white/10 bg-white/[0.04]">
            <div className="container-page py-10">
              <Link
                href="/patient/know-yourself"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted transition hover:text-brand-200"
              >
                <ArrowLeft className="h-4 w-4" />
                Know Yourself
              </Link>

              <p className="section-eyebrow mt-6">
                {article.issue} · {article.section}
              </p>
              <h1 className="display mt-3 max-w-3xl text-3xl leading-[1.1] text-ink sm:text-5xl">
                {article.title}
              </h1>
              <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-muted">
                {article.dek}
              </p>
              <p className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-ink-muted">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> {article.readMins} min read
                </span>
                <Link
                  href={`/patient/explore/${article.category}`}
                  className="chip hover:bg-brand-400/20"
                >
                  {article.categoryLabel}
                </Link>
              </p>
            </div>
          </header>

          {/* ── Lead image ─────────────────────────────────────────────── */}
          <div className="container-page pt-8">
            <div className="relative h-56 overflow-hidden rounded-3xl sm:h-96">
              <SmartImage
                src={article.image}
                alt=""
                sizes="100vw"
                priority
              />
            </div>
          </div>

          {/* ── Body ───────────────────────────────────────────────────── */}
          <div className="container-page pt-10">
            <div className="mx-auto max-w-2xl">
              <p className="rounded-3xl border border-brand-300/25 bg-white/[0.04] p-6 text-lg leading-relaxed text-ink sm:p-7">
                {article.answer}
              </p>

              {article.body.map((s) => (
                <section key={s.heading} className="mt-9">
                  <h2 className="display-sm text-xl text-ink sm:text-2xl">
                    {s.heading}
                  </h2>
                  <p className="mt-3 text-[15px] leading-[1.75] text-ink-soft">
                    {s.text}
                  </p>
                </section>
              ))}

              <p className="mt-10 rounded-2xl bg-white/10 px-5 py-4 text-xs leading-relaxed text-ink-muted">
                General information, not medical advice. What applies to your
                skin is decided by a doctor after an assessment.
              </p>
            </div>
          </div>

          {/* ── Tied service (C-22) ────────────────────────────────────── */}
          {category && (
            <div className="container-page pt-12">
              <div className="mx-auto max-w-2xl">
                <Link
                  href={`/patient/explore/${category.slug}`}
                  className="group flex items-center justify-between gap-5 rounded-3xl bg-white/[0.04] ring-1 ring-white/10 p-6"
                >
                  <div>
                    <p className="section-eyebrow">The service behind this</p>
                    <p className="display-sm mt-1.5 text-lg text-ink">
                      {category.name}
                    </p>
                    <p className="mt-1 text-sm text-ink-muted">
                      {category.treatments.length} treatments · no prices, no
                      clinic names, enquiry first.
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 shrink-0 text-brand-300 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>
          )}
        </article>

        {/* ── Keep reading ─────────────────────────────────────────────── */}
        <section className="container-page pt-14">
          <SectionHead
            eyebrow="Keep reading"
            title="More from this issue"
            action={{ label: "All articles", href: "/patient/know-yourself" }}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            {more.map((a) => (
              <Link
                key={a.slug}
                href={`/patient/know-yourself/${a.slug}`}
                className="group flex flex-col overflow-hidden rounded-2xl bg-white/[0.04] ring-1 ring-white/10 transition hover:border-brand-300/50 hover:shadow-soft"
              >
                <div className="relative h-36 overflow-hidden">
                  <SmartImage
                    src={a.image}
                    alt=""
                    sizes="(min-width: 640px) 33vw, 100vw"
                    className="transition-transform duration-700 group-hover:scale-105"
                  />
                </div>
                <div className="p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-300">
                    {a.categoryLabel}
                  </p>
                  <h3 className="display-sm mt-2 text-[15px] leading-snug text-ink">
                    {a.title}
                  </h3>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="container-page pt-14">
          <KnowYouCta variant="advice" />
        </section>
      </main>

      <Footer />
    </>
  );
}
