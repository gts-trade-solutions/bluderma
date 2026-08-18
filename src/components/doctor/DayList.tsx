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
      <ol className="space-y-2">
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
                <p className="py-1 pl-[76px] text-xs font-medium text-slate-400">
                  {gapLabel(gap)}
                </p>
              )}
              <button
                onClick={() => setOpenId(r.id)}
                className={`flex w-full items-center gap-4 rounded-2xl border bg-white p-4 text-left transition hover:border-slate-300 ${
                  awaiting ? "border-amber-300" : "border-slate-200"
                } ${cancelled ? "opacity-55" : ""}`}
              >
                <div className="w-14 shrink-0 text-right">
                  <p
                    className={`text-sm font-bold tabular-nums ${
                      cancelled ? "text-slate-400 line-through" : "text-ink"
                    }`}
                  >
                    {r.time}
                  </p>
                  <p className="text-[11px] text-slate-400">{r.durationMin}m</p>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`font-semibold ${
                        cancelled ? "text-slate-400 line-through" : "text-ink"
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
