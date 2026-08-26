import { AppointmentStatus, SubscriptionStatus } from "@prisma/client";
import { cache } from "react";

import { prisma } from "@/lib/prisma";
import type {
  AppointmentRecord,
  ConsultedDoctor,
  DiscountRecord,
  Prescription,
  PaymentRecord,
  ProcedureRecord,
  Purchase,
  SkinReport,
} from "@/data/profile";
import { getMyAnalyses, getMyAppointments } from "./patient";
import { buildConditions, perksOf } from "./profileCore";

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
    /** "BLU-P-4K7M2Q". What a receptionist asks for on the phone. */
    publicId: string;
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
  /** Everything they have actually paid for. See PaymentRecord. */
  payments: PaymentRecord[];
  procedures: ProcedureRecord[];
  discounts: DiscountRecord[];
  /**
   * The client's live Gold Collar term, if any.
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

  /**
   * What this client is actually being treated for.
   *
   * Not a diagnosis and never presented as one — it is the two things the
   * client themselves told us: what their last scan scored worst, and what
   * they picked as the reason on each booking. Both are their own words in a
   * fixed vocabulary, which is exactly why they can be shown back to them.
   */
  conditions: {
    key: string;
    label: string;
    /** "Skin analysis" or "You told us at booking". */
    source: string;
    /** Bookings that named it, or the analysis score out of 100. */
    detail: string;
    /** 0-100, for the bar. */
    weight: number;
  }[];

  /** Every Gold Collar tier, so the member page can be read in full here. */
  plans: {
    slug: string;
    name: string;
    interval: string;
    priceInr: number;
    compareAtInr: number | null;
    discountPercent: number;
    scanCredits: number;
    priorityBooking: boolean;
    waiveCancellationFee: boolean;
    perks: string[];
  }[];

  /**
   * Listed locations. Ordered by distance on the client, where the visitor's
   * own position is known; otherwise in the directory's own order.
   */
  clinics: {
    id: string;
    name: string;
    area: string;
    city: string;
    addressLine1: string;
    pincode: string;
    phone: string | null;
    lat: number | null;
    lng: number | null;
  }[];
}

export const getProfilePageData = cache(
  async (userId: string): Promise<ProfilePageData> => {
    const [user, analyses, appts, rx, buys, pays, grants, membership, plans, reasonMix] =
      await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          publicId: true,
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
        include: {
          doctor: { select: { name: true } },
          items: { orderBy: { sortOrder: "asc" } },
        },
      }),
      prisma.purchase.findMany({
        where: { userId },
        orderBy: { orderedAt: "desc" },
      }),
      // Money. The admin console could see every payment and the person who
      // made them could see none of them.
      prisma.payment.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 40,
        select: {
          id: true,
          purpose: true,
          status: true,
          amountInr: true,
          refundedInr: true,
          createdAt: true,
          providerPaymentId: true,
          appointment: {
            select: {
              scheduledAt: true,
              doctor: { select: { name: true } },
            },
          },
        },
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
      prisma.subscriptionPlan.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: {
          slug: true,
          name: true,
          interval: true,
          priceInr: true,
          compareAtInr: true,
          discountPercent: true,
          scanCredits: true,
          priorityBooking: true,
          waiveCancellationFee: true,
          perks: true,
        },
      }),
      // What they came in for, in their own words from the booking form.
      prisma.appointment.groupBy({
        by: ["reason"],
        where: { patientUserId: userId, status: { not: AppointmentStatus.CANCELLED } },
        _count: { _all: true },
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
      doctor: p.doctor?.name ?? "BluDerma doctor",
      fileUrl: p.fileUrl,
      // The lines as the doctor wrote them, each reading as an instruction
      // rather than a name: "Tretinoin 0.025% — thin layer at night — 12
      // weeks". Older prescriptions have no lines at all, and fall back to
      // the title and note they were written as.
      items: p.items.length
        ? p.items.map((i) =>
            [
              [i.name, i.strength].filter(Boolean).join(" "),
              i.dose,
              i.duration,
            ]
              .filter(Boolean)
              .join(" — ")
          )
        : [p.title, ...(p.notes ? [p.notes] : [])],
      validTill: "—",
    }));

    const payments: PaymentRecord[] = pays.map((p) => {
      const what =
        p.purpose === "APPOINTMENT"
          ? p.appointment?.doctor.name
            ? `Consultation with ${p.appointment.doctor.name}`
            : "Consultation"
          : p.purpose === "SKIN_SCAN"
            ? "Skin analysis"
            : p.purpose === "SUBSCRIPTION"
              ? "Gold Collar membership"
              : "Gift card";

      // Four states, told apart properly. A partial refund shown as "Refunded"
      // is the kind of thing somebody rings about.
      const status: PaymentRecord["status"] =
        p.status === "REFUNDED" || (p.refundedInr ?? 0) >= p.amountInr
          ? "Refunded"
          : (p.refundedInr ?? 0) > 0
            ? "Partly refunded"
            : p.status === "PAID"
              ? "Paid"
              : p.status === "FAILED"
                ? "Failed"
                : "Pending";

      return {
        id: p.id,
        date: fmt(p.createdAt),
        what,
        amountInr: p.amountInr,
        refundedInr: p.refundedInr ?? 0,
        status,
        reference: p.providerPaymentId,
      };
    });

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

    // ── What they are being treated for ─────────────────────────────────
    // Derived in profileCore so it can be proved by a tsx script — this
    // module's `cache()` wrapper makes it unimportable from one. The rule it
    // enforces: every entry names the client's own source, and none of it is
    // presented as a diagnosis.
    const conditions = buildConditions(
      analyses[0]
        ? { createdAt: analyses[0].createdAt, topConcerns: analyses[0].topConcerns }
        : null,
      reasonMix.map((r) => ({ reason: r.reason, count: r._count._all })),
      fmt
    );

    // Listed locations in their city. Coordinates come along so the list can
    // be ordered by how near each one actually is: the visitor's own position
    // lives in localStorage, so the ordering happens on the client, and this
    // query only has to supply the points.
    //
    // Not filtered to the city when we have coordinates for everything, since
    // the nearest clinic to somebody on a city boundary can easily be in the
    // next one, and a directory that hides it is worse than a longer list.
    const city = user.patientProfile?.city ?? "";
    const clinics = await prisma.clinic.findMany({
      where: {
        isActive: true,
        ...(city ? { city: { equals: city } } : {}),
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      take: 6,
      select: {
        id: true,
        name: true,
        area: true,
        city: true,
        addressLine1: true,
        pincode: true,
        phone: true,
        lat: true,
        lng: true,
      },
    });

    return {
      client: {
        name: user.patientProfile?.fullName ?? user.name ?? "Client",
        publicId: user.publicId ?? "",
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
      payments,
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

      conditions,
      plans: plans.map((p) => ({ ...p, perks: perksOf(p.perks) })),
      clinics,
    };
  }
);
