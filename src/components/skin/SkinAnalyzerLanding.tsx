"use client";

import Link from "next/link";
import { useEffect, useState, type ComponentType } from "react";
import {
  ArrowRight,
  Camera,
  ChevronDown,
  Clock,
  LoaderCircle,
  Lock,
  ScanFace,
  Smartphone,
  Sparkles,
  Star,
  Zap,
} from "lucide-react";

import ConsultationStep from "@/components/skin/ConsultationStep";
import PublishedReviewsSection from "@/components/PublishedReviewsSection";
import SmartImage from "@/components/SmartImage";
import { useSkinAccess } from "@/hooks/useSkinAccess";
import { useRazorpayCheckout } from "@/hooks/useRazorpayCheckout";
import { IMG } from "@/data/hubImages";
import { metrics } from "@/data/skin";

/** Layered shadows: tight core, mid bloom, wide spill — how a tube lights. */
const GLOW = {
  textShadow:
    "0 0 8px rgba(146,234,217,0.95), 0 0 22px rgba(84,215,194,0.7), 0 0 55px rgba(50,143,240,0.5)",
};

const ERROR_COPY: Record<string, string> = {
  missing_token: "That analysis link was incomplete. Please start again.",
  invalid_token:
    "That analysis link was invalid or expired. Please start again.",
  token_used: "That analysis link was already used. Start a new scan.",
  no_access: "You have no scans remaining.",
};

/**
 * The skin analyzer landing page.
 *
 * Built as a consumer front page rather than a tool page: a K-beauty hero,
 * proof, then the explanation — the layout a skincare brand uses when the
 * visitor has never heard of it.
 *
 * Two deliberate routing decisions:
 *  - the hero "Scan my skin" button goes to the hub, because the hub is
 *    where a first-time visitor should land;
 *  - the button that actually launches the analyzer lives further down, in
 *    "Ready when you are", where the entitlement state can be explained.
 */
export default function SkinAnalyzerLanding() {
  const {
    status,
    busy,
    error,
    setError,
    start,
    requestAccess,
    reload,
    firstScanFree,
  } = useSkinAccess();
  const { checkout } = useRazorpayCheckout();

  /**
   * Buy another scan.
   *
   * One POST. /api/skin/purchase creates the order and the Payment row, and
   * useRazorpayCheckout handles all three of its answers: a real order, a free
   * grant, or the gateway not being configured on this build.
   *
   * The credit itself is granted when the payment SETTLES, not when checkout
   * opens — see releaseScanCredit in lib/payments/settle.ts — so an abandoned
   * payment leaves nothing behind and this only has to reload the state.
   */
  const buyScan = async () => {
    const outcome = await checkout({
      createUrl: "/api/skin/purchase",
      body: {},
      description: "Skin analysis",
      reference: "skin-scan",
    });
    if (outcome.status === "paid" || outcome.status === "no_payment_due") {
      await reload();
    } else if (outcome.status === "failed") {
      setError(outcome.error);
    }
  };

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("error");
    if (code)
      setError(ERROR_COPY[code] ?? "Something went wrong. Please try again.");
  }, [setError]);

  return (
    <>
      {/* ── Hero, offer included ──────────────────────────────────────── */}
      {/* One section, not two. A gold offer band stacked on a blue hero said
          the same thing twice and put three calls to action above the fold;
          the offer now sits inside the hero as the lit teal accent, and there is
          exactly one button. */}
      <section className="relative isolate overflow-hidden bg-[#0b1020]">
        <div className="pointer-events-none absolute -left-32 top-0 h-96 w-96 rounded-full bg-brand-600/25 blur-[120px]" />
        <div className="pointer-events-none absolute -right-24 bottom-0 h-[26rem] w-[26rem] rounded-full bg-teal-500/20 blur-[120px]" />
        {/* Extra spill under the offer, so the teal reads as lit rather than
            flat against the navy. */}
        <div className="pointer-events-none absolute -left-16 bottom-4 h-64 w-[30rem] rounded-full bg-teal-500/15 blur-[110px]" />

        <div className="container-page relative grid gap-10 pb-10 pt-28 sm:pb-12 sm:pt-32 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:pb-14 lg:pt-32">
          <div>
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-teal-300/40 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-teal-300"
              style={GLOW}
            >
              <Zap className="h-3 w-3 fill-teal-300" /> First scan free
            </span>

            <h1 className="display mt-5 max-w-2xl text-balance text-[2.5rem] leading-[0.98] text-white sm:text-6xl lg:text-[4rem]">
              Skincare that
              <br className="hidden sm:block" /> understands{" "}
              <span className="bg-gradient-to-r from-teal-200 to-brand-300 bg-clip-text text-transparent">
                your skin
              </span>
            </h1>

            <p className="mt-5 max-w-lg text-base font-medium leading-relaxed text-white/70 sm:text-lg">
              One selfie, read against the K-beauty standard. Twelve-plus
              signals scored in about thirty seconds.
            </p>

            {/* The offer, as one line: price anchor + the two facts that used
                to be stat tiles. */}
            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-4">
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/35">
                    Every scan
                  </p>
                  <p className="relative mt-0.5 inline-block text-3xl font-extrabold tracking-tight text-white/60">
                    ₹99
                    <span
                      aria-hidden
                      className="absolute inset-x-[-7px] top-1/2 h-[4px] -translate-y-1/2 -rotate-[8deg] rounded-full bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.9)]"
                    />
                  </p>
                </div>

                <ArrowRight className="h-6 w-6 shrink-0 text-teal-300/70" />

                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-teal-300/80">
                    Your first scan
                  </p>
                  <p
                    className="mt-0.5 text-3xl font-extrabold tracking-tight text-teal-200"
                    style={GLOW}
                  >
                    ₹0
                  </p>
                </div>
              </div>

              <span className="rotate-[-6deg] rounded-xl bg-gradient-to-r from-teal-300 to-brand-400 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[#04121f] shadow-[0_0_24px_-4px_rgba(84,215,194,0.9)]">
                100% off
              </span>
            </div>

            {/* One button. */}
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link
                href="/patient/know-you"
                className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-teal-300 to-brand-400 px-7 py-4 text-sm font-extrabold uppercase tracking-wide text-[#04121f] shadow-[0_0_40px_-6px_rgba(84,215,194,0.85)] transition hover:from-teal-200 hover:to-brand-300 active:scale-[0.98]"
              >
                Start your skin consultation
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <a
                href="#how"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/60 underline-offset-4 transition hover:text-white hover:underline"
              >
                How it works
                <ChevronDown className="h-4 w-4" />
              </a>
            </div>

            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-xs font-medium text-white/45">
              <Trust icon={Clock} label="About 30 seconds" />
              <Trust icon={Lock} label="Photo never stored" />
              <Trust icon={Smartphone} label="One free scan per account" />
            </div>
          </div>

          <div className="mx-auto w-full max-w-[19rem] sm:max-w-sm lg:max-w-[23rem]">
            <FaceAnalysisCard />
          </div>
        </div>
      </section>

      {/* ── The real launcher ─────────────────────────────────────────── */}
      <section id="start" className="scroll-mt-24 bg-white/[0.04] py-16 sm:py-20">
        <div className="container-page">
          <div className="mb-7 text-center">
            <p className="section-eyebrow">Step 1 of 2</p>
            <h2 className="display mt-2 text-3xl text-ink sm:text-4xl">
              Now scan your skin
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-base leading-relaxed text-ink-muted">
              One selfie, twelve-plus signals scored against what you just told
              us. About thirty seconds.
            </p>
          </div>

          <div className="mx-auto max-w-xl rounded-3xl bg-white/[0.04] ring-1 ring-white/10 p-7 text-center shadow-card sm:p-10">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400/15 to-teal-400/15 text-brand-300 ring-1 ring-inset ring-brand-300/40">
              <ScanFace className="h-7 w-7" strokeWidth={1.7} />
            </span>
            <h2 className="display-sm mt-5 text-2xl text-ink">
              Ready when you are
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-muted">
              {firstScanFree
                ? "Your first scan is on us. It takes about half a minute and the result saves to your profile."
                : "You've used your complimentary scan. Ask for another and we'll review it."}
            </p>

            {error && (
              <div className="mx-auto mt-5 max-w-sm rounded-xl border border-rose-200 bg-rose-500/[12%] px-4 py-3 text-sm text-rose-300">
                {error}
              </div>
            )}

            <div className="mx-auto mt-6 max-w-sm">
              <Cta
                status={status}
                busy={busy}
                onStart={start}
                onRequest={requestAccess}
                onBuy={buyScan}
              />
              <p className="mt-3 text-xs text-ink-muted">
                Powered by Perfect Corp · your photo is analysed, not stored.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Step 3: the appointment ───────────────────────────────────── */}
      {/* The journey ends with a doctor, not with a score. A reading nobody
          acts on is a nice number and nothing else. */}
      <section
        id="consult"
        className="scroll-mt-24 bg-[var(--surface)] py-16 sm:py-20"
      >
        <div className="container-page">
          <div className="mb-7">
            <p className="section-eyebrow">Step 2 of 2</p>
            <h2 className="display mt-2 text-3xl text-ink sm:text-4xl">
              Book your consultation
            </h2>
            <p className="mt-2 max-w-2xl text-base leading-relaxed text-ink-muted">
              Doctors in your city can see you in person. Anyone further away
              consults by video — so the right specialist is not decided by how
              near they happen to be.
            </p>
          </div>

          <ConsultationStep />
        </div>
      </section>

      {/* ── What we score ─────────────────────────────────────────────── */}
      <section className="bg-white/[0.04] py-16 sm:py-20">
        <div className="container-page">
          <p className="section-eyebrow">What gets read</p>
          <h2 className="display mt-2 max-w-2xl text-3xl text-ink sm:text-4xl">
            Twelve signals, scored individually
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink-muted">
            An overall number tells you very little on its own. The breakdown is
            what decides the order treatment happens in.
          </p>

          <ul className="mt-9 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {metrics.map((m) => (
              <li
                key={m.key}
                className="rounded-2xl bg-white/[0.04] ring-1 ring-white/10 p-4 transition hover:border-brand-300/50 hover:shadow-soft"
              >
                <p className="text-sm font-bold text-ink">{m.label}</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                  {m.hint}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────── */}
      <section
        id="how"
        className="scroll-mt-24 bg-[var(--surface)] py-16 sm:py-20"
      >
        <div className="container-page">
          <p className="section-eyebrow">How it works</p>
          <h2 className="display mt-2 text-3xl text-ink sm:text-4xl">
            Three steps, one selfie
          </h2>

          <ol className="mt-9 grid gap-4 lg:grid-cols-3">
            {[
              {
                n: "01",
                t: "Take the photo",
                b: "Front camera, even light, no makeup if you can manage it. The photo is analysed and never stored.",
                img: IMG.portraitClean,
              },
              {
                n: "02",
                t: "Read the score",
                b: "Twelve-plus signals, each scored, with the three that need attention first pulled to the top.",
                img: IMG.portraitMacro,
              },
              {
                n: "03",
                t: "Take it to a doctor",
                b: "Your report attaches to the questionnaire, so the dermatologist has read it before you meet.",
                img: IMG.procFacial,
              },
            ].map((s) => (
              <li
                key={s.n}
                className="overflow-hidden rounded-3xl bg-white/[0.04] ring-1 ring-white/10"
              >
                <div className="relative h-44">
                  <SmartImage
                    src={s.img}
                    alt=""
                    sizes="(min-width: 1024px) 33vw, 100vw"
                    className="object-top"
                  />
                </div>
                <div className="p-6">
                  <span className="display text-xl text-brand-300">{s.n}</span>
                  <p className="display-sm mt-1.5 text-lg text-ink">{s.t}</p>
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                    {s.b}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── K-beauty standard ─────────────────────────────────────────── */}
      <section className="bg-white/[0.04] py-16 sm:py-20">
        <div className="container-page">
          <div className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand-700 via-brand-600 to-teal-600">
            <div className="grid gap-0 lg:grid-cols-[1fr_1.1fr]">
              <div className="p-8 sm:p-11">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-200">
                  The K-beauty standard
                </p>
                <h2 className="display mt-3 text-3xl leading-tight text-white sm:text-4xl">
                  Graded against the world&apos;s most demanding skin market
                </h2>
                <p className="mt-4 max-w-md text-base leading-relaxed text-white/75">
                  Korean dermatology judges skin on barrier health, tone
                  evenness and texture long before it looks at wrinkles. Our
                  scoring follows the same order — which is why the plan you get
                  starts with repair, not resurfacing.
                </p>

                <ul className="mt-7 space-y-3">
                  {[
                    "Barrier and hydration weighted first",
                    "Tone evenness scored across four zones",
                    "Texture read at pore level, not as a single number",
                    "Written for pigmented skin, where most tools are not",
                  ].map((line) => (
                    <li
                      key={line}
                      className="flex items-start gap-2.5 text-sm text-white/80"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-300" />
                      {line}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid grid-cols-2 gap-1 p-1 sm:gap-2 sm:p-2">
                {[
                  IMG.portraitHero,
                  IMG.portraitGlow,
                  IMG.prod1,
                  IMG.facial1,
                ].map((src, i) => (
                  <div
                    key={src}
                    className={`relative overflow-hidden rounded-2xl ${
                      i === 0 ? "row-span-2 min-h-[18rem]" : "min-h-[8.5rem]"
                    }`}
                  >
                    <SmartImage
                      src={src}
                      alt=""
                      sizes="(min-width: 1024px) 25vw, 50vw"
                      className="object-top"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Reviews ───────────────────────────────────────────────────── */}
      {/* Real published reviews only. This block used to hold three invented
          testimonials with invented cities and a hardcoded five-star rating.
          It renders nothing until real clients have reviewed. */}
      <PublishedReviewsSection
        eyebrow="What clients say"
        title="The part people remember"
      />

      {/* ── FAQ ───────────────────────────────────────────────────────── */}
      <section className="bg-[var(--surface)] py-16 sm:py-20">
        <div className="container-page">
          <p className="section-eyebrow">Questions</p>
          <h2 className="display mt-2 text-3xl text-ink sm:text-4xl">
            Before you scan
          </h2>

          <div className="mt-8 max-w-3xl divide-y divide-white/10 overflow-hidden rounded-3xl bg-white/[0.04] ring-1 ring-white/10">
            {[
              {
                q: "Is the analysis a diagnosis?",
                a: "No. It measures what a camera can see and turns it into scores. Anything that needs an examination — a mole, a rash, a lesion — is a doctor's call, not a camera's.",
              },
              {
                q: "What happens to my photo?",
                a: "It is analysed and discarded. The scores are saved to your profile so you can compare later; the image itself is not kept.",
              },
              {
                q: "Do I need makeup off?",
                a: "It helps. Foundation and concealer flatten texture and hide redness, which is exactly what the scoring is looking for.",
              },
              {
                q: "Why is the first one free?",
                a: "Because the report is only useful if you actually run it. It is normally ₹99; the first scan on an account is free, no card involved.",
              },
              {
                q: "Can I take the result to my own doctor?",
                a: "Yes. Download it from your profile, or attach it to the questionnaire and it goes to whichever BluDerma doctor you book.",
              },
            ].map((f) => (
              <details key={f.q} className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 text-sm font-bold text-ink">
                  {f.q}
                  <ChevronDown className="h-4 w-4 shrink-0 text-ink-muted transition-transform group-open:rotate-180" />
                </summary>
                <p className="px-6 pb-5 text-sm leading-relaxed text-ink-muted">
                  {f.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Closing ───────────────────────────────────────────────────── */}
      <section className="bg-white/[0.04] pb-20">
        <div className="container-page">
          <div className="flex flex-col items-start justify-between gap-5 rounded-[2rem] bg-gradient-to-r from-brand-700 to-teal-600 p-8 text-white sm:flex-row sm:items-center sm:p-11">
            <div>
              <h2 className="display-sm text-2xl sm:text-3xl">
                Everything else lives on the hub
              </h2>
              <p className="mt-2 max-w-lg text-sm text-white/80">
                Treatments, deals, conditions and the doctors who treat them —
                all in one place, with no prices on the treatment cards.
              </p>
            </div>
            <Link
              href="/patient/explore"
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white/[0.04] px-6 py-3.5 text-sm font-bold text-brand-100 transition hover:bg-teal-400/[12%]"
            >
              Explore treatments
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────── */

/** The entitlement-aware launcher. Unchanged behaviour, new home. */
function Cta({
  status,
  busy,
  onStart,
  onRequest,
  onBuy,
}: {
  status: ReturnType<typeof useSkinAccess>["status"];
  busy: boolean;
  onStart: () => void;
  onRequest: () => void;
  onBuy: () => void;
}) {
  if (!status) {
    return (
      <button
        disabled
        className="btn-primary inline-flex w-full justify-center"
      >
        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Loading…
      </button>
    );
  }

  if (!status.authed) {
    return (
      <div className="space-y-2">
        <Link
          href="/login?callbackUrl=/patient/skin-analyzer"
          className="btn-primary inline-flex w-full justify-center"
        >
          <Camera className="mr-2 h-4 w-4" /> Sign in &amp; analyze your skin
        </Link>
        <p className="text-center text-xs text-ink-muted">
          New here?{" "}
          <Link
            href="/register?callbackUrl=/patient/skin-analyzer"
            className="font-medium text-brand-300 underline"
          >
            Create a free account
          </Link>
        </p>
      </div>
    );
  }

  const { state, lastAnalysisId, pendingRequest } = status;
  const viewLast = lastAnalysisId ? (
    <Link
      href="/patient/skin-analysis"
      className="btn-ghost inline-flex w-full justify-center text-sm"
    >
      View your past results
    </Link>
  ) : null;

  if (state.status === "ready" || state.status === "reserved") {
    return (
      <div className="space-y-2">
        <button
          onClick={onStart}
          disabled={busy}
          className="btn-primary inline-flex w-full justify-center disabled:opacity-70"
        >
          {busy ? (
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Camera className="mr-2 h-4 w-4" />
          )}
          {state.status === "reserved"
            ? "Continue your analysis"
            : "Analyze my skin — free"}
        </button>
        {viewLast}
      </div>
    );
  }

  // Out of credits. Two ways forward: buy one, or ask us — and buying was
  // unreachable until now even though the endpoint and the price were both
  // already there.
  const offer = status.offer;
  const canBuy = Boolean(offer && offer.priceInr > 0);

  return (
    <div className="space-y-2">
      <p className="rounded-lg bg-white/10 p-3 text-center text-sm text-ink-muted">
        You&apos;ve used your available scan.
        {canBuy
          ? ` Another is ₹${offer!.priceInr.toLocaleString("en-IN")}.`
          : " Request access for another one."}
      </p>

      {canBuy && (
        <button
          onClick={onBuy}
          disabled={busy}
          className="btn-primary inline-flex w-full justify-center disabled:opacity-70"
        >
          {busy ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
          Buy another scan — ₹{offer!.priceInr.toLocaleString("en-IN")}
        </button>
      )}

      {(!canBuy || offer?.allowRequests) && (
        <button
          onClick={onRequest}
          disabled={busy || pendingRequest}
          className={`inline-flex w-full justify-center disabled:opacity-70 ${
            canBuy ? "btn-ghost text-sm" : "btn-primary"
          }`}
        >
          {busy && !canBuy ? (
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          {pendingRequest ? "Request pending review" : "Request another scan"}
        </button>
      )}
      {viewLast}
    </div>
  );
}

function Trust({
  icon: Icon,
  label,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="h-4 w-4 text-teal-300" />
      {label}
    </span>
  );
}

/** Hero visual: a face with a live scan overlay. */
function FaceAnalysisCard() {
  const [score] = useState(82);

  return (
    <div className="relative mx-auto max-w-sm">
      <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] border-4 border-white/80 bg-white/10 shadow-2xl shadow-black/40">
        {/* object-top keeps the face in frame when a 2:3 portrait is cropped
            into this 4:5 card. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={IMG.analyzerHeroAlt}
          alt="AI skin analysis"
          className="h-full w-full object-cover object-top"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/15 via-transparent to-black/35" />

        <div className="animate-scanline pointer-events-none absolute inset-x-0 h-px bg-white/90 shadow-[0_0_18px_4px_rgba(255,255,255,0.5)]" />

        <ScanDot top="30%" left="35%" />
        <ScanDot top="33%" left="65%" delay="0.9s" />
        <ScanDot top="58%" left="50%" delay="1.8s" />

        <div className="absolute left-3 top-3 rounded-2xl bg-[#070d1c]/85 px-3 py-2 shadow-lg ring-1 ring-white/15 backdrop-blur">
          <div className="text-[9px] uppercase tracking-wide text-ink-muted">
            Overall
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold text-emerald-600">{score}</span>
            <span className="text-[10px] text-ink-muted">/ 100 · Good</span>
          </div>
        </div>

        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-brand-600 px-2 py-1 text-[10px] font-semibold text-white shadow">
          <Sparkles className="h-3 w-3" /> Analyzing
        </span>

        <div className="absolute inset-x-3 bottom-3 flex flex-wrap gap-1.5">
          <FaceChip label="Hydration" score={72} tone="bg-lime-500" />
          <FaceChip label="Pores" score={58} tone="bg-amber-500" />
          <FaceChip label="Dark circles" score={44} tone="bg-red-500" />
        </div>
      </div>
    </div>
  );
}

function ScanDot({
  top,
  left,
  delay = "0s",
}: {
  top: string;
  left: string;
  delay?: string;
}) {
  return (
    <span
      className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full bg-white/[0.04] shadow ring-2 ring-brand-400/80"
      style={{ top, left, animationDelay: delay }}
    />
  );
}

function FaceChip({
  label,
  score,
  tone,
}: {
  label: string;
  score: number;
  tone: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">
      <span className={`h-1.5 w-1.5 rounded-full ${tone}`} />
      {label}
      <span className="tabular-nums opacity-80">{score}</span>
    </span>
  );
}
