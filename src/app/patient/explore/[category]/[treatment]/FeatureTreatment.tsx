import Link from "next/link";
import { Check, ChevronLeft } from "lucide-react";

import SmartImage from "@/components/SmartImage";
import BeforeAfter from "@/components/hub/BeforeAfter";
import KnowYouCta from "@/components/hub/KnowYouCta";
import type { BeforeAfterCase, HubCategory, HubTreatment } from "@/data/hub";
import { storyFor } from "@/data/treatmentDetail";
import { getProtocol } from "@/lib/queries/hubCatalogue";
import TreatmentBackdrop from "./TreatmentBackdrop";

/**
 * The revamped treatment page, on two treatments for client sign-off (the
 * FEATURED set in page.tsx).
 *
 * Deliberately plain: one readable column, clear headings, whole photographs.
 * Every earlier draft of this page was more designed than this one — stacked
 * posters, then a clinical dossier — and each read as ornament. What survived
 * is the content: what the treatment is and how it works (with imagery),
 * the options, who it suits, before/after, and safety.
 *
 * Absent by design: price, clinic, branch, address, map, contact details.
 * The pinned bar states where cost comes from — a doctor, after assessment.
 */
export default async function FeatureTreatment({
  category,
  treatment,
}: {
  category: HubCategory;
  treatment: HubTreatment;
}) {
  // Admin-managed protocol, falling back to the shipped copy when a category
  // has not been given its own.
  const d = await getProtocol(category.slug, treatment);
  const story = storyFor(category, treatment, d);

  // Cases from this category first, then the rest — never an empty section.
  const storedCases = treatment.beforeAfterCases ?? [];
  const imagePairs =
    storedCases.length > 0
      ? storedCases
      : treatment.beforeImage && treatment.afterImage
        ? [{ beforeImage: treatment.beforeImage, afterImage: treatment.afterImage }]
        : [];
  const cases: BeforeAfterCase[] = imagePairs.map((pair, index) => ({
    slug: `${category.slug}-${treatment.slug}-${index + 1}`,
    concern: treatment.name,
    treatment: `${treatment.name} · illustrative comparison ${index + 1}`,
    categorySlug: category.slug,
    sessions: d.sessions,
    timeframe: "Results vary",
    before: pair.beforeImage,
    after: pair.afterImage,
  }));

  const facts = [
    { label: "Duration", value: d.duration },
    { label: "Anaesthesia", value: d.anaesthesia },
    { label: "Sessions", value: d.sessions },
    { label: "Downtime", value: d.downtime },
  ];

  const safety = [
    { title: "Precautions", items: d.precautions },
    { title: "Possible side effects", items: d.sideEffects },
    { title: "Not suitable if", items: d.notSuitable },
    { title: "Aftercare", items: d.aftercare },
  ];

  return (
    <main className="relative isolate bg-[var(--surface)] pb-32">
      <TreatmentBackdrop />
      <div className="container-page max-w-5xl">
        {/* ── Header ────────────────────────────────────────────────── */}
        <header className="pt-8 sm:pt-10">
          <Link
            href={`/patient/explore/${category.slug}`}
            className="inline-flex items-center gap-1 text-sm font-medium text-ink-muted transition hover:text-teal-200"
          >
            <ChevronLeft className="h-4 w-4" />
            {category.name}
          </Link>

          <h1 className="display mt-5 text-3xl text-white sm:text-4xl">
            {treatment.name}
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink-soft">
            {treatment.blurb}
          </p>
          {treatment.meta && (
            <p className="mt-2 text-sm text-ink-muted">{treatment.meta}</p>
          )}
        </header>

        {/* Whole photograph — never cropped. */}
        <div className="mt-8 overflow-hidden rounded-2xl ring-1 ring-white/10">
          <SmartImage
            mode="natural"
            src={treatment.image}
            alt={treatment.name}
            priority
          />
        </div>

        {/* ── The facts ─────────────────────────────────────────────── */}
        <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {facts.map((f) => (
            <li
              key={f.label}
              className="rounded-xl bg-white/[0.04] px-4 py-3.5 ring-1 ring-white/10"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                {f.label}
              </p>
              <p className="mt-1 text-sm font-medium leading-snug text-ink">
                {f.value}
              </p>
            </li>
          ))}
        </ul>

        {/* ── About ─────────────────────────────────────────────────── */}
        <section className="mt-12">
          <h2 className="display text-2xl text-white">
            About this treatment
          </h2>
          <div className="mt-4 space-y-8">
            {story.map((block, i) => (
              <div key={block.heading}>
                <h3 className="text-lg font-bold text-white">
                  {block.heading}
                </h3>
                <p className="mt-2 max-w-3xl text-base leading-[1.8] text-ink-soft">
                  {block.body}
                </p>
                {/* Two supporting photographs, whole, at natural ratio. */}
                {(i === 1 || i === 2) && (
                  <div className="mt-5 overflow-hidden rounded-2xl ring-1 ring-white/10">
                    <SmartImage
                      mode="natural"
                      src={block.image}
                      alt={block.heading}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── Options ───────────────────────────────────────────────── */}
        <section className="mt-12">
          <h2 className="display text-2xl text-white">Options</h2>
          <ul className="mt-4 divide-y divide-white/10 rounded-2xl ring-1 ring-white/10">
            {d.options.map((o) => (
              <li
                key={o.name}
                className="flex items-start justify-between gap-4 px-5 py-4"
              >
                <div>
                  <p className="text-base font-bold text-white">{o.name}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-ink-muted">
                    {o.detail}
                  </p>
                </div>
                {o.popular && (
                  <span className="mt-0.5 shrink-0 rounded-full bg-teal-400/[15%] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-teal-200">
                    Popular
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            No price is listed on this page. The treatment plan and its cost
            come from the doctor after an assessment.
          </p>
        </section>

        {/* ── Who it suits ──────────────────────────────────────────── */}
        <section className="mt-12">
          <h2 className="display text-2xl text-white">Who it suits</h2>
          <ul className="mt-4 space-y-3">
            {d.recommendedFor.map((r) => (
              <li key={r} className="flex gap-3">
                <Check
                  className="mt-0.5 h-4 w-4 shrink-0 text-teal-300"
                  strokeWidth={2.5}
                />
                <span className="text-base leading-relaxed text-ink-soft">
                  {r}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Before & after ────────────────────────────────────────── */}
        {cases.length > 0 && (
          <section className="mt-12">
            <h2 className="display text-2xl text-white">Before &amp; after</h2>
            <p className="mt-2 text-sm text-ink-muted">
              Drag the handle across each photograph to compare.
            </p>
            <div className="mt-5">
              <BeforeAfter cases={cases} />
            </div>
          </section>
        )}

        {/* ── Safety ────────────────────────────────────────────────── */}
        <section className="mt-12">
          <h2 className="display text-2xl text-white">
            Safety &amp; aftercare
          </h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {safety.map((group) => (
              <div
                key={group.title}
                className="rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10"
              >
                <h3 className="text-base font-bold text-white">{group.title}</h3>
                <ul className="mt-3 space-y-2">
                  {group.items.map((item) => (
                    <li key={item} className="flex gap-2.5">
                      <span className="mt-[0.55rem] h-1 w-1 shrink-0 rounded-full bg-teal-300" />
                      <span className="text-[14.5px] leading-relaxed text-ink-soft">
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm leading-relaxed text-ink-muted">
            General information, not medical advice and not a diagnosis. What
            suits your skin, at what depth and over how many sessions, is
            decided by a doctor after an examination.
          </p>
        </section>
      </div>

      {/* ── Pinned enquiry ──────────────────────────────────────────── */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#070d1c]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="container-page flex max-w-5xl items-center justify-between gap-4 py-3">
          <div className="hidden min-w-0 sm:block">
            <p className="truncate text-sm font-bold text-white">
              {treatment.name}
            </p>
            <p className="text-[11px] text-ink-muted">
              Plan and cost come from the doctor, after an assessment.
            </p>
          </div>
          <div className="w-full sm:w-auto [&_button]:w-full sm:[&_button]:w-auto">
            <KnowYouCta variant="button" label="Request a consultation" />
          </div>
        </div>
      </div>
    </main>
  );
}
