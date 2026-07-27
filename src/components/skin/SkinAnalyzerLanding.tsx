"use client";

import Link from "next/link";
import { useEffect, useState, type ComponentType } from "react";
import {
  Sparkles,
  Camera,
  Loader2,
  Clock,
  Lock,
  Smartphone,
} from "lucide-react";

type Status =
  | { authed: false }
  | {
      authed: true;
      state:
        | { status: "ready"; remaining: number }
        | { status: "reserved"; grantId: string }
        | { status: "none" };
      lastAnalysisId: string | null;
      pendingRequest: boolean;
    };

const ERROR_COPY: Record<string, string> = {
  missing_token: "That analysis link was incomplete. Please start again.",
  invalid_token: "That analysis link was invalid or expired. Please start again.",
  token_used: "That analysis link was already used. Start a new scan.",
  no_access: "You have no scans remaining.",
};

// Hero model (Pexels) — 4:5 crop to match the card.
const HERO_FACE =
  "https://images.pexels.com/photos/19999466/pexels-photo-19999466.jpeg?auto=compress&cs=tinysrgb&w=900&h=1120&fit=crop";

const AVATARS = [
  "https://randomuser.me/api/portraits/thumb/women/44.jpg",
  "https://randomuser.me/api/portraits/thumb/men/32.jpg",
  "https://randomuser.me/api/portraits/thumb/women/68.jpg",
  "https://randomuser.me/api/portraits/thumb/men/75.jpg",
  "https://randomuser.me/api/portraits/thumb/women/90.jpg",
];

export default function SkinAnalyzerLanding() {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Surface an analyzer bounce (?error=...) once on mount.
    const code = new URLSearchParams(window.location.search).get("error");
    if (code) setError(ERROR_COPY[code] ?? "Something went wrong. Please try again.");
    load();
  }, []);

  async function load() {
    try {
      const r = await fetch("/api/skin/status", { cache: "no-store" });
      setStatus(await r.json());
    } catch {
      setStatus({ authed: false });
    }
  }

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/skin/start", { method: "POST" });
      const data = await r.json();
      if (!r.ok || !data.redirectUrl) {
        setError(data.message ?? "Could not start your analysis.");
        setBusy(false);
        return;
      }
      window.location.href = data.redirectUrl;
    } catch {
      setError("Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  async function requestAccess() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/skin/request-access", { method: "POST" });
      const data = await r.json();
      if (!r.ok) setError(data.message ?? "Could not submit your request.");
      else await load();
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setBusy(false);
  }

  function cta() {
    if (!status) {
      return (
        <button disabled className="btn-primary inline-flex w-full justify-center">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
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
              className="font-medium text-brand-600 underline"
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
            onClick={start}
            disabled={busy}
            className="btn-primary inline-flex w-full justify-center disabled:opacity-70"
          >
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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

    return (
      <div className="space-y-2">
        <p className="rounded-lg bg-slate-100 p-3 text-center text-sm text-ink-muted">
          You&apos;ve used your available scan. Request access for another one.
        </p>
        <button
          onClick={requestAccess}
          disabled={busy || pendingRequest}
          className="btn-primary inline-flex w-full justify-center disabled:opacity-70"
        >
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {pendingRequest ? "Request pending review" : "Request another scan"}
        </button>
        {viewLast}
      </div>
    );
  }

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-brand-50 via-white to-white">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand-200/50 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 top-32 h-72 w-72 rounded-full bg-teal-200/40 blur-3xl" />
      <div className="relative mx-auto flex max-w-6xl flex-col px-4 py-12 lg:grid lg:grid-cols-2 lg:items-center lg:gap-12 lg:py-20">
        <div className="order-2 lg:order-1">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-white/70 px-3 py-1 text-xs font-medium text-brand-700 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" /> AI Skin Analysis · powered by
            Perfect Corp
          </span>
          <h1 className="mt-4 text-4xl font-bold leading-[1.05] tracking-tight text-ink sm:text-5xl">
            Your skin,{" "}
            <span className="bg-gradient-to-r from-brand-600 to-teal-500 bg-clip-text text-transparent">
              analysed in seconds
            </span>
          </h1>
          <p className="mt-4 max-w-md text-base text-ink-muted">
            Snap one selfie. Our AI reads 12+ skin signals — acne, hydration,
            pores, dark circles and more — then gives you an overall score and a
            concern breakdown to review with a clinician.
          </p>

          {error && (
            <div className="mt-5 max-w-sm rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div className="mt-7 max-w-sm">
            {cta()}
            <p className="mt-3 text-center text-xs text-ink-muted lg:text-left">
              1 free analysis · results saved to your profile
            </p>
          </div>

          <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-muted">
            <Trust icon={Clock} label="~30 seconds" />
            <Trust icon={Lock} label="Photo never stored" />
            <Trust icon={Smartphone} label="Works on any phone" />
          </div>

          <div className="mt-6 flex items-center gap-3">
            <div className="flex -space-x-2">
              {AVATARS.map((a) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={a}
                  src={a}
                  alt=""
                  className="h-8 w-8 rounded-full border-2 border-white object-cover shadow-sm"
                />
              ))}
            </div>
            <p className="text-xs text-ink-muted">
              <span className="font-semibold text-ink">10,000+</span> skin scans
              and counting
            </p>
          </div>
        </div>

        <div className="order-1 mb-8 lg:order-2 lg:mb-0">
          <FaceAnalysisCard />
        </div>
      </div>
    </section>
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
      <Icon className="h-4 w-4 text-brand-400" />
      {label}
    </span>
  );
}

// Hero visual: a real face with a subtle scan overlay.
function FaceAnalysisCard() {
  return (
    <div className="relative mx-auto max-w-sm">
      <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] border-4 border-white bg-slate-100 shadow-2xl shadow-brand-500/15">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={HERO_FACE}
          alt="AI skin analysis"
          className="h-full w-full object-cover"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/15 via-transparent to-black/30" />

        {/* soft scanning line */}
        <div className="animate-scanline pointer-events-none absolute inset-x-0 h-px bg-white/90 shadow-[0_0_18px_4px_rgba(255,255,255,0.5)]" />

        {/* analysis points */}
        <ScanDot top="30%" left="35%" />
        <ScanDot top="33%" left="65%" delay="0.9s" />
        <ScanDot top="58%" left="50%" delay="1.8s" />

        {/* overall score badge */}
        <div className="absolute left-3 top-3 rounded-2xl bg-white/85 px-3 py-2 shadow-lg backdrop-blur">
          <div className="text-[9px] uppercase tracking-wide text-ink-muted">
            Overall
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold text-emerald-600">82</span>
            <span className="text-[10px] text-ink-muted">/ 100 · Good</span>
          </div>
        </div>

        {/* live badge */}
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-brand-600 px-2 py-1 text-[10px] font-semibold text-white shadow">
          <Sparkles className="h-3 w-3" /> Analyzing
        </span>

        {/* concern chips */}
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
      className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full bg-white shadow ring-2 ring-brand-400/80"
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
