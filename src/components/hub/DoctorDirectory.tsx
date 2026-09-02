"use client";

import { useRouter } from "next/navigation";

import { useMemo, useState } from "react";
import {
  Building2,
  CalendarDays,
  Languages,
  MapPin,
  ShieldCheck,
  Star,
  Video,
  Zap,
} from "lucide-react";

import {
  type Doctor,
} from "@/data/doctors";
import { useBackToClose } from "@/hooks/useBackToClose";
import { experienceLabel, feeLabel, ratingLabel } from "@/lib/doctorDisplay";
import {
  useDoctorAvailability,
  type DoctorAvailability,
} from "@/hooks/useDoctorAvailability";

/**
 * The doctor discovery block (C-25 … C-30): who is available, what they
 * charge, the slots they usually have free, and the booking + payment step.
 * Client before/after work sits in its own section on the page above this
 * one, so the card stays about the doctor.
 *
 * The directory arrives as a prop from the server page — real records from
 * the Doctor table, mapped to this shape in lib/queries/doctors.
 */
export default function DoctorDirectory({ doctors }: { doctors: Doctor[] }) {
  const router = useRouter();
  const [city, setCity] = useState("All cities");
  const [scope, setScope] = useState<"domestic" | "international">("domestic");
  // One batched request for the whole grid rather than one per card. Doctor.id
  // is the public slug here (see toDTO in lib/queries/doctors).
  const { availability, loaded: availabilityLoaded } = useDoctorAvailability(
    doctors.map((d) => d.id)
  );

  /* ── Two questions, asked in order ─────────────────────────────────────
     One flat row of city chips put Chennai, Kanchipuram and Mumbai beside
     each other with no way to say "anywhere abroad" — and no way to grow,
     because the moment a clinic opens overseas its CITY appears in the same
     row as an Indian one and means something different.

     So the first choice is where in the world, and the second narrows it:
     Domestic lists Indian cities, International lists countries. A country is
     the right grain abroad — somebody looking for a clinic in Dubai is
     choosing a country first, and the city list for one overseas clinic is
     noise. */
  const HOME_COUNTRY = "India";

  const domestic = useMemo(
    () => doctors.filter((d) => (d.country ?? HOME_COUNTRY) === HOME_COUNTRY),
    [doctors]
  );
  const international = useMemo(
    () => doctors.filter((d) => (d.country ?? HOME_COUNTRY) !== HOME_COUNTRY),
    [doctors]
  );

  const inScope = scope === "domestic" ? domestic : international;

  // Cities at home, countries abroad. Sorted, so the row does not reshuffle
  // when a practitioner is added.
  const options = useMemo(() => {
    const raw =
      scope === "domestic"
        ? inScope.map((d) => d.location)
        : inScope.map((d) => d.country ?? "");
    return [
      scope === "domestic" ? "All cities" : "All countries",
      ...Array.from(new Set(raw.filter(Boolean))).sort((a, b) =>
        a.localeCompare(b)
      ),
    ];
  }, [inScope, scope]);

  const list = useMemo(
    () =>
      city === "All cities" || city === "All countries"
        ? inScope
        : inScope.filter((d) =>
            scope === "domestic" ? d.location === city : d.country === city
          ),
    [city, inScope, scope]
  );

  return (
    <div>
      {/* Where in the world. Two options, always both shown: hiding
          International when nothing is listed there answers the question by
          omission, and somebody wondering whether we cover Dubai deserves to
          be told rather than left to guess. */}
      <div className="mb-3 inline-flex rounded-full bg-white/[0.04] p-1 ring-1 ring-white/10">
        {(["domestic", "international"] as const).map((s) => (
          <button
            key={s}
            onClick={() => {
              setScope(s);
              setCity(s === "domestic" ? "All cities" : "All countries");
            }}
            aria-pressed={scope === s}
            className={`rounded-full px-5 py-2 text-sm font-bold capitalize transition ${
              scope === s
                ? "bg-white text-[var(--on-sheet)]"
                : "text-ink-soft hover:text-brand-200"
            }`}
          >
            {s}
            <span className="ml-1.5 text-xs font-semibold opacity-60">
              {s === "domestic" ? domestic.length : international.length}
            </span>
          </button>
        ))}
      </div>

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {options.map((c) => (
          <button
            key={c}
            onClick={() => setCity(c)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
              city === c
                ? "bg-white text-[var(--on-sheet)]"
                : "bg-white/[0.04] text-ink-soft ring-1 ring-white/10 hover:text-brand-200"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {list.length === 0 && (
        <p className="rounded-2xl bg-white/[0.04] px-5 py-8 text-center text-sm text-ink-muted ring-1 ring-white/10">
          {scope === "international"
            ? "No clinics outside India are listed yet."
            : "No clinics listed here yet."}
        </p>
      )}

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((d) => (
          <DirectoryCard
            key={d.id}
            doctor={d}
            onBook={() => router.push(`/patient/book/${d.id}`)}
            onInstant={() => router.push(`/patient/book/${d.id}?step=when`)}
            availability={availability[d.id]}
            availabilityLoaded={availabilityLoaded}
          />
        ))}
      </ul>

      {/* The booking dialog was removed on 19 Aug 2026. Booking is a page now,
          at /patient/book/[slug] — one question per screen, the step in the
          URL, and a Back button that works without intercepting history.
          Keeping a second implementation here is what let the clinic picker
          regress unnoticed once already. */}
    </div>
  );
}

function DirectoryCard({
  doctor,
  onBook,
  onInstant,
  availability,
  availabilityLoaded,
}: {
  doctor: Doctor;
  onBook: () => void;
  onInstant: () => void;
  /** Real next-free times. null = nothing free in the next week. */
  availability: DoctorAvailability | null | undefined;
  availabilityLoaded: boolean;
}) {
  const rated = ratingLabel(Number(doctor.rating), doctor.reviews);
  const experience = experienceLabel(doctor.experienceYears);
  const fee = feeLabel(doctor.fee);

  return (
    <li className="flex flex-col rounded-3xl bg-white/[0.04] ring-1 ring-white/10 p-5">
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={doctor.image}
          alt={doctor.name}
          className="h-16 w-16 shrink-0 rounded-2xl object-cover ring-1 ring-white/10"
          loading="lazy"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-[15px] font-bold text-ink">
              {doctor.name}
            </p>
            {doctor.verified && (
              <ShieldCheck className="h-4 w-4 shrink-0 text-teal-300" />
            )}
          </div>
          <p className="truncate text-xs text-ink-muted">{doctor.title}</p>
          <p className="mt-1 text-xs font-semibold text-brand-200">
            {doctor.specialty}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
        {rated ? (
          <>
            <span className="inline-flex items-center gap-1 font-semibold text-ink">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              {rated.value}
            </span>
            <span>{rated.reviews}</span>
          </>
        ) : (
          <span className="rounded-full bg-white/10 px-2 py-0.5 font-semibold text-teal-200">
            Newly listed
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3 w-3" /> {doctor.location}
        </span>
        {experience && <span>{experience}</span>}
      </div>

      <p className="mt-3 text-xs leading-relaxed text-ink-muted">{doctor.about}</p>

      {/* Areas of speciality lead, because "known for acne scarring" is what
          a person choosing a dermatologist is actually reading for, and it
          says more than three procedure names. The services fill in behind
          them for a practitioner who has not named any. */}
      {(doctor.specialtyAreas?.length ?? 0) > 0 && (
        <div className="mt-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-teal-300/80">
            Known for
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {doctor.specialtyAreas!.slice(0, 3).map((a: string) => (
              <span
                key={a}
                className="rounded-full bg-teal-400/15 px-2.5 py-1 text-[11px] font-semibold text-teal-100 ring-1 ring-inset ring-teal-300/25"
              >
                {a}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {doctor.services
          .slice(0, (doctor.specialtyAreas?.length ?? 0) > 0 ? 2 : 3)
          .map((s) => (
          <span
            key={s}
            className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-ink-soft"
          >
            {s}
          </span>
        ))}
      </div>

      {doctor.languages.length > 0 && (
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-ink-muted">
          <Languages className="h-3 w-3" /> {doctor.languages.join(", ")}
        </p>
      )}

      {/*
        What a previous patient actually said.

        The star rating was already here and the words were not — they were on
        a site-wide testimonials strip where they could not be attached to the
        doctor they were about, which is the one place they are worth reading.
        A person choosing between two practitioners is choosing on what
        somebody said, not on a number to one decimal place.

        Nothing renders when there is nothing published. There is deliberately
        no fallback: this codebase has already deleted one set of invented
        testimonials, and a card that quietly borrows somebody else's review
        would be the same mistake wearing a different hat.
      */}
      {(doctor.reviewList?.length ?? 0) > 0 && (
        <figure className="mt-3 rounded-xl bg-white/[0.05] p-3 ring-1 ring-inset ring-white/10">
          <blockquote className="text-[12px] leading-relaxed text-ink-soft">
            &ldquo;{doctor.reviewList![0].body}&rdquo;
          </blockquote>
          <figcaption className="mt-1.5 flex items-center gap-1.5 text-[11px] text-ink-muted">
            <span aria-hidden className="text-amber-400">
              {"★".repeat(doctor.reviewList![0].rating)}
            </span>
            <span className="sr-only">
              {doctor.reviewList![0].rating} out of 5
            </span>
            {doctor.reviewList![0].author}
            {(doctor.reviewList?.length ?? 0) > 1 && (
              <span className="text-ink-muted/70">
                · {doctor.reviewList!.length - 1} more
              </span>
            )}
          </figcaption>
        </figure>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-medium text-ink-muted">
        <span className="inline-flex items-center gap-1">
          <Building2 className="h-3 w-3" /> Clinic
        </span>
        {doctor.modes.includes("video") && (
          <span className="inline-flex items-center gap-1">
            <Video className="h-3 w-3" /> Video
          </span>
        )}
      </div>

      {/* Usual available slots (C-29) — from the doctor's real calendar.
          Three honest states: still checking, genuinely nothing free this
          week, or actual times. Never a guess. */}
      <div className="mt-4 rounded-2xl bg-white/[0.04] p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
          {availability
            ? `Free ${availability.dayLabel.toLowerCase()}`
            : "Availability"}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {!availabilityLoaded ? (
            <span className="text-xs text-ink-muted">Checking…</span>
          ) : availability && availability.times.length > 0 ? (
            availability.times.map((t) => (
              <button
                key={`${t.clinicId ?? ""}-${t.label}`}
                onClick={onBook}
                title={t.clinicName ?? undefined}
                className="rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-xs font-semibold text-brand-200 ring-1 ring-brand-300/40 transition hover:bg-brand-400/[12%]"
              >
                {t.label}
              </button>
            ))
          ) : (
            <span className="text-xs text-ink-muted">
              No open times this week, ask for another date.
            </span>
          )}
        </div>
      </div>

      {/* Consultation fee (C-27, permitted by G-3) */}
      <div className="mt-4 flex items-baseline justify-between border-t border-white/10 pt-3">
        <div>
          <span className="display-sm text-xl text-ink">{fee.amount}</span>
          <span className="ml-1 text-xs text-ink-muted">{fee.note}</span>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <button onClick={onBook} className="btn-primary flex-1 !px-3 !py-2 text-sm">
          <CalendarDays className="h-4 w-4" /> Book
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
