/**
 * Sample content for the parts of My Profile that have no backend yet.
 *
 * Three of the nine sections — the wallet, Buy Now Pay Later, and saved
 * addresses — describe products that are not built. There is no `Wallet`
 * table, no credit provider integration and no address book; the page shows
 * them so the shape of the finished profile can be reviewed.
 *
 * The rule this file works under, and the reason it is a separate file at all:
 * **every panel it feeds is labelled `Sample` in the interface.** This codebase
 * has deleted invented figures before, and the difference between a mock-up
 * and a lie is whether the reader can tell which one they are looking at. When
 * the real tables arrive, the section swaps its import and the badge comes off
 * — nothing else about the page changes.
 *
 * Nothing here is per-user. It is the same illustration for everyone, which is
 * also a hint that it is not their data.
 */

export interface WalletMovement {
  id: string;
  label: string;
  detail: string;
  /** Positive is money in, negative is money spent. */
  amountInr: number;
  on: string;
}

export const DEMO_WALLET = {
  balanceInr: 2_450,
  /** Earned back on completed consultations and orders. */
  lifetimeCashbackInr: 5_180,
  /** Credit that expires if unused, kept separate from the cash balance. */
  expiringInr: 500,
  expiringOn: "30 Sep 2026",
  movements: [
    {
      id: "w1",
      label: "Cashback: consultation",
      detail: "5% back on your visit to Dr. Nithya Raghavan",
      amountInr: 70,
      on: "12 Aug 2026",
    },
    {
      id: "w2",
      label: "Paid: Niacinamide 10% Serum",
      detail: "Wallet used at checkout",
      amountInr: -1_120,
      on: "9 Aug 2026",
    },
    {
      id: "w3",
      label: "Referral credit",
      detail: "A friend booked their first consultation",
      amountInr: 500,
      on: "2 Aug 2026",
    },
    {
      id: "w4",
      label: "Cashback: order",
      detail: "Mineral Sunscreen SPF 50",
      amountInr: 119,
      on: "22 Jul 2026",
    },
    {
      id: "w5",
      label: "Refund: cancelled appointment",
      detail: "Cancelled by the clinic, refunded in full",
      amountInr: 1_400,
      on: "14 Jul 2026",
    },
  ] as WalletMovement[],
};

export interface PayLaterPlan {
  id: string;
  item: string;
  totalInr: number;
  paidInr: number;
  instalmentInr: number;
  instalmentsPaid: number;
  instalmentsTotal: number;
  nextDue: string;
}

export const DEMO_PAY_LATER = {
  /** What a course could be split across, if the client is approved. */
  approvedLimitInr: 60_000,
  usedInr: 18_000,
  /** No-cost EMI window, in months. */
  interestFreeMonths: 3,
  provider: "BluDerma Care Credit",
  plans: [
    {
      id: "bnpl1",
      item: "Acne scar resurfacing: 4 session course",
      totalInr: 24_000,
      paidInr: 12_000,
      instalmentInr: 4_000,
      instalmentsPaid: 3,
      instalmentsTotal: 6,
      nextDue: "5 Sep 2026",
    },
    {
      id: "bnpl2",
      item: "Laser hair reduction: full face",
      totalInr: 12_000,
      paidInr: 6_000,
      instalmentInr: 3_000,
      instalmentsPaid: 2,
      instalmentsTotal: 4,
      nextDue: "18 Sep 2026",
    },
  ] as PayLaterPlan[],
  howItWorks: [
    "Split any treatment course over ₹5,000 into three, six or nine instalments.",
    "Three months is at no cost. Longer terms carry the provider's own interest, shown before you agree.",
    "Approval is a soft check and takes about a minute. It does not affect your credit score.",
    "Instalments are collected automatically. Missing one is a provider charge, never a clinic one.",
  ],
};

export interface SavedAddress {
  id: string;
  label: string;
  line1: string;
  line2: string;
  pincode: string;
  isDefault: boolean;
  /** Home visits are only offered where a listed doctor travels. */
  homeVisitAvailable: boolean;
}

export const DEMO_ADDRESSES: SavedAddress[] = [
  {
    id: "a1",
    label: "Home",
    line1: "12/4 Rajaji Salai, Pallavaram",
    line2: "Chennai, Tamil Nadu",
    pincode: "600043",
    isDefault: true,
    homeVisitAvailable: true,
  },
  {
    id: "a2",
    label: "Work",
    line1: "Prestige Palladium, Greams Road",
    line2: "Chennai, Tamil Nadu",
    pincode: "600006",
    isDefault: false,
    homeVisitAvailable: false,
  },
];
