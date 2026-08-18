import Link from "next/link";
import { AppointmentStatus, ApprovalState } from "@prisma/client";

import { EmptyState, PageHeader } from "@/components/admin/ui";
import RequestList from "@/components/doctor/RequestList";
import { getOwnDoctor } from "@/lib/doctor/guard";
import { prisma } from "@/lib/prisma";
import { membersAmong } from "@/lib/subscription/membership";
import { swatchFor } from "@/components/doctor/clinicColors";

export const metadata = { title: "Requests" };
export const dynamic = "force-dynamic";

/**
 * Bookings waiting on the doctor.
 *
 * Every one of these is holding a slot that nobody else can take, so the
 * ordering is soonest-first: a request for tomorrow morning costs the clinic
 * far more to sit on than one for next month.
 */
export default async function RequestsPage() {
  const owner = await getOwnDoctor();
  if (!owner) {
    return (
      <EmptyState
        title="No doctor profile linked"
        description="Your account is not connected to a practice yet."
        action={
          <Link href="/doctor/join" className="btn-primary">
            Complete onboarding
          </Link>
        }
      />
    );
  }

  const rows = await prisma.appointment.findMany({
    where: {
      doctorId: owner.doctorId,
      approvalState: ApprovalState.AWAITING_DOCTOR,
      status: { not: AppointmentStatus.CANCELLED },
      scheduledAt: { gte: new Date() },
    },
    orderBy: { scheduledAt: "asc" },
    select: {
      id: true,
      scheduledAt: true,
      durationMin: true,
      mode: true,
      patientName: true,
      patientUserId: true,
      notes: true,
      isPriority: true,
      feeAtBooking: true,
      visitFee: true,
      createdAt: true,
      clinic: { select: { name: true, area: true, colorKey: true } },
    },
  });

  const members = await membersAmong(rows.map((r) => r.patientUserId));

  if (rows.length === 0) {
    return (
      <>
        <PageHeader
          title="Requests"
          description="Bookings waiting for you to accept or decline."
        />
        <EmptyState
          title="Nothing waiting"
          description={
            owner.requiresApproval
              ? "Every request has been dealt with. New ones appear here and hold their slot until you decide."
              : "You accept bookings automatically, so nothing needs reviewing. Turn manual confirmation on under My practice if you would rather vet each one."
          }
          action={
            <Link href="/doctor/portal/calendar" className="btn-primary">
              Open calendar
            </Link>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Requests"
        description={`${rows.length} ${
          rows.length === 1 ? "booking is" : "bookings are"
        } holding a slot until you decide. Soonest first.`}
      />
      <RequestList
        rows={rows.map((r) => ({
          id: r.id,
          daySeed: r.scheduledAt.toISOString().slice(0, 10),
          time: r.scheduledAt.toISOString().slice(11, 16),
          durationMin: r.durationMin || 30,
          mode: r.mode,
          patientName: r.patientName,
          notes: r.notes,
          isPriority: r.isPriority,
          isMember: r.patientUserId ? members.has(r.patientUserId) : false,
          feeInr: r.feeAtBooking + r.visitFee,
          requestedAt: r.createdAt.toISOString(),
          clinicName: r.clinic?.name ?? null,
          clinicArea: r.clinic?.area ?? null,
          clinicDot: swatchFor(r.clinic?.colorKey).dot,
        }))}
      />
    </>
  );
}
