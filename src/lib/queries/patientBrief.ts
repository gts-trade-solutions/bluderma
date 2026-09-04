import { AppointmentStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { reasonLabel } from "@/lib/booking/visitIntake";
import type { PatientBriefData } from "@/components/doctor/PatientBrief";

/**
 * Everything a doctor needs about a patient in order to plan for them.
 *
 * Assembled here rather than in the page because two screens want it — the
 * treatment plan and, next, anywhere else a decision is made about somebody
 * without their record open.
 *
 * ── Scoped to this practice, on every branch ─────────────────────────────
 * Visits, prescriptions, care sheets and plans are all filtered by doctorId.
 * A patient's history at another clinic is that clinician's record; the chart
 * and the appointment drawer already draw exactly this line, and a planning
 * panel is not the place to start blurring it.
 *
 * ── Snapshots, not joins, for the clinical facts ─────────────────────────
 * Allergies, medication and the reason come off the most recent APPOINTMENT
 * rather than a profile, because that is what the patient said at the time and
 * what the doctor was told. A profile edited next year must not silently
 * rewrite the history of a consultation.
 */
export async function getPatientBrief(
  doctorId: string,
  patientUserId: string
): Promise<PatientBriefData | null> {
  const now = new Date();

  const [user, profile, appts, latestIntake, scan, analysis, prescriptions, sheets, plans] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: patientUserId },
        select: { name: true, publicId: true },
      }),
      prisma.patientProfile.findUnique({
        where: { userId: patientUserId },
        select: { age: true, gender: true, city: true, phone: true },
      }),
      prisma.appointment.findMany({
        where: { doctorId, patientUserId },
        orderBy: { scheduledAt: "desc" },
        select: {
          scheduledAt: true,
          status: true,
          patientPhone: true,
          patientAge: true,
          patientGender: true,
        },
      }),
      // The newest booking that actually carries intake answers. The newest
      // booking full stop may be one taken over the phone with none.
      prisma.appointment.findFirst({
        where: {
          doctorId,
          patientUserId,
          OR: [
            { allergies: { not: null } },
            { medications: { not: null } },
            { reason: { not: null } },
          ],
        },
        orderBy: { scheduledAt: "desc" },
        select: { allergies: true, medications: true, reason: true },
      }),
      prisma.skinScan.findFirst({
        where: { userId: patientUserId },
        orderBy: { createdAt: "desc" },
        select: {
          createdAt: true,
          issues: {
            orderBy: { score: "desc" },
            take: 5,
            select: { issueType: true, score: true, severityBand: true },
          },
        },
      }),
      // The other analyser. Whichever is newer wins; see the note in
      // queries/doctorCalendar about this app having two.
      prisma.skinAnalysis.findFirst({
        where: { userId: patientUserId },
        orderBy: { createdAt: "desc" },
        select: {
          createdAt: true,
          scores: {
            orderBy: { score: "desc" },
            take: 5,
            select: { score: true, concern: { select: { label: true } } },
          },
        },
      }),
      prisma.prescription.findMany({
        where: { doctorId, userId: patientUserId },
        orderBy: { issuedAt: "desc" },
        take: 3,
        select: {
          id: true,
          title: true,
          issuedAt: true,
          items: { take: 4, select: { name: true } },
        },
      }),
      prisma.aftercareSheet.findMany({
        where: { doctorId, patientUserId },
        orderBy: { issuedAt: "desc" },
        take: 3,
        select: { id: true, kind: true, procedure: true, issuedAt: true },
      }),
      prisma.treatmentPlan.findMany({
        where: { doctorId, patientUserId },
        orderBy: { createdAt: "desc" },
        take: 4,
        select: {
          id: true,
          createdAt: true,
          sharedAt: true,
          items: { where: { state: "ACCEPTED" }, select: { id: true } },
        },
      }),
    ]);

  if (!user) return null;

  const day = (d: Date) =>
    d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  const past = appts.filter((a) => a.scheduledAt <= now);
  const ahead = appts.filter(
    (a) => a.scheduledAt > now && a.status !== AppointmentStatus.CANCELLED
  );

  // Age and sex off the profile if it has them, off the booking if not: a
  // guest-turned-account has the second and not the first.
  const snapshot = appts.find((a) => a.patientAge !== null || a.patientGender !== null);

  const useScan =
    scan && (!analysis || scan.createdAt >= analysis.createdAt) ? scan : null;
  const concerns = useScan
    ? useScan.issues.map((i) => ({
        label: i.issueType.replace(/_/g, " "),
        score: i.score,
        band: i.severityBand,
      }))
    : (analysis?.scores ?? []).map((s) => ({
        label: s.concern.label,
        score: s.score,
        band: null,
      }));

  return {
    userId: patientUserId,
    name: user.name ?? "Client",
    publicId: user.publicId,
    age: profile?.age ?? snapshot?.patientAge ?? null,
    gender: profile?.gender ?? snapshot?.patientGender ?? null,
    city: profile?.city ?? null,
    phone: profile?.phone ?? appts.find((a) => a.patientPhone)?.patientPhone ?? null,
    allergies: latestIntake?.allergies ?? null,
    medications: latestIntake?.medications ?? null,
    reason: latestIntake?.reason ? reasonLabel(latestIntake.reason) ?? null : null,
    visits: appts.length,
    completed: past.filter((a) => a.status === AppointmentStatus.COMPLETED).length,
    cancelled: appts.filter((a) => a.status === AppointmentStatus.CANCELLED).length,
    noShows: appts.filter((a) => a.status === AppointmentStatus.NO_SHOW).length,
    lastVisit: past[0] ? day(past[0].scheduledAt) : null,
    nextVisit: ahead.length ? day(ahead[ahead.length - 1].scheduledAt) : null,
    concerns,
    analysedOn: useScan
      ? day(useScan.createdAt)
      : analysis
        ? day(analysis.createdAt)
        : null,
    prescriptions: prescriptions.map((p) => ({
      id: p.id,
      title: p.title,
      on: day(p.issuedAt),
      lines: p.items.map((i) => i.name),
    })),
    sheets: sheets.map((x) => ({
      id: x.id,
      kind: x.kind,
      procedure: x.procedure,
      on: day(x.issuedAt),
    })),
    otherPlans: plans.map((p) => ({
      id: p.id,
      on: day(p.createdAt),
      shared: p.sharedAt !== null,
      accepted: p.items.length,
    })),
  };
}
