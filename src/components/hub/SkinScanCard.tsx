"use client";

import Link from "next/link";
import {
  ArrowRight,
  Camera,
  Loader2,
  Lock,
  ScanFace,
  Sparkles,
  Timer,
} from "lucide-react";

import { useSkinAccess } from "@/hooks/useSkinAccess";
import { IMG } from "@/data/hubImages";

const SIGNALS = [
  { label: "Hydration", value: 72, tone: "bg-lime-400" },
  { label: "Texture", value: 66, tone: "bg-teal-400" },
  { label: "Pores", value: 58, tone: "bg-amber-400" },
  { label: "Pigmentation", value: 51, tone: "bg-orange-400" },
  { label: "Dark circles", value: 44, tone: "bg-rose-400" },
];

/**
 * The "analyse your skin" band on the client hub.
 *
 * Pricing here is the one deliberate exception to the site's no-prices rule:
 * the strike-through *is* the offer. The first scan is complimentary; once it
 * has been used the card falls back to ₹99 and the request-access flow.
 */
export default function SkinScanCard() {
  const { status, busy, error, start, requestAccess, firstScanFree } =
    useSkinAccess();

  const used = status?.authed === true && status.state.status === "none";

  return (
    <section className="relative overflow-hidden rounded-[2rem] bg-[#070d1c]">
      {/* Photographic ground */}
      <div className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={IMG.portraitMacro}
          alt=""
          className="h-full w-full object-cover object-right opacity-60 lg:opacity-100"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#070d1c] via-[#070d1c]/95 to-[#070d1c]/25" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#070d1c] via-transparent to-transparent lg:hidden" />
      </div>
      <div className="pointer-events-none absolute -left-24 top-1/3 h-72 w-72 rounded-full bg-teal-500/20 blur-[100px]" />

      <div className="relative grid items-center gap-10 px-6 py-12 sm:px-10 sm:py-16 lg:grid-cols-[1fr_20rem] lg:px-14 lg:py-20">
        {/* ── Copy ─────────────────────────────────────────────────── */}
        <div className="max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-300 backdrop-blur">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-teal-300" />
            </span>
            AI Skin Analysis
          </span>

          <h2 className="display mt-6 text-[2.15rem] leading-[1.05] text-white sm:text-5xl">
            Know your skin
            <br />
            <span className="bg-gradient-to-r from-teal-200 via-teal-300 to-brand-300 bg-clip-text text-transparent">
              before you treat it.
            </span>
          </h2>

          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-white/60">
            One selfie. Twelve-plus signals scored, acne, pores, hydration,
            pigmentation, dark circles, wrinkles, and a plain-English read on
            what to treat first, and in what order.
          </p>

          {/* ── The offer ─────────────────────────────────────────── */}
          <div className="mt-8 inline-flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-3.5 backdrop-blur">
            <div className="text-right">
              <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">
                Usually
              </p>
              <p className="relative text-xl font-semibold text-white/35">
                <span className="relative">
                  ₹99
                  <span className="absolute inset-x-[-2px] top-1/2 h-[2px] -rotate-6 rounded bg-rose-400" />
                </span>
              </p>
            </div>

            <span className="h-9 w-px bg-white/15" />

            {firstScanFree ? (
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-teal-300/80">
                  Your first scan
                </p>
                <p className="display text-2xl uppercase text-teal-300">Free</p>
              </div>
            ) : (
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">
                  Additional scan
                </p>
                <p className="text-xl font-bold text-white">₹99</p>
              </div>
            )}
          </div>

          {error && (
            <p className="mt-5 max-w-md rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </p>
          )}

          <div className="mt-7 max-w-sm">
            <Cta
              status={status}
              busy={busy}
              used={used}
              onStart={start}
              onRequest={requestAccess}
            />
          </div>

          <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2.5 text-xs font-medium text-white/45">
            <Fact icon={Timer} label="Results in ~30 seconds" />
            <Fact icon={Lock} label="Photo never stored" />
            <Fact icon={ScanFace} label="No card, no app" />
          </ul>
        </div>

        {/* ── Live-report mock ─────────────────────────────────────── */}
        <div className="relative mx-auto w-full max-w-[20rem]">
          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.07] p-5 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/40">
                  Overall skin score
                </p>
                <p className="display mt-1 text-4xl text-white">
                  82
                  <span className="ml-1 text-sm font-semibold text-white/35">
                    /100
                  </span>
                </p>
              </div>
              <Dial value={82} />
            </div>

            <p className="mt-1 text-xs font-semibold text-emerald-400">
              Good · better than 68% your age
            </p>

            <div className="my-5 h-px bg-white/10" />

            <ul className="space-y-3">
              {SIGNALS.map((s) => (
                <li key={s.label}>
                  <div className="flex items-baseline justify-between text-[11px]">
                    <span className="font-medium text-white/70">{s.label}</span>
                    <span className="font-semibold tabular-nums text-white/45">
                      {s.value}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full ${s.tone}`}
                      style={{ width: `${s.value}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>

            <p className="mt-5 rounded-xl bg-white/[0.06] px-3 py-2.5 text-[11px] leading-relaxed text-white/50">
              <Sparkles className="mr-1 inline h-3 w-3 text-teal-300" />
              Your two lowest signals become the first two things we treat.
            </p>
          </div>

          <p className="mt-3 text-center text-[10px] text-white/30">
            Sample report · your own scores will differ
          </p>
        </div>
      </div>
    </section>
  );
}

function Cta({
  status,
  busy,
  used,
  onStart,
  onRequest,
}: {
  status: ReturnType<typeof useSkinAccess>["status"];
  busy: boolean;
  used: boolean;
  onStart: () => void;
  onRequest: () => void;
}) {
  const base =
    "group inline-flex w-full items-center justify-center gap-2 rounded-full px-7 py-4 text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-70";
  const solid = `${base} bg-white text-[#070d1c] shadow-[0_10px_40px_-12px_rgba(84,215,194,0.6)] hover:bg-teal-100`;

  if (!status) {
    return (
      <button disabled className={solid}>
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </button>
    );
  }

  if (!status.authed) {
    return (
      <div className="space-y-3">
        <Link href="/login?callbackUrl=/patient/skin-analyzer" className={solid}>
          <Camera className="h-4 w-4" /> Sign in &amp; scan free
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
        <p className="text-center text-xs text-white/40">
          New here?{" "}
          <Link
            href="/register?callbackUrl=/patient/skin-analyzer"
            className="font-semibold text-teal-300 underline underline-offset-2"
          >
            Create a free account
          </Link>
        </p>
      </div>
    );
  }

  const past = status.lastAnalysisId ? (
    <Link
      href="/patient/skin-analysis"
      className="block text-center text-xs font-semibold text-teal-300 underline underline-offset-2"
    >
      View your past results
    </Link>
  ) : null;

  if (used) {
    return (
      <div className="space-y-3">
        <button
          onClick={onRequest}
          disabled={busy || status.pendingRequest}
          className={solid}
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {status.pendingRequest
            ? "Request pending review"
            : "Request another scan"}
        </button>
        {past}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button onClick={onStart} disabled={busy} className={solid}>
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Camera className="h-4 w-4" />
        )}
        {status.state.status === "reserved"
          ? "Continue your analysis"
          : "Analyse my skin: free"}
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </button>
      {past}
    </div>
  );
}

/** Score ring for the sample report. */
function Dial({ value }: { value: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
      <circle
        cx="32"
        cy="32"
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth="5"
      />
      <circle
        cx="32"
        cy="32"
        r={r}
        fill="none"
        stroke="url(#dial)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={`${(value / 100) * c} ${c}`}
      />
      <defs>
        <linearGradient id="dial" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#54d7c2" />
          <stop offset="100%" stopColor="#8ecdff" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function Fact({
  icon: Icon,
  label,
}: {
  icon: typeof Lock;
  label: string;
}) {
  return (
    <li className="inline-flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 text-teal-300/70" />
      {label}
    </li>
  );
}
