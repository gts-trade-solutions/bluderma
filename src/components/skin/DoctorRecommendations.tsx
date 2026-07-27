"use client";

import { useState } from "react";
import { CalendarDays } from "@/components/icons";
import BookingModal from "@/components/skin/BookingModal";
import type { DoctorDTO } from "@/lib/queries/types";

export type RecommendedDoctor = {
  slug: string;
  name: string;
  title: string | null;
  specialty: string | null;
  clinic: string | null;
  location: string | null;
  image: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
};

function initials(name: string): string {
  const parts = name.replace(/^(dr\.?|clinic)\s+/i, "").trim().split(/\s+/);
  return (
    (parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")
  ).toUpperCase();
}

/** Whether an image URL is a real photo (imported clinics have no DP). */
function hasPhoto(url: string | null): url is string {
  return !!url && /^https?:\/\//.test(url) && !url.includes("/brand/");
}

/** Build the DoctorDTO the booking modal expects from the lean recommendation row. */
function toDoctorDTO(d: RecommendedDoctor): DoctorDTO {
  return {
    id: d.slug,
    name: d.name,
    title: d.title ?? "",
    specialty: d.specialty ?? d.title ?? "Dermatology & Aesthetics",
    focus: [],
    rating: 0,
    reviews: 0,
    experienceYears: 0,
    clinic: d.clinic ?? d.name,
    location: d.location ?? "",
    image: d.image ?? "/brand/clinic-avatar.svg",
    fee: 0,
    languages: [],
    services: [],
    modes: ["clinic"],
    about: "",
    verified: false,
  };
}

/**
 * Lists clinics a client can book after a scan. Not concern-matched — every
 * active clinic is shown. `mode="book"` (default) opens the slot-by-timing
 * booking modal; `mode="list"` renders a static, print-friendly list (used in
 * the downloadable report). Falls back to an initials avatar for contacts
 * imported without a photo.
 */
export default function DoctorRecommendations({
  doctors,
  mode = "book",
}: {
  doctors: RecommendedDoctor[];
  mode?: "book" | "list";
}) {
  const [bookingDoctor, setBookingDoctor] = useState<DoctorDTO | null>(null);

  if (doctors.length === 0) return null;
  const bookable = mode === "book";

  return (
    <div>
      <h2 className="mb-1 text-lg font-bold text-ink">
        Talk to a BluDerma clinic
      </h2>
      <p className="mb-4 text-sm text-ink-muted">
        {bookable
          ? "Book a consultation to discuss these results and tailored treatment options."
          : "Reach out to a clinic to discuss these results and tailored treatment options."}
      </p>
      {/* Mobile: horizontal slider (less scroll). Desktop: 2-col grid. */}
      <ul className="flex snap-x gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0">
        {doctors.map((d) => (
          <li
            key={d.slug}
            className="flex w-[82%] shrink-0 snap-start flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:w-auto"
          >
            <div className="flex items-center gap-3">
              {hasPhoto(d.image) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={d.image}
                  alt={d.name}
                  className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-slate-200"
                />
              ) : (
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-700 ring-1 ring-brand-100">
                  {initials(d.name) || "BD"}
                </span>
              )}
              <div className="min-w-0">
                <div className="truncate font-semibold text-ink">{d.name}</div>
                <div className="truncate text-xs text-ink-muted">
                  {[d.specialty || d.title, d.location].filter(Boolean).join(" · ")}
                </div>
              </div>
            </div>
            {bookable && (
              <button
                onClick={() => setBookingDoctor(toDoctorDTO(d))}
                className="btn-primary mt-auto w-full !py-2 text-sm"
              >
                <CalendarDays className="h-4 w-4" /> Book appointment
              </button>
            )}
          </li>
        ))}
      </ul>

      {bookable && (
        <BookingModal
          doctor={bookingDoctor}
          open={!!bookingDoctor}
          onClose={() => setBookingDoctor(null)}
        />
      )}
    </div>
  );
}
