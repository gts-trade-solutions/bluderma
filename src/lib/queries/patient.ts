import { AppointmentStatus } from "@prisma/client";
import { cache } from "react";

import { prisma } from "@/lib/prisma";
import { intakeSummary } from "@/lib/booking/visitIntake";

export interface AppointmentDTO {
  id: string;
  doctorSlug: string;
  doctorName: string;
  specialty: string;
  image: string;
  clinic: string;
  location: string;
  /** YYYY-MM-DD */
  daySeed: string;
  /** HH:MM */
  time: string;
  dateLabel: string;
  dateSub: string;
  mode: "clinic" | "video" | "home";
  status: AppointmentStatus;
  fee: number;
  patientName: string;
  patientPhone: string | null;
  isPast: boolean;
  /** How many times it has been moved — the policy caps this. */
  rescheduleCount: number;
  /** True once the client has reviewed it, so we stop asking. */
  hasReview: boolean;
  /** Charged when it was cancelled late. */
  cancellationFeeInr: number;
  /** What the patient told the clinic at booking. Null for older bookings. */
  reasonSummary: string | null;
  reasonDetail: string | null;
  reportAttached: boolean;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const WEEKDAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

/** Human labels for a stored instant, using the same UTC anchor as booking. */
function labelsFor(at: Date, now: Date) {
  const daySeed = at.toISOString().slice(0, 10);
  const todaySeed = now.toISOString().slice(0, 10);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const label =
    daySeed === todaySeed
      ? "Today"
      : daySeed === tomorrow
      ? "Tomorrow"
      : WEEKDAYS[at.getUTCDay()];

  return {
    daySeed,
    time: at.toISOString().slice(11, 16),
    dateLabel: label,
    dateSub: `${at.getUTCDate()} ${MONTHS[at.getUTCMonth()]}`,
  };
}

export const getMyAppointments = cache(
  async (userId: string): Promise<AppointmentDTO[]> => {
    const rows = await prisma.appointment.findMany({
      where: { patientUserId: userId },
      orderBy: { scheduledAt: "desc" },
      include: {
        doctor: {
          select: {
            slug: true,
            name: true,
            specialty: true,
            image: true,
            clinic: true,
            location: true,
          },
        },
        // Only whether one exists — enough to stop asking for a review.
        review: { select: { id: true } },
      },
    });

    const now = new Date();
    return rows.map((r) => ({
      id: r.id,
      doctorSlug: r.doctor.slug,
      doctorName: r.doctor.name,
      specialty: r.doctor.specialty,
      image: r.doctor.image,
      clinic: r.doctor.clinic,
      location: r.doctor.location,
      ...labelsFor(r.scheduledAt, now),
      mode: r.mode === "VIDEO" ? "video" : r.mode === "HOME" ? "home" : "clinic",
      status: r.status,
      fee: r.feeAtBooking,
      patientName: r.patientName,
      patientPhone: r.patientPhone,
      isPast: r.scheduledAt.getTime() < now.getTime(),
      rescheduleCount: r.rescheduleCount,
      hasReview: !!r.review,
      cancellationFeeInr: r.cancellationFeeInr,
      // Shown back to the patient so they can see what the doctor was told —
      // and correct it by calling if it is wrong.
      reasonSummary: r.reason
        ? intakeSummary({
            reason: r.reason,
            symptomDuration: r.symptomDuration,
            severity: r.severity,
            isFirstVisit: r.isFirstVisit,
          })
        : null,
      reasonDetail: r.reasonDetail,
      reportAttached: Boolean(r.skinAnalysisId || r.skinScanId),
    }));
  }
);

export interface ProfileDTO {
  fullName: string;
  email: string;
  phone: string;
  age: string;
  gender: string;
  city: string;
}

export const getMyProfile = cache(
  async (userId: string): Promise<ProfileDTO> => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        phone: true,
        patientProfile: true,
      },
    });

    const p = user?.patientProfile;
    return {
      fullName: p?.fullName ?? user?.name ?? "",
      email: user?.email ?? "",
      phone: p?.phone ?? user?.phone ?? "",
      age: p?.age != null ? String(p.age) : "",
      gender: p?.gender ?? "",
      city: p?.city ?? "",
    };
  }
);

export interface AnalysisSummaryDTO {
  id: string;
  overall: number;
  skinType: string;
  estimatedAge: number;
  createdAt: string;
  topConcerns: { key: string; label: string; score: number }[];
}

/**
 * Every skin report this client has, newest first.
 *
 * ── Why this reads SkinScan and not SkinAnalysis ─────────────────────────
 * There are two tables. `SkinAnalysis` is the older in-app analyser;
 * `SkinScan` is what the live analyser writes back through
 * /api/skin/callback, and it is the table `/patient/skin-analysis/[id]`
 * reads to render a report.
 *
 * This function read the OTHER one. So a client could run a scan, open the
 * report, see their score and their twelve concerns — and their profile
 * would say "My reports 0" and offer to run their first analysis. Worse, the
 * profile links each row to `/patient/skin-analysis/{id}/report`, which
 * resolves a SkinScan id; the ids this returned could never have loaded
 * there even when the count was non-zero.
 *
 * Legacy SkinAnalysis rows are deliberately not merged in. They have no
 * report page — that route has only ever resolved scans — so listing them
 * would produce rows that 404 when tapped. Every such row in this database
 * belongs to a seeded account.
 *
 * ── The shape is unchanged ───────────────────────────────────────────────
 * The analyser returns its headline figures in a summary JSON rather than in
 * columns, so they are read out of it here and mapped onto the same DTO the
 * page already renders. Callers do not change.
 */
export const getMyAnalyses = cache(
  async (userId: string, limit = 10): Promise<AnalysisSummaryDTO[]> => {
    const rows = await prisma.skinScan.findMany({
      where: { userId, status: "done" },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        createdAt: true,
        summary: true,
        issues: {
          orderBy: { score: "desc" },
          take: 4,
          select: { issueType: true, score: true },
        },
      },
    });

    return rows.map((r) => {
      const summary = (r.summary ?? {}) as {
        overall?: number | null;
        skin_type?: string | null;
        skin_age?: number | null;
      };
      return {
        id: r.id,
        // A score of 0 is a real reading; only a missing one falls back.
        overall: typeof summary.overall === "number" ? Math.round(summary.overall) : 0,
        skinType: summary.skin_type ?? "—",
        estimatedAge: typeof summary.skin_age === "number" ? Math.round(summary.skin_age) : 0,
        createdAt: r.createdAt.toISOString(),
        topConcerns: r.issues.map((i) => ({
          key: i.issueType,
          label: concernLabel(i.issueType),
          score: i.score === null ? 0 : Math.round(i.score),
        })),
      };
    });
  }
);

/** "dark_circles" -> "Dark circles". The analyser names issues in snake_case. */
function concernLabel(issueType: string): string {
  const words = issueType.replace(/_/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Full score set for one analysis — used by the compare view. */
export const getAnalysisScores = cache(
  async (analysisId: string, userId: string) => {
    const row = await prisma.skinAnalysis.findFirst({
      where: { id: analysisId, userId },
      include: {
        scores: { include: { concern: { select: { key: true, label: true } } } },
      },
    });
    if (!row) return null;
    return {
      id: row.id,
      overall: row.overall,
      createdAt: row.createdAt.toISOString(),
      scores: row.scores.map((s) => ({
        key: s.concern.key,
        label: s.concern.label,
        score: s.score,
      })),
    };
  }
);
