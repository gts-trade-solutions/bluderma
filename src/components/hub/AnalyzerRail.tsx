"use client";

import Link from "next/link";
import {
  ArrowRight,
  ClipboardList,
  Clock,
  LoaderCircle,
  ScanFace,
  Scissors,
} from "lucide-react";

import { useSkinAccess } from "@/hooks/useSkinAccess";
import KnowYouCta from "./KnowYouCta";

/**
 * The sticky rail on the browse page.
 *
 * The analyzer is the one thing that should stay reachable no matter how far
 * down the catalogue someone scrolls, so it lives here rather than as another
 * section they scroll past once. Compact by design — the full pitch is on the
 * analyzer's own page.
 */
export default function AnalyzerRail() {
  const {
    status,
    busy,
    error,
    start,
    purchase,
    requestAccess,
    firstScanFree,
    priceInr,
    allowRequests,
    payable,
  } = useSkinAccess();

  const used =
    !!status && status.authed && status.state.status === "none";

  // The advertised figure comes from settings. It was written into this card
  // as a literal 99 while skin.scan_price_inr said 499, so the card was
  // quoting a price the checkout would not have charged.
  const price = priceInr ?? 99;
  // A purchase is only offered where it can actually complete: the server
  // reports whether Razorpay is configured on this deployment. Where it is
  // not, asking staff is the honest fallback rather than a button that fails
  // after the click.

  return (
    <div className="space-y-3">
      {/* ── Skin analyzer ─────────────────────────────────────────── */}
      {/* The card used to be #070d1c — byte for byte the page background —
          so the one section that has to be noticed had no edge at all and
          read as loose text on a phone. It now carries the brand gradient
          the home banner uses, which is the only other place on the client
          side that colour appears: it marks "this is the thing to do first"
          without inventing a new colour for it. */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-800 via-brand-900 to-teal-800 p-5 text-white shadow-[0_18px_44px_-18px_rgba(15,88,173,0.75)] ring-1 ring-inset ring-white/15">
        {/* A single bloom so the gradient has depth rather than looking flat. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-teal-400/20 blur-3xl"
        />
        <div className="relative">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 text-teal-200 ring-1 ring-inset ring-white/20">
          <ScanFace className="h-5 w-5" strokeWidth={1.8} />
        </span>

        <h2 className="display-sm mt-3.5 text-lg leading-snug">
          Analyse your skin first
        </h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-white/75">
          One selfie, twelve-plus signals, about thirty seconds. It turns this
          whole catalogue into a shortlist of three.
        </p>

        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-[#04101f]/45 px-4 py-3 ring-1 ring-inset ring-white/10">
          <div className="text-right">
            <p className="text-[9px] font-medium uppercase tracking-wider text-white/55">
              Usually
            </p>
            <p className="relative text-base font-semibold text-white/50">
              <span className="relative">
                ₹{price}
                <span className="absolute inset-x-[-2px] top-1/2 h-[2px] -rotate-6 rounded bg-rose-400" />
              </span>
            </p>
          </div>
          <span className="h-8 w-px bg-white/15" />
          <div>
            <p className="text-[9px] font-medium uppercase tracking-wider text-teal-200">
              {firstScanFree ? "Your first scan" : "Additional scan"}
            </p>
            <p className="display text-lg uppercase text-teal-200">
              {firstScanFree ? "Free" : `₹${price}`}
            </p>
          </div>
        </div>

        {error && (
          <p className="mt-3 rounded-xl border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
            {error}
          </p>
        )}

        <div className="mt-4">
          {!status ? (
            <button
              disabled
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white/90 px-4 py-3 text-sm font-bold text-brand-900"
            >
              <LoaderCircle className="h-4 w-4 animate-spin" /> Loading…
            </button>
          ) : !status.authed ? (
            <Link
              href="/login?callbackUrl=/patient/skin-analyzer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-bold text-brand-900 transition hover:bg-teal-100"
            >
              Sign in &amp; scan
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : used ? (
            // Their free scan is spent. The card already quotes a price, so
            // the button charges it: an admin approving a purchase is not a
            // checkout, and "Request pending" is a dead end for somebody
            // holding a card. Asking staff survives only where the gateway
            // is not configured, which is a deployment state, not a product.
            <button
              onClick={payable ? purchase : requestAccess}
              // With requests switched off AND no gateway there is nothing
              // to click, so the button says so and does not pretend.
              disabled={
                busy ||
                (!payable && (status.pendingRequest || !allowRequests))
              }
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-bold text-brand-900 transition hover:bg-teal-100 disabled:opacity-60"
            >
              {busy ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : null}
              {payable
                ? `Buy another scan for ₹${price}`
                : !allowRequests
                  ? "Ask the clinic for another scan"
                  : status.pendingRequest
                  ? "Request pending"
                  : "Request another scan"}
            </button>
          ) : (
            <button
              onClick={start}
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-bold text-brand-900 transition hover:bg-teal-100 disabled:opacity-60"
            >
              {busy ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <ScanFace className="h-4 w-4" />
              )}
              Scan my skin: free
            </button>
          )}
        </div>

        <Link
          href="/patient/skin-analyzer"
          className="mt-3 block text-center text-xs font-medium text-white/60 underline-offset-2 hover:text-white hover:underline"
        >
          How the analysis works
        </Link>
        </div>
      </div>

      {/* ── Hair analyzer ─────────────────────────────────────────── */}
      {/* The skin card was given a gradient and this one was left flat, which
          made the rail read as one real product and two afterthoughts. Same
          treatment, different hue: violet for hair, so the two analysers are
          obviously siblings rather than obviously ranked. Dimmed a shade
          because it genuinely is not built yet, and a card that looks as
          ready as the one above it would be a promise. */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-800 via-purple-900 to-fuchsia-800 p-5 text-white shadow-[0_18px_44px_-18px_rgba(126,34,206,0.65)] ring-1 ring-inset ring-white/15">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-fuchsia-400/20 blur-3xl"
        />
        <div className="relative">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-fuchsia-200 ring-1 ring-inset ring-white/20">
              <Scissors className="h-4 w-4" strokeWidth={1.8} />
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-300/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-200">
              <Clock className="h-3 w-3" /> Coming soon
            </span>
          </div>
          <h3 className="display-sm mt-3.5 text-lg leading-snug text-white">
            AI hair analysis
          </h3>
          <p className="mt-1.5 text-[13px] leading-relaxed text-white/75">
            Density, shedding pattern and scalp condition, scored the same way.
          </p>

          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-[#100420]/45 px-4 py-3 ring-1 ring-inset ring-white/10">
            <div className="text-right">
              <p className="text-[9px] font-medium uppercase tracking-wider text-white/55">
                Usually
              </p>
              <p className="relative text-base font-semibold text-white/50">
                <span className="relative">
                  ₹50
                  <span className="absolute inset-x-[-2px] top-1/2 h-[2px] -rotate-6 rounded bg-rose-400" />
                </span>
              </p>
            </div>
            <span className="h-8 w-px bg-white/15" />
            <div>
              <p className="text-[9px] font-medium uppercase tracking-wider text-fuchsia-200">
                At launch
              </p>
              <p className="display text-lg uppercase text-fuchsia-200">Free</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Questionnaire ─────────────────────────────────────────── */}
      {/* The third sibling. Teal rather than a fourth new colour: this is the
          route for somebody who does not want a scan at all, and it should
          read as the calm alternative to the two analysers, not compete with
          them. */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-800 via-teal-900 to-brand-900 p-5 text-white shadow-[0_18px_44px_-18px_rgba(10,102,93,0.7)] ring-1 ring-inset ring-white/15">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-teal-400/20 blur-3xl"
        />
        <div className="relative">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-teal-200 ring-1 ring-inset ring-white/20">
            <ClipboardList className="h-4 w-4" strokeWidth={1.8} />
          </span>
          <h3 className="display-sm mt-3.5 text-lg leading-snug text-white">
            Rather just tell us?
          </h3>
          <p className="mt-1.5 text-[13px] leading-relaxed text-white/75">
            Seven questions about your skin and your routine, then the doctors
            who match. No scan needed.
          </p>
          <div className="mt-4">
            <KnowYouCta variant="rail" />
          </div>
        </div>
      </div>
    </div>
  );
}
