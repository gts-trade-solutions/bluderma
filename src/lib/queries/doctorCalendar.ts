import { AppointmentStatus, ApprovalState } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { membersAmong } from "@/lib/subscription/membership";

/**
 * What the doctor's calendar needs to draw itself.
 *
 * One range query per view rather than one per day: a month is 42 cells, and
 * asking the database 42 times to render one screen is the difference between
 * a calendar that feels instant and one that does not.
 *
 * The Gold Collar badge is resolved for the whole page in a single IN query
 * (see membersAmong) instead of per row, for the same reason.
 *
 * TIMEZONE. Everything here follows the contract in queries/availability.ts:
 * clinic wall-clock time is stored labelled as UTC, so every boundary is
 * computed with the UTC accessors and never converted. Using local-time
 * accessors here would shift the whole grid by five and a half hours.
 */

export interface CalendarAppointment {
  id: string;
  /** "2026-08-18" — the day cell this belongs in. */
  daySeed: string;
  /** "14:30" */
  time: string;
  /** Minutes from midnight, for positioning in the day and week columns. */
  startMinute: number;
  durationMin: number;
  status: AppointmentStatus;
  approvalState: ApprovalState;
  mode: string;
  patientName: string;
  patientUserId: string | null;
  isPriority: boolean;
  isMember: boolean;
  hasMeetingUrl: boolean;
  clinicId: string | null;
  clinicName: string | null;
  clinicColor: string;
  feeInr: number;
}

export interface CalendarClinic {
  id: string;
  name: string;
  area: string;
  city: string;
  colorKey: string;
}

export interface CalendarData {
  appointments: CalendarAppointment[];
  clinics: CalendarClinic[];
  /** Bookings waiting on this doctor, whatever range is being viewed. */
  awaitingCount: number;
}

/** Midnight UTC on the given day seed. */
export function dayStart(daySeed: string): Date {
  return new Date(`${daySeed}T00:00:00.000Z`);
}

export function addDays(d: Date, n: number): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n)
  );
}

export function toDaySeed(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export type CalendarView = "month" | "week" | "day";

/**
 * The half-open range a view covers.
 *
 * A month view shows leading and trailing days from the neighbouring months so
 * the grid is always six full weeks — the range has to cover those too, or
 * appointments visibly vanish when they fall in the greyed-out cells.
 */
export function rangeFor(view: CalendarView, anchor: Date): { from: Date; to: Date } {
  if (view === "day") {
    const from = new Date(
      Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate())
    );
    return { from, to: addDays(from, 1) };
  }

  if (view === "week") {
    const from = addDays(anchor, -anchor.getUTCDay());
    return { from, to: addDays(from, 7) };
  }

  const firstOfMonth = new Date(
    Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1)
  );
  const from = addDays(firstOfMonth, -firstOfMonth.getUTCDay());
  return { from, to: addDays(from, 42) };
}

export async function getCalendarData(
  doctorId: string,
  from: Date,
  to: Date,
  clinicId?: string
): Promise<CalendarData> {
  const [rows, practices, awaitingCount] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        doctorId,
        scheduledAt: { gte: from, lt: to },
        ...(clinicId ? { clinicId } : {}),
      },
      orderBy: { scheduledAt: "asc" },
      select: {
        id: true,
        scheduledAt: true,
        durationMin: true,
        status: true,
        approvalState: true,
        mode: true,
        patientName: true,
        patientUserId: true,
        isPriority: true,
        meetingUrl: true,
        feeAtBooking: true,
        visitFee: true,
        clinicId: true,
        clinic: { select: { name: true, colorKey: true } },
      },
    }),
    prisma.doctorClinic.findMany({
      where: { doctorId, isActive: true, clinic: { isActive: true } },
      orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
      select: {
        clinic: {
          select: { id: true, name: true, area: true, city: true, colorKey: true },
        },
      },
    }),
    prisma.appointment.count({
      where: {
        doctorId,
        approvalState: ApprovalState.AWAITING_DOCTOR,
        status: { not: AppointmentStatus.CANCELLED },
        scheduledAt: { gte: new Date() },
      },
    }),
  ]);

  const members = await membersAmong(rows.map((r) => r.patientUserId));

  return {
    appointments: rows.map((r) => {
      const iso = r.scheduledAt.toISOString();
      return {
        id: r.id,
        daySeed: iso.slice(0, 10),
        time: iso.slice(11, 16),
        startMinute: r.scheduledAt.getUTCHours() * 60 + r.scheduledAt.getUTCMinutes(),
        durationMin: r.durationMin || 30,
        status: r.status,
        approvalState: r.approvalState,
        mode: r.mode,
        patientName: r.patientName,
        patientUserId: r.patientUserId,
        isPriority: r.isPriority,
        isMember: r.patientUserId ? members.has(r.patientUserId) : false,
        hasMeetingUrl: Boolean(r.meetingUrl),
        clinicId: r.clinicId,
        clinicName: r.clinic?.name ?? null,
        // A booking taken before multi-clinic support has no location; it
        // renders in a neutral swatch rather than borrowing another clinic's.
        clinicColor: r.clinic?.colorKey ?? "slate",
        feeInr: r.feeAtBooking + r.visitFee,
      };
    }),
    clinics: practices.map((p) => p.clinic),
    awaitingCount,
  };
}

/**
 * Everything the detail drawer shows about one appointment.
 *
 * Includes the client's own skin analysis history, which is the point of
 * opening it before a consultation — the doctor should not have to leave the
 * calendar to find out why someone is coming in.
 */
export async function getAppointmentDetail(doctorId: string, appointmentId: string) {
  const appt = await prisma.appointment.findFirst({
    where: { id: appointmentId, doctorId },
    select: {
      id: true,
      scheduledAt: true,
      durationMin: true,
      mode: true,
      status: true,
      approvalState: true,
      declineReason: true,
      isPriority: true,
      meetingUrl: true,
      notes: true,

      // The booking intake. This is the whole point of asking for it — the
      // doctor sees why the patient is coming before the patient arrives.
      reason: true,
      reasonDetail: true,
      symptomDuration: true,
      severity: true,
      isFirstVisit: true,
      priorTreatment: true,
      medications: true,
      allergies: true,
      photoConsent: true,
      patientAge: true,
      patientGender: true,
      skinAnalysisId: true,
      skinScanId: true,

      feeAtBooking: true,
      visitFee: true,
      discountInr: true,
      cancelReason: true,
      cancelledBy: true,
      rescheduleCount: true,
      patientUserId: true,
      patientName: true,
      patientEmail: true,
      patientPhone: true,
      createdAt: true,
      clinic: {
        select: { id: true, name: true, area: true, city: true, addressLine1: true, phone: true },
      },
      photos: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, url: true },
      },
    },
  });
  if (!appt) return null;

  // A guest booking taken over the phone has no account, so there is nothing
  // more to show. Say so rather than rendering empty panels.
  if (!appt.patientUserId) {
    return {
      appointment: appt,
      member: null,
      scans: [],
      history: [],
      profile: null,
      intake: null,
    };
  }

  /* ── The report the patient chose for THIS visit ──────────────────────
     `skinAnalysisId` was written at booking, selected in this query, and
     declared in the drawer's props — and never once read. The in-app
     analyser writes SkinAnalysis; the only scan the doctor was shown came
     from SkinScan, a different table filled by the external callback. So a
     patient could run an analysis, deliberately attach it to their booking,
     and the doctor would open the appointment and see nothing.

     Loaded by ID rather than "their most recent", because attaching is a
     choice: somebody with four analyses picked one to show, and showing them
     the newest instead quietly overrules that. */
  const [member, scans, history, profile, intake, attachedAnalysis] =
    await Promise.all([
    prisma.subscription
      .findFirst({
        where: {
          userId: appt.patientUserId,
          status: "ACTIVE",
          currentPeriodEnd: { gt: new Date() },
        },
        select: { currentPeriodEnd: true, plan: { select: { name: true } } },
      })
      .catch(() => null),
    prisma.skinScan.findMany({
      where: { userId: appt.patientUserId },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true,
        createdAt: true,
        summary: true,
        issues: {
          orderBy: { score: "desc" },
          take: 5,
          select: { issueType: true, score: true, severityBand: true },
        },
      },
    }),
    // Their history WITH THIS DOCTOR only. A doctor has no business reading
    // what a client did at an unrelated clinic.
    prisma.appointment.findMany({
      where: {
        doctorId,
        patientUserId: appt.patientUserId,
        id: { not: appt.id },
      },
      orderBy: { scheduledAt: "desc" },
      take: 5,
      select: { id: true, scheduledAt: true, status: true, mode: true },
    }),
    prisma.patientProfile.findUnique({
      where: { userId: appt.patientUserId },
      select: { fullName: true, age: true, gender: true, city: true, phone: true },
    }),
    // The consultation questionnaire. PatientProfile carries demographics
    // only, so skin history, current routine and health background live here —
    // and that is the half a clinician actually needs before the door opens.
    prisma.intakeResponse.findFirst({
      where: { userId: appt.patientUserId },
      orderBy: { createdAt: "desc" },
      select: { id: true, createdAt: true, answers: true, summary: true },
    }),
    appt.skinAnalysisId
      ? prisma.skinAnalysis.findFirst({
          // Scoped to the patient as well as the id. The id reached the
          // database through a booking form, and re-checking ownership here
          // costs nothing.
          where: { id: appt.skinAnalysisId, userId: appt.patientUserId },
          select: {
            id: true,
            createdAt: true,
            overall: true,
            skinType: true,
            estimatedAge: true,
            scores: {
              orderBy: { score: "desc" },
              take: 6,
              select: {
                score: true,
                concern: { select: { label: true } },
              },
            },
          },
        })
      : null,
  ]);

  return {
    appointment: appt,
    member,
    scans,
    history,
    profile,
    intake,
    attachedAnalysis,
  };
}
