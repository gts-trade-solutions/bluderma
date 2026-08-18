import Link from "next/link";

import type { HubTreatment } from "@/data/hub";
import SmartImage from "@/components/SmartImage";

/**
 * The label card the Korean marketplaces use for a procedure: a small brand
 * line at the top, the procedure name set large and bold beneath it, and a
 * photograph behind the lot.
 *
 * On the reference cards the bottom of the tile is a price. Ours carries the
 * session-and-downtime note instead — a treatment card here never shows a
 * price, a clinic or a branch (G-1, G-2). It is the one real difference from
 * the reference, and it is deliberate.
 *
 * Sized for a horizontal rail so a category's labels sit next to each other.
 */
export default function TreatmentLabel({
  treatment,
  categorySlug,
  categoryLabel,
  tint,
}: {
  treatment: HubTreatment;
  categorySlug: string;
  /** The small line above the name — the "brand" slot on the reference. */
  categoryLabel: string;
  /** Category gradient, used for the wash behind the type. */
  tint: string;
}) {
  return (
    <Link
      href={`/patient/explore/${categorySlug}/${treatment.slug}`}
      className="group relative flex aspect-[3/4] w-[10.5rem] shrink-0 snap-start flex-col overflow-hidden rounded-2xl bg-white/[0.04] ring-1 ring-white/10 transition-all duration-300 hover:-translate-y-1 hover:ring-brand-300/40 sm:w-[12rem]"
    >
      {/* Photograph fills the tile; the type sits on a wash over the top of
          it so it stays readable whatever the image is doing. */}
      <SmartImage
        src={treatment.image}
        alt=""
        sizes="12rem"
        className="object-cover transition-transform duration-500 group-hover:scale-105"
      />

      <div
        className={`absolute inset-x-0 top-0 h-[62%] bg-gradient-to-b ${tint} opacity-30`}
      />
      <div className="absolute inset-x-0 top-0 h-[62%] bg-gradient-to-b from-[#070d1c]/90 via-[#070d1c]/65 to-transparent" />

      <div className="relative flex h-full flex-col p-3.5">
        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-teal-300">
          {categoryLabel}
        </p>

        <h3 className="mt-1.5 line-clamp-3 text-[15px] font-extrabold leading-[1.15] tracking-[-0.01em] text-white">
          {treatment.name}
        </h3>

        {/* Where the reference puts the price. */}
        {treatment.meta && (
          <span className="mt-auto w-fit rounded-lg bg-white/10 px-2 py-1 text-[10px] font-bold text-white/80 ring-1 ring-white/15 backdrop-blur">
            {treatment.meta}
          </span>
        )}
      </div>
    </Link>
  );
}
