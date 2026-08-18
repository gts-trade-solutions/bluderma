import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Clock } from "lucide-react";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SmartImage from "@/components/SmartImage";
import { buildPatientMenu } from "@/lib/queries/nav";
import KnowYouCta from "@/components/hub/KnowYouCta";
import SectionHead from "@/components/hub/SectionHead";
import {
  ARTICLES,
  ARTICLE_SECTIONS,
  COVER_ARTICLE,
  CURRENT_ISSUE,
  type Article,
} from "@/data/knowYourself";

export const metadata: Metadata = {
  title: "Know Yourself",
  description:
    "The BluDerma magazine — direct answers to the questions clients actually ask about acne, melasma, ageing, hair fall and treatment choices, each tied to a service.",
};

/**
 * KNOW YOURSELF (C-20 … C-22). Presented as an issue with a cover feature
 * and departments, not a reverse-chronological blog roll, and every piece
 * carries the service it belongs to.
 */
export default function KnowYourselfPage() {
  const rest = ARTICLES.filter((a) => a.slug !== COVER_ARTICLE.slug);

  return (
    <>
      <Navbar
        role="patient"
        menu={buildPatientMenu()}
      />

      <main className="bg-[var(--surface)] pb-20">
        {/* ── Masthead ─────────────────────────────────────────────────── */}
        <section className="border-b border-white/10 bg-white/[0.04]">
          <div className="container-page py-10">
            <Link
              href="/patient/explore"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted transition hover:text-brand-200"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to the hub
            </Link>

            <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="section-eyebrow">{CURRENT_ISSUE}</p>
                <h1 className="display mt-2 text-4xl text-ink sm:text-6xl">
                  Know Yourself
                </h1>
              </div>
              <p className="max-w-sm text-sm leading-relaxed text-ink-muted">
                Straight answers about skin, written by the people who treat
                it. Every piece is tied to a service, so you can act on it.
              </p>
            </div>
          </div>
        </section>

        {/* ── Cover feature ────────────────────────────────────────────── */}
        <section className="container-page pt-10">
          <Link
            href={`/patient/know-yourself/${COVER_ARTICLE.slug}`}
            className="group grid overflow-hidden rounded-3xl bg-white/[0.04] ring-1 ring-white/10 lg:grid-cols-2"
          >
            <div className="relative min-h-[16rem] overflow-hidden">
              <SmartImage
                src={COVER_ARTICLE.image}
                alt=""
                sizes="(min-width: 1024px) 50vw, 100vw"
                priority
                className="transition-transform duration-700 group-hover:scale-105"
              />
              <span className="absolute left-4 top-4 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-white ring-1 ring-white/20 backdrop-blur">
                Cover feature
              </span>
            </div>

            <div className="p-7 sm:p-10">
              <p className="section-eyebrow">{COVER_ARTICLE.section}</p>
              <h2 className="display mt-3 text-2xl leading-tight text-ink sm:text-4xl">
                {COVER_ARTICLE.title}
              </h2>
              <p className="mt-4 text-base leading-relaxed text-ink-muted">
                {COVER_ARTICLE.dek}
              </p>
              <p className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-ink-muted">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> {COVER_ARTICLE.readMins} min
                  read
                </span>
                <span className="chip">{COVER_ARTICLE.categoryLabel}</span>
              </p>
              <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-brand-200">
                Read the feature
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
          </Link>
        </section>

        {/* ── Departments ──────────────────────────────────────────────── */}
        {ARTICLE_SECTIONS.map((section) => {
          const items = rest.filter((a) => a.section === section);
          if (items.length === 0) return null;
          return (
            <section key={section} className="container-page pt-14">
              <SectionHead eyebrow="Department" title={section} />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((a) => (
                  <ArticleCard key={a.slug} article={a} />
                ))}
              </div>
            </section>
          );
        })}

        <section className="container-page pt-14">
          <KnowYouCta variant="advice" />
        </section>
      </main>

      <Footer />
    </>
  );
}

function ArticleCard({ article }: { article: Article }) {
  return (
    <Link
      href={`/patient/know-yourself/${article.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl bg-white/[0.04] ring-1 ring-white/10 transition hover:border-brand-300/50 hover:shadow-soft"
    >
      <div className="relative h-40 overflow-hidden">
        <SmartImage
          src={article.image}
          alt=""
          sizes="(min-width: 1024px) 33vw, 100vw"
          className="transition-transform duration-700 group-hover:scale-105"
        />
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-300">
          {article.categoryLabel}
        </p>
        <h3 className="display-sm mt-2 text-base leading-snug text-ink">
          {article.title}
        </h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-muted">
          {article.dek}
        </p>
        <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted">
          <Clock className="h-3.5 w-3.5" /> {article.readMins} min read
        </p>
      </div>
    </Link>
  );
}
