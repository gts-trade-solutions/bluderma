"use client";

import Link from "next/link";
import { useState } from "react";

import SmartImage from "./SmartImage";
import type { ProductCardDTO } from "@/lib/queries/products";

const INITIAL = 8;
const STEP = 8;

/**
 * Grid of products that suit a treatment. Shown on the treatment page. No
 * prices — clicking through opens the product page, which is enquiry-to-order.
 * Long lists start collapsed to `INITIAL` and reveal more on demand.
 */
export default function RelatedProducts({
  products,
  heading = "Related products",
  subheading,
}: {
  products: ProductCardDTO[];
  heading?: string;
  subheading?: string;
}) {
  const [visible, setVisible] = useState(INITIAL);

  if (products.length === 0) return null;

  const shown = products.slice(0, visible);
  const remaining = products.length - shown.length;

  return (
    <section className="border-t border-slate-100 bg-white py-16">
      <div className="container-page">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="section-eyebrow">Matched solutions</p>
            <h2 className="mt-2 text-2xl font-bold text-ink">
              {heading}
              <span className="ml-2 text-base font-semibold text-ink-muted">
                {products.length}
              </span>
            </h2>
            {subheading && <p className="mt-2 text-ink-muted">{subheading}</p>}
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((p) => (
            <Link
              key={p.slug}
              href={`/products/${p.slug}`}
              className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-black/[0.03] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_45px_-15px_rgba(16,42,71,0.28)]"
            >
              <div className="relative aspect-square overflow-hidden bg-slate-50">
                <SmartImage
                  src={p.image ?? ""}
                  alt={p.name}
                  sizes="(max-width: 768px) 50vw, 25vw"
                  className="transition-transform duration-500 group-hover:scale-105"
                />
                {p.brand && (
                  <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-brand-700 backdrop-blur">
                    {p.brand}
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col p-4">
                <h3 className="text-sm font-bold text-ink transition-colors group-hover:text-brand-700">
                  {p.name}
                </h3>
                <p className="mt-1 text-xs text-ink-muted">{p.category}</p>
                {p.tagline && (
                  <p className="mt-1.5 line-clamp-2 text-xs text-ink-soft">
                    {p.tagline}
                  </p>
                )}
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-teal-600">
                  View product
                  <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none">
                    <path
                      d="m8 5 5 5-5 5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </div>
            </Link>
          ))}
        </div>

        {remaining > 0 && (
          <div className="mt-8 flex justify-center">
            <button
              onClick={() => setVisible((v) => v + STEP)}
              className="btn-ghost"
            >
              Load more
              <span className="ml-1 text-ink-muted">
                ({remaining} more)
              </span>
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
