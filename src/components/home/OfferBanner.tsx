import Link from "next/link";
import { ArrowRight, Zap } from "lucide-react";

/**
 * The launch offer.
 *
 * It replaced a thin coloured strip above the navbar that said the same thing
 * and was read by nobody — the one genuinely commercial message on the site
 * was also the least visible thing on it.
 *
 * It is a first-scan offer, not a one-day sale, so the price labels read
 * "every scan → your first scan" rather than "usually → today". Fake urgency
 * is the fastest way to lose the one bit of trust a clinic needs.
 *
 * Laid out as a marketing bar, left to right in the order the eye needs it:
 * what the offer is → what it costs → what to do. The price anchor in the
 * middle is the point of the whole thing, so the struck-out ₹99 is set at
 * the same size as the ₹0 that replaces it, with a thick rose bar across it.
 * A faint grey strikethrough is worth nothing: if the old price can't be read,
 * the discount doesn't land.
 *
 * Full-bleed rather than a contained card: a promo band with page gutters
 * either side reads as a widget someone dropped in, not as the site talking.
 *
 * Brand blue lit as neon: the same tube treatment an offer needs to be read
 * as an offer, without a second palette arriving on the page to do it.
 * Everything is CSS — layered text-shadow for the glow, a blurred radial for
 * the spill. The type stays sharp at any zoom, translates,
 * and is read out properly instead of being trapped in a PNG.
 */

/** Layered shadows: tight core, mid bloom, wide spill — how a tube lights. */
const GLOW = {
  textShadow:
    "0 0 8px rgba(146,234,217,0.95), 0 0 22px rgba(84,215,194,0.7), 0 0 55px rgba(50,143,240,0.5)",
};

export interface OfferCopy {
  badge: string;
  headline: string;
  regularLabel: string;
  regularPrice: string;
  freeLabel: string;
  freePrice: string;
  discountTag: string;
  cta: string;
  footnote: string;
}

/** The launch copy — also what renders when no settings are configured. */
export const OFFER_DEFAULTS: OfferCopy = {
  badge: "New here",
  headline: "FIRST SKIN SCAN FREE",
  regularLabel: "Every scan",
  regularPrice: "₹99",
  freeLabel: "Your first scan",
  freePrice: "₹0",
  discountTag: "100% off",
  cta: "Claim my free scan",
  footnote: "One free scan per account · no card needed",
};

export default function OfferBanner({
  href = "/patient/explore",
  underNav = false,
  copy = OFFER_DEFAULTS,
}: {
  /** Where the offer leads. Defaults to the hub. */
  href?: string;
  /** Leave room for a navbar floating over the band. */
  underNav?: boolean;
  /** Admin-managed wording, from the "offer" settings group. */
  copy?: OfferCopy;
}) {
  return (
    <div className="relative isolate overflow-hidden bg-surface">
      {/* Tube spill */}
      <div className="pointer-events-none absolute left-[8%] top-1/2 h-72 w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-600/30 blur-[100px]" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-64 w-[28rem] -translate-x-1/2 rounded-full bg-teal-400/20 blur-[90px]" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(146,234,217,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(146,234,217,.5) 1px, transparent 1px)",
          backgroundSize: "46px 46px",
        }}
      />

      <div className={`container-page relative flex flex-col items-center gap-7 pb-7 text-center sm:pb-8 lg:flex-row lg:justify-between lg:gap-8 lg:text-left ${
          underNav ? "pt-28 sm:pt-32" : "pt-7 sm:pt-8"
        }`}>
        {/* ── 1. What it is ─────────────────────────────────────────── */}
        <div>
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-teal-300/40 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-teal-300"
            style={GLOW}
          >
            <Zap className="h-3 w-3 fill-teal-300" /> {copy.badge}
          </span>

          {/* One line from the point there is room for one. Sized so it holds
              that line against the price anchor and the button beside it. */}
          <p
            className="mt-3 text-[1.75rem] font-extrabold italic leading-[0.95] tracking-[-0.035em] text-teal-100 sm:text-[2.15rem] lg:whitespace-nowrap"
            style={GLOW}
          >
            {copy.headline}
          </p>
        </div>

        {/* ── 2. What it costs ──────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
              {copy.regularLabel}
            </p>
            <p className="relative mt-1 inline-block text-4xl font-extrabold tracking-tight text-white/70 sm:text-5xl">
              {copy.regularPrice}
              {/* Thick, lit, and rotated — a hairline grey rule reads as a
                  rendering artefact rather than a discount. */}
              <span
                aria-hidden
                className="absolute inset-x-[-8px] top-1/2 h-[5px] -translate-y-1/2 -rotate-[8deg] rounded-full bg-rose-500 shadow-[0_0_14px_rgba(244,63,94,0.95)]"
              />
            </p>
          </div>

          <ArrowRight className="h-6 w-6 shrink-0 text-teal-300/70 sm:h-8 sm:w-8" />

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-teal-300/80">
              {copy.freeLabel}
            </p>
            <p
              className="mt-1 text-4xl font-extrabold tracking-tight text-teal-200 sm:text-5xl"
              style={GLOW}
            >
              {copy.freePrice}
            </p>
          </div>

          <span className="hidden shrink-0 rotate-[-6deg] rounded-xl bg-gradient-to-r from-teal-300 to-brand-400 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[#04121f] shadow-[0_0_24px_-4px_rgba(84,215,194,0.9)] sm:block">
              {copy.discountTag}
          </span>
        </div>

        {/* ── 3. What to do ─────────────────────────────────────────── */}
        <div className="shrink-0">
          <Link
            href={href}
            className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-teal-300 to-brand-400 px-7 py-3.5 text-sm font-extrabold uppercase tracking-wide text-[#04121f] shadow-[0_0_40px_-6px_rgba(84,215,194,0.85)] transition hover:from-teal-200 hover:to-brand-300 active:scale-[0.98]"
          >
            {copy.cta}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <p className="mt-2.5 text-[11px] font-medium text-white/40">
            {copy.footnote}
          </p>
        </div>
      </div>
    </div>
  );
}
