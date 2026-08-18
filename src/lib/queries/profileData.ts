import { AppointmentStatus, SubscriptionStatus } from "@prisma/client";
import { cache } from "react";

import { prisma } from "@/lib/prisma";
import type {
  AppointmentRecord,
  ConsultedDoctor,
  DiscountRecord,
  Prescription,
  ProcedureRecord,
  Purchase,
  SkinReport,
} from "@/data/profile";
import { getMyAnalyses, getMyAppointments } from "./patient";

/**
 * The My Profile page's seven sections, from the database, in the exact
 * shapes the page was originally built against in `@/data/profile` — that
 * file kept its interfaces as the contract, so the page swaps imports
 * instead of being rewritten.
 *
 * Procedures are not their own table: a completed appointment IS the record
 * that a procedure happened, so they derive from appointment history.
 */

const fmt = (d: Date | string) => {
  const at = typeof d === "string" ? new Date(d) : d;
  return at.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
};

export interface ProfilePageData {
  client: {
    name: string;
    email: string;
    phone: string;
    city: string;
    skinType: string;
    since: string;
  };
  skinReports: SkinReport[];
  appointments: AppointmentRecord[];
  consultedDoctors: ConsultedDoctor[];
  prescriptions: Prescription[];
  purchases: Purchase[];
  procedures: ProcedureRecord[];
  discounts: DiscountRecord[];
  /**
   * The client's live White Collar term, if any.
   *
   * Shown on their own profile and — via getDoctorAppointments — beside their
   * name in the doctor portal, which is the requirement: the treating doctor
   * should be able to see at a glance that this is a member.
   */
  membership: {
    planName: string;
    endsOn: string;
    discountPercent: number;
    daysLeft: number;
  } | null;
}

export const getProfilePageData = cache(
  async (userId: string): Promise<ProfilePageData> => {
    const [user, analyses, appts, rx, buys, grants, membership] = await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          name: true,
          email: true,
          phone: true,
          createdAt: true,
          patientProfile: { select: { city: true, fullName: true } },
        },
      }),
      getMyAnalyses(userId, 20),
      getMyAppointments(userId),
      prisma.prescription.findMany({
        where: { userId },
        orderBy: { issuedAt: "desc" },
        include: { doctor: { select: { name: true } } },
      }),
      prisma.purchase.findMany({
        where: { userId },
        orderBy: { orderedAt: "desc" },
      }),
      prisma.discountGrant.findMany({
        where: { userId, usedAt: { not: null } },
        orderBy: { usedAt: "desc" },
      }),
          prisma.subscription.findFirst({
        where: {
          userId,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodEnd: { gt: new Date() },
        },
        orderBy: { currentPeriodEnd: "desc" },
        select: {
          currentPeriodEnd: true,
          plan: { select: { name: true, discountPercent: true } },
        },
      }),
    ]);

    const skinReports: SkinReport[] = analyses.map((a) => ({
      id: a.id,
      date: fmt(a.createdAt),
      score: a.overall,
      skinType: a.skinType,
      topConcerns: a.topConcerns.map((c) => c.label),
    }));

    const appointments: AppointmentRecord[] = appts.map((a) => ({
      id: a.id,
      doctor: a.doctorName,
      specialty: a.specialty,
      date: `${a.dateLabel}, ${a.dateSub}`,
      time: a.time,
      mode:
        a.mode === "video"
          ? "Video"
          : a.mode === "home"
          ? "Home visit"
          : "In clinic",
      status:
        a.status === AppointmentStatus.CANCELLED
          ? "Cancelled"
          : a.isPast || a.status === AppointmentStatus.COMPLETED
          ? "Completed"
          : "Upcoming",
    }));

    // Doctors seen: every doctor with at least one non-cancelled appointment,
    // most recent first.
    const seen = new Map<string, ConsultedDoctor>();
    for (const a of appts) {
      if (a.status === AppointmentStatus.CANCELLED) continue;
      const prev = seen.get(a.doctorSlug);
      if (prev) {
        prev.visits += 1;
      } else {
        seen.set(a.doctorSlug, {
          id: a.doctorSlug,
          name: a.doctorName,
          specialty: a.specialty,
          image: a.image,
          visits: 1,
          lastSeen: `${a.dateLabel}, ${a.dateSub}`,
        });
      }
    }

    const prescriptions: Prescription[] = rx.map((p) => ({
      id: p.id,
      issued: fmt(p.issuedAt),
      doctor: p.doctor?.name ?? "BluDerma clinician",
      items: [p.title, ...(p.notes ? [p.notes] : [])],
      validTill: "—",
    }));

    const purchases: Purchase[] = buys.map((b) => ({
      id: b.id,
      date: fmt(b.orderedAt),
      item: b.quantity > 1 ? `${b.itemName} × ${b.quantity}` : b.itemName,
      kind: "Product",
      amount: b.amountInr ?? 0,
      status:
        b.status === "DELIVERED"
          ? "Delivered"
          : b.status === "SHIPPED"
          ? "Shipped"
          : "Processing",
    }));

    const procedures: ProcedureRecord[] = appts
      .filter((a) => a.status === AppointmentStatus.COMPLETED)
      .map((a) => ({
        id: a.id,
        name: "Consultation",
        category: a.specialty,
        date: `${a.dateLabel}, ${a.dateSub}`,
        sessions: "1 session",
        doctor: a.doctorName,
      }));

    const discounts: DiscountRecord[] = grants.map((g) => ({
      id: g.id,
      label: g.code,
      detail: g.description,
      usedOn: g.usedAt ? fmt(g.usedAt) : "—",
      saved: g.amountOffInr
        ? `₹${g.amountOffInr.toLocaleString("en-IN")}`
        : g.percentOff
        ? `${g.percentOff}%`
        : "—",
    }));

    return {
      client: {
        name: user.patientProfile?.fullName ?? user.name ?? "Client",
        email: user.email,
        phone: user.phone ?? "",
        city: user.patientProfile?.city ?? "",
        // The latest analysis is the source of truth for skin type.
        skinType: analyses[0]?.skinType ?? "",
        since: (typeof user.createdAt === "string"
          ? new Date(user.createdAt)
          : user.createdAt
        ).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }),
      },
      skinReports,
      appointments,
      consultedDoctors: Array.from(seen.values()),
      prescriptions,
      purchases,
      procedures,
      discounts,
      membership: membership
        ? {
            planName: membership.plan.name,
            endsOn: membership.currentPeriodEnd.toISOString().slice(0, 10),
            discountPercent: membership.plan.discountPercent,
            // Rounded up, because "0 days left" on the last day of a term a
            // member has paid for reads as already expired.
            daysLeft: Math.max(
              0,
              Math.ceil(
                (membership.currentPeriodEnd.getTime() - Date.now()) / 86_400_000
              )
            ),
          }
        : null,
    };
  }
);
