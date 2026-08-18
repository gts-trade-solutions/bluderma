"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";

/**
 * Real client reviews, or nothing.
 *
 * Replaces hand-written testimonial arrays that were scattered across the
 * client side — invented names, invented cities, and an unconditional
 * five-star rating attributed to "clients across our clinics". None of those
 * people existed.
 *
 * There is deliberately no fallback. When no client has reviewed yet, or an
 * admin has not published any, this renders nothing at all and the page is
 * one section shorter. That is the honest state of a young platform, and a
 * fallback here would just be the fabrication again with extra steps.
 *
 * Reviews are written by clients and published by an admin at /admin/reviews.
 */

interface Review {
  id: string;
  rating: number;
  title: string | null;
  quote: string;
  name: string;
  doctor: string;
  specialty: string;
}

export default function PublishedReviewsSection({
  eyebrow = "What clients say",
  title = "The part people remember",
  limit = 3,
  className = "bg-white/[0.04] py-16 sm:py-20",
}: {
  eyebrow?: string;
  title?: string;
  limit?: number;
  className?: string;
}) {
  const [reviews, setReviews] = useState<Review[] | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/reviews/published")
      .then((r) => r.json())
      .then((d) => live && d?.ok && setReviews(d.reviews ?? []))
      .catch(() => live && setReviews([]));
    return () => {
      live = false;
    };
  }, []);

  if (!reviews || reviews.length === 0) return null;

  return (
    <section className={className}>
      <div className="container-page">
        <p className="section-eyebrow">{eyebrow}</p>
        <h2 className="display mt-2 text-3xl text-ink sm:text-4xl">{title}</h2>

        <div className="mt-9 grid gap-4 sm:grid-cols-3">
          {reviews.slice(0, limit).map((r) => (
            <figure
              key={r.id}
              className="flex flex-col rounded-3xl bg-white/[0.04] p-6 ring-1 ring-white/10"
            >
              <div className="flex gap-0.5 text-amber-400">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`h-4 w-4 ${
                      i < r.rating ? "fill-current" : "opacity-25"
                    }`}
                  />
                ))}
              </div>
              {r.title && (
                <p className="mt-3 text-sm font-bold text-ink">{r.title}</p>
              )}
              <blockquote className="mt-2 flex-1 text-sm leading-relaxed text-ink-soft">
                &ldquo;{r.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-4 text-xs font-semibold text-ink">
                {r.name}
                <span className="ml-1.5 font-normal text-ink-muted">
                  · on {r.doctor}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
