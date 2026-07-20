"use client";

import { useEffect, useRef, useState } from "react";

interface HeroVideoProps {
  /** Poster/fallback image, shown while loading and if the video can't play. */
  poster: string;
  /**
   * Video sources tried in order. A local file (your own footage) takes
   * priority; a free-license beauty-model clip is the default fallback.
   */
  sources?: string[];
}

const DEFAULT_SOURCES = [
  "/videos/hero.mp4", // drop your own Korean beauty-model footage here (wins if present)
  "https://assets.mixkit.co/videos/52042/52042-720.mp4",
  "https://assets.mixkit.co/videos/9101/9101-720.mp4",
  "https://assets.mixkit.co/videos/52042/52042-360.mp4",
];

/**
 * Clean, full-width hero video — no overlays, no text. Autoplays muted and
 * loops, exactly like the reference clinic banner. The poster sits behind the
 * video only so there's no blank frame while it loads (and as a fallback).
 */
export default function HeroVideo({
  poster,
  sources = DEFAULT_SOURCES,
}: HeroVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onReady = () => setReady(true);
    const onError = () => {
      if (v.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) setFailed(true);
    };
    v.addEventListener("canplay", onReady);
    v.addEventListener("error", onError, true);
    const p = v.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
    return () => {
      v.removeEventListener("canplay", onReady);
      v.removeEventListener("error", onError, true);
    };
  }, []);

  return (
    <section className="relative w-full overflow-hidden bg-slate-100">
      <div className="relative h-[58vh] min-h-[380px] w-full sm:h-[64vh]">
        {/* Poster behind video (no dark overlay) */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${poster})` }}
        />
        {!failed && (
          <video
            ref={videoRef}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
              ready ? "opacity-100" : "opacity-0"
            }`}
            autoPlay
            muted
            loop
            playsInline
            poster={poster}
          >
            {sources.map((s) => (
              <source key={s} src={s} type="video/mp4" />
            ))}
          </video>
        )}
      </div>
    </section>
  );
}
