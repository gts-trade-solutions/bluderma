"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  acceptAppointment,
  declineAppointment,
} from "@/lib/actions/doctorAppointments";
import AppointmentDrawer from "./AppointmentDrawer";
import GoldCollarBadge from "@/components/GoldCollarBadge";

/**
 * The confirmation queue.
 *
 * Accept is one click, because accepting is the common case and the doctor has
 * already seen everything they need on the card. Decline is deliberately
 * slower and demands a reason, because the client reads it — a booking that
 * vanishes without explanation is the complaint this whole flow exists to
 * avoid.
 */

export interface RequestRow {
  id: string;
  daySeed: string;
  time: string;
  durationMin: number;
  mode: string;
  patientName: string;
  notes: string | null;
  /** One-line intake summary, and the patient's own description. */
  reasonSummary: string | null;
  reasonDetail: string | null;
  urgent: boolean;
  isPriority: boolean;
  isMember: boolean;
  feeInr: number;
  requestedAt: string;
  clinicName: string | null;
  clinicArea: string | null;
  clinicDot: string;
}

const MODE_LABEL: Record<string, string> = {
  CLINIC: "In clinic",
  VIDEO: "Video",
  HOME: "Home visit",
};

function niceDay(daySeed: string): string {
  const d = new Date(`${daySeed}T00:00:00.000Z`);
  const today = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
  const tomorrow = new Date(
    new Date(`${today}T00:00:00.000Z`).getTime() + 86_400_000
  )
    .toISOString()
    .slice(0, 10);
  if (daySeed === today) return "Today";
  if (daySeed === tomorrow) return "Tomorrow";
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/** How long the client has been waiting. Pressure, honestly stated. */
function waitingFor(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 60) return `${Math.max(1, mins)} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function RequestList({ rows }: { rows: RequestRow[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <>
      <ul className="space-y-3">
        {rows.map((r) => (
          <RequestCard key={r.id} r={r} onOpen={() => setOpenId(r.id)} />
        ))}
      </ul>
      {openId && (
        <AppointmentDrawer appointmentId={openId} onClose={() => setOpenId(null)} />
      )}
    </>
  );
}

function RequestCard({ r, onOpen }: { r: RequestRow; onOpen: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <li className="rounded-2xl border border-amber-200 bg-white p-4">
      <div className="flex flex-wrap items-start gap-4">
        <div className="w-20 shrink-0">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-600">
            {niceDay(r.daySeed)}
          </p>
          <p className="text-lg font-bold tabular-nums text-ink">{r.time}</p>
          <p className="text-[11px] text-slate-400">{r.durationMin} min</p>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={onOpen}
              className="font-semibold text-ink underline-offset-2 hover:underline"
            >
              {r.patientName}
            </button>
            {r.isMember && (
              <GoldCollarBadge />
            )}
            {r.isPriority && !r.isMember && (
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-800">
                PRIORITY
              </span>
            )}
          </div>

          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
            <span>{MODE_LABEL[r.mode] ?? r.mode}</span>
            {r.clinicName && (
              <span className="flex items-center gap-1">
                <span className={`h-1.5 w-1.5 rounded-full ${r.clinicDot}`} />
                {r.clinicName.replace(/^BluDerma\s+/, "")}
                {r.clinicArea ? ` · ${r.clinicArea}` : ""}
              </span>
            )}
            <span>₹{r.feeInr.toLocaleString("en-IN")}</span>
            <span className="text-slate-400">asked {waitingFor(r.requestedAt)}</span>
          </p>

          {/* Accepting or declining a request without knowing what it is for
              is not a decision anyone can make, so the reason renders here
              rather than only behind the drawer. */}
          {r.reasonSummary && (
            <p
              className={`mt-2 text-xs font-bold ${
                r.urgent ? "text-rose-600" : "text-slate-700"
              }`}
            >
              {r.urgent && "● "}
              {r.reasonSummary}
            </p>
          )}
          {(r.reasonDetail || r.notes) && (
            <p className="mt-1.5 whitespace-pre-line rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {r.reasonDetail || r.notes}
            </p>
          )}
        </div>

        {!declining && (
          <div className="flex shrink-0 gap-2">
            <button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await acceptAppointment(r.id);
                  if (res.ok) router.refresh();
                  else setError(res.error ?? "Could not accept that.");
                })
              }
              className="rounded-full bg-brand-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-50"
            >
              {pending ? "…" : "Accept"}
            </button>
            <button
              disabled={pending}
              onClick={() => setDeclining(true)}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Decline
            </button>
          </div>
        )}
      </div>

      {declining && (
        <div className="mt-3 space-y-2 rounded-xl border border-rose-200 bg-rose-50/50 p-3">
          <label className="block text-sm font-semibold text-slate-800">
            Why can you not take this?
          </label>
          <textarea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="The client is shown this word for word."
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              disabled={pending || reason.trim().length < 3}
              onClick={() => {
                const fd = new FormData();
                fd.set("appointmentId", r.id);
                fd.set("reason", reason.trim());
                start(async () => {
                  const res = await declineAppointment(fd);
                  if (res.ok) router.refresh();
                  else setError(res.error ?? "Could not decline that.");
                });
              }}
              className="rounded-full bg-rose-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-rose-700 disabled:opacity-40"
            >
              {pending ? "…" : "Decline and notify"}
            </button>
            <button
              onClick={() => setDeclining(false)}
              className="rounded-full px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-800"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </li>
  );
}
