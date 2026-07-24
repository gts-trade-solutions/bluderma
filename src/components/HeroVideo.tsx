"use client";

import { useEffect, useRef } from "react";

interface HeroVideoProps {
  /** Optional — kept for API compatibility; no poster image is shown now. */
  poster?: string;
  /**
   * Video sources tried in order. Self-hosted files under public/videos/
   * play reliably (free stock CDNs block hotlinking).
   */
  sources?: string[];
}

const DEFAULT_SOURCES = [
  "/videos/hero.mp4", // rename your clip to this to swap it in
  "/videos/mixkit-52042-video-52042-hd-ready.mp4",
];

/**
 * Clean, full-viewport hero video — plays immediately from the start, muted
 * and looping, with no poster image in front of it.
 */
export default function HeroVideo({ sources = DEFAULT_SOURCES }: HeroVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    const p = v.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  }, []);

  const scrollToContent = () => {
    const el = sectionRef.current;
    const top = el
      ? el.getBoundingClientRect().bottom + window.scrollY
      : window.innerHeight;
    window.scrollTo({ top, behavior: "smooth" });
  };

  return (
    <section ref={sectionRef} className="relative w-full overflow-hidden bg-slate-900">
      <div className="relative h-[calc(100vh-4rem)] min-h-[480px] w-full">
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
        >
          {sources.map((s) => (
            <source key={s} src={s} type="video/mp4" />
          ))}
        </video>

        {/* Soft gradient so the cue stays legible over bright video frames. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/40 to-transparent" />

        {/* Scroll-down cue */}
        <button
          type="button"
          onClick={scrollToContent}
          aria-label="Scroll to content"
          className="group absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2 outline-none"
        >
          <span className="animate-scroll-nudge flex h-11 w-7 items-start justify-center rounded-full border-2 border-white/70 p-1.5 drop-shadow transition-colors group-hover:border-white">
            <span className="animate-scroll-dot h-2 w-1 rounded-full bg-white/90" />
          </span>
          <svg
            viewBox="0 0 20 20"
            className="h-4 w-4 text-white/70 drop-shadow transition-colors group-hover:text-white"
            fill="none"
          >
            <path
              d="m5 8 5 5 5-5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </section>
  );
}
