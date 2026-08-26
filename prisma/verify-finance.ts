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
  CLINIC_TIERS,
  categoryLabel,
  clinicPerformanceFor,
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
    // `vendor-licences/`, not `credentials/`. This form is public and
    // `credentials/` is doctors-only, so every licence upload used to come
    // back "Not permitted" — see the note in lib/uploadAuth.ts. Both prefixes
    // are private; only one of them an applicant may write to.
    /uploadFile\(file, "vendor-licences"\)/.test(vendorForm) &&
      /"vendor-licences"/.test(codeOnly("src/lib/uploadAuth.ts"))
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

  /* ------------------------------------------------------------------------
     Which clinic earned it
     ---------------------------------------------------------------------
     The ranking is meant to be acted on — which rent to keep paying, where the
     extra session goes — so the rules that matter are the ones that stop it
     being more confident than the rows underneath it.
     --------------------------------------------------------------------- */

  console.log("\nWhich clinic earned it");

  const C = (id: string, name: string) => ({ id, name });
  const at = (clinicId: string | null, amountInr: number) => ({ clinicId, amountInr });

  {
    const perf = clinicPerformanceFor({
      clinics: [C("a", "Adyar"), C("b", "Besant Nagar"), C("c", "Velachery")],
      bookings: [at("a", 40_000), at("b", 90_000), at("c", 10_000)],
      procedures: [at("b", 20_000), at("a", 5_000)],
      otherIncome: [at("c", 2_000)],
      expenses: [at("a", 15_000), at("b", 30_000), at("c", 40_000)],
      unattributableInr: 25_000,
    });

    check(
      "the strongest clinic is first",
      perf.rows[0].name === "Besant Nagar" && perf.rows[0].rank === 1,
      perf.rows.map((r) => r.name).join(" > ")
    );
    check(
      "and the ranking is by revenue, not by name or id",
      perf.rows.map((r) => r.revenueInr).join(",") === "110000,45000,12000"
    );
    check("the leader reads as the leader", perf.rows[0].tier === "LEADING");

    // The rule worth having: placing second is not the same as being fine.
    const velachery = perf.rows.find((r) => r.name === "Velachery")!;
    check(
      "a clinic spending more than it takes is flagged whatever its rank",
      velachery.tier === "LOSING" && velachery.netInr === -28_000,
      `${velachery.tier} at ${velachery.netInr}`
    );
    check(
      "and it says so in money rather than in a tier name",
      /28,000/.test(velachery.meaning),
      velachery.meaning
    );

    // The dispensary cannot be placed, so it must not be placed.
    check(
      "dispensary income is never divided between clinics",
      perf.attributedInr === 167_000 && perf.unattributableInr === 25_000,
      `attributed ${perf.attributedInr}, held back ${perf.unattributableInr}`
    );
    check(
      "no clinic's revenue contains any of it",
      perf.rows.every(
        (r) => r.revenueInr === r.bookingsInr + r.proceduresInr + r.otherInr
      )
    );

    // Shares are a share OF something, and that something is the table.
    const shares = perf.rows.reduce((n, r) => n + r.sharePct, 0);
    check("the shares add up to one whole", Math.abs(shares - 1) < 1e-9, String(shares));

    check(
      "margin is net over revenue, not over takings-plus-dispensary",
      Math.abs((perf.rows[0].marginPct ?? 0) - 80_000 / 110_000) < 1e-9
    );
    check("three clinics is not a single clinic", perf.singleClinic === false);
  }

  {
    // Rows recorded without a location are the common real-world case: they
    // must be reported, because silently dropping them makes every margin above
    // look better than it is.
    const perf = clinicPerformanceFor({
      clinics: [C("a", "Adyar")],
      bookings: [at("a", 10_000), at(null, 7_000)],
      procedures: [],
      otherIncome: [at(null, 3_000)],
      expenses: [at(null, 4_000)],
    });
    check(
      "takings with no location are reported, not dropped",
      perf.unplacedInr === 10_000,
      String(perf.unplacedInr)
    );
    check(
      "costs with no location are reported too",
      perf.unplacedCostsInr === 4_000,
      String(perf.unplacedCostsInr)
    );
    check("one clinic says ranking means nothing here", perf.singleClinic === true);
  }

  {
    // A month where nothing happened must not divide by zero or crown a winner.
    const perf = clinicPerformanceFor({
      clinics: [C("a", "Adyar"), C("b", "Besant Nagar")],
      bookings: [],
      procedures: [],
      otherIncome: [],
      expenses: [],
    });
    check("an empty month produces no leader", perf.rows.every((r) => r.tier === "QUIET"));
    check(
      "and no NaN shares or margins",
      perf.rows.every((r) => r.sharePct === 0 && r.marginPct === null)
    );
  }

  {
    // A refund or a correction can leave a negative amount on a row. It must not
    // subtract from a clinic's takings through the back door.
    const perf = clinicPerformanceFor({
      clinics: [C("a", "Adyar")],
      bookings: [at("a", 5_000), at("a", -2_000)],
      procedures: [],
      otherIncome: [],
      expenses: [],
    });
    check(
      "a negative row cannot quietly reduce a clinic's revenue",
      perf.rows[0].revenueInr === 5_000,
      String(perf.rows[0].revenueInr)
    );
  }

  // The colours are the ones the machines already use, so the two tables read
  // the same way, and blue is the good end.
  check(
    "blue is the strongest tier and rose is the losing one",
    CLINIC_TIERS.LEADING.tone === "blue" && CLINIC_TIERS.LOSING.tone === "rose"
  );

  const perfUi = readFileSync("src/components/doctor/ClinicPerformance.tsx", "utf8");
  check(
    "the panel names every tone as a full literal class",
    ["border-l-blue-500", "border-l-rose-500", "bg-teal-100", "from-amber-400"].every((c) =>
      perfUi.includes(c)
    )
  );
  check(
    "and says what is missing from the split rather than hiding it",
    /Medicine orders belong to the practice/.test(perfUi)
  );

  const financePage = readFileSync("src/app/doctor/portal/finance/page.tsx", "utf8");
  check(
    "the finance page passes the dispensary in as unattributable",
    /unattributableInr: orders\.reduce/.test(financePage)
  );
  check(
    "and attributes machine charges through the asset's clinic",
    /clinicId: a\.clinicId, amountInr: Math\.max\(u\.chargedInr, 0\)/.test(financePage)
  );

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
