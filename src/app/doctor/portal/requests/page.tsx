import Link from "next/link";
import { AppointmentStatus, ApprovalState } from "@prisma/client";

import {
  Empty,
  PageHead,
  portalBtnPrimary,
} from "@/components/doctor/portalUi";
import RequestList from "@/components/doctor/RequestList";
import { getOwnDoctor } from "@/lib/doctor/guard";
import { prisma } from "@/lib/prisma";
import { membersAmong } from "@/lib/subscription/membership";
import { swatchFor } from "@/components/doctor/clinicColors";
import { intakeSummary, isUrgent } from "@/lib/booking/visitIntake";

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
      <Empty
        title="No doctor profile linked"
        body="Your account is not connected to a practice yet."
        action={
          <Link href="/doctor/join" className={portalBtnPrimary}>
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
      reason: true,
      reasonDetail: true,
      symptomDuration: true,
      severity: true,
      isFirstVisit: true,
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
        <PageHead
          title="Requests"
          sub="Bookings waiting for you to accept or decline."
        />
        <Empty
          title="Nothing waiting"
          body={
            owner.requiresApproval
              ? "Every request has been dealt with. New ones appear here and hold their slot until you decide."
              : "You accept bookings automatically, so nothing needs reviewing. Turn manual confirmation on under My practice if you would rather vet each one."
          }
          action={
            <Link href="/doctor/portal/calendar" className={portalBtnPrimary}>
              Open calendar
            </Link>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHead
        title="Requests"
        sub={`${rows.length} ${
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
          reasonSummary: r.reason
            ? intakeSummary({
                reason: r.reason,
                symptomDuration: r.symptomDuration,
                severity: r.severity,
                isFirstVisit: r.isFirstVisit,
              })
            : null,
          reasonDetail: r.reasonDetail,
          urgent: isUrgent(r.severity),
        }))}
      />
    </>
  );
}
