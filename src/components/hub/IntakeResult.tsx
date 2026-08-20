"use client";

import { useRouter } from "next/navigation";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  House,
  MapPin,
  Plane,
  ShieldCheck,
  Star,
  Video,
  Zap,
} from "lucide-react";

import {
  matchStrength,
  suggestDoctors,
  type ConsultMode,
  type Doctor,
} from "@/data/doctors";
import type { MetricKey } from "@/data/skin";
import { useDoctors } from "@/hooks/useDoctors";
import { experienceLabel, feeLabel, ratingLabel } from "@/lib/doctorDisplay";
import {
  useDoctorAvailability,
  type DoctorAvailability,
} from "@/hooks/useDoctorAvailability";
import type { Answers, SkinReport } from "./IntakeFlow";

/** Concern wording the client sees → the signal the doctor data is keyed on. */
/** What /api/clinics returns. Deliberately has no `distanceKm` — see the
 *  note in that route about not printing a figure we cannot compute. */
interface RealClinic {
  id: string;
  slug: string;
  name: string;
  address: string;
  area: string;
  city: string;
  pincode: string;
  phone: string | null;
  image: string | null;
  facilities: string[];
  doctorCount: number;
  homeVisit: boolean;
}

const CONCERN_TO_METRIC: Record<string, MetricKey> = {
  "clear-acne": "acne",
  "clogged-pores": "pores",
  "dark-spots": "ageSpots",
  oiliness: "oiliness",
  redness: "redness",
  wrinkles: "wrinkles",
  texture: "texture",
  firmness: "firmness",
  "dark-circles": "darkCircles",
  melasma: "ageSpots",
  "body-acne": "acne",
  "bumpy-skin": "texture",
  "body-spots": "ageSpots",
  "unwanted-hair": "texture",
};

/** Goal id → the label the summary chips show. */
const GOAL_LABEL: Record<string, string> = {
  "clear-acne": "Clear acne",
  "clogged-pores": "Clogged pores",
  "dark-spots": "Dark spots",
  oiliness: "Oiliness",
  redness: "Redness",
  wrinkles: "Fine lines",
  texture: "Texture",
  firmness: "Firmness",
  "dark-circles": "Dark circles",
  melasma: "Melasma",
  "body-acne": "Body acne",
  "bumpy-skin": "Bumpy skin",
  "body-spots": "Body dark spots",
  "unwanted-hair": "Unwanted hair",
};

/**
 * What the client sees once the questionnaire is done (C-37 … C-38): the
 * doctors we'd put them with, then the four ways to proceed — pick a slot,
 * take an instant appointment, book a procedure (which routes to Hot Deals),
 * or have someone come to them.
 *
 * The doctor list, slots and fees all come from the static catalogue in
 * `@/data/doctors`, so this whole screen runs without a backend.
 */
export default function IntakeResult({
  answers,
  report,
  onEdit,
  onRestart,
}: {
  answers: Answers;
  report: SkinReport;
  onEdit: () => void;
  onRestart: () => void;
}) {
  const router = useRouter();
  const name = ((answers.name as string) ?? "").split(" ")[0];
  const city = (answers.city as string) ?? "";
  // Real directory records, shared-fetched once per page.
  const { doctors: allDoctors } = useDoctors();
  const goals = useMemo(
    () => (answers.goals as string[]) ?? [],
    [answers.goals]
  );
  const preferredMode: ConsultMode | "home" = "clinic";

  // Concerns first, then whatever the attached analysis flagged — so a scan
  // that contradicts the self-report still gets a doctor who covers it.
  const topConcerns = useMemo<MetricKey[]>(() => {
    const fromForm = goals
      .map((g) => CONCERN_TO_METRIC[g])
      .filter(Boolean) as MetricKey[];
    // Only concerns the analyzer mapped to a known key feed the match. An
    // unrecognised finding is still shown to the client, but guessing which
    // bucket it belongs in would put them in front of the wrong doctor.
    const fromScan =
      report.kind === "analysis"
        ? (report.result.concerns
            .map((c) => c.key)
            .filter(Boolean) as MetricKey[])
        : [];
    return Array.from(new Set([...fromForm, ...fromScan])).slice(0, 4);
  }, [goals, report]);

  const matched = useMemo(
    () => suggestDoctors(allDoctors, topConcerns, 4),
    [allDoctors, topConcerns]
  );

  // Real next-free times for the matched doctors, in one request.
  const { availability } = useDoctorAvailability(matched.map((d) => d.id));

  // Real clinics from the database, narrowed to their city. The old
  // clinicsNear() returned six invented addresses with invented distances and
  // fell back to Chennai for any unmatched city — a client could have set out
  // for a building that does not exist.
  const [clinics, setClinics] = useState<RealClinic[]>([]);
  const [clinicsLoaded, setClinicsLoaded] = useState(false);
  useEffect(() => {
    let live = true;
    fetch(`/api/clinics${city ? `?city=${encodeURIComponent(city)}` : ""}`)
      .then((r) => r.json())
      .then((d) => {
        if (!live || !d?.ok) return;
        setClinics(d.clinics ?? []);
        setClinicsLoaded(true);
      })
      .catch(() => live && setClinicsLoaded(true));
    return () => {
      live = false;
    };
  }, [city]);

  // The inline booking panel was removed on 19 Aug 2026. Booking is a page
  // now, at /patient/book/[slug] — the result screen links there rather than
  // swapping itself out for a second booking implementation.
  return (
    <div>
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="border-b border-white/10 bg-gradient-to-r from-brand-500/15 to-teal-500/15 px-5 py-6 sm:px-7">
        <p className="section-eyebrow">Your answers are in</p>
        <h2 className="display-sm mt-1 text-xl text-ink sm:text-2xl">
          {name ? `${name}, here's who we'd put you with` : "Here's who we'd put you with"}
        </h2>
        <p className="mt-1.5 max-w-xl text-sm text-ink-muted">
          Matched on what you told us
          {report.kind === "analysis" && " and on your skin analysis"}. Fees
          below are for the consultation. Treatment costs are quoted only after
          an assessment.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {goals.slice(0, 3).map((g) => (
            <span key={g} className="chip">
              {GOAL_LABEL[g] ?? g}
            </span>
          ))}
          {city && (
            <span className="chip">
              <MapPin className="h-3 w-3" /> {city}
            </span>
          )}
          <button
            onClick={onEdit}
            className="ml-auto text-xs font-semibold text-brand-200 hover:underline"
          >
            Edit my answers
          </button>
        </div>
      </div>

      <div className="space-y-9 px-5 py-7 sm:px-7">
        {/* ── Doctors (C-26, C-27, C-29) ─────────────────────────────── */}
        <section>
          <SubHead
            title="Interested doctors"
            sub="Available for your concerns, in or near your city."
          />
          <ul className="grid gap-3 sm:grid-cols-2">
            {matched.map((d) => (
              <DoctorCard
                key={d.id}
                doctor={d}
                strength={matchStrength(d, topConcerns)}
                onBook={() => router.push(`/patient/book/${d.id}`)}
                onInstant={() => router.push(`/patient/book/${d.id}?step=when`)}
                availability={availability[d.id]}
              />
            ))}
          </ul>
        </section>

        {/* ── Book a procedure instead (C-37c) ───────────────────────── */}
        <section>
          <SubHead
            title="Or book a procedure directly"
            sub="Already know what you want done? Go straight to what's running."
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <RouteCard
              icon={Building2}
              title="In-clinic, in India"
              body="Pick from the packages running this fortnight at a clinic near you."
              cta="See hot deals"
              href="/patient/explore#deals"
            />
            <RouteCard
              icon={Plane}
              title="International package"
              body="Procedure, stay and airport transfer arranged as one booking."
              cta="See hot deals"
              href="/patient/explore#deals"
            />
          </div>
        </section>

        {/* ── Nearby clinics + home visit (C-38) ─────────────────────── */}
        {clinicsLoaded && clinics.length > 0 && (
        <section>
          <SubHead
            title={city ? `Clinics in ${city}` : "Clinics you can walk into"}
            sub="Where our practitioners consult."
          />
          <ul className="grid gap-3 sm:grid-cols-3">
            {clinics.map((c) => (
              <li
                key={c.slug}
                className="overflow-hidden rounded-2xl bg-white/[0.04] ring-1 ring-white/10"
              >
                {/* Distance and opening hours are deliberately absent: no
                    address is geocoded yet, and a figure we cannot compute
                    must not be printed. Area and city are what people
                    actually navigate by. */}
                {c.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.image}
                    alt=""
                    className="h-24 w-full object-cover"
                    loading="lazy"
                  />
                )}
                <div className="p-3.5">
                  <p className="text-sm font-bold text-ink">{c.name}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {c.address}, {c.area}, {c.city} {c.pincode}
                  </p>
                  {c.doctorCount > 0 && (
                    <p className="mt-2 text-xs text-ink-muted">
                      {c.doctorCount}{" "}
                      {c.doctorCount === 1 ? "practitioner" : "practitioners"}
                      {c.facilities.length > 0
                        ? ` · ${c.facilities.slice(0, 2).join(", ")}`
                        : ""}
                    </p>
                  )}
                  {c.homeVisit && (
                    <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-teal-400/[12%] px-2.5 py-1 text-[11px] font-semibold text-teal-200">
                      <House className="h-3 w-3" /> Home visit available
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex flex-col items-start justify-between gap-3 rounded-2xl border border-teal-300/30 bg-teal-400/[12%] p-4 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] text-teal-300 ring-1 ring-teal-300/25">
                <House className="h-5 w-5" strokeWidth={1.7} />
              </span>
              <div>
                <p className="text-sm font-bold text-ink">
                  Prefer we come to you?
                </p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  A doctor and assistant at your address, for assessments and
                  selected treatments.
                </p>
              </div>
            </div>
            <button
              onClick={() =>
                matched[0] &&
                router.push(`/patient/book/${matched[0].id}?mode=home`)
              }
              className="btn-teal shrink-0 !py-2.5 text-sm"
            >
              Request a home visit
            </button>
          </div>
        </section>
        )}

        <p className="rounded-xl bg-white/[0.04] px-4 py-3 text-xs leading-relaxed text-ink-muted">
          Nothing here is a diagnosis. Which treatment suits you, how many
          sessions it takes and what it costs are settled with the doctor after
          an assessment.
        </p>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── */

function SubHead({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-3">
      <h3 className="display-sm text-base text-ink sm:text-lg">{title}</h3>
      <p className="mt-0.5 text-sm text-ink-muted">{sub}</p>
    </div>
  );
}

function DoctorCard({
  doctor,
  strength,
  onBook,
  onInstant,
  availability,
}: {
  doctor: Doctor;
  strength: number;
  onBook: () => void;
  onInstant: () => void;
  /** Real next-free time. null = nothing open in the next week. */
  availability: DoctorAvailability | null | undefined;
}) {
  const rated = ratingLabel(Number(doctor.rating), doctor.reviews);
  const experience = experienceLabel(doctor.experienceYears);
  const fee = feeLabel(doctor.fee);
  const soonest = availability?.times[0] ?? null;

  return (
    <li className="flex flex-col rounded-2xl bg-white/[0.04] ring-1 ring-white/10 p-4">
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={doctor.image}
          alt={doctor.name}
          className="h-14 w-14 shrink-0 rounded-full object-cover ring-1 ring-white/10"
          loading="lazy"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-bold text-ink">{doctor.name}</p>
            {doctor.verified && (
              <ShieldCheck className="h-4 w-4 shrink-0 text-teal-300" />
            )}
          </div>
          <p className="truncate text-xs text-ink-muted">{doctor.title}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-muted">
            <span className="inline-flex items-center gap-1 font-semibold text-ink">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              {rated ? rated.value : "New"}
            </span>
            {/* Via doctorDisplay: a doctor with no reviews yet must read
                "New", not "0 reviews · 0 yrs" — that is a false claim about a
                real practitioner. */}
            {rated && <span>{rated.reviews} reviews</span>}
            {rated && experience && <span>·</span>}
            {experience && <span>{experience}</span>}
          </p>
        </div>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-ink-muted">
        {doctor.about}
      </p>

      {strength > 0 && (
        <p className="mt-2 inline-flex w-fit items-center gap-1 rounded-full bg-brand-400/[12%] px-2.5 py-1 text-[11px] font-semibold text-brand-200">
          <Check className="h-3 w-3" /> Covers {strength} of your concerns
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-medium text-ink-muted">
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3 w-3" /> {doctor.location}
        </span>
        {doctor.modes.includes("video") && (
          <span className="inline-flex items-center gap-1">
            <Video className="h-3 w-3" /> Video
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <Building2 className="h-3 w-3" /> Clinic
        </span>
      </div>

      <div className="mt-3 flex items-baseline justify-between border-t border-white/10 pt-3">
        <div>
          <span className="display-sm text-lg text-ink">{fee.amount}</span>
          <span className="ml-1 text-xs text-ink-muted">consultation</span>
        </div>
        {soonest && availability && (
          <span
            className="text-[11px] font-semibold text-teal-200"
            title={soonest.clinicName ?? undefined}
          >
            Next free {availability.dayLabel.toLowerCase()} {soonest.label}
          </span>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <button onClick={onBook} className="btn-primary flex-1 !px-3 !py-2 text-sm">
          <CalendarDays className="h-4 w-4" /> Date &amp; time
        </button>
        <button
          onClick={onInstant}
          className="inline-flex items-center gap-1.5 rounded-full border border-teal-300/30 bg-teal-400/[12%] px-3 py-2 text-sm font-semibold text-teal-200 transition hover:bg-teal-400/20"
        >
          <Zap className="h-4 w-4" /> Instant
        </button>
      </div>
    </li>
  );
}

function RouteCard({
  icon: Icon,
  title,
  body,
  cta,
  href,
}: {
  icon: typeof Building2;
  title: string;
  body: string;
  cta: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-2xl bg-white/[0.04] ring-1 ring-white/10 p-4 transition hover:border-brand-300/50 hover:shadow-soft"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400/15 to-teal-400/15 text-brand-300 ring-1 ring-inset ring-brand-300/40">
        <Icon className="h-5 w-5" strokeWidth={1.7} />
      </span>
      <div>
        <p className="text-sm font-bold text-ink">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{body}</p>
        <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-200">
          {cta}
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

