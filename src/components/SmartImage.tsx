"use client";

import Image from "next/image";
import { useState } from "react";

interface SmartImageProps {
  src: string;
  mobileSrc?: string;
  tabletSrc?: string;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  /**
   * "fill" (default) covers a relatively-positioned parent, cropping to fit.
   * "natural" renders the whole photograph at its own aspect ratio — for
   * figures where cropping the subject is wrong.
   */
  mode?: "fill" | "natural";
}

/**
 * Image with a graceful branded fallback if the remote asset ever fails to
 * load. Fills its (relatively-positioned) parent unless mode="natural".
 */
export default function SmartImage({
  src,
  mobileSrc,
  tabletSrc,
  alt,
  className = "",
  sizes = "100vw",
  priority = false,
  mode = "fill",
}: SmartImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-500/25 via-brand-500/10 to-teal-500/25 ${
          mode === "natural" ? "aspect-[16/9]" : ""
        } ${className}`}
        aria-label={alt}
      >
        <span className="px-4 text-center text-sm font-semibold text-brand-200/80">
          {alt}
        </span>
      </div>
    );
  }

  if (mode === "natural") {
    return (
      /* eslint-disable-next-line @next/next/no-img-element -- natural-ratio
         figure; next/image fill would reintroduce the crop this mode exists
         to avoid, and images are served unoptimized anyway. */
      <img
        src={src}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className={`h-auto w-full ${className}`}
        onError={() => setFailed(true)}
      />
    );
  }

  if (mobileSrc && tabletSrc) {
    return (
      <picture>
        <source media="(min-width: 1024px)" srcSet={src} />
        <source media="(min-width: 768px)" srcSet={tabletSrc} />
        {/* A native picture is intentional here: the browser downloads only
            the artwork composed for its breakpoint instead of three hidden
            Next Image instances. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={mobileSrc}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          className={`absolute inset-0 h-full w-full object-cover ${className}`}
          onError={() => setFailed(true)}
        />
      </picture>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      className={`object-cover ${className}`}
      onError={() => setFailed(true)}
    />
  );
}
