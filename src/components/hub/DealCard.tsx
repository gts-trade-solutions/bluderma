import Link from "next/link";
import { Clock, Flame, Users } from "lucide-react";

import type { HubDeal } from "@/data/hub";
import SmartImage from "@/components/SmartImage";

/**
 * A deal card. Deliberately price-free — BluDerma is enquiry-only, so the
 * offer is expressed as a discount, a perk and a deadline. The final figure
 * is confirmed in consultation.
 */
export default function DealCard({
  deal,
  size = "lg",
}: {
  deal: HubDeal;
  /** "lg" is the hot-deal card, "sm" the regular rail card. */
  size?: "lg" | "sm";
}) {
  const large = size === "lg";

  return (
    <Link
      href={`/patient/explore/${deal.categorySlug}`}
      className={`card-soft group flex shrink-0 snap-start flex-col overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_45px_-20px_rgba(16,42,71,0.4)] ${
        large ? "w-[16.5rem] sm:w-[19rem]" : "w-[14rem] sm:w-[16rem]"
      }`}
    >
      <div className={`relative ${large ? "aspect-[4/3]" : "aspect-[16/10]"}`}>
        <SmartImage
          src={deal.image}
          alt={deal.title}
          sizes="320px"
          className="transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />

        <span
          className={`absolute left-3 top-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold shadow-sm ${
            deal.hot
              ? "bg-gradient-to-r from-rose-500 to-orange-500 text-white"
              : "bg-white/[0.04] text-brand-200"
          }`}
        >
          {deal.hot && <Flame className="h-3 w-3" />}
          {deal.discount}% OFF
        </span>

        {deal.endsIn === "Today" && (
          <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur">
            Last day
          </span>
        )}

        <p className="absolute inset-x-3 bottom-2.5 text-[11px] font-medium text-white/85">
          {deal.categoryLabel}
        </p>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="display-sm text-[15px] leading-snug text-ink group-hover:text-brand-200">
          {deal.title}
        </h3>
        <p className="mt-1 text-xs text-ink-muted">{deal.treatment}</p>

        <p className="mt-3 rounded-lg bg-teal-400/[12%] px-2.5 py-1.5 text-[11px] font-semibold text-teal-200">
          {deal.perk}
        </p>

        {/* `claimed` used to render as "724 enquired" — a social-proof number
            nobody counted — and `endsIn` as a red "Today" countdown on a
            hardcoded string that never actually expired. Both are gone. The
            deadline is still shown when an admin has set one, because a real
            end date is useful; the invented enquiry count is not shown at all.
            Deals carry real start/end dates in the CMS and stop showing
            themselves when they lapse. */}
        {deal.endsIn && (
          <div className="mt-auto flex items-center justify-between pt-3 text-[11px] text-ink-muted">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {deal.endsIn}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
