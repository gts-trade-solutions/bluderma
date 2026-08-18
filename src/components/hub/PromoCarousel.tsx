"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";

import type { HubPromo } from "@/data/hub";
import SmartImage from "@/components/SmartImage";

/**
 * The banner carousel at the top of the hub. Auto-advances, pauses on hover
 * and stops entirely for anyone who prefers reduced motion.
 */
export default function PromoCarousel({ slides }: { slides: HubPromo[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || slides.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((n) => (n + 1) % slides.length), 6000);
    return () => clearInterval(t);
  }, [paused, slides.length]);

  const go = (dir: -1 | 1) =>
    setI((n) => (n + dir + slides.length) % slides.length);

  return (
    <div
      className="relative overflow-hidden rounded-[2rem] bg-[#070d1c]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative aspect-[16/10] sm:aspect-[21/8]">
        {slides.map((s, n) => (
          <div
            key={s.slug}
            aria-hidden={n !== i}
            className={`absolute inset-0 transition-opacity duration-700 ${
              n === i ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            <SmartImage
              src={s.image}
              alt=""
              sizes="(max-width: 1024px) 100vw, 1100px"
              className={n === i ? "animate-ken-burns" : ""}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#070d1c] via-[#070d1c]/80 to-transparent" />

            <div className="relative flex h-full max-w-xl flex-col justify-center px-6 py-8 sm:px-10">
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-300">
                {s.eyebrow}
              </span>
              <h2 className="display mt-2.5 text-balance text-[1.7rem] leading-[1.06] text-white sm:text-4xl lg:text-[2.75rem]">
                {s.title}
              </h2>
              <p className="mt-2 hidden max-w-md text-sm leading-relaxed text-white/70 sm:block">
                {s.body}
              </p>
              <Link
                href={s.href}
                tabIndex={n === i ? 0 : -1}
                className="mt-5 inline-flex w-fit items-center gap-1.5 rounded-full bg-white/[0.04] px-5 py-2.5 text-sm font-bold text-brand-100 transition hover:bg-teal-400/[12%]"
              >
                {s.cta}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <button
        onClick={() => go(-1)}
        aria-label="Previous slide"
        className="absolute left-3 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25 sm:flex"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        onClick={() => go(1)}
        aria-label="Next slide"
        className="absolute right-3 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25 sm:flex"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      <div className="absolute bottom-4 left-6 flex items-center gap-1.5 sm:left-10">
        {slides.map((s, n) => (
          <button
            key={s.slug}
            onClick={() => setI(n)}
            aria-label={`Go to slide ${n + 1}`}
            className={`h-1.5 rounded-full transition-all ${
              n === i ? "w-7 bg-teal-300" : "w-3 bg-white/35 hover:bg-white/60"
            }`}
          />
        ))}
        <span className="ml-2 text-[11px] font-medium tabular-nums text-white/60">
          {i + 1}/{slides.length}
        </span>
      </div>
    </div>
  );
}
