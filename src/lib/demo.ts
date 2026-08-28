/**
 * Which accounts are allowed to see illustrated data.
 *
 * ── Why this exists ──────────────────────────────────────────────────────
 * Parts of the client profile were built before the tables behind them. The
 * wallet is the one that survived longest: there is no `Wallet` table, no
 * ledger and no way to earn or spend a rupee of it, and the page was showing
 * every signed-in client a balance of ₹2,450, a lifetime cashback figure, and
 * transaction rows naming a doctor they had never seen and a serum they had
 * never bought.
 *
 * On a brand-new account — nought skin reports, nought appointments, nought
 * treatments — that is not a placeholder anybody could read as one. It is a
 * spendable figure that cannot be spent, which is the specific failure the
 * demo file's own header warned about and called "the entry with the
 * shortest fuse".
 *
 * ── Why an email test and not a database flag ────────────────────────────
 * The demo accounts are already defined by their addresses, in
 * prisma/seed-demo-doctor.ts, and are the only accounts that will ever hold
 * seeded content. A column would have to be set correctly on every future
 * seed run to be worth anything, and a column that is silently false is how
 * illustrated data reaches a real client in the first place.
 *
 * The domains are `.local`, which cannot be registered and cannot receive
 * mail, so no real person can hold one by accident or on purpose.
 */

/** Exactly the addresses prisma/seed-demo-doctor.ts creates. */
const DEMO_EMAILS = new Set([
  "demo.doctor@bluderma.local",
  "demo.client@bluderma.local",
]);

/** Seeded patients get an address on this domain. */
const DEMO_DOMAIN = "demo.bluderma.local";

/**
 * The suffixes, for the places that must filter in SQL rather than in code.
 *
 * `.local` is reserved for link-local naming and cannot be registered or
 * receive mail, so no real person can hold one of these by accident or on
 * purpose. That is what makes an endsWith filter safe here: it cannot catch
 * a genuine practitioner or client.
 *
 * `@bluderma.local` deliberately also catches the dr.test@ account, which is
 * not a demo but is just as much not a real doctor.
 */
export const DEMO_EMAIL_SUFFIXES = ["@bluderma.local", `@${DEMO_DOMAIN}`];

/** A Prisma fragment excluding demo authors from a public read. */
export const NOT_DEMO_USER = {
  NOT: DEMO_EMAIL_SUFFIXES.map((suffix) => ({
    user: { is: { email: { endsWith: suffix } } },
  })),
};

/**
 * True only for a seeded demonstration account.
 *
 * Defaults to FALSE for anything it cannot identify — a missing email, a
 * malformed one, a null. Getting this wrong in the safe direction means a
 * demo account sees an empty wallet; getting it wrong in the other means a
 * paying client sees money that does not exist.
 */
export function isDemoAccount(email: string | null | undefined): boolean {
  if (!email) return false;
  const e = email.trim().toLowerCase();
  return DEMO_EMAILS.has(e) || e.endsWith(`@${DEMO_DOMAIN}`);
}
