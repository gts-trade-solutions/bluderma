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

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    const p = v.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  }, []);

  return (
    <section className="relative w-full overflow-hidden bg-slate-900">
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
      </div>
    </section>
  );
}
