import { SubscriptionStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { NO_BENEFITS, type MembershipBenefits } from "./plan";

/**
 * Gold Collar — the data half.
 *
 * A membership is "active" when its status says so AND its paid term has not
 * run out. Both conditions are checked on read rather than relying on a job to
 * flip expired rows, because a lapsed member must lose their discount the
 * moment the term ends, not the next time a cron happens to run.
 */

export interface Membership {
  id: string;
  planId: string;
  planName: string;
  currentPeriodEnd: Date;
  benefits: MembershipBenefits;
}

const activeWhere = (userId: string, now: Date) => ({
  userId,
  status: SubscriptionStatus.ACTIVE,
  currentPeriodEnd: { gt: now },
});

/**
 * The caller's live membership, or null.
 *
 * Deliberately NOT wrapped in React's cache(): this is imported by server
 * actions and API routes as well as by rendered pages, and a module-level
 * cache() call breaks under plain Node (see queries/doctorAccess.ts).
 */
export async function getMembership(
  userId: string | null | undefined
): Promise<Membership | null> {
  if (!userId) return null;

  const row = await prisma.subscription.findFirst({
    where: activeWhere(userId, new Date()),
    orderBy: { currentPeriodEnd: "desc" },
    select: {
      id: true,
      planId: true,
      currentPeriodEnd: true,
      plan: {
        select: {
          name: true,
          discountPercent: true,
          scanCredits: true,
          priorityBooking: true,
          waiveCancellationFee: true,
        },
      },
    },
  });
  if (!row) return null;

  return {
    id: row.id,
    planId: row.planId,
    planName: row.plan.name,
    currentPeriodEnd: row.currentPeriodEnd,
    benefits: {
      discountPercent: row.plan.discountPercent,
      scanCredits: row.plan.scanCredits,
      priorityBooking: row.plan.priorityBooking,
      waiveCancellationFee: row.plan.waiveCancellationFee,
    },
  };
}

/** Cheap existence check for the places that only need a yes or no. */
export async function hasActiveMembership(
  userId: string | null | undefined
): Promise<boolean> {
  if (!userId) return false;
  const n = await prisma.subscription.count({
    where: activeWhere(userId, new Date()),
    take: 1,
  });
  return n > 0;
}

export function benefitsOf(membership: Membership | null): MembershipBenefits {
  return membership?.benefits ?? NO_BENEFITS;
}

/**
 * Which of a set of clients hold a membership.
 *
 * The doctor portal shows a badge beside every client in a list; asking per
 * row would be a query per appointment. One IN query answers the whole page.
 */
export async function membersAmong(
  userIds: (string | null | undefined)[]
): Promise<Set<string>> {
  const ids = [...new Set(userIds.filter((v): v is string => Boolean(v)))];
  if (ids.length === 0) return new Set();

  const rows = await prisma.subscription.findMany({
    where: {
      userId: { in: ids },
      status: SubscriptionStatus.ACTIVE,
      currentPeriodEnd: { gt: new Date() },
    },
    select: { userId: true },
  });
  return new Set(rows.map((r) => r.userId));
}
