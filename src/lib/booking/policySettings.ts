import { cache } from "react";

import { prisma } from "@/lib/prisma";
import { POLICY_DEFAULTS, type BookingPolicy } from "./policy";

/**
 * Reads the booking policy from admin settings.
 *
 * Split from the policy logic itself so the decisions stay pure and testable —
 * this half is the only part that touches the database.
 */

const KEYS = {
  freeHours: "booking.cancel_free_hours",
  feeInr: "booking.cancel_fee_inr",
  contactHours: "booking.cancel_contact_hours",
  maxReschedules: "booking.max_reschedules",
  rescheduleMinHours: "booking.reschedule_min_hours",
  receptionPhone: "booking.reception_phone",
} as const;

export const getBookingPolicy = cache(async (): Promise<BookingPolicy> => {
  const rows = await prisma.siteSetting.findMany({
    where: { key: { in: Object.values(KEYS) } },
    select: { key: true, value: true },
  });
  const map = new Map(rows.map((r) => [r.key, r.value ?? ""]));

  const num = (key: string, fallback: number) => {
    const n = Number(map.get(key));
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };

  return {
    freeHours: num(KEYS.freeHours, POLICY_DEFAULTS.freeHours),
    feeInr: num(KEYS.feeInr, POLICY_DEFAULTS.feeInr),
    contactHours: num(KEYS.contactHours, POLICY_DEFAULTS.contactHours),
    maxReschedules: num(KEYS.maxReschedules, POLICY_DEFAULTS.maxReschedules),
    rescheduleMinHours: num(
      KEYS.rescheduleMinHours,
      POLICY_DEFAULTS.rescheduleMinHours
    ),
    receptionPhone: map.get(KEYS.receptionPhone) || POLICY_DEFAULTS.receptionPhone,
  };
});
