"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import SmartImage from "@/components/SmartImage";
import PatientHeader from "./PatientHeader";
import {
  CalendarClock,
  Video,
  Building2,
  MapPin,
  X,
  CheckCircle2,
  ScanFace,
} from "@/components/icons";
import {
  Appointment,
  cancelAppointment,
  getAppointments,
  onAppointmentsChange,
} from "@/lib/patientStore";

export default function AppointmentsView() {
  const [mounted, setMounted] = useState(false);
  const [appts, setAppts] = useState<Appointment[]>([]);

  useEffect(() => {
    setMounted(true);
    const refresh = () => setAppts(getAppointments());
    refresh();
    return onAppointmentsChange(refresh);
  }, []);

  return (
    <>
      <PatientHeader
        eyebrow="Your care"
        title="My Appointments"
        subtitle="Your booked consultations with BluDerma doctors, all in one place."
      />

      <section className="mx-auto max-w-5xl px-4 py-12">
        {!mounted ? null : appts.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <div className="mb-6 flex items-center justify-between">
              <p className="text-sm text-ink-muted">
                {appts.length} appointment{appts.length > 1 ? "s" : ""} booked
              </p>
              <Link href="/patient/skin-analyzer" className="btn-primary !px-5 !py-2 text-sm">
                <ScanFace className="h-4 w-4" /> Book another
              </Link>
            </div>
            <div className="grid gap-4">
              {appts.map((a) => (
                <ApptCard key={a.id} appt={a} onCancel={() => cancelAppointment(a.id)} />
              ))}
            </div>
          </>
        )}
      </section>
    </>
  );
}

function ApptCard({
  appt,
  onCancel,
}: {
  appt: Appointment;
  onCancel: () => void;
}) {
  const Mode = appt.mode === "video" ? Video : Building2;
  return (
    <div className="flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center">
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl">
        <SmartImage src={appt.image} alt={appt.doctorName} sizes="64px" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-bold text-ink">{appt.doctorName}</h3>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
            <CheckCircle2 className="h-3 w-3" /> Confirmed
          </span>
        </div>
        <p className="text-sm text-rose-600">{appt.specialty}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
          <span className="inline-flex items-center gap-1 font-medium text-ink-soft">
            <CalendarClock className="h-3.5 w-3.5 text-rose-500" />
            {appt.dateLabel} · {appt.dateSub} · {appt.time}
          </span>
          <span className="inline-flex items-center gap-1">
            <Mode className="h-3.5 w-3.5" />
            {appt.mode === "video" ? "Video consult" : "In-clinic"}
          </span>
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {appt.mode === "video" ? "Link on confirmation" : `${appt.clinic}, ${appt.location}`}
          </span>
        </div>
        <p className="mt-1 text-xs text-ink-muted">
          Booked for {appt.patientName} · ₹{appt.fee}
        </p>
      </div>

      <button
        onClick={onCancel}
        className="inline-flex items-center gap-1.5 self-start rounded-full border border-rose-200 px-4 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50 sm:self-center"
      >
        <X className="h-4 w-4" /> Cancel
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl border border-dashed bg-white p-10 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-rose-500">
        <CalendarClock className="h-7 w-7" />
      </div>
      <h3 className="mt-4 text-lg font-bold text-ink">No appointments yet</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">
        Run a skin analysis to get matched with the right doctor, then book a
        slot — your appointments will show up here.
      </p>
      <Link href="/patient/skin-analyzer" className="btn-primary mt-6">
        <ScanFace className="h-4 w-4" /> Start skin analysis
      </Link>
    </div>
  );
}
