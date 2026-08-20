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

export const getMyAnalyses = cache(
  async (userId: string, limit = 10): Promise<AnalysisSummaryDTO[]> => {
    const rows = await prisma.skinAnalysis.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        scores: {
          where: { topRank: { not: null } },
          orderBy: { topRank: "asc" },
          include: { concern: { select: { key: true, label: true } } },
        },
      },
    });

    return rows.map((r) => ({
      id: r.id,
      overall: r.overall,
      skinType: r.skinType,
      estimatedAge: r.estimatedAge,
      createdAt: r.createdAt.toISOString(),
      topConcerns: r.scores.map((s) => ({
        key: s.concern.key,
        label: s.concern.label,
        score: s.score,
      })),
    }));
  }
);

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
