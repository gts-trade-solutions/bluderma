"use client";

import { useState } from "react";
import SmartImage from "./SmartImage";

/**
 * Up-to-5 image gallery with a main view and thumbnails. Falls back to
 * SmartImage's branded placeholder when a URL is missing or fails.
 */
export default function ProductGallery({
  images,
  name,
}: {
  images: { url: string; alt: string | null }[];
  name: string;
}) {
  const [active, setActive] = useState(0);
  const shots = images.slice(0, 5);
  const main = shots[active] ?? shots[0];

  return (
    <div>
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-white ring-1 ring-black/[0.04]">
        <SmartImage
          src={main?.url ?? ""}
          alt={main?.alt ?? name}
          sizes="(max-width: 1024px) 100vw, 40vw"
          priority
        />
      </div>

      {shots.length > 1 && (
        <div className="mt-3 flex gap-2.5">
          {shots.map((s, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              aria-label={`View image ${i + 1}`}
              className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl ring-1 transition ${
                i === active
                  ? "ring-2 ring-brand-500"
                  : "ring-black/[0.06] hover:ring-brand-300"
              }`}
            >
              <SmartImage src={s.url} alt={s.alt ?? ""} sizes="64px" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
