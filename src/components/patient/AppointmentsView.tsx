"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import SmartImage from "@/components/SmartImage";
import PatientHeader from "./PatientHeader";
import {
  CalendarClock,
  Video,
  House,
  Building2,
  MapPin,
  X,
  CheckCircle2,
  ScanFace,
} from "@/components/icons";
import AppointmentControls, {
  type AppointmentPolicyView,
} from "./AppointmentControls";
import type { AppointmentDTO } from "@/lib/queries/patient";

export default function AppointmentsView({
  appointments,
  policies,
}: {
  appointments: AppointmentDTO[];
  policies: Record<string, AppointmentPolicyView>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upcoming = appointments.filter(
    (a) => !a.isPast && a.status !== "CANCELLED"
  );
  const past = appointments.filter((a) => a.isPast || a.status === "CANCELLED");



  return (
    <>
      <PatientHeader
        eyebrow="Your care"
        title="My Appointments"
        subtitle="Your booked consultations with BluDerma doctors, all in one place."
      />

      <section className="mx-auto max-w-5xl px-4 py-12">
        {error && (
          <div
            role="alert"
            className="mb-6 rounded-xl bg-rose-500/[12%] px-4 py-3 text-sm text-rose-700 ring-1 ring-inset ring-rose-100"
          >
            {error}
          </div>
        )}

        {appointments.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <div className="mb-6 flex items-center justify-between">
              <p className="text-sm text-ink-muted">
                {upcoming.length} upcoming appointment
                {upcoming.length === 1 ? "" : "s"}
              </p>
              <Link
                href="/patient/skin-analyzer"
                className="btn-primary !px-5 !py-2 text-sm"
              >
                <ScanFace className="h-4 w-4" /> Book another
              </Link>
            </div>

            {upcoming.length > 0 && (
              <div className="grid gap-4">
                {upcoming.map((a) => (
                  <ApptCard
                    key={a.id}
                    appt={a}
                    policy={policies[a.id]}
                  />
                ))}
              </div>
            )}

            {past.length > 0 && (
              <>
                <h2 className="mb-4 mt-10 text-sm font-semibold uppercase tracking-wide text-ink-muted">
                  Past &amp; cancelled
                </h2>
                <div className="grid gap-4">
                  {past.map((a) => (
                    <ApptCard key={a.id} appt={a} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </section>
    </>
  );
}

/**
 * Status pills, in dark ink on a tinted ground.
 *
 * These were written for the dark theme — amber-300, rose-300, white/60 — and
 * this page is light. Only CONFIRMED had been corrected, which is why it was
 * the one badge still readable while the rest of the card faded out. A pill
 * has to hold its own contrast regardless of what the surface under it does.
 */
const STATUS_STYLE: Record<string, { label: string; className: string }> = {
  CONFIRMED: {
    label: "Confirmed",
    className: "bg-emerald-400/[15%] text-emerald-800",
  },
  PENDING: { label: "Pending", className: "bg-amber-400/[18%] text-amber-800" },
  CANCELLED: { label: "Cancelled", className: "bg-rose-500/[12%] text-rose-800" },
  COMPLETED: { label: "Completed", className: "bg-slate-200 text-slate-700" },
  NO_SHOW: { label: "Missed", className: "bg-slate-200 text-slate-700" },
};

function ApptCard({
  appt,
  policy,
}: {
  appt: AppointmentDTO;
  policy?: AppointmentPolicyView;
}) {
  const Mode =
    appt.mode === "video" ? Video : appt.mode === "home" ? House : Building2;
  const status = STATUS_STYLE[appt.status] ?? STATUS_STYLE.CONFIRMED;
  const dimmed = appt.status === "CANCELLED" || appt.isPast;

  return (
    <div
      className={`flex flex-col gap-4 rounded-2xl border bg-white/[0.04] p-5 shadow-sm sm:flex-row sm:items-center ${
        dimmed ? "opacity-70" : ""
      }`}
    >
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl">
        <SmartImage src={appt.image} alt={appt.doctorName} sizes="64px" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-bold text-ink">{appt.doctorName}</h3>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.className}`}
          >
            {appt.status === "CONFIRMED" && (
              <CheckCircle2 className="h-3 w-3" />
            )}
            {status.label}
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
            {appt.mode === "video"
              ? "Video consult"
              : appt.mode === "home"
              ? "Home visit"
              : "In-clinic"}
          </span>
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {appt.mode === "video"
              ? "Link on confirmation"
              : appt.mode === "home"
              ? "At your address: the clinic will call to confirm"
              : `${appt.clinic}, ${appt.location}`}
          </span>
        </div>

        {/* What they told the clinic, read back to them. A patient who cannot
            see what the doctor was told has no way to notice it is wrong. */}
        {appt.reasonSummary && (
          <div className="mt-2.5 rounded-xl bg-white/[0.05] px-3.5 py-2.5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">
              What you told the clinic
            </p>
            <p className="mt-0.5 text-xs font-semibold text-ink-soft">
              {appt.reasonSummary}
              {appt.reportAttached && " · skin report attached"}
            </p>
            {appt.reasonDetail && (
              <p className="mt-1 line-clamp-3 text-xs text-ink-muted">
                {appt.reasonDetail}
              </p>
            )}
          </div>
        )}
        <p className="mt-1 text-xs text-ink-muted">
          Booked for {appt.patientName} · ₹{appt.fee}
        </p>
      </div>

      {/* What a client may do with this booking — reschedule, cancel under
          the clinic's policy, or rate the doctor once it has happened. */}
      {policy && (
        <div className="shrink-0 sm:w-64">
          <AppointmentControls
            appointmentId={appt.id}
            doctorSlug={appt.doctorSlug}
            doctorName={appt.doctorName}
            policy={policy}
            canReview={appt.isPast && appt.status !== "CANCELLED"}
            reviewed={appt.hasReview}
          />
          {appt.cancellationFeeInr > 0 && (
            <p className="mt-1 text-right text-[11px] text-rose-700">
              Late-cancellation fee: ₹{appt.cancellationFeeInr}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl border border-dashed bg-white/[0.04] p-10 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-400/15 text-rose-500">
        <CalendarClock className="h-7 w-7" />
      </div>
      <h3 className="mt-4 text-lg font-bold text-ink">No appointments yet</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">
        Run a skin analysis to get matched with the right doctor, then book a
        slot. Your appointments will show up here.
      </p>
      <Link href="/patient/skin-analyzer" className="btn-primary mt-6">
        <ScanFace className="h-4 w-4" /> Start skin analysis
      </Link>
    </div>
  );
}
