import Link from "next/link";
import { ArrowRight } from "lucide-react";

import type { HubTreatment } from "@/data/hub";
import SmartImage from "@/components/SmartImage";

/**
 * A treatment as the client sees it: name, what it does, and a session /
 * downtime note. No clinic, no location, no price — those come later in the
 * flow, in consultation.
 *
 * `categorySlug` turns the card into a link to the treatment page. Without it
 * the card stays inert, which is what the search results and any listing that
 * has lost track of its category get.
 */
export default function HubTreatmentCard({
  treatment,
  categorySlug,
}: {
  treatment: HubTreatment;
  categorySlug?: string;
}) {
  const body = (
    <>
      <div className="relative aspect-[4/3] overflow-hidden">
        <SmartImage
          src={treatment.image}
          alt={treatment.name}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="transition-transform duration-500 group-hover:scale-105"
        />
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="display-sm text-[15px] leading-snug text-ink transition-colors group-hover:text-brand-200">
          {treatment.name}
        </h3>
        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-ink-muted">
          {treatment.blurb}
        </p>

        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          {treatment.meta && (
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-ink-soft">
              {treatment.meta}
            </span>
          )}
          {categorySlug && (
            <ArrowRight className="h-4 w-4 shrink-0 text-teal-300 transition-transform group-hover:translate-x-0.5" />
          )}
        </div>
      </div>
    </>
  );

  const shell =
    "card-soft group flex flex-col overflow-hidden transition-all duration-300";

  if (!categorySlug) return <article className={shell}>{body}</article>;

  return (
    <Link
      href={`/patient/explore/${categorySlug}/${treatment.slug}`}
      className={`${shell} hover:-translate-y-1 hover:shadow-[0_20px_45px_-20px_rgba(16,42,71,0.4)]`}
    >
      {body}
    </Link>
  );
}
