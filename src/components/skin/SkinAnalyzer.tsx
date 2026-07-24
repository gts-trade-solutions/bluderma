"use client";

import { useMemo, useRef, useState, type ComponentType } from "react";
import {
  Sparkles,
  Camera,
  ShieldCheck,
  ScanFace,
  BarChart3,
  Stethoscope,
  Wand2,
  LineChart,
  Lock,
  Clock,
  Smartphone,
  ChevronDown,
  Star,
  Video,
  Building2,
  Globe,
  CheckCircle2,
  MapPin,
  CalendarClock,
} from "@/components/icons";
import SmartImage from "@/components/SmartImage";
import { rankDoctors, matchStrength } from "@/lib/queries/doctors";
import type { ConcernDTO, ConsultModeDTO, DoctorDTO } from "@/lib/queries/types";
import { saveAnalysis } from "@/lib/actions/analysis";
import {
  metrics,
  metricLabel,
  ratingForScore,
  simulateAnalysis,
  seedFromString,
  AnalysisResult,
  MetricKey,
} from "@/data/skin";
import BookingModal from "./BookingModal";

type Step = "intro" | "capture" | "analyzing" | "results";

const STEPS = [
  { icon: Camera, title: "Snap a selfie", body: "Front-facing, in good light — best on your phone." },
  { icon: ScanFace, title: "AI reads your skin", body: "12+ skin signals analysed in seconds." },
  { icon: BarChart3, title: "See your scores", body: "Clear scores and severity for every concern." },
  { icon: Stethoscope, title: "Meet a doctor", body: "Get matched to the right specialist and book." },
];

const BENEFITS = [
  { icon: Wand2, title: "Personalised to you", body: "Guidance mapped to your specific concerns — no guesswork." },
  { icon: LineChart, title: "Track your progress", body: "Re-analyse any time and compare to see what's working." },
  { icon: Sparkles, title: "K-beauty inspired", body: "Built on the precision of Korean dermatology and skincare." },
  { icon: Lock, title: "Private by design", body: "Your photo is analysed in your browser and never uploaded." },
];

const FAQ = [
  { q: "How accurate is it?", a: "It's clinically-informed cosmetic guidance to help you focus your routine and find the right specialist — not a medical diagnosis." },
  { q: "Is my photo stored?", a: "No. In this build your selfie is processed entirely in your browser and is never uploaded or saved." },
  { q: "How many analyses do I get?", a: "As many as you like — the analysis runs locally, so it's always free here." },
  { q: "What do I need?", a: "Any phone or laptop with a camera, and good, even lighting for the most accurate read." },
  { q: "What happens after?", a: "You'll see your scores and get matched with suggested doctors — pick one to see open slots and book." },
];

const AVATARS = [
  "https://randomuser.me/api/portraits/thumb/women/44.jpg",
  "https://randomuser.me/api/portraits/thumb/men/32.jpg",
  "https://randomuser.me/api/portraits/thumb/women/68.jpg",
  "https://randomuser.me/api/portraits/thumb/men/75.jpg",
  "https://randomuser.me/api/portraits/thumb/women/90.jpg",
];

const HERO_FACE =
  "https://images.pexels.com/photos/19999466/pexels-photo-19999466.jpeg?auto=compress&cs=tinysrgb&w=900&h=1120&fit=crop";

const TESTIMONIALS = [
  { name: "Ananya R.", loc: "Mumbai", avatar: "https://randomuser.me/api/portraits/women/65.jpg", quote: "I finally understood why my skin felt so dry — and got matched to a doctor the same day." },
  { name: "Rahul M.", loc: "Bengaluru", avatar: "https://randomuser.me/api/portraits/men/46.jpg", quote: "Took a selfie, got real scores in seconds, and booked a slot that evening." },
  { name: "Sana K.", loc: "Delhi", avatar: "https://randomuser.me/api/portraits/women/12.jpg", quote: "Love that I can re-scan and compare — my pores score actually went up in a month!" },
];


export interface SkinAnalyzerProps {
  doctors: DoctorDTO[];
  concerns: ConcernDTO[];
  /** Next free slot today per doctor slug — a hint, refreshed with the page. */
  nextSlotBySlug: Record<string, string | null>;
}

export default function SkinAnalyzer({
  doctors,
  concerns,
  nextSlotBySlug,
}: SkinAnalyzerProps) {
  const [step, setStep] = useState<Step>("intro");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [seedSource, setSeedSource] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [bookingDoctor, setBookingDoctor] = useState<DoctorDTO | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl(URL.createObjectURL(file));
    setSeedSource(`${file.name}-${file.size}-${file.lastModified}`);
  };

  const runAnalysis = (source: string) => {
    setStep("analyzing");
    const seed = seedFromString(source);
    window.setTimeout(() => {
      const r = simulateAnalysis(seed);
      setResult(r);

      // Persist every metric, not just the summary — that's what makes
      // "re-scan and compare" possible. Fire-and-forget: a failed save must
      // not stop the patient seeing their results.
      void saveAnalysis({
        overall: r.overall,
        skinType: r.skinType,
        estimatedAge: r.estimatedAge,
        seed: source,
        scores: (Object.entries(r.scores) as [MetricKey, number][]).map(
          ([key, score]) => ({ key, score })
        ),
        topConcerns: r.topConcerns,
      }).catch(() => undefined);

      setStep("results");
    }, 2600);
  };

  const reset = () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl(null);
    setSeedSource("");
    setResult(null);
    setStep("intro");
  };

  return (
    <>
      {step === "intro" && (
        <Intro concerns={concerns} onStart={() => setStep("capture")} />
      )}
      {step === "capture" && (
        <Capture
          imageUrl={imageUrl}
          hasPhoto={!!imageUrl}
          onPick={() => fileRef.current?.click()}
          onAnalyze={() => runAnalysis(seedSource || `sample-${Date.now()}`)}
          onSample={() => runAnalysis(`sample-${Date.now()}`)}
        />
      )}
      {step === "analyzing" && <Analyzing imageUrl={imageUrl} />}
      {step === "results" && result && (
        <Results
          result={result}
          imageUrl={imageUrl}
          doctors={doctors}
          nextSlotBySlug={nextSlotBySlug}
          onBook={setBookingDoctor}
          onReset={reset}
        />
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={onFile}
      />
      <BookingModal
        doctor={bookingDoctor}
        open={!!bookingDoctor}
        onClose={() => setBookingDoctor(null)}
      />
    </>
  );
}

/* ============================ INTRO (your UI) ========================== */

function Intro({
  concerns,
  onStart,
}: {
  concerns: ConcernDTO[];
  onStart: () => void;
}) {
  const Cta = ({ small }: { small?: boolean }) => (
    <button
      onClick={onStart}
      className={`btn-primary w-full ${small ? "" : "!py-3.5 text-base"}`}
    >
      <Camera className="h-4 w-4" /> Analyze my skin — free
    </button>
  );

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-rose-50 via-white to-white">
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-rose-200/50 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 top-32 h-72 w-72 rounded-full bg-violet-200/40 blur-3xl" />
        <div className="relative mx-auto flex max-w-6xl flex-col px-4 py-12 lg:grid lg:grid-cols-2 lg:items-center lg:gap-12 lg:py-20">
          <div className="order-2 lg:order-1">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-white/70 px-3 py-1 text-xs font-medium text-rose-700 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" /> AI Skin Analysis
            </span>
            <h1 className="mt-4 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
              Your skin,{" "}
              <span className="bg-gradient-to-r from-rose-500 to-violet-500 bg-clip-text text-transparent">
                analysed in seconds
              </span>
            </h1>
            <p className="mt-4 max-w-md text-base text-ink-muted">
              Snap one selfie. Our AI reads 12+ skin signals — acne, hydration,
              pores, dark circles and more — then matches you with the right
              doctor for your skin.
            </p>

            <div className="mt-7 max-w-sm">
              <Cta />
              <p className="mt-3 text-center text-xs text-ink-muted lg:text-left">
                Free · runs entirely in your browser
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
                <span className="font-semibold text-ink">10,000+</span> skin
                scans and counting
              </p>
            </div>
          </div>

          <div className="order-1 mb-8 lg:order-2 lg:mb-0">
            <FaceAnalysisCard />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <SectionHeading eyebrow="How it works" title="From selfie to a booked appointment, in minutes" />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <div key={s.title} className="relative rounded-2xl border bg-white p-5 shadow-sm">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                <s.icon className="h-5 w-5" />
              </div>
              <div className="text-xs font-semibold text-rose-500">Step {i + 1}</div>
              <div className="mt-0.5 font-medium text-ink">{s.title}</div>
              <p className="mt-1 text-sm text-ink-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* What we analyze */}
      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <SectionHeading
            eyebrow="Deep analysis"
            title="We read 12+ signals in your skin"
            sub="Every concern gets its own score and severity — so you know exactly where to focus."
          />
          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {concerns.map((c) => (
              <div key={c.key} className="rounded-xl border bg-white p-4 transition-shadow hover:shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-gradient-to-r from-rose-400 to-violet-400" />
                  <span className="text-sm font-medium text-ink">{c.label}</span>
                </div>
                <p className="mt-1 text-xs text-ink-muted">
                  {c.description ?? c.hint}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-ink-muted">
            Plus your skin type, estimated skin age and an overall skin score.
          </p>
        </div>
      </section>

      {/* Benefits */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <SectionHeading eyebrow="Why it's different" title="More than a score" />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.map((b) => (
            <div key={b.title} className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-rose-100 to-violet-100 text-rose-600">
                <b.icon className="h-5 w-5" />
              </div>
              <div className="font-medium text-ink">{b.title}</div>
              <p className="mt-1 text-sm text-ink-muted">{b.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Privacy band */}
      <section className="mx-auto max-w-5xl px-4 pb-16">
        <div className="flex flex-col items-start gap-4 rounded-3xl border bg-gradient-to-br from-emerald-50 to-white p-6 sm:flex-row sm:items-center sm:p-8">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-semibold text-ink">Your photo never sticks around</h3>
            <p className="mt-1 text-sm text-ink-muted">
              The analysis runs in your browser, the image is used only for that
              moment, and nothing is uploaded or stored on a server.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 pb-16">
        <SectionHeading eyebrow="Good to know" title="Questions, answered" />
        <div className="mt-8 divide-y rounded-2xl border bg-white px-5">
          {FAQ.map((f) => (
            <details key={f.q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-ink">
                {f.q}
                <ChevronDown className="h-4 w-4 shrink-0 text-ink-muted transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <SectionHeading eyebrow="Loved by our community" title="Real skin, real results" />
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="rounded-2xl border bg-white p-5 shadow-sm">
                <div className="flex gap-0.5 text-amber-400">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <p className="mt-3 text-sm leading-relaxed text-ink-soft">&ldquo;{t.quote}&rdquo;</p>
                <div className="mt-4 flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={t.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
                  <div>
                    <div className="text-sm font-medium text-ink">{t.name}</div>
                    <div className="text-xs text-ink-muted">{t.loc}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden bg-gradient-to-br from-rose-500 to-violet-600">
        <div className="pointer-events-none absolute inset-0 opacity-20 [background:radial-gradient(circle_at_20%_20%,white,transparent_40%)]" />
        <div className="relative mx-auto max-w-2xl px-4 py-16 text-center text-white">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Ready to meet your skin?</h2>
          <p className="mx-auto mt-3 max-w-md text-white/85">
            See your scores, understand your concerns, and get matched with the
            right doctor for you.
          </p>
          <div className="mx-auto mt-7 max-w-sm rounded-2xl bg-white p-4 text-ink shadow-xl">
            <Cta small />
          </div>
        </div>
      </section>
    </>
  );
}

function Trust({ icon: Icon, label }: { icon: ComponentType<{ className?: string }>; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="h-4 w-4 text-rose-400" />
      {label}
    </span>
  );
}

function SectionHeading({ eyebrow, title, sub }: { eyebrow?: string; title: string; sub?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      {eyebrow && (
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-500">{eyebrow}</div>
      )}
      <h2 className="mt-1.5 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{title}</h2>
      {sub && <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">{sub}</p>}
    </div>
  );
}

function FaceAnalysisCard() {
  return (
    <div className="relative mx-auto max-w-sm">
      <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] border-4 border-white bg-slate-100 shadow-2xl shadow-rose-500/15">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={HERO_FACE} alt="AI skin analysis" className="h-full w-full object-cover" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/15 via-transparent to-black/30" />
        <div className="mk-scanline pointer-events-none absolute inset-x-0 h-px bg-white/90 shadow-[0_0_18px_4px_rgba(255,255,255,0.5)]" />
        <ScanDot top="30%" left="35%" />
        <ScanDot top="33%" left="65%" delay="0.9s" />
        <ScanDot top="58%" left="50%" delay="1.8s" />
        <div className="absolute left-3 top-3 rounded-2xl bg-white/85 px-3 py-2 shadow-lg backdrop-blur">
          <div className="text-[9px] uppercase tracking-wide text-ink-muted">Overall</div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold text-emerald-600">82</span>
            <span className="text-[10px] text-ink-muted">/ 100 · Good</span>
          </div>
        </div>
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-rose-500 px-2 py-1 text-[10px] font-semibold text-white shadow">
          <Sparkles className="h-3 w-3" /> Analyzing
        </span>
        <div className="absolute inset-x-3 bottom-3 flex flex-wrap gap-1.5">
          <FaceChip label="Hydration" score={72} tone="bg-lime-500" />
          <FaceChip label="Pores" score={58} tone="bg-amber-500" />
          <FaceChip label="Dark circles" score={44} tone="bg-red-500" />
        </div>
      </div>

      <style jsx global>{`
        @keyframes mk-scanline {
          0% { top: 8%; opacity: 0; }
          20% { opacity: 0.85; }
          80% { opacity: 0.85; }
          100% { top: 92%; opacity: 0; }
        }
        .mk-scanline { animation: mk-scanline 4s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

function ScanDot({ top, left, delay = "0s" }: { top: string; left: string; delay?: string }) {
  return (
    <span
      className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full bg-white shadow ring-2 ring-rose-400/80"
      style={{ top, left, animationDelay: delay }}
    />
  );
}

function FaceChip({ label, score, tone }: { label: string; score: number; tone: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">
      <span className={`h-1.5 w-1.5 rounded-full ${tone}`} />
      {label}
      <span className="tabular-nums opacity-80">{score}</span>
    </span>
  );
}

/* ============================== CAPTURE =============================== */

function Capture({
  imageUrl,
  hasPhoto,
  onPick,
  onAnalyze,
  onSample,
}: {
  imageUrl: string | null;
  hasPhoto: boolean;
  onPick: () => void;
  onAnalyze: () => void;
  onSample: () => void;
}) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <div className="mx-auto max-w-lg text-center">
        <h2 className="text-3xl font-semibold text-ink">Take or upload a selfie</h2>
        <p className="mt-2 text-ink-muted">
          Face the camera in even lighting, remove glasses, and keep a neutral
          expression for the most accurate read.
        </p>

        <button
          onClick={onPick}
          className="group mx-auto mt-8 flex aspect-square w-64 items-center justify-center overflow-hidden rounded-full border-4 border-dashed border-rose-200 bg-rose-50/60 transition hover:border-rose-400"
        >
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="Your selfie preview" className="h-full w-full object-cover" />
          ) : (
            <span className="flex flex-col items-center text-rose-500">
              <Camera className="h-12 w-12" />
              <span className="mt-2 text-sm font-semibold">Tap to add photo</span>
            </span>
          )}
        </button>

        <div className="mt-8 flex flex-col items-center gap-3">
          <button
            onClick={onAnalyze}
            disabled={!hasPhoto}
            className={`btn-primary !px-8 ${!hasPhoto ? "cursor-not-allowed opacity-40" : ""}`}
          >
            <ScanFace className="h-4 w-4" /> Analyze my skin
          </button>
          {hasPhoto ? (
            <button onClick={onPick} className="text-sm font-medium text-rose-600 hover:text-rose-700">
              Choose a different photo
            </button>
          ) : (
            <button onClick={onSample} className="text-sm font-medium text-ink-muted hover:text-rose-700">
              No photo handy? Try a sample analysis →
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

/* ============================= ANALYZING ============================= */

function Analyzing({ imageUrl }: { imageUrl: string | null }) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-24">
      <div className="mx-auto max-w-sm text-center">
        <div className="relative mx-auto aspect-square w-56 overflow-hidden rounded-3xl bg-rose-100">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="Analyzing" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-rose-100 to-violet-100" />
          )}
          <div className="mk-scan pointer-events-none absolute inset-x-0 h-px bg-white shadow-[0_0_18px_4px_rgba(255,255,255,0.6)]" />
          <div className="absolute inset-0 ring-4 ring-inset ring-rose-400/40" />
        </div>
        <h2 className="mt-8 flex items-center justify-center gap-2 text-2xl font-semibold text-ink">
          <ScanFace className="h-6 w-6 text-rose-500" /> Reading your skin…
        </h2>
        <p className="mt-2 text-ink-muted">Analysing 12 signals across your complexion.</p>
        <div className="mx-auto mt-6 h-1.5 w-56 overflow-hidden rounded-full bg-slate-200">
          <div className="mk-bar h-full bg-gradient-to-r from-rose-500 to-violet-500" />
        </div>
      </div>
      <style jsx global>{`
        @keyframes mk-scan { 0% { top: 6%; } 100% { top: 94%; } }
        .mk-scan { animation: mk-scan 1.5s ease-in-out infinite alternate; }
        @keyframes mk-bar { 0% { width: 5%; } 100% { width: 100%; } }
        .mk-bar { animation: mk-bar 2.6s ease-in-out forwards; }
      `}</style>
    </section>
  );
}

/* ============================== RESULTS ============================== */

type SortKey = "match" | "rating" | "experience" | "price";

function Results({
  result,
  imageUrl,
  doctors,
  nextSlotBySlug,
  onBook,
  onReset,
}: {
  result: AnalysisResult;
  imageUrl: string | null;
  doctors: DoctorDTO[];
  nextSlotBySlug: Record<string, string | null>;
  onBook: (d: DoctorDTO) => void;
  onReset: () => void;
}) {
  const rating = ratingForScore(result.overall);
  const [viewAll, setViewAll] = useState(false);
  const [sort, setSort] = useState<SortKey>("match");
  const [modeFilter, setModeFilter] = useState<"all" | ConsultModeDTO>("all");

  const list = useMemo(() => {
    let base = viewAll
      ? [...doctors]
      : rankDoctors(doctors, result.topConcerns, 4);
    if (modeFilter !== "all") base = base.filter((d) => d.modes.includes(modeFilter));
    const sorted = [...base].sort((a, b) => {
      if (sort === "rating") return b.rating - a.rating;
      if (sort === "experience") return b.experienceYears - a.experienceYears;
      if (sort === "price") return a.fee - b.fee;
      // match
      return (
        matchStrength(b, result.topConcerns) - matchStrength(a, result.topConcerns) ||
        b.rating - a.rating
      );
    });
    return sorted;
  }, [viewAll, sort, modeFilter, result.topConcerns, doctors]);

  return (
    <section className="mx-auto max-w-6xl px-4 py-14">
      {/* Summary */}
      <div className="grid gap-8 rounded-3xl border bg-white p-6 shadow-sm sm:p-9 lg:grid-cols-[auto,1fr]">
        <div className="flex items-center gap-6">
          {imageUrl && (
            <div className="relative hidden h-28 w-28 overflow-hidden rounded-2xl sm:block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="Your selfie" className="h-full w-full object-cover" />
            </div>
          )}
          <ScoreRing value={result.overall} rating={rating} />
        </div>
        <div className="flex flex-col justify-center">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-500">
            Your results
          </div>
          <h2 className="mt-1 text-2xl font-semibold text-ink sm:text-3xl">
            Overall score:{" "}
            <span className={rating.color}>
              {result.overall}/100 · {rating.label}
            </span>
          </h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <Fact k="Skin type" v={result.skinType} />
            <Fact k="Estimated skin age" v={`${result.estimatedAge} yrs`} />
            <Fact k="Top concern" v={metricLabel[result.topConcerns[0]]} />
          </div>
          <button
            onClick={onReset}
            className="mt-5 self-start text-sm font-medium text-rose-600 hover:text-rose-700"
          >
            ↺ Analyse another photo
          </button>
        </div>
      </div>

      {/* Metric breakdown */}
      <div className="mt-10">
        <h3 className="text-lg font-bold text-ink">Detailed breakdown</h3>
        <p className="text-sm text-ink-muted">
          Higher is healthier. Your three lowest scores are highlighted as focus areas.
        </p>
        <div className="mt-6 grid gap-x-10 gap-y-5 sm:grid-cols-2">
          {metrics.map((m) => (
            <MetricBar
              key={m.key}
              label={m.label}
              hint={m.hint}
              score={result.scores[m.key]}
              focus={result.topConcerns.includes(m.key)}
            />
          ))}
        </div>
      </div>

      {/* Suggested doctors */}
      <div className="mt-16">
        <div className="mb-1 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 ring-1 ring-rose-100">
            <Stethoscope className="h-3.5 w-3.5" /> Matched to your results
          </span>
        </div>
        <h3 className="text-2xl font-semibold text-ink">
          {viewAll ? "All BluDerma doctors" : "Recommended doctors for you"}
        </h3>
        <p className="mt-1 max-w-2xl text-ink-muted">
          Based on your score and top concerns (
          {result.topConcerns.map((c) => metricLabel[c]).join(", ")}). Pick a
          doctor to see available slots and book.
        </p>

        {/* Toolbar */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-full bg-slate-100 p-1 text-sm">
            <TogglePill active={!viewAll} onClick={() => setViewAll(false)}>
              Best matches
            </TogglePill>
            <TogglePill active={viewAll} onClick={() => setViewAll(true)}>
              All doctors
            </TogglePill>
          </div>

          <div className="inline-flex rounded-full bg-slate-100 p-1 text-sm">
            <TogglePill active={modeFilter === "all"} onClick={() => setModeFilter("all")}>
              All
            </TogglePill>
            <TogglePill active={modeFilter === "video"} onClick={() => setModeFilter("video")}>
              <Video className="mr-1 inline h-3.5 w-3.5" /> Video
            </TogglePill>
            <TogglePill active={modeFilter === "clinic"} onClick={() => setModeFilter("clinic")}>
              <Building2 className="mr-1 inline h-3.5 w-3.5" /> In-clinic
            </TogglePill>
          </div>

          <label className="ml-auto flex items-center gap-2 text-sm text-ink-muted">
            Sort by
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-medium text-ink outline-none focus:border-brand-400"
            >
              <option value="match">Best match</option>
              <option value="rating">Rating</option>
              <option value="experience">Experience</option>
              <option value="price">Price: low to high</option>
            </select>
          </label>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          {list.map((d, i) => (
            <DoctorCard
              key={d.id}
              doctor={d}
              best={!viewAll && sort === "match" && i === 0}
              concerns={result.topConcerns}
              nextSlot={nextSlotBySlug[d.id] ?? null}
              onBook={() => onBook(d)}
            />
          ))}
          {list.length === 0 && (
            <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-ink-muted lg:col-span-2">
              No doctors match this filter. Try another consultation type.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function TogglePill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 font-medium transition ${
        active ? "bg-white text-ink shadow-sm" : "text-ink-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl bg-rose-50 px-4 py-2 ring-1 ring-rose-100">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{k}</p>
      <p className="text-sm font-bold text-ink">{v}</p>
    </div>
  );
}

function ScoreRing({ value, rating }: { value: number; rating: ReturnType<typeof ratingForScore> }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <div className="relative h-32 w-32 shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#e2e8f0" strokeWidth="12" />
        <circle
          cx="60" cy="60" r={r} fill="none" strokeWidth="12" strokeLinecap="round"
          className={rating.ring} stroke="currentColor"
          strokeDasharray={c} strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-extrabold text-ink">{value}</span>
        <span className="text-[11px] font-semibold text-ink-muted">/ 100</span>
      </div>
    </div>
  );
}

function MetricBar({ label, hint, score, focus }: { label: string; hint: string; score: number; focus: boolean }) {
  const rating = ratingForScore(score);
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-ink">{label}</span>
          {focus && (
            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-600">
              Focus
            </span>
          )}
          <span className="hidden text-xs text-ink-muted sm:inline">· {hint}</span>
        </div>
        <span className={`text-sm font-bold ${rating.color}`}>{score}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${rating.bar}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function DoctorCard({
  doctor,
  best,
  concerns,
  nextSlot,
  onBook,
}: {
  doctor: DoctorDTO;
  best: boolean;
  concerns: MetricKey[];
  nextSlot: string | null;
  onBook: () => void;
}) {
  const matched = concerns
    .filter((c) => doctor.focus.includes(c))
    .map((c) => metricLabel[c]);
  return (
    <div
      className={`relative flex flex-col rounded-2xl border bg-white p-5 shadow-sm transition ${
        best ? "ring-2 ring-rose-400" : ""
      }`}
    >
      {best && (
        <span className="absolute -top-2.5 left-5 rounded-full bg-rose-500 px-2.5 py-0.5 text-[11px] font-bold text-white">
          Best match
        </span>
      )}
      <div className="flex gap-4">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl">
          <SmartImage src={doctor.image} alt={doctor.name} sizes="96px" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h4 className="truncate font-bold text-ink">{doctor.name}</h4>
            {doctor.verified && <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-500" />}
          </div>
          <p className="text-sm text-rose-600">{doctor.specialty}</p>
          <p className="text-xs text-ink-muted">
            {doctor.title} · {doctor.experienceYears} yrs
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
            <span className="inline-flex items-center gap-1 font-semibold text-amber-500">
              <Star className="h-3.5 w-3.5 fill-current" /> {doctor.rating}
              <span className="font-normal text-ink-muted">({doctor.reviews})</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> {doctor.location}
            </span>
            <span className="inline-flex items-center gap-1">
              <Globe className="h-3.5 w-3.5" /> {doctor.languages.slice(0, 2).join(", ")}
            </span>
          </div>
        </div>
      </div>

      <p className="mt-3 text-sm text-ink-soft">{doctor.about}</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {doctor.services.map((s) => (
          <span key={s} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-ink-soft">
            {s}
          </span>
        ))}
      </div>

      {matched.length > 0 && (
        <p className="mt-3 text-xs text-ink-soft">
          Treats your <span className="font-semibold text-ink">{matched.join(", ")}</span>
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
        <span className="inline-flex items-center gap-1 text-ink-muted">
          {doctor.modes.includes("clinic") && <Building2 className="h-3.5 w-3.5" />}
          {doctor.modes.includes("video") && <Video className="h-3.5 w-3.5" />}
          {doctor.modes.map((m) => (m === "video" ? "Video" : "In-clinic")).join(" · ")}
        </span>
        {nextSlot && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
            <CalendarClock className="h-3.5 w-3.5" /> Next today: {nextSlot}
          </span>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
        <span className="text-sm text-ink-muted">
          Consult <span className="font-bold text-ink">₹{doctor.fee}</span>
        </span>
        <button onClick={onBook} className="btn-primary !px-5 !py-2 text-sm">
          Book appointment
        </button>
      </div>
    </div>
  );
}
