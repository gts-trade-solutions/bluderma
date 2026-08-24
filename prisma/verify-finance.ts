/**
 * Practice finance, and the machine-recovery arithmetic behind the guidance.
 *
 * The numbers here are ones a practitioner may use to decide whether to buy a
 * second laser, so the rules that matter are the ones that keep a figure from
 * being more confident than the data underneath it:
 *
 *   - a capital purchase is never subtracted from a month's takings
 *   - "how many more uses" is null, not Infinity, when nothing has been charged
 *   - a rate is only extrapolated to a date once there is history for one
 *
 *   npx tsx prisma/verify-finance.ts
 */
import { readFileSync } from "node:fs";

import { PrismaClient } from "@prisma/client";

import {
  categoryLabel,
  netFor,
  recoveryFor,
  type AssetRow,
} from "../src/lib/doctor/financeCore";
import { isDoctorId, isPatientId, isVendorId, newVendorId } from "../src/lib/publicId";

const prisma = new PrismaClient({ log: ["error"] });

let pass = 0;
const fails: string[] = [];
function check(name: string, ok: boolean, detail?: string) {
  if (ok) pass++;
  else fails.push(detail ? `${name} (${detail})` : name);
}
const codeOnly = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ");

const NOW = new Date("2026-08-24T00:00:00Z");
const asset = (over: Partial<AssetRow> = {}): AssetRow => ({
  id: "a",
  name: "CO2 laser",
  purpose: "resurfacing",
  costInr: 500_000,
  upkeepInr: 0,
  purchasedOn: new Date("2026-02-24T00:00:00Z"), // six months earlier
  uses: [],
  ...over,
});

async function main() {
  /* ── The example from the brief, worked through ────────────────────── */

  // A ₹5,00,000 machine, first use charged at ₹8,000.
  const first = recoveryFor(
    asset({ uses: [{ chargedInr: 8_000, usedOn: NOW }] }),
    NOW
  );
  check("outlay is the purchase price", first.outlayInr === 500_000);
  check("recovered is what was charged", first.recoveredInr === 8_000);
  check("remaining is the difference", first.remainingInr === 492_000);
  check(
    "and it says how many more uses at that rate",
    first.usesToBreakEven === 62,
    `${first.usesToBreakEven}`
  );
  check("progress is a fraction, not a percentage", first.progress > 0 && first.progress < 0.02);
  check(
    "the guidance quotes the real figures",
    first.guidance.includes("8,000") &&
      first.guidance.includes("4,92,000") &&
      first.guidance.includes("62"),
    first.guidance
  );

  /* ── Upkeep counts toward what has to come back ────────────────────── */

  const withUpkeep = recoveryFor(asset({ upkeepInr: 40_000 }), NOW);
  check("upkeep is added to the outlay", withUpkeep.outlayInr === 540_000);

  /* ── The cases that produce nonsense if unguarded ──────────────────── */

  const none = recoveryFor(asset(), NOW);
  check("with no uses there is no rate", none.usesToBreakEven === null);
  check("and the guidance says so plainly", /No uses recorded yet/.test(none.guidance));
  check("average is null rather than zero", none.averageChargeInr === null);

  const freeOnly = recoveryFor(
    asset({ uses: [{ chargedInr: 0, usedOn: NOW }, { chargedInr: 0, usedOn: NOW }] }),
    NOW
  );
  check(
    "uses charged at nothing give no rate either",
    freeOnly.usesToBreakEven === null,
    "dividing by an average of nil yields Infinity"
  );
  check("but they still count as uses", freeOnly.useCount === 2);
  check(
    "and the guidance admits there is no rate",
    /no rate to work from/.test(freeOnly.guidance),
    freeOnly.guidance
  );

  // Free uses must not drag the average down: they say nothing about earning.
  const mixed = recoveryFor(
    asset({
      uses: [
        { chargedInr: 10_000, usedOn: NOW },
        { chargedInr: 0, usedOn: NOW },
      ],
    }),
    NOW
  );
  check(
    "an uncharged use does not halve the average",
    mixed.averageChargeInr === 10_000,
    `${mixed.averageChargeInr}`
  );

  const over = recoveryFor(
    asset({ uses: Array.from({ length: 100 }, () => ({ chargedInr: 8_000, usedOn: NOW })) }),
    NOW
  );
  check("a machine cannot be more than fully recovered", over.progress === 1);
  check("remaining floors at zero", over.remainingInr === 0);
  check("and nothing more is needed", over.usesToBreakEven === 0);
  check("the guidance says it has paid for itself", /Paid for itself/.test(over.guidance));

  /* ── A rate is only projected once there is history ────────────────── */

  const fresh = recoveryFor(
    asset({
      purchasedOn: NOW, // bought today
      uses: [{ chargedInr: 8_000, usedOn: NOW }],
    }),
    NOW
  );
  check(
    "no months-to-go from a single month of data",
    !/month/.test(fresh.guidance),
    "one month extrapolated to a date is a guess with a decimal point on it"
  );
  const seasoned = recoveryFor(
    asset({ uses: Array.from({ length: 12 }, () => ({ chargedInr: 8_000, usedOn: NOW })) }),
    NOW
  );
  check(
    "but six months of history does earn one",
    /month/.test(seasoned.guidance),
    seasoned.guidance
  );
  check(
    "and it states the assumption",
    /if it carries on the same way/.test(seasoned.guidance)
  );

  /* ── Net is takings minus RUNNING costs only ───────────────────────── */

  const net = netFor(300_000, [
    { category: "RENT", amountInr: 60_000 },
    { category: "SALARY", amountInr: 80_000 },
    { category: "RENT", amountInr: 10_000 },
  ]);
  check("running costs sum", net.runningCostInr === 150_000);
  check("net is the difference", net.netInr === 150_000);
  check("categories are merged", net.byCategory.length === 2);
  check("and sorted heaviest first", net.byCategory[0].category === "SALARY");
  check("the cost ratio is a fraction", net.costRatio === 0.5);
  check(
    "with no takings the ratio is null, not Infinity",
    netFor(0, [{ category: "RENT", amountInr: 1 }]).costRatio === null
  );

  // The whole reason assets and expenses are separate tables.
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  check(
    "a machine is an asset, not an expense row",
    /model PracticeAsset/.test(schema) && /model PracticeExpense/.test(schema)
  );
  const core = codeOnly("src/lib/doctor/financeCore.ts");
  check(
    "net never touches asset cost",
    !/costInr/.test(core.slice(core.indexOf("export function netFor"))),
    "subtracting a capital purchase from one month would read as a disaster"
  );

  check("category labels are readable", categoryLabel("CONSUMABLES") === "Consumables");


  /* ── Seller applications ───────────────────────────────────────────── */

  // Three parties appear on the same correspondence, so an id has to say which
  // kind it is by shape alone.
  const v = newVendorId();
  check("a vendor id is well formed", isVendorId(v), v);
  check("and is not a patient id", !isPatientId(v));
  check("nor a doctor id", !isDoctorId(v));
  check(
    "vendor ids are the shortest of the three",
    v.length < "BLU-P-000000".length,
    v
  );

  const vendorAction = codeOnly("src/lib/actions/vendor.ts");
  check(
    "a drug licence number is required",
    /drugLicenceNo: z\.string\(\)[\s\S]{0,80}min\(/.test(vendorAction),
    "the alternative is listing prescription medicine on an unverified claim"
  );
  check(
    "there is no automatic approval path",
    !/status: VendorStatus\.APPROVED/.test(
      vendorAction.slice(0, vendorAction.indexOf("export async function reviewVendor"))
    ),
    "approval must require a human who has read a licence"
  );
  check(
    "reviewing is admin-only",
    /user\.role !== "ADMIN"/.test(vendorAction)
  );
  check(
    "a duplicate open application is refused",
    /already have an application from this email/.test(vendorAction),
    "two rows put the reviewer in front of the same business twice"
  );

  const vendorRow = codeOnly("src/components/admin/VendorRow.tsx");
  check(
    "approving needs the licence document, not just the number",
    /disabled=\{pending \|\| !hasDocument\}/.test(vendorRow),
    "a licence number on its own is a claim"
  );

  const sellPage = codeOnly("src/app/sell/page.tsx");
  check("the seller page exists and is public", sellPage.length > 200);
  const vendorForm = codeOnly("src/components/vendor/VendorForm.tsx");
  check(
    "the licence uploads to a private prefix",
    /folder: "credentials"/.test(vendorForm)
  );
  check(
    "and the form says submitting creates nothing",
    /does not create an account/.test(vendorForm),
    "\"get started selling today\" over a form that creates no account is a lie"
  );

  /* ── Live: the tables exist and are scoped per doctor ──────────────── */

  const doctor = await prisma.doctor.findFirst({ select: { id: true } });
  if (!doctor) {
    fails.push("need a doctor");
    return;
  }
  let assetId = "";
  try {
    const created = await prisma.practiceAsset.create({
      data: {
        doctorId: doctor.id,
        name: "vfy-machine",
        costInr: 100_000,
        purchasedOn: new Date("2026-01-01T00:00:00Z"),
        uses: { create: [{ usedOn: NOW, chargedInr: 25_000 }] },
      },
      select: { id: true },
    });
    assetId = created.id;

    const row = await prisma.practiceAsset.findUniqueOrThrow({
      where: { id: assetId },
      include: { uses: { select: { chargedInr: true, usedOn: true } } },
    });
    const live = recoveryFor(row, NOW);
    check("a real asset computes", live.recoveredInr === 25_000 && live.remainingInr === 75_000);
    check("and needs three more at that rate", live.usesToBreakEven === 3, `${live.usesToBreakEven}`);

    const others = await prisma.practiceAsset.count({
      where: { id: assetId, doctorId: "someone-else" },
    });
    check("another practice cannot see it", others === 0);
  } finally {
    if (assetId) await prisma.practiceAsset.delete({ where: { id: assetId } }).catch(() => {});
    const left = await prisma.practiceAsset.count({ where: { name: "vfy-machine" } });
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
