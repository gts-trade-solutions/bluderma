"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import type { VisitReason, SymptomDuration } from "@prisma/client";

import { useBackToClose } from "@/hooks/useBackToClose";
import { useFormValidation } from "@/hooks/useFormValidation";
import PrescriptionLines from "@/components/doctor/PrescriptionLines";
import {
  durationLabel,
  isUrgent,
  reasonLabel,
  severityLabel,
} from "@/lib/booking/visitIntake";

import {
  acceptAppointment,
  cancelByDoctor,
  declineAppointment,
  rescheduleByDoctor,
  setMeetingLink,
} from "@/lib/actions/doctorAppointments";
import {
  issuePrescription,
  updateOwnAppointmentStatus,
} from "@/lib/actions/doctor";

/**
 * Everything about one appointment, and everything the doctor can do to it.
 *
 * Built as a right-hand drawer rather than a page so the calendar stays behind
 * it — a doctor deciding whether to move a booking wants to see the day it
 * would move within, not navigate away from it.
 *
 * The destructive actions (decline, cancel) are two-step and demand a written
 * reason, because the client is told that reason verbatim. "Cancelled" with no
 * explanation is the thing patients complain about, and it costs one sentence
 * to avoid.
 */

interface Detail {
  appointment: {
    id: string;
    scheduledAt: string;
    durationMin: number;
    mode: string;
    status: string;
    approvalState: string;
    declineReason: string | null;
    isPriority: boolean;
    meetingUrl: string | null;
    notes: string | null;
    reason: VisitReason | null;
    reasonDetail: string | null;
    symptomDuration: SymptomDuration | null;
    severity: number | null;
    isFirstVisit: boolean;
    priorTreatment: string | null;
    medications: string | null;
    allergies: string | null;
    photoConsent: boolean;
    patientAge: number | null;
    patientGender: string | null;
    skinAnalysisId: string | null;
    skinScanId: string | null;
    feeAtBooking: number;
    visitFee: number;
    discountInr: number;
    cancelReason: string | null;
    cancelledBy: string | null;
    rescheduleCount: number;
    patientUserId: string | null;
    patientName: string;
    patientEmail: string | null;
    patientPhone: string | null;
    createdAt: string;
    clinic: {
      id: string;
      name: string;
      area: string;
      city: string;
      addressLine1: string;
      phone: string | null;
    } | null;
    photos: { id: string; url: string }[];
  };
  member: { currentPeriodEnd: string; plan: { name: string } } | null;
  scans: {
    id: string;
    createdAt: string;
    summary: unknown;
    issues: { issueType: string; score: number | null; severityBand: string | null }[];
  }[];
  /** The report the patient deliberately attached to THIS booking. */
  attachedAnalysis: {
    id: string;
    createdAt: string;
    overall: number;
    skinType: string;
    estimatedAge: number;
    scores: { score: number; concern: { label: string } }[];
  } | null;
  history: { id: string; scheduledAt: string; status: string; mode: string }[];
  profile: {
    fullName: string | null;
    age: number | null;
    gender: string | null;
    city: string | null;
    phone: string | null;
  } | null;
  intake: { id: string; createdAt: string; answers: unknown; summary: string | null } | null;
}

const MODE_LABEL: Record<string, string> = {
  CLINIC: "In clinic",
  VIDEO: "Video consultation",
  HOME: "Home visit",
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function fmtTime(iso: string): string {
  return new Date(iso).toISOString().slice(11, 16);
}

export default function AppointmentDrawer({
  appointmentId,
  onClose,
}: {
  appointmentId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Back closes the drawer. Without this it walked the doctor back through
  // their own calendar history and dumped them on an unrelated week.
  useBackToClose(true, onClose);

  useEffect(() => {
    let live = true;
    setDetail(null);
    setError(null);
    fetch(`/api/doctor/appointments/${appointmentId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => live && setDetail(d))
      .catch(() => live && setError("Could not load that appointment."));
    return () => {
      live = false;
    };
  }, [appointmentId]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onEsc);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onEsc);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const refresh = () => {
    router.refresh();
    fetch(`/api/doctor/appointments/${appointmentId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then(setDetail)
      .catch(() => {});
  };

  if (!mounted) return null;

  // `pro-surface` because createPortal renders to document.body, OUTSIDE the
  // portal layout that carries it. Without it this drawer is the one clinical
  // surface a theme can reach — and a patient's appointment inverting colour
  // mid-consultation is precisely what the console is kept out of themes for.
  return createPortal(
    <div className="theme-light pro-surface fixed inset-0 z-[60] flex justify-end">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
      />
      <div className="relative flex h-full w-full max-w-lg flex-col border-l border-slate-200 bg-white shadow-2xl">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-slate-900">
              {detail?.appointment.patientName ?? "Appointment"}
            </h2>
            {detail && (
              <p className="text-sm text-slate-500">
                {fmtDate(detail.appointment.scheduledAt)} ·{" "}
                {fmtTime(detail.appointment.scheduledAt)}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {error && <p className="text-sm text-rose-600">{error}</p>}
          {!detail && !error && (
            <p className="text-sm text-slate-400">Loading…</p>
          )}
          {detail && <Body detail={detail} onDone={refresh} />}
        </div>
      </div>
    </div>,
    document.body
  );
}

function Body({ detail, onDone }: { detail: Detail; onDone: () => void }) {
  const a = detail.appointment;
  const cancelled = a.status === "CANCELLED";
  const awaiting = a.approvalState === "AWAITING_DOCTOR" && !cancelled;
  // Past appointments get a different set of actions: what happened, and what
  // was prescribed. Compared against the clinic wall clock, like everything
  // else that reasons about "now" (see queries/availability.ts).
  const isPast = new Date(a.scheduledAt).getTime() <= Date.now() + 330 * 60_000;
  const settled = a.status === "COMPLETED" || a.status === "NO_SHOW";

  return (
    <div className="space-y-6">
      {/* ── State banners ────────────────────────────────────────────── */}
      {awaiting && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong className="font-bold">Waiting for you.</strong> The slot is held
          until you accept or decline.
        </div>
      )}
      {cancelled && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <strong className="font-bold">Cancelled</strong>
          {a.cancelledBy ? ` by ${a.cancelledBy.toLowerCase()}` : ""}.
          {a.cancelReason && <span className="block mt-1">{a.cancelReason}</span>}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {detail.member && (
          <Badge tone="gold">
            {detail.member.plan.name} · to {detail.member.currentPeriodEnd.slice(0, 10)}
          </Badge>
        )}
        {a.isPriority && <Badge tone="violet">Priority booking</Badge>}
        <Badge tone="slate">{MODE_LABEL[a.mode] ?? a.mode}</Badge>
        <Badge tone="slate">{a.durationMin} min</Badge>
        {a.rescheduleCount > 0 && (
          <Badge tone="slate">Moved {a.rescheduleCount}×</Badge>
        )}
      </div>

      {/* ── Where and what it costs ──────────────────────────────────── */}
      <Section title="Appointment">
        <Row label="Where">
          {a.clinic ? (
            <>
              {a.clinic.name}
              <span className="block text-xs text-slate-500">
                {a.clinic.addressLine1}, {a.clinic.area}, {a.clinic.city}
              </span>
            </>
          ) : a.mode === "VIDEO" ? (
            "Video consultation"
          ) : (
            <span className="text-slate-400">No location recorded</span>
          )}
        </Row>
        <Row label="Fee">
          ₹{(a.feeAtBooking + a.visitFee).toLocaleString("en-IN")}
          {a.discountInr > 0 && (
            <span className="block text-xs text-teal-600">
              after ₹{a.discountInr.toLocaleString("en-IN")} membership discount
            </span>
          )}
          {a.visitFee > 0 && (
            <span className="block text-xs text-slate-500">
              includes ₹{a.visitFee.toLocaleString("en-IN")} home-visit charge
            </span>
          )}
        </Row>
        <Row label="Booked">{fmtDate(a.createdAt)}</Row>
      </Section>

      {/* ── Why they are coming ──────────────────────────────────────────
          Deliberately above money and logistics: this is the part a doctor
          reads before a consultation, and it used to not exist at all. */}
      <Section title="Why they are coming">
        {a.reason ? (
          <>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-bold text-white">
                {reasonLabel(a.reason)}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                {a.isFirstVisit ? "First visit" : "Follow-up"}
              </span>
              {a.symptomDuration && (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                  {durationLabel(a.symptomDuration)}
                </span>
              )}
              {a.severity != null && (
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                    isUrgent(a.severity)
                      ? "bg-rose-100 text-rose-800"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {severityLabel(a.severity)}
                </span>
              )}
              {(a.patientAge != null || a.patientGender) && (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                  {[
                    a.patientAge != null ? `${a.patientAge}y` : null,
                    a.patientGender && a.patientGender !== "UNDISCLOSED"
                      ? a.patientGender.toLowerCase()
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              )}
            </div>

            {a.reasonDetail && (
              <p className="mt-3 whitespace-pre-line rounded-xl bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-800">
                {a.reasonDetail}
              </p>
            )}

            <div className="mt-3 space-y-2">
              {a.priorTreatment && (
                <Row label="Already tried">{a.priorTreatment}</Row>
              )}
              {a.medications && <Row label="Medication">{a.medications}</Row>}
              {/* Always rendered: a blank allergies row reads as "not asked",
                  and it always is asked. */}
              <Row label="Allergies">
                {a.allergies || (
                  <span className="text-slate-400">None reported</span>
                )}
              </Row>
              {a.notes && <Row label="Also mentioned">{a.notes}</Row>}
              {a.photos.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Photos from the client
                  </p>
                  {/* Served through the signed-view route: these sit in a
                      private bucket prefix and 403 if linked directly. */}
                  <div className="mt-1.5 grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {a.photos.map((ph) => (
                      <a
                        key={ph.id}
                        href={`/api/uploads/view?url=${encodeURIComponent(ph.url)}`}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="aspect-square overflow-hidden rounded-xl ring-1 ring-slate-200 transition hover:ring-slate-400"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/uploads/view?url=${encodeURIComponent(ph.url)}`}
                          alt="Photograph supplied by the client"
                          className="h-full w-full object-cover"
                        />
                      </a>
                    ))}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Tap to open full size.
                  </p>
                </div>
              )}
              <Row label="Photo consent">
                {a.photoConsent ? (
                  <span className="font-semibold text-teal-700">Given</span>
                ) : (
                  <span className="font-semibold text-amber-700">
                    Not given: ask before photographing
                  </span>
                )}
              </Row>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-400">
            {a.notes
              ? a.notes
              : "Booked before we asked for a reason, or taken over the phone."}
          </p>
        )}
      </Section>

      {/* ── The client ───────────────────────────────────────────────── */}
      <Section title="Client">
        <Row label="Contact">
          {a.patientPhone || detail.profile?.phone || (
            <span className="text-slate-400">No phone given</span>
          )}
          {a.patientEmail && (
            <span className="block text-xs text-slate-500">{a.patientEmail}</span>
          )}
        </Row>
        {detail.profile && (detail.profile.age || detail.profile.gender || detail.profile.city) && (
          <Row label="Profile">
            {[
              detail.profile.age ? `${detail.profile.age} yrs` : null,
              detail.profile.gender,
              detail.profile.city,
            ]
              .filter(Boolean)
              .join(" · ")}
          </Row>
        )}
        {!a.patientUserId && (
          <p className="text-xs text-slate-400">
            Booked without an account, so there is no history or analysis to show.
          </p>
        )}
      </Section>

      {/* ── The report they attached ────────────────────────────────────
          Shown ABOVE the recent scans, and labelled differently, because it
          is a different fact: these are not the newest numbers, they are the
          ones the patient chose to put in front of this doctor for this
          visit. The distinction was invisible before — this section did not
          exist at all, and the id sat in the props unread. */}
      {detail.attachedAnalysis && (
        <Section title="Attached by the patient for this visit">
          <div className="rounded-lg border border-brand-200 bg-brand-50/60 p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="text-sm font-bold text-slate-900">
                Overall {detail.attachedAnalysis.overall}/100
              </p>
              <p className="text-xs text-slate-500">
                {fmtDate(detail.attachedAnalysis.createdAt)}
              </p>
            </div>
            <p className="mt-0.5 text-xs text-slate-600">
              {detail.attachedAnalysis.skinType} skin · estimated age{" "}
              {detail.attachedAnalysis.estimatedAge}
            </p>
            {detail.attachedAnalysis.scores.length > 0 && (
              <ul className="mt-2 space-y-1">
                {detail.attachedAnalysis.scores.map((sc) => (
                  <li
                    key={sc.concern.label}
                    className="flex items-baseline justify-between gap-3 text-sm"
                  >
                    <span className="text-slate-700">{sc.concern.label}</span>
                    <span className="shrink-0 text-xs font-semibold text-slate-500">
                      {sc.score}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
              Scored from a photograph. Not a diagnosis — it says what to look
              at, not what it is.
            </p>
          </div>
        </Section>
      )}

      {/* ── Clinical context ─────────────────────────────────────────── */}
      {detail.scans.length > 0 && (
        <Section title="Recent skin analysis">
          {detail.scans.map((s) => (
            <div key={s.id} className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-semibold text-slate-500">
                {fmtDate(s.createdAt)}
              </p>
              {s.issues.length > 0 ? (
                <ul className="mt-1.5 space-y-1">
                  {s.issues.map((i) => (
                    <li key={i.issueType} className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="capitalize text-slate-700">
                        {i.issueType.replace(/_/g, " ")}
                      </span>
                      <span className="shrink-0 text-xs font-semibold text-slate-500">
                        {i.severityBand ?? (i.score != null ? i.score.toFixed(0) : "—")}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-slate-400">No findings recorded.</p>
              )}
            </div>
          ))}
        </Section>
      )}

      {detail.intake?.summary && (
        <Section title="Consultation questionnaire">
          <p className="text-sm text-slate-700">{detail.intake.summary}</p>
          <p className="text-xs text-slate-400">
            Completed {fmtDate(detail.intake.createdAt)}
          </p>
        </Section>
      )}

      {detail.history.length > 0 && (
        <Section title="Seen by you before">
          <ul className="space-y-1">
            {detail.history.map((h) => (
              <li key={h.id} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-slate-700">{fmtDate(h.scheduledAt)}</span>
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {h.status.toLowerCase()}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* ── Actions ──────────────────────────────────────────────────── */}
      {!cancelled && (
        <div className="space-y-3 border-t border-slate-200 pt-5">
          {awaiting && <AcceptDecline id={a.id} onDone={onDone} />}

          {isPast && !settled && <Outcome id={a.id} onDone={onDone} />}
          {settled && (
            <p className="rounded-xl bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-600">
              Marked {a.status === "COMPLETED" ? "completed" : "as a no-show"}.
            </p>
          )}

          {isPast && a.patientUserId && (
            <PrescribeForm id={a.id} onDone={onDone} />
          )}
          {isPast && !a.patientUserId && (
            <p className="text-xs text-slate-400">
              This client has no BluDerma account, so a prescription cannot be
              filed to them here. Issue it at the clinic.
            </p>
          )}

          {!isPast && a.mode === "VIDEO" && (
            <MeetingLinkForm id={a.id} current={a.meetingUrl} onDone={onDone} />
          )}
          {!isPast && (
            <>
              <RescheduleForm id={a.id} isPriority={a.isPriority} onDone={onDone} />
              <CancelForm id={a.id} onDone={onDone} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Actions -------------------------------- */

function AcceptDecline({ id, onDone }: { id: string; onDone: () => void }) {
  const [pending, start] = useTransition();
  const [declining, setDeclining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (declining) {
    return (
      <ReasonForm
        label="Why can you not take this appointment?"
        hint="The client is shown this word for word."
        submitLabel="Decline and tell the client"
        tone="danger"
        onCancel={() => setDeclining(false)}
        onSubmit={(reason) =>
          new Promise((resolve) => {
            const fd = new FormData();
            fd.set("appointmentId", id);
            fd.set("reason", reason);
            start(async () => {
              const res = await declineAppointment(fd);
              if (res.ok) {
                setDeclining(false);
                onDone();
              }
              resolve(res.ok ? null : res.error ?? "Could not decline that.");
            });
          })
        }
      />
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await acceptAppointment(id);
              if (res.ok) onDone();
              else setError(res.error ?? "Could not accept that.");
            })
          }
          className="flex-1 rounded-full bg-brand-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-50"
        >
          {pending ? "Confirming…" : "Accept appointment"}
        </button>
        <button
          disabled={pending}
          onClick={() => setDeclining(true)}
          className="rounded-full border border-rose-200 px-4 py-2.5 text-sm font-bold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
        >
          Decline
        </button>
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}

function RescheduleForm({
  id,
  isPriority,
  onDone,
}: {
  id: string;
  isPriority: boolean;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formCheck = useFormValidation();

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-full border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
      >
        Move this appointment
      </button>
    );
  }

  return (
    <form
      ref={formCheck.formRef}
      noValidate
      className="space-y-3 rounded-xl border border-slate-200 p-4"
      onSubmit={formCheck.guard((fd, form) => {
        setError(null);
        fd.set("appointmentId", id);
        start(async () => {
          const res = await rescheduleByDoctor(fd);
          if (res.ok) {
            setOpen(false);
            onDone();
          } else {
            setError(res.error ?? "Could not move that.");
          }
        });
      })}
    >
      {formCheck.summary}
      <p className="text-sm font-semibold text-slate-800">Move to</p>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="date"
          name="daySeed"
          required
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <input
          type="time"
          name="time"
          required
          step={300}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      <textarea
        name="reason"
        rows={2}
        required={isPriority}
        placeholder={
          isPriority
            ? "Required: this client holds a priority membership"
            : "Reason (optional, shown to the client)"
        }
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
      />
      <p className="text-xs text-slate-500">
        The client is emailed the new time. This does not use up their own
        reschedule allowance.
      </p>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-full bg-brand-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-50"
        >
          {pending ? "Moving…" : "Move and notify"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-800"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function CancelForm({ id, onDone }: { id: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-full px-4 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
      >
        Cancel this appointment
      </button>
    );
  }

  return (
    <ReasonForm
      label="Why is this being cancelled?"
      hint="The client is shown this word for word. They are never charged a fee for a clinic cancellation."
      submitLabel="Cancel and tell the client"
      tone="danger"
      onCancel={() => setOpen(false)}
      onSubmit={(reason) =>
        new Promise((resolve) => {
          const fd = new FormData();
          fd.set("appointmentId", id);
          fd.set("reason", reason);
          start(async () => {
            const res = await cancelByDoctor(fd);
            if (res.ok) {
              setOpen(false);
              onDone();
            }
            resolve(res.ok ? null : res.error ?? "Could not cancel that.");
          });
        })
      }
    />
  );
}

function MeetingLinkForm({
  id,
  current,
  onDone,
}: {
  id: string;
  current: string | null;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const formCheck = useFormValidation();

  return (
    <form
      ref={formCheck.formRef}
      noValidate
      className="space-y-2 rounded-xl border border-slate-200 p-4"
      onSubmit={formCheck.guard((fd, form) => {
        setError(null);
        setSaved(false);
        fd.set("appointmentId", id);
        start(async () => {
          const res = await setMeetingLink(fd);
          if (res.ok) {
            setSaved(true);
            onDone();
          } else {
            setError(res.error ?? "Could not save that link.");
          }
        });
      })}
    >
      {formCheck.summary}
      <label className="block text-sm font-semibold text-slate-800">
        Meeting link
      </label>
      <input
        name="meetingUrl"
        defaultValue={current ?? ""}
        placeholder="https://meet.example.com/abc-defg-hij"
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
      />
      <p className="text-xs text-slate-500">
        Saved here and emailed to the client. Leave blank to remove it.
      </p>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {saved && <p className="text-sm text-teal-600">Saved and sent.</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-full border border-slate-200 px-4 py-1.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
      >
        {pending ? "Saving…" : current ? "Update link" : "Share link"}
      </button>
    </form>
  );
}

/** Shared two-step confirm that insists on a written reason. */
function ReasonForm({
  label,
  hint,
  submitLabel,
  tone,
  onCancel,
  onSubmit,
}: {
  label: string;
  hint: string;
  submitLabel: string;
  tone: "danger" | "primary";
  onCancel: () => void;
  onSubmit: (reason: string) => Promise<string | null>;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2 rounded-xl border border-rose-200 bg-rose-50/50 p-4">
      <label className="block text-sm font-semibold text-slate-800">{label}</label>
      <textarea
        rows={3}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
      />
      <p className="text-xs text-slate-500">{hint}</p>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="flex gap-2">
        <button
          disabled={busy || reason.trim().length < 3}
          onClick={async () => {
            setBusy(true);
            setError(await onSubmit(reason.trim()));
            setBusy(false);
          }}
          className={`flex-1 rounded-full px-4 py-2 text-sm font-bold text-white transition disabled:opacity-40 ${
            tone === "danger"
              ? "bg-rose-600 hover:bg-rose-700"
              : "bg-brand-600 hover:bg-brand-700"
          }`}
        >
          {busy ? "Working…" : submitLabel}
        </button>
        <button
          onClick={onCancel}
          className="rounded-full px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-800"
        >
          Back
        </button>
      </div>
    </div>
  );
}

/** What actually happened. Recorded by the doctor, never inferred. */
function Outcome({ id, onDone }: { id: string; onDone: () => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const set = (status: "COMPLETED" | "NO_SHOW") =>
    start(async () => {
      const res = await updateOwnAppointmentStatus(id, status);
      if (res.ok) onDone();
      else setError(res.error ?? "Could not save that.");
    });

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 p-4">
      <p className="text-sm font-semibold text-slate-800">How did it go?</p>
      <div className="flex gap-2">
        <button
          disabled={pending}
          onClick={() => set("COMPLETED")}
          className="flex-1 rounded-full bg-brand-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-50"
        >
          Completed
        </button>
        <button
          disabled={pending}
          onClick={() => set("NO_SHOW")}
          className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
        >
          No-show
        </button>
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}

/**
 * Filing a prescription against the consultation.
 *
 * Appears only once the appointment has happened — prescribing before seeing
 * someone is not a thing, and offering the form beforehand invites it.
 */
function PrescribeForm({ id, onDone }: { id: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const formCheck = useFormValidation();

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-full border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
      >
        {saved ? "Add another prescription" : "Issue a prescription"}
      </button>
    );
  }

  return (
    <form
      ref={formCheck.formRef}
      noValidate
      className="space-y-2 rounded-xl border border-slate-200 p-4"
      onSubmit={formCheck.guard((fd, form) => {
        setError(null);
        fd.set("appointmentId", id);
        start(async () => {
          const res = await issuePrescription(fd);
          if (res.ok) {
            setSaved(true);
            setOpen(false);
            onDone();
          } else {
            setError(res.error ?? "Could not file that.");
          }
        });
      })}
    >
      {formCheck.summary}
      <label className="block text-sm font-semibold text-slate-800">
        What this prescription is for
      </label>
      <input
        name="title"
        required
        maxLength={160}
        placeholder="e.g. Acne — 12 week course"
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
      />

      {/* The lines, picked off the doctor's own dispensary where they stock
          it and typed where they do not. See PrescriptionLines.tsx. */}
      <PrescriptionLines />

      <textarea
        name="notes"
        rows={3}
        placeholder="Anything else the client should read — review date, what to stop, what to watch for."
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
      />
      <p className="text-xs text-slate-500">
        Filed to the client&apos;s record, where they can read it in their
        profile — and reorder anything you stock, from you.
      </p>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-full bg-brand-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-50"
        >
          {pending ? "Filing…" : "File prescription"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-800"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

/* ------------------------------ Bits ----------------------------------- */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[86px_1fr] gap-3 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-800">{children}</span>
    </div>
  );
}

function Badge({
  tone,
  children,
}: {
  tone: "gold" | "violet" | "slate";
  children: React.ReactNode;
}) {
  const cls =
    tone === "gold"
      ? "bg-amber-100 text-amber-900 ring-1 ring-amber-300"
      : tone === "violet"
      ? "bg-violet-100 text-violet-800"
      : "bg-slate-100 text-slate-600";
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${cls}`}>
      {children}
    </span>
  );
}
