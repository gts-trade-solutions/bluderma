import { cache } from "react";

import { prisma } from "@/lib/prisma";
import {
  outstanding,
  readSettings,
  toPlan,
  SETTING_KEYS,
  type PayLaterPlan,
  type PayLaterSettings,
} from "./payLaterCore";

export type { PayLaterPlan, PayLaterSettings };

/**
 * The instalment programme, and what this client has running on it.
 *
 * ── Why it is settings-gated and off by default ──────────────────────────
 * The section this feeds used to be DEMO_PAY_LATER: an "approved limit of
 * ₹60,000 through BluDerma Care Credit", plus two courses the client was
 * apparently halfway through paying for. None of it existed.
 *
 * That is a different order of problem from a mock wallet balance. A credit
 * limit is a statement about money somebody can borrow, shown to a person
 * deciding whether they can afford treatment, and it named a lender that does
 * not exist. So the programme is off until an admin turns it on, and turning it
 * on requires naming the provider.
 *
 * With the programme off the profile says so. With it on and no plans it shows
 * the terms and nothing else. Neither state invents a figure.
 *
 * The rules live in payLaterCore so a verify script can reach them: `cache()`
 * at module level cannot be imported under tsx.
 */

export interface PayLater extends PayLaterSettings {
  plans: PayLaterPlan[];
  outstandingInr: number;
}

export const getPayLaterSettings = cache(
  async (): Promise<PayLaterSettings> => {
    const rows = await prisma.siteSetting.findMany({
      where: { key: { in: Object.values(SETTING_KEYS) } },
      select: { key: true, value: true },
    });
    return readSettings(rows);
  }
);

export async function getPayLater(userId: string): Promise<PayLater> {
  const settings = await getPayLaterSettings();

  // Plans are read whether or not the programme is currently open: somebody
  // part-way through paying must keep seeing what they owe even if the clinic
  // has stopped offering new agreements.
  const rows = await prisma.instalmentPlan.findMany({
    where: { userId },
    orderBy: [{ settledAt: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      item: true,
      provider: true,
      totalInr: true,
      instalmentInr: true,
      instalmentsPaid: true,
      instalmentsTotal: true,
      nextDueAt: true,
      settledAt: true,
    },
  });

  const plans = rows.map(toPlan);
  return { ...settings, plans, outstandingInr: outstanding(plans) };
}
