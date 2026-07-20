"use client";

import Image from "next/image";
import { useState } from "react";

interface SmartImageProps {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}

/**
 * Image with a graceful branded fallback if the remote asset ever fails to
 * load. Always fills its (relatively-positioned) parent.
 */
export default function SmartImage({
  src,
  alt,
  className = "",
  sizes = "100vw",
  priority = false,
}: SmartImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-100 via-brand-50 to-teal-100 ${className}`}
        aria-label={alt}
      >
        <span className="px-4 text-center text-sm font-semibold text-brand-700/80">
          {alt}
        </span>
      </div>
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
