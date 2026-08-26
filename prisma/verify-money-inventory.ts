/**
 * Revenue, costs, equipment tiers, and the stock ledger.
 *
 * Two things here are worth protecting properly rather than eyeballing.
 *
 * The first is that revenue counts each rupee once. Four streams now feed one
 * figure, and a double-count makes the number quietly too high — which is the
 * version nobody checks, because it flatters.
 *
 * The second is the stock ledger. Medicine.stock used to be READ by the order
 * flow and never written: a practice with ten units could accept fifty orders
 * and still show ten. The check existed, so the bug read as working software.
 * Every assertion below about balances exists so that cannot come back.
 */
import { readFileSync } from "node:fs";

for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
  if (m && process.env[m[1]] === undefined) {
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
}

import {
  MACHINE_TIERS,
  categoryLabel,
  costGroupOf,
  machineStatus,
  netFor,
  recoveryFor,
  revenueFor,
  type AssetRow,
} from "../src/lib/doctor/financeCore";

let pass = 0;
const fails: string[] = [];
function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    pass++;
    console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    fails.push(name);
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}
const read = (p: string) => readFileSync(p, "utf8");
const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;

console.log("1. Revenue is four streams, each counted once");

const rev = revenueFor({
  bookingsInr: 240_000,
  bookingCount: 200,
  medicinesInr: 32_000,
  medicineOrderCount: 14,
  proceduresInr: 96_000,
  procedureCount: 8,
  otherInr: 12_000,
  otherCount: 3,
});

check("the total is the sum of the streams", rev.totalInr === 380_000, money(rev.totalInr));
check("all four streams are described", rev.streams.length === 4);
check(
  "every stream says what it counts",
  rev.streams.every((s) => s.basis.length > 20)
);
check(
  "the shares add to one",
  Math.abs(rev.streams.reduce((n, s) => n + s.share, 0) - 1) < 1e-9
);
check(
  "an empty practice does not divide by zero",
  revenueFor({
    bookingsInr: 0, bookingCount: 0,
    medicinesInr: 0, medicineOrderCount: 0,
    proceduresInr: 0, procedureCount: 0,
    otherInr: 0, otherCount: 0,
  }).streams.every((s) => s.share === 0)
);
check(
  "a negative figure cannot drag the total down",
  revenueFor({
    bookingsInr: -5000, bookingCount: 0,
    medicinesInr: 1000, medicineOrderCount: 1,
    proceduresInr: 0, procedureCount: 0,
    otherInr: 0, otherCount: 0,
  }).totalInr === 1000
);
check("a plausible month raises no double-count warning", rev.overlapWarning === null);
check(
  "procedures far ahead of bookings asks the question",
  revenueFor({
    bookingsInr: 20_000, bookingCount: 20,
    medicinesInr: 0, medicineOrderCount: 0,
    proceduresInr: 400_000, procedureCount: 30,
    otherInr: 0, otherCount: 0,
  }).overlapWarning !== null
);
check(
  "and asks it rather than asserting it",
  /Worth a check|normal for/.test(
    revenueFor({
      bookingsInr: 20_000, bookingCount: 20,
      medicinesInr: 0, medicineOrderCount: 0,
      proceduresInr: 400_000, procedureCount: 30,
      otherInr: 0, otherCount: 0,
    }).overlapWarning ?? ""
  )
);

console.log("\n2. The dashboard and the money page agree");

const dash = read("src/components/doctor/dashboard/DashboardHome.tsx");
const page = read("src/app/doctor/portal/finance/page.tsx");
check("both compute revenue the same way", /revenueFor\(/.test(dash) && /revenueFor\(/.test(page));
check(
  "net is taken from the full revenue, not from bookings alone",
  /netFor\(revenue\.totalInr/.test(dash) && /netFor\(\s*revenue\.totalInr/.test(page)
);
check(
  "both exclude cancelled medicine orders",
  /status: \{ not: MedicineOrderStatus\.CANCELLED \}/.test(dash) &&
    /status: \{ not: MedicineOrderStatus\.CANCELLED \}/.test(page)
);
check(
  "machine charges are windowed for revenue, not read whole",
  /windowUses/.test(dash) && /monthUses/.test(page)
);

console.log("\n3. Costs, grouped the way a practitioner reads them");

const net = netFor(380_000, [
  { category: "RENT", amountInr: 85_000 },
  { category: "UTILITIES", amountInr: 18_000 },
  { category: "LAUNDRY", amountInr: 6_000 },
  { category: "SALARY", amountInr: 142_000, headcount: 6 },
  { category: "MEDICINES", amountInr: 31_000 },
  { category: "OTHER", amountInr: 4_000 },
]);

check("rent, utilities and laundry are one line", costGroupOf("RENT") === "INFRASTRUCTURE" &&
  costGroupOf("UTILITIES") === "INFRASTRUCTURE" && costGroupOf("LAUNDRY") === "INFRASTRUCTURE");
check("dispensary stock sits with supplies", costGroupOf("MEDICINES") === "SUPPLIES");
check(
  "the groups sum to the total",
  net.groups.reduce((n, g) => n + g.amountInr, 0) === net.runningCostInr
);
check("an empty group is not drawn", net.groups.every((g) => g.amountInr > 0));
check(
  "headcount reaches the People line",
  net.groups.find((g) => g.key === "PEOPLE")?.headcount === 6
);
check(
  "headcount is null where nobody stated one",
  netFor(100, [{ category: "SALARY", amountInr: 50 }]).groups.find((g) => g.key === "PEOPLE")
    ?.headcount === null
);
check(
  "profit percentage is the margin, not one minus the cost ratio",
  net.profitRatio !== null && Math.abs(net.profitRatio - net.netInr / net.takingsInr) < 1e-9
);
check("a loss reports a negative margin", (netFor(100, [{ category: "RENT", amountInr: 400 }]).profitRatio ?? 0) < 0);
check("no revenue means an undefined margin, not zero", netFor(0, []).profitRatio === null);
check('OTHER reads as "Miscellaneous"', categoryLabel("OTHER") === "Miscellaneous");
check('MEDICINES reads as "Dispensary stock"', categoryLabel("MEDICINES") === "Dispensary stock");

console.log("\n4. Equipment colours are a rate, not a percentage");

const uses = (n: number, each: number, from: Date, everyDays: number) =>
  Array.from({ length: n }, (_, i) => ({
    chargedInr: each,
    usedOn: new Date(from.getTime() + i * everyDays * 86_400_000),
  }));

const NOW = new Date(Date.UTC(2026, 7, 26));
const asset = (over: Partial<AssetRow>): AssetRow => ({
  id: "a",
  name: "Laser",
  purpose: null,
  costInr: 1_000_000,
  upkeepInr: 0,
  purchasedOn: new Date(Date.UTC(2025, 7, 26)),
  uses: [],
  ...over,
});

const brandNew = machineStatus(
  recoveryFor(asset({ purchasedOn: new Date(Date.UTC(2026, 7, 1)), uses: uses(2, 12_000, new Date(Date.UTC(2026, 7, 2)), 5) }), NOW)
);
check("a machine owned a fortnight is not judged", brandNew.tier === "NEW", brandNew.label);

const neverUsed = machineStatus(recoveryFor(asset({}), NOW));
check("a machine with no uses is not judged either", neverUsed.tier === "NEW");

const strong = machineStatus(
  recoveryFor(asset({ uses: uses(52, 14_000, new Date(Date.UTC(2025, 7, 26)), 7) }), NOW)
);
check("one that has paid for itself is blue", strong.tone === "blue", strong.label);

const slow = machineStatus(
  recoveryFor(asset({ uses: uses(10, 4_000, new Date(Date.UTC(2025, 7, 26)), 30) }), NOW)
);
check("one recovering far too slowly is not blue", slow.tone !== "blue", `${slow.label} (${slow.tone})`);
// Every tier below "on track" has to name something the practitioner can
// actually do, or the colour is a judgement with no action attached.
check(
  "and it says what would change it",
  /more uses|higher charge|decid|push it|let it go|not being (used|recorded)/i.test(
    slow.meaning
  ),
  slow.meaning
);

check(
  "the same percentage can mean two different things",
  // 12% recovered after one month vs after three years.
  machineStatus(
    recoveryFor(asset({ purchasedOn: new Date(Date.UTC(2026, 6, 20)), uses: uses(9, 13_400, new Date(Date.UTC(2026, 6, 21)), 3) }), NOW)
  ).tier !==
    machineStatus(
      recoveryFor(asset({ purchasedOn: new Date(Date.UTC(2023, 7, 26)), uses: uses(9, 13_400, new Date(Date.UTC(2023, 8, 1)), 120) }), NOW)
    ).tier
);
check("every tier has a colour and a label", MACHINE_TIERS.every((t) => t.label && t.tone));

console.log("\n5. The stock ledger");

const meds = read("src/lib/actions/medicines.ts");
check(
  "an order takes stock off the shelf",
  /applyStockMovement\(tx, \{\s*medicineId: line\.medicineId,\s*delta: -line\.qty/.test(meds)
);
check(
  "the order and the movement are one transaction",
  /prisma\.\$transaction\(async \(tx\) => \{[\s\S]*?medicineOrder\.create[\s\S]*?applyStockMovement/.test(meds)
);
check("cancelling puts it back", /StockMoveReason\.ORDER_CANCELLED/.test(meds));
check(
  "cancelling twice does not credit it twice",
  /existing\.status !== MedicineOrderStatus\.CANCELLED/.test(meds)
);
check("the shelf can never go negative", /Math\.max\(0, medicine\.stock \+ input\.delta\)/.test(meds));
check(
  "the ledger records what was ACTUALLY applied, not what was asked",
  /const applied = balance - medicine\.stock/.test(meds)
);
check(
  "an untracked medicine is left untracked, never zeroed",
  /if \(!medicine \|\| medicine\.stock === null\) return null/.test(meds)
);
check(
  "typing over the count is logged as a correction",
  /reason: StockMoveReason\.CORRECTION[\s\S]{0,200}?Counted and corrected/.test(meds)
);
check("a correction without a reason is refused", /Say what the correction is for/.test(meds));
check(
  "the order flow's own movements have no actor",
  // Written by the system on the patient's behalf; attributing them to the
  // patient would read as the patient having adjusted the doctor's stock.
  /reason: StockMoveReason\.ORDER,\s*\n\s*orderId: order\.id,\s*\n\s*\}\);/.test(meds)
);

console.log("\n6. Prescribing from the dispensary");

const doctorActions = read("src/lib/actions/doctor.ts");
check(
  "a line can point at a medicine",
  /medicineId: linked\?\.id \?\? null/.test(doctorActions)
);
check(
  "only at one of THIS doctor's",
  /where: \{ id: \{ in: claimedIds \}, doctorId: owner\.doctorId \}/.test(doctorActions)
);
check(
  "the name is snapshotted, not referenced",
  /name: linked\?\.name \?\? line\.name/.test(doctorActions)
);
check(
  "a freehand line still saves",
  /stops being a link|typed freehand/.test(doctorActions)
);
check(
  "the prescription remembers which visit it came from",
  /appointmentId: appointment\.id,/.test(doctorActions)
);
check(
  "the patient sees the lines rather than the title",
  /p\.items\.length/.test(read("src/lib/queries/profileData.ts"))
);
check(
  "the form warns before prescribing something out of stock",
  /You have none of this left/.test(read("src/components/doctor/PrescriptionLines.tsx"))
);

console.log(`\n${pass} passed, ${fails.length} failed`);
if (fails.length) {
  fails.forEach((f) => console.log(`  FAIL  ${f}`));
  process.exit(1);
}
console.log("All checks pass.");
