"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
} from "lucide-react";

import SmartImage from "@/components/SmartImage";
import { IMG } from "@/data/hubImages";

/**
 * Four full-bleed home banners covering analysis, remote expertise,
 * concern-led care and accessible financing.
 *
 * Rotation pauses on hovering the CONTROLS and on keyboard focus — but not on
 * hovering the hero. The hero fills the top of the page, so a resting cursor
 * froze it for the whole visit and the carousel read as broken. There is a
 * real pause button instead, because autoplay has to be stoppable by
 * something a person can find (WCAG 2.2.2).
 *
 * `prefers-reduced-motion` drops the crossfade but keeps advancing: a frozen
 * slideshow is a bug, not an accommodation, and a fade is not the kind of
 * motion that setting exists to prevent.
 *
 * Every slide remains in the DOM so its content is available to search
 * engines and assistive technology.
 */

const INTERVAL_MS = 6000;

export interface HeroSlideData {
  key: string;
  eyebrow: string;
  title: string;
  /** Second title line, rendered in the brand gradient. */
  titleAccent?: string | null;
  body: string;
  image: {
    desktop: string;
    tablet?: string | null;
    mobile?: string | null;
  };
  cta: { label: string; href: string };
}

const SLIDES: HeroSlideData[] = [
  {
    key: "analyzer",
    eyebrow: "KNOW YOUR SKIN",
    title: "Understand Your Skin.",
    titleAccent: "Unlock Its Potential.",
    body: "Discover what your skin truly needs with expert-guided skin analysis.",
    image: {
      desktop: IMG.homeHeroSkinAnalysis,
      tablet: IMG.homeHeroSkinAnalysisTablet,
      mobile: IMG.homeHeroSkinAnalysisMobile,
    },
    cta: { label: "Start skin analysis", href: "/patient/skin-analyzer" },
  },
  {
    key: "teleconsult",
    eyebrow: "WORLD-CLASS EXPERTISE. FROM THE COMFORT OF HOME.",
    title: "Consult a World-Class Aesthetician",
    titleAccent: "2,000 Miles Away.",
    body: "Get personalized aesthetic and skincare guidance through convenient online consultations.",
    image: {
      desktop: IMG.homeHeroTeleconsult,
      tablet: IMG.homeHeroTeleconsultTablet,
      mobile: IMG.homeHeroTeleconsultMobile,
    },
    cta: { label: "Consult online", href: "/patient/doctors" },
  },
  {
    key: "concern-care",
    eyebrow: "HAVE A SKIN CONCERN? DON’T WORRY.",
    title: "Expert Consultation.",
    titleAccent: "Best-in-Class Care.",
    body: "From acne and pigmentation to ageing concerns, get the right guidance for your skin.",
    image: {
      desktop: IMG.homeHeroConcernCare,
      tablet: IMG.homeHeroConcernCareTablet,
      mobile: IMG.homeHeroConcernCareMobile,
    },
    cta: { label: "Explore skin concerns", href: "/patient/rx-skin" },
  },
  {
    key: "financing",
    eyebrow: "AESTHETIC FINANCING: GET STARTED TODAY.",
    title: "Avail Now.",
    titleAccent: "Pay Later.",
    body: "Make your aesthetic journey more accessible with flexible financing options.",
    image: {
      desktop: IMG.homeHeroFinancing,
      tablet: IMG.homeHeroFinancingTablet,
      mobile: IMG.homeHeroFinancingMobile,
    },
    cta: { label: "Get started", href: "/patient/know-you" },
  },
];

export default function HeroCarousel({
  slides,
}: {
  /** Admin-managed slides; when absent or empty the built-in set shows. */
  slides?: HeroSlideData[];
}) {
  const deck = slides?.length ? slides : SLIDES;
  const [index, setIndex] = useState(0);
  /** Explicit stop, from the pause button. */
  const [stopped, setStopped] = useState(false);
  /** Hovering the CONTROLS — not the hero. See the note below. */
  const [overControls, setOverControls] = useState(false);
  /** Something inside has keyboard focus. */
  const [focused, setFocused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [rotationCycle, setRotationCycle] = useState(0);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const go = useCallback(
    (n: number) => {
      setIndex((n + deck.length) % deck.length);
    },
    [deck.length]
  );

  const goFromControl = useCallback((n: number) => {
    go(n);
    // A keyboard/mouse pagination action restarts a complete interval instead
    // of allowing the old timer to advance again a fraction of a second later.
    setRotationCycle((cycle) => cycle + 1);
  }, [go]);

  const running = !stopped && !overControls && !focused;

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(
      () => setIndex((i) => (i + 1) % deck.length),
      INTERVAL_MS
    );
    return () => window.clearInterval(id);
  }, [running, rotationCycle, deck.length]);

  return (
    <section
      className="relative isolate overflow-hidden bg-[#070d1c]"
      aria-roledescription="carousel"
      aria-label="What BluDerma does"
      // NOT paused on hovering the hero. The hero fills the top of the page,
      // so a cursor resting anywhere on it — which is where a cursor usually
      // rests — stopped the rotation for the whole visit and looked broken.
      // Hover only pauses over the controls; the pause button does the rest.
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={() => setFocused(false)}
    >
      {deck.map((slide, slideIndex) => (
        <div
          key={slide.key}
          // Reduced motion drops the crossfade, but the slideshow keeps
          // advancing — freezing it entirely just looked broken, and a fade
          // is not what the setting is there to protect people from.
          className={`${reduced ? "" : "transition-opacity duration-700"} ${
            slideIndex === index
              ? "relative z-10 min-h-[760px] opacity-100 sm:min-h-[680px] lg:min-h-0"
              : "pointer-events-none absolute inset-0 min-h-[760px] opacity-0 sm:min-h-[680px] lg:min-h-0"
          }`}
          role="group"
          aria-roledescription="slide"
          aria-label={`${slideIndex + 1} of ${deck.length}`}
          aria-hidden={slideIndex !== index}
        >
          <div className="absolute inset-0">
            <SmartImage
              src={slide.image.desktop}
              tabletSrc={(slide.image.tablet ?? slide.image.mobile) || undefined}
              mobileSrc={(slide.image.mobile ?? slide.image.tablet) || undefined}
              alt=""
              sizes="100vw"
              priority={slideIndex === 0}
              className="object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#071326]/[78%] via-[#071326]/[38%] to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#070d1c] via-transparent to-transparent sm:hidden" />
          </div>

          <div className="container-page relative pb-20 pt-28 sm:pb-24 sm:pt-32 lg:pb-32 lg:pt-40">
            <div className="max-w-2xl">
              <span className="inline-flex max-w-full items-center rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-teal-200 backdrop-blur sm:text-[11px] sm:tracking-[0.16em]">
                {slide.eyebrow}
              </span>

              <h1 className="display mt-7 text-balance text-[2.4rem] leading-[0.98] text-white sm:text-[3.5rem] lg:text-[4.25rem]">
                {slide.title}
                {slide.titleAccent && (
                  <>
                    <br className="hidden sm:block" />{" "}
                    <span className="bg-gradient-to-r from-teal-200 to-brand-300 bg-clip-text text-transparent">
                      {slide.titleAccent}
                    </span>
                  </>
                )}
              </h1>

              <p className="mt-6 max-w-xl text-base font-medium leading-relaxed text-white/70 sm:text-lg">
                {slide.body}
              </p>

              <div className="mt-9 flex min-h-[3.5rem] flex-wrap items-center gap-3">
                <Link
                  href={slide.cta.href}
                  tabIndex={slideIndex === index ? 0 : -1}
                  className="group inline-flex items-center gap-2 rounded-full bg-white px-7 py-4 text-sm font-bold text-[#070d1c] shadow-[0_10px_40px_-12px_rgba(84,215,194,0.55)] transition hover:bg-teal-100 active:scale-[0.98]"
                >
                  {slide.cta.label}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Controls. Hovering these pauses the rotation — the hero itself does
          not, so the slideshow keeps running while you read. */}
      <div
        className="absolute inset-x-0 bottom-6 z-20"
        onMouseEnter={() => setOverControls(true)}
        onMouseLeave={() => setOverControls(false)}
      >
        <div className="container-page flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {deck.map((slide, slideIndex) => (
              <button
                key={slide.key}
                onClick={() => goFromControl(slideIndex)}
                onPointerUp={(event) => event.currentTarget.blur()}
                aria-label={`Show slide ${slideIndex + 1}: ${slide.eyebrow}`}
                aria-current={slideIndex === index}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  slideIndex === index
                    ? "w-9 bg-teal-300"
                    : "w-4 bg-white/30 hover:bg-white/60"
                }`}
              />
            ))}
          </div>

          <div className="flex gap-2">
            {/* Autoplay has to be stoppable by something a person can find
                (WCAG 2.2.2) — that used to be "hover anywhere", which is why
                it never seemed to run. */}
            <button
              onClick={() => setStopped((v) => !v)}
              onPointerUp={(event) => event.currentTarget.blur()}
              aria-label={stopped ? "Resume the slideshow" : "Pause the slideshow"}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-white/70 transition hover:border-white/50 hover:text-white"
            >
              {stopped ? (
                <Play className="h-3.5 w-3.5 fill-current" />
              ) : (
                <Pause className="h-3.5 w-3.5 fill-current" />
              )}
            </button>
            <button
              onClick={() => goFromControl(index - 1)}
              onPointerUp={(event) => event.currentTarget.blur()}
              aria-label="Previous slide"
              className="hidden h-9 w-9 items-center justify-center rounded-full border border-white/20 text-white/70 transition hover:border-white/50 hover:text-white sm:flex"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => goFromControl(index + 1)}
              onPointerUp={(event) => event.currentTarget.blur()}
              aria-label="Next slide"
              className="hidden h-9 w-9 items-center justify-center rounded-full border border-white/20 text-white/70 transition hover:border-white/50 hover:text-white sm:flex"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
