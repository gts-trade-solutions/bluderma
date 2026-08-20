"use client";

import { useState } from "react";

import AppointmentDrawer from "./AppointmentDrawer";

/**
 * Today's list, as a timeline rather than a table.
 *
 * A doctor reads their day in order and wants to know where the gaps are, so
 * the time sits in its own column and a break between appointments is drawn
 * rather than left implicit. Clicking a row opens the same detail drawer the
 * calendar uses — one place where an appointment is examined and acted on.
 */

export interface DayRow {
  id: string;
  time: string;
  durationMin: number;
  status: string;
  approvalState: string;
  mode: string;
  patientName: string;
  patientPhone: string | null;
  isPriority: boolean;
  isMember: boolean;
  hasMeetingUrl: boolean;
  clinicName: string | null;
  clinicArea: string | null;
  clinicDot: string;
  /** One-line intake summary. Null for bookings taken before we asked. */
  reason: string | null;
  urgent: boolean;
}

const MODE_LABEL: Record<string, string> = {
  CLINIC: "In clinic",
  VIDEO: "Video",
  HOME: "Home visit",
};

function minutesOf(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function gapLabel(mins: number): string {
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const r = mins % 60;
    return r ? `${h}h ${r}m free` : `${h}h free`;
  }
  return `${mins}m free`;
}

export default function DayList({
  rows,
  daySeed,
}: {
  rows: DayRow[];
  daySeed: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <>
      <ol className="space-y-2.5">
        {rows.map((r, i) => {
          const prev = rows[i - 1];
          const gap =
            prev && prev.status !== "CANCELLED" && r.status !== "CANCELLED"
              ? minutesOf(r.time) - (minutesOf(prev.time) + prev.durationMin)
              : 0;
          const cancelled = r.status === "CANCELLED";
          const awaiting = r.approvalState === "AWAITING_DOCTOR" && !cancelled;

          return (
            <li key={r.id}>
              {/* Only worth drawing a gap the doctor could actually use. */}
              {gap >= 30 && (
                <p className="flex items-center gap-2 py-1.5 pl-[88px] text-xs font-medium text-slate-400">
                  {gapLabel(gap)}
                </p>
              )}
              <button
                onClick={() => setOpenId(r.id)}
                className={`flex w-full items-center gap-4 rounded-2xl bg-white p-4 text-left shadow-[0_1px_2px_rgba(15,23,42,0.05)] ring-1 transition hover:shadow-[0_1px_2px_rgba(15,23,42,0.05),0_10px_28px_-18px_rgba(15,23,42,0.35)] ${
                  awaiting
                    ? "ring-amber-300 hover:ring-amber-400"
                    : "ring-slate-200/80 hover:ring-slate-300"
                } ${cancelled ? "opacity-55" : ""}`}
              >
                {/* The time is the column a doctor scans down, so it gets its
                    own tabular gutter rather than sharing the name's line. */}
                <div className="w-16 shrink-0 border-r border-slate-100 pr-4 text-right">
                  <p
                    className={`font-display text-base font-bold tabular-nums ${
                      cancelled ? "text-slate-400 line-through" : "text-slate-900"
                    }`}
                  >
                    {r.time}
                  </p>
                  <p className="text-[11px] text-slate-400">{r.durationMin} min</p>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`font-semibold ${
                        cancelled ? "text-slate-400 line-through" : "text-slate-900"
                      }`}
                    >
                      {r.patientName}
                    </span>
                    {r.isMember && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900 ring-1 ring-amber-300">
                        WHITE COLLAR
                      </span>
                    )}
                    {r.isPriority && !r.isMember && (
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-800">
                        PRIORITY
                      </span>
                    )}
                  </div>
                  {/* The reason sits directly under the name: a doctor
                      scanning their day should not have to open each row to
                      find out what any of them are for. */}
                  {r.reason && (
                    <p
                      className={`mt-0.5 truncate text-xs font-semibold ${
                        r.urgent ? "text-rose-600" : "text-slate-600"
                      }`}
                    >
                      {r.urgent && "● "}
                      {r.reason}
                    </p>
                  )}
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                    <span>{MODE_LABEL[r.mode] ?? r.mode}</span>
                    {r.clinicName && (
                      <span className="flex items-center gap-1">
                        <span className={`h-1.5 w-1.5 rounded-full ${r.clinicDot}`} />
                        {r.clinicName.replace(/^BluDerma\s+/, "")}
                        {r.clinicArea ? ` · ${r.clinicArea}` : ""}
                      </span>
                    )}
                    {r.patientPhone && <span>{r.patientPhone}</span>}
                    {r.mode === "VIDEO" && !r.hasMeetingUrl && (
                      <span className="font-semibold text-amber-700">
                        No meeting link yet
                      </span>
                    )}
                  </p>
                </div>

                <span className="shrink-0 text-xs font-bold uppercase tracking-wide">
                  {cancelled ? (
                    <span className="text-slate-400">Cancelled</span>
                  ) : awaiting ? (
                    <span className="text-amber-600">Confirm</span>
                  ) : (
                    <span className="text-slate-300">View</span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {openId && (
        <AppointmentDrawer appointmentId={openId} onClose={() => setOpenId(null)} />
      )}
    </>
  );
}
