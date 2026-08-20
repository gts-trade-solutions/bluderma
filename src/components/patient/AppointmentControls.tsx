"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { cancelAppointment, rescheduleAppointment } from "@/lib/actions/booking";
import { submitReview } from "@/lib/actions/review";
import type { DayOption, Slot } from "@/lib/queries/availability";

/**
 * What a client can do with a booking they already hold.
 *
 * Cancelling is deliberately not a bare button. The consequence — free, a fee,
 * or "please phone us" — is shown before anything is committed, because being
 * charged by a button you did not know was a paid button is the thing this
 * design exists to prevent. The server re-checks the same policy, so the
 * warning and the outcome cannot drift apart.
 */

export interface AppointmentPolicyView {
  /** What cancelling costs right now. */
  cancel:
    | { kind: "free" }
    | { kind: "fee"; feeInr: number }
    | { kind: "contact"; phone: string }
    | { kind: "not_applicable" };
  /** Whether the client may still move it themselves. */
  reschedule:
    | { kind: "allowed"; remaining: number }
    | { kind: "too_late"; phone: string; minHours: number }
    | { kind: "limit_reached"; phone: string; max: number }
    | { kind: "not_applicable" };
}

export default function AppointmentControls({
  appointmentId,
  doctorSlug,
  doctorName,
  policy,
  canReview,
  reviewed,
}: {
  appointmentId: string;
  doctorSlug: string;
  doctorName: string;
  policy: AppointmentPolicyView;
  /** Past, uncancelled appointments can be rated. */
  canReview: boolean;
  reviewed: boolean;
}) {
  const [panel, setPanel] = useState<"none" | "cancel" | "move" | "review">("none");

  if (canReview) {
    return reviewed ? (
      <span className="text-xs font-semibold text-teal-700">
        Thanks for your review
      </span>
    ) : panel === "review" ? (
      <ReviewPanel
        appointmentId={appointmentId}
        doctorName={doctorName}
        onDone={() => setPanel("none")}
      />
    ) : (
      <button
        onClick={() => setPanel("review")}
        className="text-sm font-semibold text-brand-700 hover:underline"
      >
        Rate {doctorName.split(" ").slice(-1)}
      </button>
    );
  }

  if (panel === "move") {
    return (
      <ReschedulePanel
        appointmentId={appointmentId}
        doctorSlug={doctorSlug}
        onDone={() => setPanel("none")}
      />
    );
  }

  if (panel === "cancel") {
    return (
      <CancelPanel
        appointmentId={appointmentId}
        policy={policy.cancel}
        onDone={() => setPanel("none")}
      />
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      {policy.reschedule.kind === "allowed" ? (
        <button
          onClick={() => setPanel("move")}
          className="text-sm font-semibold text-brand-700 hover:underline"
        >
          Reschedule
        </button>
      ) : policy.reschedule.kind !== "not_applicable" ? (
        <span className="text-xs text-ink-muted">
          {policy.reschedule.kind === "limit_reached"
            ? `Moved ${policy.reschedule.max} times — call reception`
            : `Call reception to move it`}
        </span>
      ) : null}

      {policy.cancel.kind !== "not_applicable" && (
        <button
          onClick={() => setPanel("cancel")}
          className="text-sm font-semibold text-rose-700 hover:underline"
        >
          Cancel
        </button>
      )}
    </div>
  );
}

/* ── Cancel ───────────────────────────────────────────────────────────── */

function CancelPanel({
  appointmentId,
  policy,
  onDone,
}: {
  appointmentId: string;
  policy: AppointmentPolicyView["cancel"];
  onDone: () => void;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Too close for self-service. Say so plainly and give the number, rather
  // than showing a button that will be refused.
  if (policy.kind === "contact") {
    return (
      <div className="rounded-xl bg-white/[0.06] p-3 text-left ring-1 ring-white/10">
        <p className="text-xs font-semibold text-ink">
          This appointment is too close to cancel online.
        </p>
        <p className="mt-1 text-xs text-ink-muted">
          Please call reception
          {policy.phone ? (
            <>
              {" "}
              on{" "}
              <a href={`tel:${policy.phone}`} className="font-semibold text-brand-700">
                {policy.phone}
              </a>
            </>
          ) : null}{" "}
          and someone will help you straight away.
        </p>
        <button
          onClick={onDone}
          className="mt-2 text-xs font-semibold text-ink-muted hover:text-ink"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white/[0.06] p-3 text-left ring-1 ring-white/10">
      <p className="text-xs font-semibold text-ink">
        {policy.kind === "fee"
          ? `Cancelling now carries a ₹${policy.feeInr} late-cancellation fee.`
          : "Cancelling now is free."}
      </p>
      <input
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (optional)"
        className="mt-2 w-full rounded-lg bg-white/10 px-2.5 py-1.5 text-xs text-ink ring-1 ring-white/15"
        aria-label="Cancellation reason"
      />
      {error && <p className="mt-2 text-xs font-medium text-rose-700">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const res = await cancelAppointment(appointmentId, reason);
              if (!res.ok) {
                setError(res.error ?? "Could not cancel that appointment.");
                return;
              }
              onDone();
              router.refresh();
            })
          }
          className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
        >
          {pending
            ? "Cancelling…"
            : policy.kind === "fee"
            ? "Cancel and accept the fee"
            : "Confirm cancellation"}
        </button>
        <button
          onClick={onDone}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-ink-muted"
        >
          Keep it
        </button>
      </div>
    </div>
  );
}

/* ── Reschedule ───────────────────────────────────────────────────────── */

function ReschedulePanel({
  appointmentId,
  doctorSlug,
  onDone,
}: {
  appointmentId: string;
  doctorSlug: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [days, setDays] = useState<DayOption[]>([]);
  const [slotsByDay, setSlotsByDay] = useState<Record<string, Slot[]>>({});
  const [dayIndex, setDayIndex] = useState(0);
  const [slot, setSlot] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/doctors/${doctorSlug}/slots?days=7`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("slots");
      const data = await res.json();
      setDays(data.days ?? []);
      setSlotsByDay(data.slots ?? {});
    } catch {
      setError("Could not load available times.");
    } finally {
      setLoading(false);
    }
  }, [doctorSlug]);

  useEffect(() => {
    load();
  }, [load]);

  const day = days[dayIndex];
  const slots = day ? slotsByDay[day.daySeed] ?? [] : [];

  return (
    <div className="rounded-xl bg-white/[0.06] p-3 text-left ring-1 ring-white/10">
      <p className="text-xs font-semibold text-ink">Pick a new time</p>

      {loading && <p className="mt-2 text-xs text-ink-muted">Loading times…</p>}

      {!loading && days.length > 0 && (
        <>
          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {days.map((d, i) => (
              <button
                key={d.daySeed}
                onClick={() => {
                  setDayIndex(i);
                  setSlot(null);
                }}
                className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold ${
                  i === dayIndex
                    ? "bg-brand-600 text-white"
                    : "bg-white/10 text-ink-soft"
                }`}
              >
                {d.label} {d.sub}
              </button>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-4">
            {slots
              .filter((s) => s.available)
              .slice(0, 16)
              .map((s) => (
                <button
                  key={s.label}
                  onClick={() => setSlot(s.label)}
                  className={`rounded-lg px-1.5 py-1.5 text-[11px] font-semibold ${
                    slot === s.label
                      ? "bg-brand-600 text-white"
                      : "bg-white/10 text-ink-soft"
                  }`}
                >
                  {s.label}
                </button>
              ))}
          </div>
          {slots.filter((s) => s.available).length === 0 && (
            <p className="mt-2 text-xs text-ink-muted">
              Nothing free that day — try another.
            </p>
          )}
        </>
      )}

      {error && <p className="mt-2 text-xs font-medium text-rose-700">{error}</p>}

      <div className="mt-2 flex gap-2">
        <button
          disabled={!slot || pending}
          onClick={() =>
            startTransition(async () => {
              if (!slot || !day) return;
              setError(null);
              const res = await rescheduleAppointment({
                appointmentId,
                daySeed: day.daySeed,
                time: slot,
              });
              if (!res.ok) {
                setError(res.error ?? "Could not move that appointment.");
                await load();
                setSlot(null);
                return;
              }
              onDone();
              router.refresh();
            })
          }
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
        >
          {pending ? "Moving…" : "Confirm new time"}
        </button>
        <button
          onClick={onDone}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-ink-muted"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ── Review ───────────────────────────────────────────────────────────── */

function ReviewPanel({
  appointmentId,
  doctorName,
  onDone,
}: {
  appointmentId: string;
  doctorName: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-xl bg-white/[0.06] p-3 text-left ring-1 ring-white/10">
      <p className="text-xs font-semibold text-ink">
        How was your consultation with {doctorName}?
      </p>

      <div className="mt-2 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => setRating(n)}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            aria-pressed={rating === n}
            className={`h-8 w-8 rounded-lg text-sm font-bold ${
              n <= rating ? "bg-amber-400 text-[#0b1322]" : "bg-white/10 text-ink-muted"
            }`}
          >
            ★
          </button>
        ))}
      </div>

      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="A short headline (optional)"
        maxLength={120}
        className="mt-2 w-full rounded-lg bg-white/10 px-2.5 py-1.5 text-xs text-ink ring-1 ring-white/15"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="What went well, what could have been better"
        className="mt-2 w-full rounded-lg bg-white/10 px-2.5 py-1.5 text-xs text-ink ring-1 ring-white/15"
      />

      {error && <p className="mt-2 text-xs font-medium text-rose-700">{error}</p>}

      <p className="mt-2 text-[11px] text-ink-muted">
        Reviews are checked before they appear publicly.
      </p>

      <div className="mt-2 flex gap-2">
        <button
          disabled={rating === 0 || pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const res = await submitReview({
                appointmentId,
                rating,
                title,
                body,
              });
              if (!res.ok) {
                setError(res.error ?? "Could not save your review.");
                return;
              }
              onDone();
              router.refresh();
            })
          }
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send review"}
        </button>
        <button
          onClick={onDone}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-ink-muted"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
