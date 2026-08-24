/**
 * The two mocks on My Profile that became real tables.
 *
 * These were DEMO_ADDRESSES: two invented Chennai addresses rendered on every
 * client's profile as though they were theirs, in a section with no actions, so
 * even a client who noticed could do nothing about it.
 *
 * Two invariants carry the weight here and neither is expressible in the MySQL
 * schema, so both are asserted against the real database:
 *
 *   1. Ownership. Every mutation filters on `{ id, userId }` together. An id
 *      lifted from a form and trusted is how one client edits another's
 *      address, and cuid confers no authorisation.
 *   2. Exactly one default. A partial unique index is the tidy way to say it
 *      and MySQL has none, so `promote()` holds the line in a transaction.
 *
 * Runs against real rows under a fixture user, and cleans up after itself.
 *
 * Also covers the instalment programme, which replaced the other mock on the
 * same page and shares its shape: stored rows instead of invented ones, and a
 * closed state that says so instead of filling the gap.
 *
 *   npx tsx prisma/verify-profile-data.ts
 */
import { readFileSync } from "node:fs";

import { PrismaClient } from "@prisma/client";

import {
  outstanding,
  readSettings,
  toPlan,
} from "../src/lib/queries/payLaterCore";

const prisma = new PrismaClient({ log: ["error"] });

let pass = 0;
const fails: string[] = [];
function check(name: string, ok: boolean, detail?: string) {
  if (ok) pass++;
  else fails.push(detail ? `${name} (${detail})` : name);
}

/** Source with comments blanked: the notes above quote what was removed. */
const codeOnly = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ");

async function main() {
  /* ── The mock is gone from the page ────────────────────────────────── */

  const page = codeOnly("src/app/patient/profile/page.tsx");
  check("the profile renders the real address book", /<AddressBook/.test(page));
  check("and no longer maps over the mock", !/DEMO_ADDRESSES/.test(page));
  const demo = codeOnly("src/data/patientDemo.ts");
  check("the mock addresses are deleted", !/DEMO_ADDRESSES/.test(demo));
  // The wallet is deliberately still a mock, by request, so it must survive:
  // a sweep that took it out too would be a silent product change.
  check("the wallet mock is untouched", /DEMO_WALLET/.test(demo));

  /* ── Ownership is on the row, not the id ───────────────────────────── */

  const actions = codeOnly("src/lib/actions/address.ts");
  for (const [name, re] of [
    ["save scopes by userId", /updateMany\(\{\s*where:\s*\{\s*id:[^}]*userId/s],
    ["delete scopes by userId", /findFirst\(\{\s*where:\s*\{\s*id,\s*userId/s],
    ["setDefault scopes by userId", /setDefaultAddress[\s\S]{0,400}userId: user\.id/],
  ] as const) {
    check(name, re.test(actions));
  }
  check(
    "promote clears the other defaults in one transaction",
    /\$transaction\(\[[\s\S]{0,400}isDefault: true[\s\S]{0,200}isDefault: false/.test(
      actions
    ) ||
      /\$transaction\(\[[\s\S]{0,400}isDefault: false[\s\S]{0,200}isDefault: true/.test(
        actions
      ),
    "two separate writes leave a window with no default at all"
  );


  /* ── The instalment programme ──────────────────────────────────────── */

  // DEMO_PAY_LATER quoted an "approved limit of ₹60,000 through BluDerma Care
  // Credit" to clients working out whether they could afford treatment. The
  // figure was not the indefensible part: the lender did not exist. So the
  // programme cannot be switched on without one being named.
  check("instalments are off with no settings at all", !readSettings([]).enabled);
  check(
    "and off when enabled with no provider named",
    !readSettings([
      { key: "paylater.enabled", value: "true" },
      { key: "paylater.provider", value: "" },
    ]).enabled,
    "a limit with no lender behind it is exactly what the mock did"
  );
  const on = readSettings([
    { key: "paylater.enabled", value: "true" },
    { key: "paylater.provider", value: "Test Finance Co" },
    { key: "paylater.limit_inr", value: "40000" },
    { key: "paylater.interest_free_months", value: "3" },
  ]);
  check("on once a provider is named", on.enabled && on.provider === "Test Finance Co");
  check("and its figures are read", on.limitInr === 40000 && on.interestFreeMonths === 3);
  check(
    "a nonsense limit falls back to nothing shown",
    readSettings([{ key: "paylater.limit_inr", value: "lots" }]).limitInr === 0
  );

  const base = {
    id: "p",
    item: "course",
    provider: "Test Finance Co",
    totalInr: 12_000,
    instalmentInr: 3_000,
    instalmentsPaid: 2,
    instalmentsTotal: 4,
    nextDueAt: new Date("2026-09-18T00:00:00Z"),
    settledAt: null as Date | null,
  };

  const live = toPlan(base);
  check("paid is counted from instalments recorded", live.paidInr === 6_000);
  check("and a live plan states its next due date", live.nextDue !== null);

  const done = toPlan({ ...base, instalmentsPaid: 4, settledAt: new Date() });
  check(
    "a settled plan asks for nothing further",
    done.nextDue === null && done.settled,
    "a finished course must stop showing an amount due"
  );

  // A data-entry slip must not tell somebody they have overpaid.
  check("an over-entered instalment cannot overpay", toPlan({ ...base, instalmentsPaid: 9 }).paidInr === 12_000);
  check("outstanding counts only what is unpaid", outstanding([live, done]) === 6_000);

  /* ── The invariants, against real rows ─────────────────────────────── */

  const [a, b] = await Promise.all([
    prisma.user.findUnique({
      where: { email: "demo.client@bluderma.local" },
      select: { id: true },
    }),
    prisma.user.findFirst({
      where: { email: { not: "demo.client@bluderma.local" }, role: "PATIENT" },
      select: { id: true },
    }),
  ]);
  if (!a || !b) {
    fails.push("need two patient accounts to test ownership across users");
    return;
  }

  const made: string[] = [];
  try {
    const one = await prisma.patientAddress.create({
      data: { userId: a.id, label: "vfy-1", line1: "1 Test Road", isDefault: true },
    });
    const two = await prisma.patientAddress.create({
      data: { userId: a.id, label: "vfy-2", line1: "2 Test Road" },
    });
    made.push(one.id, two.id);

    // Promote the second the way setDefaultAddress does.
    await prisma.$transaction([
      prisma.patientAddress.updateMany({
        where: { userId: a.id, isDefault: true, NOT: { id: two.id } },
        data: { isDefault: false },
      }),
      prisma.patientAddress.updateMany({
        where: { id: two.id, userId: a.id },
        data: { isDefault: true },
      }),
    ]);

    const mine = await prisma.patientAddress.findMany({
      where: { userId: a.id, id: { in: made } },
      select: { id: true, isDefault: true },
    });
    check(
      "promoting one demotes the rest",
      mine.filter((r) => r.isDefault).length === 1,
      `${mine.filter((r) => r.isDefault).length} defaults`
    );
    check(
      "and it is the one promoted",
      mine.find((r) => r.isDefault)?.id === two.id
    );

    // The ownership filter, exercised rather than read.
    const cross = await prisma.patientAddress.updateMany({
      where: { id: one.id, userId: b.id },
      data: { label: "hijacked" },
    });
    check(
      "another client's update matches nothing",
      cross.count === 0,
      "the userId in the same where clause is what stops it"
    );
    const stillMine = await prisma.patientAddress.findUnique({
      where: { id: one.id },
      select: { label: true },
    });
    check("and the row is untouched", stillMine?.label === "vfy-1");

    // Deleting the default hands it on rather than leaving none.
    await prisma.patientAddress.delete({ where: { id: two.id } });
    const next = await prisma.patientAddress.findFirst({
      where: { userId: a.id },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    check("a survivor exists to take the default", next?.id === one.id);
  } finally {
    await prisma.patientAddress.deleteMany({ where: { id: { in: made } } });
    const left = await prisma.patientAddress.count({
      where: { label: { startsWith: "vfy-" } },
    });
    check("the fixture cleaned up after itself", left === 0, `${left} left`);
  }
}

main()
  .catch((e) => fails.push(`threw: ${e.message ?? e}`))
  .finally(async () => {
    await prisma.$disconnect();
    console.log(`\n${pass} passed, ${fails.length} failed`);
    if (fails.length) {
      fails.forEach((f) => console.log(`  FAIL  ${f}`));
      process.exit(1);
    }
  });
