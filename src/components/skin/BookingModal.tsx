"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import {
  Star,
  MapPin,
  Video,
  Building2,
  Globe,
  CheckCircle2,
  X,
  CalendarDays,
} from "@/components/icons";
import SmartImage from "@/components/SmartImage";
import { bookAppointment } from "@/lib/actions/booking";
import type { DayOption, Slot } from "@/lib/queries/availability";
import type { ConsultModeDTO, DoctorDTO } from "@/lib/queries/types";

interface BookingModalProps {
  doctor: DoctorDTO | null;
  open: boolean;
  onClose: () => void;
}

const PERIODS: Array<"Morning" | "Afternoon" | "Evening"> = [
  "Morning",
  "Afternoon",
  "Evening",
];

export default function BookingModal({
  doctor,
  open,
  onClose,
}: BookingModalProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const [dayIndex, setDayIndex] = useState(0);
  const [mode, setMode] = useState<ConsultModeDTO>("clinic");
  const [slot, setSlot] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Availability comes from the server — it depends on other people's bookings,
  // so it can't be derived on the client.
  const [days, setDays] = useState<DayOption[]>([]);
  const [slotsByDay, setSlotsByDay] = useState<Record<string, Slot[]>>({});
  const [loadingSlots, setLoadingSlots] = useState(false);

  const activeDay = days[dayIndex] ?? days[0];
  const slots = activeDay ? slotsByDay[activeDay.daySeed] ?? [] : [];

  const loadSlots = useCallback(async (slug: string) => {
    setLoadingSlots(true);
    try {
      const res = await fetch(`/api/doctors/${slug}/slots?days=5`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setDays(data.days ?? []);
      setSlotsByDay(data.slots ?? {});
    } catch {
      setError("Could not load available times. Please try again.");
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  useEffect(() => {
    if (open && doctor) {
      setDayIndex(0);
      setMode(doctor.modes[0] ?? "clinic");
      setSlot(null);
      setPhone("");
      setConfirmed(false);
      setError(null);
      // Pre-fill from the account so the patient doesn't retype it.
      setName(session?.user?.name ?? "");
      loadSlots(doctor.id);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open, doctor, session?.user?.name, loadSlots]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Reset the chosen slot whenever the day changes.
  useEffect(() => setSlot(null), [dayIndex]);

  if (!open || !doctor) return null;

  const signedIn = status === "authenticated";
  const canConfirm = !!slot && name.trim().length > 1 && signedIn && !busy;
  const freeCount = slots.filter((s) => s.available).length;

  const handleConfirm = async () => {
    if (!doctor || !slot || !activeDay) return;
    setBusy(true);
    setError(null);

    const res = await bookAppointment({
      doctorSlug: doctor.id,
      daySeed: activeDay.daySeed,
      time: slot,
      mode,
      patientName: name.trim(),
      patientPhone: phone.trim(),
    });

    if (!res.ok) {
      setError(res.error ?? "Could not complete your booking.");
      // The slot list is the likely culprit — refresh it so the taken slot
      // shows as unavailable rather than letting them retry the same one.
      await loadSlots(doctor.id);
      setSlot(null);
      setBusy(false);
      return;
    }

    setConfirmed(true);
    setBusy(false);
    router.refresh();
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Book an appointment with ${doctor.name}`}
    >
      <div className="absolute inset-0 bg-ink/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start gap-4 border-b border-slate-100 p-6">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl">
            <SmartImage src={doctor.image} alt={doctor.name} sizes="64px" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="text-lg font-bold text-ink">{doctor.name}</h3>
              {doctor.verified && (
                <CheckCircle2 className="h-4 w-4 text-brand-500" />
              )}
            </div>
            <p className="text-sm text-brand-600">{doctor.specialty}</p>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-muted">
              <span className="inline-flex items-center gap-1">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                {doctor.rating} ({doctor.reviews})
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {doctor.clinic}, {doctor.location}
              </span>
              <span className="inline-flex items-center gap-1">
                <Globe className="h-3 w-3" />
                {doctor.languages.join(", ")}
              </span>
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-2 text-ink-muted transition hover:bg-slate-100 hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {confirmed ? (
          <div className="p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-teal-100 text-teal-600">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h4 className="text-lg font-bold text-ink">Appointment booked</h4>
            <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">
              {name || "You"} — you&apos;re booked with{" "}
              <span className="font-medium text-ink">{doctor.name}</span>.
            </p>
            <div className="mx-auto mt-5 max-w-xs rounded-2xl bg-brand-50 p-4 text-left text-sm ring-1 ring-brand-100">
              <Row k="Doctor" v={doctor.name} />
              <Row k="Date" v={`${activeDay.label} · ${activeDay.sub}`} />
              <Row k="Time" v={slot ?? ""} />
              <Row k="Mode" v={mode === "video" ? "Video consult" : "In-clinic"} />
              <Row
                k="Where"
                v={
                  mode === "video"
                    ? "Video link on confirmation"
                    : `${doctor.clinic}, ${doctor.location}`
                }
              />
              <Row k="Consultation" v={`₹${doctor.fee}`} />
            </div>
            <p className="mt-4 text-xs text-ink-muted">
              A confirmation email is on its way. You can cancel any time from
              My Appointments.
            </p>
            <button onClick={onClose} className="btn-primary mt-6">
              Done
            </button>
          </div>
        ) : (
          <div className="space-y-6 p-6">
            {error && (
              <div
                role="alert"
                className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-inset ring-rose-100"
              >
                {error}
              </div>
            )}

            {/* Booking needs an account — say so up front rather than at submit. */}
            {status !== "loading" && !signedIn && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800 ring-1 ring-inset ring-brand-100">
                <span>Sign in to confirm a booking.</span>
                <Link
                  href={`/login?callbackUrl=${encodeURIComponent(pathname ?? "/")}`}
                  className="btn-primary !px-4 !py-1.5 text-xs"
                >
                  Sign in
                </Link>
              </div>
            )}

            {/* Consultation mode */}
            {doctor.modes.length > 1 && (
              <div>
                <p className="mb-2 text-sm font-semibold text-ink">
                  Consultation type
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  {(["clinic", "video"] as ConsultModeDTO[])
                    .filter((m) => doctor.modes.includes(m))
                    .map((m) => {
                      const selected = mode === m;
                      const Icon = m === "video" ? Video : Building2;
                      return (
                        <button
                          key={m}
                          onClick={() => setMode(m)}
                          className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                            selected
                              ? "border-brand-600 bg-brand-50 text-brand-700"
                              : "border-slate-200 text-ink-soft hover:border-brand-300"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          {m === "video" ? "Video consult" : "In-clinic visit"}
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Date tabs */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                  <CalendarDays className="h-4 w-4 text-brand-500" /> Choose a date
                </p>
                <span className="text-xs text-ink-muted">{freeCount} slots free</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {loadingSlots && days.length === 0 &&
                  Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-[52px] min-w-[74px] animate-pulse rounded-xl bg-slate-100"
                    />
                  ))}
                {days.map((d, i) => {
                  const selected = i === dayIndex;
                  return (
                    <button
                      key={d.daySeed}
                      onClick={() => setDayIndex(i)}
                      className={`flex min-w-[74px] flex-col items-center rounded-xl border px-3 py-2 transition ${
                        selected
                          ? "border-brand-600 bg-brand-600 text-white"
                          : "border-slate-200 text-ink-soft hover:border-brand-300"
                      }`}
                    >
                      <span className="text-xs font-semibold">{d.label}</span>
                      <span
                        className={`text-[11px] ${
                          selected ? "text-white/80" : "text-ink-muted"
                        }`}
                      >
                        {d.sub}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Slots grouped by period */}
            <div className="space-y-4">
              {!loadingSlots && slots.length === 0 && (
                <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-ink-muted">
                  {doctor.name} isn&apos;t taking appointments on this day. Try
                  another date.
                </p>
              )}
              {PERIODS.map((period) => {
                const periodSlots = slots.filter((s) => s.period === period);
                if (periodSlots.length === 0) return null;
                return (
                  <div key={period}>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                      {period}
                    </p>
                    <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5">
                      {periodSlots.map((s) => {
                        const selected = slot === s.label;
                        return (
                          <button
                            key={s.label}
                            disabled={!s.available}
                            onClick={() => setSlot(s.label)}
                            className={`rounded-xl border px-2 py-2 text-sm font-medium transition ${
                              !s.available
                                ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300 line-through"
                                : selected
                                ? "border-brand-600 bg-brand-600 text-white shadow-soft"
                                : "border-slate-200 bg-white text-ink-soft hover:border-brand-400 hover:text-brand-700"
                            }`}
                          >
                            {s.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              <p className="text-xs text-ink-muted">
                Struck-through times are already booked or have passed.
              </p>
            </div>

            {/* Patient details */}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-ink-soft">
                  Your name <span className="text-brand-500">*</span>
                </span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-ink-soft">
                  Phone
                </span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 …"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <div className="text-sm">
                <span className="text-ink-muted">Consultation </span>
                <span className="font-bold text-ink">₹{doctor.fee}</span>
                {slot && (
                  <span className="text-ink-muted">
                    {" "}
                    · {activeDay.label} {slot}
                  </span>
                )}
              </div>
              <button
                disabled={!canConfirm}
                onClick={handleConfirm}
                className={`btn-primary ${
                  !canConfirm ? "cursor-not-allowed opacity-40" : ""
                }`}
              >
                {busy ? "Booking…" : "Confirm booking"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 py-1">
      <span className="text-ink-muted">{k}</span>
      <span className="text-right font-medium text-ink">{v}</span>
    </div>
  );
}
