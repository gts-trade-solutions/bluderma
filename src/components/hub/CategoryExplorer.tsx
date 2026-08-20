"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Search, X } from "lucide-react";

import { HUB_CATEGORIES, type HubCategory, type HubTreatment } from "@/data/hub";
import HubTreatmentCard from "./HubTreatmentCard";
import Rail from "./Rail";
import { categoryIcon } from "./icons";

/**
 * The browse control: a row of categories, and under whichever one is open, a
 * row of its sub-categories, then the matching treatments.
 *
 * It is one component rather than three because the three states share a
 * selection — picking a category has to clear the sub-category, and typing a
 * search has to escape both. Splitting them meant lifting all of that into
 * the page anyway.
 *
 * Search is a third mode, not a filter of the current one: a client who types
 * "botox" means it, and should not have to find the right tab first.
 */
export default function CategoryExplorer({
  initialSlug,
}: {
  initialSlug?: string;
}) {
  const first =
    HUB_CATEGORIES.find((c) => c.slug === initialSlug) ?? HUB_CATEGORIES[0];

  const [category, setCategory] = useState<HubCategory>(first);
  const [treatmentSlug, setTreatmentSlug] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const searching = query.trim().length > 1;

  const results = useMemo(() => {
    if (!searching) return [];
    const q = query.trim().toLowerCase();
    return HUB_CATEGORIES.flatMap((c) =>
      c.treatments
        .filter(
          (t) =>
            t.name.toLowerCase().includes(q) ||
            t.blurb.toLowerCase().includes(q) ||
            c.name.toLowerCase().includes(q)
        )
        .map((t) => ({ treatment: t, category: c }))
    ).slice(0, 24);
  }, [query, searching]);

  const shown: HubTreatment[] = treatmentSlug
    ? category.treatments.filter((t) => t.slug === treatmentSlug)
    : category.treatments;

  return (
    <div>
      {/* ── Search ──────────────────────────────────────────────────── */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a treatment or a concern, botox, acne, hair fall…"
          aria-label="Search treatments"
          className="w-full rounded-2xl bg-white/[0.04] ring-1 ring-white/10 py-3.5 pl-11 pr-11 text-sm text-ink outline-none transition placeholder:text-ink-muted focus:border-brand-400 focus:ring-4 focus:ring-brand-300/40"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-ink-muted transition hover:bg-white/10 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {searching ? (
        <div className="mt-6">
          <p className="text-sm text-ink-muted">
            {results.length > 0 ? (
              <>
                <span className="font-semibold text-ink">{results.length}</span>{" "}
                {results.length === 1 ? "match" : "matches"} for &ldquo;
                {query.trim()}&rdquo;
              </>
            ) : (
              <>
                Nothing matches &ldquo;{query.trim()}&rdquo;. Try a concern
                instead, &ldquo;pigmentation&rdquo;, &ldquo;hair&rdquo;,
                &ldquo;lifting&rdquo;.
              </>
            )}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
            {results.map(({ treatment, category: c }) => (
              <div key={`${c.slug}-${treatment.slug}`}>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-teal-300">
                  {c.name}
                </p>
                <HubTreatmentCard treatment={treatment} categorySlug={c.slug} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* ── Categories ──────────────────────────────────────────── */}
          <div className="mt-6">
            <Rail
              ariaLabel="Treatment categories"
              className="items-end gap-1"
              arrows="inline"
            >
              {HUB_CATEGORIES.map((c) => {
                const Icon = categoryIcon(c.icon);
                const on = c.slug === category.slug;
                return (
                  <button
                    key={c.slug}
                    onClick={() => {
                      setCategory(c);
                      setTreatmentSlug(null);
                    }}
                    aria-pressed={on}
                    className={`group flex shrink-0 snap-start flex-col items-center gap-1.5 border-b-2 px-3.5 pb-2.5 pt-1 transition ${
                      on
                        ? "border-ink text-ink"
                        : "border-transparent text-ink-muted hover:text-brand-200"
                    }`}
                  >
                    {/* The unselected tile used to be flattened to a grey
                        wash, which meant seventeen of the eighteen icons
                        carried no colour at any moment. It keeps its own hue
                        and simply steps back — dimmed and desaturated — so the
                        row reads as a palette and the selection still shows. */}
                    <span
                      className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br shadow-[0_6px_16px_-6px_rgba(0,0,0,0.6)] ring-1 ring-inset transition duration-200 ${c.tint} ${
                        on
                          ? "scale-105 ring-white/40"
                          : "opacity-55 saturate-[0.7] ring-white/15 group-hover:opacity-100"
                      }`}
                    >
                      <Icon className="h-5 w-5" strokeWidth={1.9} />
                    </span>
                    <span
                      className={`whitespace-nowrap text-xs ${
                        on ? "font-bold" : "font-medium"
                      }`}
                    >
                      {shortName(c.name)}
                    </span>
                  </button>
                );
              })}
            </Rail>
          </div>

          {/* ── Sub-categories ──────────────────────────────────────── */}
          {/* Wrapped, not scrolled. A category has at most eight of these and
              they fit in two lines — hiding half of them behind a horizontal
              scroll nobody can see is worse than a second row. */}
          <div className="mt-4 flex flex-wrap gap-2">
            <Chip
              label="Everything"
              on={treatmentSlug === null}
              onClick={() => setTreatmentSlug(null)}
            />
            {category.treatments.map((t) => (
              <Chip
                key={t.slug}
                label={t.name}
                on={treatmentSlug === t.slug}
                onClick={() =>
                  setTreatmentSlug((s) => (s === t.slug ? null : t.slug))
                }
              />
            ))}
          </div>

          {/* ── Intro + treatments ──────────────────────────────────── */}
          <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
            <p className="max-w-2xl text-sm leading-relaxed text-ink-muted">
              {category.intro}
            </p>
            <Link
              href={`/patient/explore/${category.slug}`}
              className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-brand-200 hover:underline"
            >
              Deals in {shortName(category.name)}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
            {shown.map((t) => (
              <HubTreatmentCard
                key={t.slug}
                treatment={t}
                categorySlug={category.slug}
              />
            ))}
          </div>

          <p className="mt-5 rounded-2xl bg-white/[0.04] ring-1 ring-white/10 px-4 py-3 text-xs leading-relaxed text-ink-muted">
            Not every treatment here suits every skin. Which of these is right
            for you, and how many sessions it takes, is decided after an
            assessment, not from this list.
          </p>
        </>
      )}
    </div>
  );
}

function Chip({
  label,
  on,
  onClick,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${
        on
          ? "bg-white text-[#070d1c]"
          : "bg-white/[0.04] text-ink-soft ring-1 ring-white/10 hover:text-brand-200"
      }`}
    >
      {label}
    </button>
  );
}

/** Category names are written for headings; the tab row needs them short. */
function shortName(name: string): string {
  return name.split(" & ")[0].replace(/^Laser /, "");
}
