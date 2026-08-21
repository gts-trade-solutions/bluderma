import Link from "next/link";
import { AppointmentStatus, ApprovalState } from "@prisma/client";

import {
  Empty,
  PageHead,
  StatTile,
  portalBtnPrimary,
  portalBtnQuiet,
} from "@/components/doctor/portalUi";
import DayList from "@/components/doctor/DayList";
import { getOwnDoctor } from "@/lib/doctor/guard";
import { prisma } from "@/lib/prisma";
import {
  clinicTodayBounds,
  clinicWallClock,
} from "@/lib/queries/availability";
import { membersAmong } from "@/lib/subscription/membership";
import { swatchFor } from "@/components/doctor/clinicColors";
import { intakeSummary, isUrgent } from "@/lib/booking/visitIntake";

export const metadata = { title: "Today" };
export const dynamic = "force-dynamic";

/**
 * The day in front of the practitioner.
 *
 * Was the portal home until the dashboard took that slot. It keeps its own
 * route because "what is happening today" and "how is the practice doing" are
 * different questions, and a doctor between consultations wants the first one
 * without scrolling past the second.
 */
export default async function DoctorTodayPage() {
  const owner = await getOwnDoctor();
  if (!owner) {
    return (
      <Empty
        icon="user"
        title="No practice linked yet"
        body="Your account is not connected to a practice."
        action={
          <Link href="/doctor/portal" className={portalBtnPrimary}>
            Set up your practice
          </Link>
        }
      />
    );
  }

  const { from, to, seed } = clinicTodayBounds();
  const now = new Date();

  const [today, awaiting, upcoming, completed, clinics] = await Promise.all([
    prisma.appointment.findMany({
      where: { doctorId: owner.doctorId, scheduledAt: { gte: from, lt: to } },
      orderBy: { scheduledAt: "asc" },
      select: {
        id: true,
        scheduledAt: true,
        durationMin: true,
        status: true,
        approvalState: true,
        mode: true,
        patientName: true,
        patientPhone: true,
        patientUserId: true,
        isPriority: true,
        meetingUrl: true,
        reason: true,
        symptomDuration: true,
        severity: true,
        isFirstVisit: true,
        clinic: { select: { name: true, area: true, colorKey: true } },
      },
    }),
    prisma.appointment.count({
      where: {
        doctorId: owner.doctorId,
        approvalState: ApprovalState.AWAITING_DOCTOR,
        status: { not: AppointmentStatus.CANCELLED },
        scheduledAt: { gte: now },
      },
    }),
    prisma.appointment.count({
      where: {
        doctorId: owner.doctorId,
        status: { in: [AppointmentStatus.CONFIRMED, AppointmentStatus.PENDING] },
        scheduledAt: { gte: now },
      },
    }),
    prisma.appointment.count({
      where: { doctorId: owner.doctorId, status: AppointmentStatus.COMPLETED },
    }),
    prisma.doctorClinic.count({
      where: { doctorId: owner.doctorId, isActive: true, clinic: { isActive: true } },
    }),
  ]);

  const members = await membersAmong(today.map((a) => a.patientUserId));

  const rows = today.map((a) => ({
    id: a.id,
    time: a.scheduledAt.toISOString().slice(11, 16),
    durationMin: a.durationMin || 30,
    status: a.status,
    approvalState: a.approvalState,
    mode: a.mode,
    patientName: a.patientName,
    patientPhone: a.patientPhone,
    isPriority: a.isPriority,
    isMember: a.patientUserId ? members.has(a.patientUserId) : false,
    hasMeetingUrl: Boolean(a.meetingUrl),
    clinicName: a.clinic?.name ?? null,
    clinicArea: a.clinic?.area ?? null,
    clinicDot: swatchFor(a.clinic?.colorKey).dot,
    reason: a.reason
      ? intakeSummary({
          reason: a.reason,
          symptomDuration: a.symptomDuration,
          severity: a.severity,
          isFirstVisit: a.isFirstVisit,
        })
      : null,
    urgent: isUrgent(a.severity),
  }));

  const live = rows.filter((r) => r.status !== "CANCELLED");

  return (
    <>
      <PageHead
        eyebrow={longDate(from)}
        title={`${greeting()}, Dr. ${owner.name.replace(/^Dr\.?\s+/i, "").split(" ")[0]}`}
        sub={
          live.length === 0
            ? "Nothing booked today. Your calendar is open."
            : `${live.length} ${live.length === 1 ? "appointment" : "appointments"} today${
                clinics > 1 ? ` across ${clinics} locations` : ""
              }.`
        }
        action={
          <Link href="/doctor/portal/calendar" className={portalBtnQuiet}>
            Open calendar
          </Link>
        }
      />

      {awaiting > 0 && (
        <Link
          href="/doctor/portal/requests"
          className="mb-6 flex items-center gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 transition hover:bg-amber-100"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-500 text-sm font-bold text-white">
            {awaiting}
          </span>
          <span className="min-w-0 flex-1 text-sm text-amber-900">
            <strong className="font-bold">
              {awaiting === 1 ? "One booking needs" : `${awaiting} bookings need`} your
              confirmation.
            </strong>{" "}
            The {awaiting === 1 ? "slot is" : "slots are"} held until you decide.
          </span>
          <span className="shrink-0 text-sm font-bold text-amber-800">Review →</span>
        </Link>
      )}

      <div className="mb-7 grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Upcoming"
          value={upcoming}
          hint="Confirmed and pending"
          accent="brand"
          icon="calendar"
          index={0}
        />
        <StatTile
          label="Completed"
          value={completed}
          hint="All time"
          accent="teal"
          icon="chart"
          index={1}
        />
        <StatTile
          label={clinics === 1 ? "Location" : "Locations"}
          value={clinics}
          hint="Manage hours and fees"
          href="/doctor/portal/practice"
          accent="amber"
          icon="clinic"
          index={2}
        />
      </div>

      {rows.length === 0 ? (
        <Empty
          title="Nothing booked today"
          body="When a client books you, it appears here and on your calendar."
          action={
            <Link href="/doctor/portal/calendar" className={portalBtnPrimary}>
              See the week
            </Link>
          }
        />
      ) : (
        <DayList rows={rows} daySeed={seed} />
      )}
    </>
  );
}

/** Reads the clinic wall clock, not the server's. */
function greeting(): string {
  const h = clinicWallClock().getUTCHours();
  if (h < 12) return "Good morning";
  return h < 17 ? "Good afternoon" : "Good evening";
}

function longDate(d: Date): string {
  return d.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}
