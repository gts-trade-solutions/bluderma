import Link from "next/link";
import { ArrowRight, Check, LogIn } from "lucide-react";

import SmartImage from "@/components/SmartImage";
import { DOCTOR_IMG } from "@/data/doctorImages";
import { doctorCta } from "@/lib/doctor/viewer";

/**
 * The practitioner recruitment banner.
 *
 * ── Bright, and the photograph is actually visible ───────────────────────
 * The previous version was a full-bleed photograph under two stacked dark
 * gradients, which is the shape the client rejected: "dull colour" and "image
 * is not properly visible due to more colour overlay". Both were fair. A scrim
 * heavy enough to carry white type across a whole frame is heavy enough to
 * destroy the picture underneath it, so you pay for a photograph and show a
 * grey rectangle.
 *
 * This splits instead. The type sits on a light ground where it needs no
 * overlay at all, and the photograph keeps its own half at full strength with
 * nothing over it but a short feather where the two meet.
 *
 * ── Explicit slate, never `text-ink` ─────────────────────────────────────
 * This is a LIGHT island on a dark page. `text-ink` resolves to a near-white
 * outside `.theme-light`, so every colour here is a literal — the same trap
 * PortalPreview's calendar sketch documents, and the one verify-theme checks
 * for.
 */
export default function JoinHero({
  doctorCount,
  clinicCount,
  viewer,
}: {
  doctorCount: number;
  clinicCount: number;
  /**
   * Who is reading this. Offering "Doctor sign in" to somebody already signed
   * in is the kind of detail that makes a site feel like it is not paying
   * attention, and offering "List your practice" to a listed doctor sends
   * them back through a wizard they finished weeks ago.
   */
  viewer: "guest" | "client" | "doctor-pending" | "doctor-live" | "admin";
}) {
  const cta = doctorCta(viewer);

  return (
    <section className="relative isolate overflow-hidden bg-gradient-to-br from-slate-100 via-white to-brand-50">
      {/* Two pale blooms. The ground is nearly white, and these are what stop
          it reading as a blank sheet. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-brand-200/40 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-[-14rem] left-1/3 h-[28rem] w-[28rem] rounded-full bg-teal-200/35 blur-3xl"
      />

      <div className="container-page relative">
        <div className="grid items-center gap-10 py-14 sm:pb-24 sm:pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-12 lg:pb-28 lg:pt-20">
          {/* ── The pitch, on light ─────────────────────────────────── */}
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-brand-700 shadow-sm ring-1 ring-brand-200">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-teal-500" />
              For dermatologists and skin specialists
            </span>

            <h1 className="display mt-5 text-balance text-4xl leading-[1.06] text-slate-900 sm:text-5xl lg:text-[3.5rem]">
              Put your practice in front of{" "}
              <span className="bg-gradient-to-r from-brand-600 to-teal-500 bg-clip-text text-transparent">
                prepared patients.
              </span>
            </h1>

            <p className="mt-5 max-w-[34rem] text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
              Meet people who have already completed their skin analysis and
              shared what they want treated. Review the brief, manage every
              clinic in one diary, and keep your consultation fee.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href={cta.href}
                className="group inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-brand-600 to-teal-600 px-7 py-3.5 text-sm font-extrabold text-white shadow-[0_14px_34px_-10px_rgba(31,111,214,0.85)] transition hover:on-dark from-brand-700 hover:to-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 sm:w-auto"
              >
                {cta.label}
                <ArrowRight
                  aria-hidden
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                />
              </Link>

              {viewer === "guest" && (
                <Link
                  href="/login?role=doctor&callbackUrl=/doctor/portal"
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 hover:ring-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:w-auto"
                >
                  <LogIn aria-hidden className="h-4 w-4" />
                  Doctor sign in
                </Link>
              )}
            </div>

            {viewer === "client" && (
              <p className="mt-4 max-w-[34rem] rounded-xl bg-white/80 px-4 py-3 text-sm text-slate-600 ring-1 ring-slate-200">
                You are signed in as a client. Doctor accounts are separate, so
                you will be asked to register as a doctor, and you can use the
                same email address.
              </p>
            )}

            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-600 sm:text-sm">
              <Proof>Free to list</Proof>
              <Proof>No consultation commission</Proof>
              <Proof>Verified profiles</Proof>
            </div>

            {doctorCount > 0 && (
              <dl className="mt-8 flex flex-wrap gap-x-6 gap-y-3 border-t border-slate-200 pt-5 sm:gap-x-9">
                <Stat
                  value={String(doctorCount)}
                  label={doctorCount === 1 ? "doctor listed" : "doctors listed"}
                />
                {clinicCount > 0 && (
                  <Stat
                    value={String(clinicCount)}
                    label={clinicCount === 1 ? "location" : "locations"}
                  />
                )}
                <Stat value="0%" label="commission on your fee" />
              </dl>
            )}
          </div>

          {/* ── The photograph, at full strength ────────────────────── */}
          <div className="relative">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] shadow-[0_40px_80px_-30px_rgba(15,23,42,0.45)] ring-1 ring-white/60 sm:aspect-[5/4] lg:aspect-[4/3]">
              <SmartImage
                src={DOCTOR_IMG.heroConsultation}
                alt="A dermatologist talking a client through their treatment plan"
                mode="fill"
                className="object-cover object-center"
                priority
                sizes="(min-width: 1024px) 52vw, 100vw"
              />
              {/* A short feather on the left edge only, so the picture meets
                  the pale ground instead of ending on a hard line. Nothing
                  across the subject: that is what was destroying it before. */}
              <div
                aria-hidden
                className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white/60 to-transparent"
              />
            </div>

            {/* One card, not two. On a light ground a white card reads as part
                of the page rather than as glass floating over a photograph,
                and one piece of proof placed well beats two competing.

                It STACKS below `sm` rather than hiding. The first version was
                `hidden sm:block`, which put the single most persuasive thing
                on the page out of reach on the devices most people read it
                on. Overlapping the photograph is a desktop luxury; the
                content is not. */}
            <figure className="relative mt-4 w-full rounded-2xl bg-white/95 p-4 shadow-[0_24px_50px_-18px_rgba(15,23,42,0.4)] ring-1 ring-slate-200/80 backdrop-blur sm:absolute sm:-bottom-5 sm:left-4 sm:mt-0 sm:w-[17rem]">
              <figcaption className="sr-only">
                An example of the brief attached to a booking
              </figcaption>
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-teal-500 text-xs font-bold text-white">
                  MP
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900">Meghna P.</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Thu 10:30 · first visit
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-display text-lg font-bold leading-none text-teal-600">
                    68
                  </p>
                  <p className="mt-0.5 text-[9px] uppercase tracking-wider text-slate-400">
                    skin score
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Chip>Acne</Chip>
                <Chip>6–12 months</Chip>
                <Chip>Severity 4/5</Chip>
              </div>
              <p className="mt-2.5 text-[10px] text-slate-400">
                The brief that arrives with a booking. Example, not a patient.
              </p>
            </figure>
          </div>
        </div>
      </div>
    </section>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-700 ring-1 ring-teal-200">
      {children}
    </span>
  );
}

function Proof({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Check aria-hidden className="h-4 w-4 text-teal-600" />
      {children}
    </span>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dt className="font-display text-3xl font-bold tracking-[-0.02em] text-slate-900 tabular-nums">
        {value}
      </dt>
      <dd className="mt-0.5 text-xs text-slate-500">{label}</dd>
    </div>
  );
}
