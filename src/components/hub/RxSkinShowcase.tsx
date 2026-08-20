"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import SmartImage from "@/components/SmartImage";
import { IMG } from "@/data/hubImages";
import { SKIN_CONDITIONS, type SkinCondition } from "@/data/rxSkin";
import RxGlyph from "./RxGlyph";

/**
 * RX SKIN, the headline treatment (C-31 … C-33).
 *
 * Two tracks — skin and hair — each a photograph over a row of condition
 * glyphs. Hovering (or tapping, or tabbing to) a glyph swaps the line under
 * the row for that condition's one-line definition, which is the behaviour
 * the brief asks for and the reason the line sits in a fixed-height slot:
 * the card must not jump as you move across the row.
 */

const SKIN_TRACK = [
  "acne",
  "large-pores",
  "dark-spots",
  "fine-lines",
  "rosacea",
  "melasma",
  "acne-scars",
  "dark-circles",
  "sagging",
  "dryness",
];

const HAIR_TRACK = [
  "hair-fall",
  "pattern-baldness",
  "thinning-ponytail",
  "wide-part",
  "bald-spots",
  "hair-breakage",
  "dandruff",
  "receding-hairline",
  "oily-scalp",
  "postpartum-shedding",
];

const bySlug = new Map(SKIN_CONDITIONS.map((c) => [c.slug, c]));
const pick = (slugs: string[]) =>
  slugs.map((s) => bySlug.get(s)).filter(Boolean) as SkinCondition[];

export default function RxSkinShowcase() {
  return (
    <div className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand-700 via-brand-600 to-teal-600 px-6 py-12 sm:px-10 sm:py-14">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-200">
        Rx Skin
      </p>
      <h2 className="display mt-3 max-w-3xl text-3xl leading-[1.08] text-white sm:text-5xl">
        Rx skin and hair care, developed by dermatologists
      </h2>
      <p className="mt-4 max-w-xl text-base leading-relaxed text-white/75">
        Start from what your skin is doing, not from a treatment menu. Hover
        any condition to see what it actually is.
      </p>

      <div className="mt-10 grid gap-5 lg:grid-cols-2">
        <TrackCard
          title="Try Rx skincare"
          href="/patient/rx-skin"
          image={IMG.portraitGlow}
          conditions={pick(SKIN_TRACK)}
          fallback="Twenty-plus skin conditions, described in one line each."
        />
        <TrackCard
          title="Try Rx hair care"
          href="/patient/explore/hair-restoration"
          image={IMG.hair1}
          conditions={pick(HAIR_TRACK)}
          fallback="Shedding, thinning and scalp conditions, and what separates them."
        />
      </div>
    </div>
  );
}

function TrackCard({
  title,
  href,
  image,
  conditions,
  fallback,
}: {
  title: string;
  href: string;
  image: string;
  conditions: SkinCondition[];
  fallback: string;
}) {
  const [active, setActive] = useState<SkinCondition | null>(null);

  return (
    <div className="overflow-hidden rounded-3xl bg-white/[0.04]">
      {/* Photograph + entry link */}
      <Link href={href} className="group relative block h-56 sm:h-72">
        <SmartImage
          src={image}
          alt=""
          sizes="(min-width: 1024px) 45vw, 100vw"
          className="object-top transition-transform duration-700 group-hover:scale-[1.04]"
        />
        <span className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#070d1c]/85 to-transparent" />
        <span className="absolute left-5 top-5 inline-flex items-center gap-1.5 text-lg font-bold text-white">
          {title}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </span>
      </Link>

      {/* Condition row */}
      <div className="px-4 pb-5 pt-5 sm:px-6">
        <ul
          className="grid grid-cols-3 gap-x-1 gap-y-4 sm:grid-cols-4 md:grid-cols-5"
          onMouseLeave={() => setActive(null)}
        >
          {conditions.map((c) => {
            const on = active?.slug === c.slug;
            return (
              <li key={c.slug}>
                <Link
                  href={`/patient/explore/${c.category}`}
                  onMouseEnter={() => setActive(c)}
                  onFocus={() => setActive(c)}
                  onBlur={() => setActive(null)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl px-1 py-2 text-center transition ${
                    on ? "bg-brand-400/[12%] text-brand-200" : "text-ink hover:bg-white/[0.04]"
                  }`}
                >
                  <RxGlyph slug={c.slug} group={c.group} className="h-7 w-7" />
                  <span className="text-[11px] font-semibold leading-tight">
                    {shortLabel(c.name)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        {/* The one-liner. Fixed height so the card never jumps. */}
        <div className="mt-4 flex min-h-[3.25rem] items-center rounded-2xl bg-white/[0.04] px-4 py-3">
          <p className="text-[13px] leading-snug text-ink-soft">
            {active ? (
              <>
                <span className="font-bold text-ink">{active.name}: </span>
                {active.line}
              </>
            ) : (
              fallback
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Condition names are written for prose; the glyph row is a narrow column.
 * Drop anything after "&", then trim to whole words that fit — measured in
 * characters, not word count, because two long words still overflow.
 */
function shortLabel(name: string): string {
  const first = name.split(" & ")[0];
  if (first.length <= 14) return first;

  const words = first.split(" ");
  let out = words[0];
  for (const word of words.slice(1)) {
    if ((out + " " + word).length > 14) break;
    out += " " + word;
  }
  return out;
}
