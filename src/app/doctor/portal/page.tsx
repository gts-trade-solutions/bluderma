import Link from "next/link";
import { AppointmentStatus, ApprovalState } from "@prisma/client";

import { EmptyState, PageHeader, Pill } from "@/components/admin/ui";
import DayList from "@/components/doctor/DayList";
import { getOwnDoctor } from "@/lib/doctor/guard";
import { prisma } from "@/lib/prisma";
import { membersAmong } from "@/lib/subscription/membership";
import { swatchFor } from "@/components/doctor/clinicColors";

export const metadata = { title: "Today" };
export const dynamic = "force-dynamic";

/**
 * The doctor's landing screen: what is happening today, and what needs them.
 *
 * Replaced the original portal home, which was a flat 200-row table of every
 * appointment ever. That answered "what have I got" but not "what do I do
 * now", which is the only question anybody opens a portal to ask.
 */

/** Today in clinic wall-clock terms — see the contract in availability.ts. */
function clinicTodayBounds() {
  const now = new Date(Date.now() + 330 * 60_000);
  const from = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  return { from, to: new Date(from.getTime() + 86_400_000), seed: from.toISOString().slice(0, 10) };
}

export default async function DoctorPortalHome() {
  const owner = await getOwnDoctor();
  if (!owner) {
    return (
      <EmptyState
        title="No doctor profile linked"
        description="Your account is not connected to a practice yet. Finish your onboarding, or ask an administrator to link you."
        action={
          <Link href="/doctor/join" className="btn-primary">
            Complete onboarding
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
  }));

  const live = rows.filter((r) => r.status !== "CANCELLED");

  return (
    <>
      <PageHeader
        title={`Good day, ${owner.name.split(" ")[0]}`}
        description={
          live.length === 0
            ? "Nothing booked for today."
            : `${live.length} ${live.length === 1 ? "appointment" : "appointments"} today.`
        }
        action={
          <Link href="/doctor/portal/calendar" className="btn-primary">
            Open calendar
          </Link>
        }
      />

      {awaiting > 0 && (
        <Link
          href="/doctor/portal/requests"
          className="mb-6 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 transition hover:bg-amber-100"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-amber-500 text-sm font-bold text-white">
            {awaiting}
          </span>
          <span className="text-sm text-amber-900">
            <strong className="font-bold">
              {awaiting === 1 ? "One booking needs" : `${awaiting} bookings need`} your
              confirmation.
            </strong>{" "}
            The {awaiting === 1 ? "slot is" : "slots are"} held until you decide.
          </span>
          <span className="ml-auto shrink-0 text-sm font-bold text-amber-800">Review →</span>
        </Link>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Upcoming" value={upcoming} />
        <Stat label="Completed" value={completed} />
        <Stat
          label={clinics === 1 ? "Location" : "Locations"}
          value={clinics}
          href="/doctor/portal/practice"
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="Nothing booked today"
          description="When a client books you, it appears here and on your calendar."
          action={
            <Link href="/doctor/portal/calendar" className="btn-primary">
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

function Stat({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href?: string;
}) {
  const inner = (
    <>
      <p className="text-3xl font-bold text-ink">{value}</p>
      <p className="mt-0.5 text-sm text-ink-muted">{label}</p>
    </>
  );
  return href ? (
    <Link
      href={href}
      className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-slate-300"
    >
      {inner}
    </Link>
  ) : (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">{inner}</div>
  );
}
