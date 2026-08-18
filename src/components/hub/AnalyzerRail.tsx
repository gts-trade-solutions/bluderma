"use client";

import Link from "next/link";
import { ArrowRight, Clock, LoaderCircle, ScanFace, Scissors } from "lucide-react";

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
  const { status, busy, error, start, requestAccess, firstScanFree } =
    useSkinAccess();

  const used =
    !!status && status.authed && status.state.status === "none";

  return (
    <div className="space-y-3">
      {/* ── Skin analyzer ─────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-3xl bg-[#070d1c] p-5 text-white">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-teal-300">
          <ScanFace className="h-5 w-5" strokeWidth={1.8} />
        </span>

        <h2 className="display-sm mt-3.5 text-lg leading-snug">
          Analyse your skin first
        </h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-white/60">
          One selfie, twelve-plus signals, about thirty seconds. It turns this
          whole catalogue into a shortlist of three.
        </p>

        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white/[0.06] px-4 py-3">
          <div className="text-right">
            <p className="text-[9px] font-medium uppercase tracking-wider text-white/40">
              Usually
            </p>
            <p className="relative text-base font-semibold text-white/35">
              <span className="relative">
                ₹99
                <span className="absolute inset-x-[-2px] top-1/2 h-[2px] -rotate-6 rounded bg-rose-400" />
              </span>
            </p>
          </div>
          <span className="h-8 w-px bg-white/15" />
          <div>
            <p className="text-[9px] font-medium uppercase tracking-wider text-teal-300/80">
              {firstScanFree ? "Your first scan" : "Additional scan"}
            </p>
            <p className="display text-lg uppercase text-teal-300">
              {firstScanFree ? "Free" : "₹99"}
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
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white/90 px-4 py-3 text-sm font-bold text-[#070d1c]"
            >
              <LoaderCircle className="h-4 w-4 animate-spin" /> Loading…
            </button>
          ) : !status.authed ? (
            <Link
              href="/login?callbackUrl=/patient/skin-analyzer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-bold text-[#070d1c] transition hover:bg-teal-100"
            >
              Sign in &amp; scan
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : used ? (
            <button
              onClick={requestAccess}
              disabled={busy || status.pendingRequest}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-bold text-[#070d1c] transition hover:bg-teal-100 disabled:opacity-60"
            >
              {status.pendingRequest ? "Request pending" : "Request another scan"}
            </button>
          ) : (
            <button
              onClick={start}
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-bold text-[#070d1c] transition hover:bg-teal-100 disabled:opacity-60"
            >
              {busy ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <ScanFace className="h-4 w-4" />
              )}
              Scan my skin — free
            </button>
          )}
        </div>

        <Link
          href="/patient/skin-analyzer"
          className="mt-3 block text-center text-xs font-medium text-white/45 underline-offset-2 hover:text-white/80 hover:underline"
        >
          How the analysis works
        </Link>
      </div>

      {/* ── Hair analyzer ─────────────────────────────────────────── */}
      <div className="rounded-3xl bg-white/[0.04] ring-1 ring-white/10 p-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400/15 to-teal-400/15 text-brand-300 ring-1 ring-inset ring-brand-300/40">
            <Scissors className="h-4 w-4" strokeWidth={1.8} />
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/[12%] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-300">
            <Clock className="h-3 w-3" /> Coming soon
          </span>
        </div>
        <h3 className="display-sm mt-3 text-[15px] text-ink">
          AI hair analysis
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">
          Density, shedding pattern and scalp condition, scored the same way.
        </p>
        <p className="mt-3 text-xs font-semibold text-ink-muted">
          <span className="line-through">₹50</span>{" "}
          <span className="text-teal-300">Free at launch</span>
        </p>
      </div>

      {/* ── Questionnaire ─────────────────────────────────────────── */}
      <div className="rounded-3xl bg-white/[0.04] ring-1 ring-white/10 p-5">
        <h3 className="display-sm text-[15px] text-ink">
          Rather just tell us?
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">
          Seven questions about your skin and your routine, then the doctors
          who match. No scan needed.
        </p>
        <div className="mt-3.5">
          <KnowYouCta variant="rail" />
        </div>
      </div>
    </div>
  );
}
