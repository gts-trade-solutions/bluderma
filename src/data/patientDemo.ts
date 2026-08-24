/**
 * Sample content for the parts of My Profile that have no backend yet.
 *
 * Three of the nine sections — the wallet, Buy Now Pay Later, and saved
 * addresses — describe products that are not built. There is no `Wallet`
 * table, no credit provider integration and no address book; the page shows
 * them so the shape of the finished profile can be reviewed.
 *
 * The rule this file works under, and the reason it is a separate file at all:
 * the panels it feeds are labelled `Sample` in the interface. This codebase has
 * deleted invented figures before, and the difference between a mock-up and a
 * lie is whether the reader can tell which one they are looking at. When the
 * real tables arrive, the section swaps its import and the badge comes off,
 * and nothing else about the page changes.
 *
 * ONE EXCEPTION, and it is deliberate: the wallet's badge was removed by
 * request, so `DEMO_WALLET` now renders as though it were a live balance.
 * That makes it the entry here with the shortest fuse. A client who reads
 * a spendable figure and cannot spend it has been misled, so this is the
 * first thing to put behind a real table.
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

/*
 * PayLaterPlan and DEMO_PAY_LATER lived here and are gone.
 *
 * They are a real table now (InstalmentPlan), gated behind settings that are
 * off until an admin names an actual lender. See src/lib/queries/payLater.ts.
 *
 * Of the three mocks on this page it was the one that had to go first on
 * merit, whatever order they happened to be done in. A fake wallet balance
 * overstates a credit the clinic owes. A fake "approved limit of 60,000
 * through BluDerma Care Credit" is a statement about money a person can
 * borrow, made to somebody working out whether they can afford treatment,
 * naming a lender that does not exist.
 */

/*
 * SavedAddress and DEMO_ADDRESSES lived here and are gone.
 *
 * They are a real table now (PatientAddress) with real actions behind them, so
 * a client's saved places are their own and they can add, edit and remove
 * them. See src/lib/actions/address.ts and components/patient/AddressBook.
 *
 * Worth recording why these went first of the three: the two invented
 * addresses were the last Indian street addresses on a site that has otherwise
 * been stripped of city and state names, and they were shown to every visitor
 * as though they were that visitor's own. A Korean client reading their own
 * profile found a flat in Pallavaram in it.
 */
