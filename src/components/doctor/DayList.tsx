"use client";

import { useState } from "react";

import AppointmentDrawer from "./AppointmentDrawer";
import GoldCollarBadge from "@/components/GoldCollarBadge";

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
                <p className="flex items-center gap-2 py-1.5 pl-[88px] text-xs font-medium text-graphite-500">
                  {gapLabel(gap)}
                </p>
              )}
              <button
                onClick={() => setOpenId(r.id)}
                className={`flex w-full items-center gap-4 rounded-[10px] bg-white p-4 text-left shadow-flat ring-1 transition hover:shadow-flat ${
                  awaiting
                    ? "ring-gold-300 hover:ring-gold-400"
                    : "ring-graphite-200 hover:ring-graphite-300"
                } ${cancelled ? "opacity-55" : ""}`}
              >
                {/* The time is the column a doctor scans down, so it gets its
                    own tabular gutter rather than sharing the name's line. */}
                <div className="w-16 shrink-0 border-r border-graphite-100 pr-4 text-right">
                  <p
                    className={`font-display text-base font-bold tabular-nums ${
                      cancelled ? "text-graphite-500 line-through" : "text-graphite-900"
                    }`}
                  >
                    {r.time}
                  </p>
                  <p className="text-[11px] text-graphite-500">{r.durationMin} min</p>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`font-semibold ${
                        cancelled ? "text-graphite-500 line-through" : "text-graphite-900"
                      }`}
                    >
                      {r.patientName}
                    </span>
                    {r.isMember && (
                      <GoldCollarBadge />
                    )}
                    {r.isPriority && !r.isMember && (
                      <span className="rounded-full bg-graphite-100 px-2 py-0.5 text-[10px] font-bold text-graphite-800">
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
                        r.urgent ? "text-coral-600" : "text-graphite-600"
                      }`}
                    >
                      {r.urgent && "● "}
                      {r.reason}
                    </p>
                  )}
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-graphite-500">
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
                      <span className="font-semibold text-gold-800">
                        No meeting link yet
                      </span>
                    )}
                  </p>
                </div>

                <span className="shrink-0 text-xs font-bold uppercase tracking-wide">
                  {cancelled ? (
                    <span className="text-graphite-500">Cancelled</span>
                  ) : awaiting ? (
                    <span className="text-gold-800">Confirm</span>
                  ) : (
                    <span className="text-graphite-400">View</span>
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
