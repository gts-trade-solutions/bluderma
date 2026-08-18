"use client";

import { useRouter } from "next/navigation";

import { useMemo, useState } from "react";
import {
  Building2,
  CalendarDays,
  MapPin,
  ShieldCheck,
  Star,
  Video,
} from "lucide-react";

import {
  type Doctor,
} from "@/data/doctors";
import { useDoctors } from "@/hooks/useDoctors";
import {
  useDoctorAvailability,
  type DoctorAvailability,
} from "@/hooks/useDoctorAvailability";
import { useClientLocation } from "@/hooks/useClientLocation";
import LocationButton from "@/components/hub/LocationButton";
import { experienceLabel, feeLabel, ratingLabel } from "@/lib/doctorDisplay";

/**
 * The last step of the DIY diagnosis: the appointment.
 *
 * Split by where the client actually is. Doctors in their city are offered
 * in person; doctors anywhere else are offered by video and labelled as such,
 * rather than being hidden — the specialist who has seen your condition a
 * thousand times is often not the nearest one, and pretending the list is
 * empty because nobody local matches serves nobody.
 *
 * The city comes from the location control in the navbar, which stores the
 * client's own choice on their device. With no city set, every doctor is
 * shown and the control is offered inline.
 */
export default function ConsultationStep() {
  const router = useRouter();
  const { location, ready } = useClientLocation();
  // Real directory records, shared-fetched once per page.
  const { doctors: ALL_DOCTORS } = useDoctors();
  // Real next-free times for every doctor on this screen, in one request.
  const { availability } = useDoctorAvailability(ALL_DOCTORS.map((d) => d.id));

  const city = location?.label?.trim() ?? "";

  const { local, remote } = useMemo(() => {
    if (!city) return { local: [] as Doctor[], remote: [] as Doctor[] };
    const needle = city.toLowerCase();
    const isLocal = (d: Doctor) =>
      d.location.toLowerCase().includes(needle) ||
      needle.includes(d.location.toLowerCase());
    return {
      local: ALL_DOCTORS.filter(isLocal),
      // Only doctors who actually take video can be offered from a distance.
      remote: ALL_DOCTORS.filter((d) => !isLocal(d) && d.modes.includes("video")),
    };
  }, [city, ALL_DOCTORS]);

  return (
    <div>
      {/* Where are you? */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white/[0.04] ring-1 ring-white/10 px-5 py-4">
        <p className="flex items-center gap-2 text-sm text-ink-soft">
          <MapPin className="h-4 w-4 shrink-0 text-brand-300" />
          {!ready ? (
            "Finding your area…"
          ) : city ? (
            <>
              Showing doctors for{" "}
              <span className="font-bold text-ink">{city}</span>
            </>
          ) : (
            "Set your city and we'll show who can see you in person."
          )}
        </p>
        <LocationButton />
      </div>

      {!city ? (
        <>
          <Group
            title="All our doctors"
            sub="Set your city above to see who can see you in person, and who would be a video consultation."
          >
            {ALL_DOCTORS.map((d) => (
              <DoctorCard
                key={d.id}
                doctor={d}
                mode="unknown"
                onBook={() => router.push(`/patient/book/${d.id}`)}
                availability={availability[d.id]}
              />
            ))}
          </Group>
        </>
      ) : (
        <div className="space-y-8">
          {local.length > 0 ? (
            <Group
              title={`In ${city}`}
              sub="You can be seen in person. Video is available with these doctors too."
            >
              {local.map((d) => (
                <DoctorCard
                  key={d.id}
                  doctor={d}
                  mode="clinic"
                  onBook={() => router.push(`/patient/book/${d.id}`)}
                availability={availability[d.id]}
                />
              ))}
            </Group>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/20 bg-white/[0.04] px-5 py-6 text-center">
              <p className="text-sm font-semibold text-ink">
                No doctor of ours holds a clinic in {city} yet.
              </p>
              <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">
                Everyone below consults by video, so you can still be seen —
                usually the same week.
              </p>
            </div>
          )}

          {remote.length > 0 && (
            <Group
              title="Available by video"
              sub={`Outside ${city}, so these are video consultations. Anything needing an examination is moved to a clinic visit.`}
            >
              {remote.map((d) => (
                <DoctorCard
                  key={d.id}
                  doctor={d}
                  mode="video"
                  onBook={() => router.push(`/patient/book/${d.id}?mode=video`)}
                availability={availability[d.id]}
                />
              ))}
            </Group>
          )}
        </div>
      )}

      {/* The booking dialog was removed on 19 Aug 2026. Booking is a page now,
          at /patient/book/[slug] — one question per screen, the step in the
          URL, and a Back button that works without intercepting history.
          Keeping a second implementation here is what let the clinic picker
          regress unnoticed once already. */}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── */

function Group({
  title,
  sub,
  children,
}: {
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="display-sm text-lg text-ink">{title}</h3>
      <p className="mt-1 max-w-2xl text-sm text-ink-muted">{sub}</p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </ul>
    </div>
  );
}

function DoctorCard({
  doctor,
  mode,
  onBook,
  availability,
}: {
  doctor: Doctor;
  mode: "clinic" | "video" | "unknown";
  onBook: () => void;
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
          className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-white/10"
          loading="lazy"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-bold text-ink">{doctor.name}</p>
            {doctor.verified && (
              <ShieldCheck className="h-4 w-4 shrink-0 text-teal-300" />
            )}
          </div>
          <p className="truncate text-xs text-ink-muted">{doctor.specialty}</p>
          <p className="mt-1 inline-flex items-center gap-1 text-xs text-ink-muted">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            <span className="font-semibold text-ink">
              {rated ? rated.value : "New"}
            </span>
            {experience && <span>· {experience}</span>}
          </p>
        </div>
      </div>

      {mode === "video" ? (
        <span className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-brand-400/[12%] px-2.5 py-1 text-[11px] font-semibold text-brand-200">
          <Video className="h-3 w-3" /> Video · {doctor.location}
        </span>
      ) : (
        <span className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-teal-400/[12%] px-2.5 py-1 text-[11px] font-semibold text-teal-200">
          <Building2 className="h-3 w-3" /> In clinic · {doctor.location}
        </span>
      )}

      <div className="mt-3 flex items-baseline justify-between border-t border-white/10 pt-3">
        <span>
          <span className="display-sm text-base text-ink">{fee.amount}</span>
          <span className="ml-1 text-[11px] text-ink-muted">consultation</span>
        </span>
        {soonest && availability && (
          <span
            className="text-[11px] font-semibold text-teal-200"
            title={soonest.clinicName ?? undefined}
          >
            Free {availability.dayLabel.toLowerCase()} {soonest.label}
          </span>
        )}
      </div>

      <button onClick={onBook} className="btn-primary mt-3 w-full !py-2 text-sm">
        <CalendarDays className="h-4 w-4" /> Book
      </button>
    </li>
  );
}
