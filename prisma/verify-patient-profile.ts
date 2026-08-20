/**
 * My Profile: the sidebar, and the line between a record and a mock-up.
 *
 * Three of the ten sections describe products that do not exist yet — the
 * wallet, pay-later and the saved address book have no tables behind them. The
 * page shows them anyway so the finished shape can be reviewed, and that is
 * only defensible while a reader can tell which panels are theirs and which
 * are an illustration.
 *
 * So the checks here are mostly about honesty rather than layout:
 *
 *   - every demo-fed panel carries the `Sample` badge;
 *   - nothing prints a distance, because Clinic.lat/lng are still empty;
 *   - conditions are labelled with where they came from, and never called a
 *     diagnosis;
 *   - the White Collar panel states that nothing auto-debits, which is the
 *     one thing people get caught by.
 *
 *   npx tsx prisma/verify-patient-profile.ts
 */
import { readFileSync } from "node:fs";
import { VisitReason } from "@prisma/client";

import {
  SOURCE_BOOKING,
  SOURCE_SCAN,
  buildConditions,
  perksOf,
} from "../src/lib/queries/profileCore";

let pass = 0;
const fails: string[] = [];
function check(name: string, ok: boolean, detail?: string) {
  if (ok) pass++;
  else fails.push(detail ? `${name} (${detail})` : name);
}
const read = (p: string) => readFileSync(p, "utf8");

const page = read("src/app/patient/profile/page.tsx");
const nav = read("src/components/patient/ProfileNav.tsx");
const demo = read("src/data/patientDemo.ts");

/* ── The menu the client asked for ───────────────────────────────────── */

const REQUIRED = [
  ["reports", "My reports"],
  ["conditions", "My conditions"],
  ["wallet", "My wallet"],
  ["prescriptions", "My prescriptions"],
  ["treatments", "My treatments"],
  ["locations", "Location"],
  ["appointments", "My appointments"],
  ["pay-later", "Pay later"],
  ["white-collar", "White Collar"],
] as const;

for (const [id, label] of REQUIRED) {
  check(`the rail lists ${label}`, page.includes(`id: "${id}"`));
  check(`${label} has a section to land on`, page.includes(`id="${id}"`));
}

check("it is a sidebar, not another long scroll", /ProfileNav/.test(page));
check(
  "the rail is sticky on a desktop",
  /lg:sticky/.test(nav)
);
check(
  "and a sticky strip on a phone",
  /sticky top-20[\s\S]*lg:hidden/.test(nav)
);
check(
  "the strip bleeds to the container's own padding",
  /-mx-5[\s\S]*sm:-mx-8/.test(nav)
);
check(
  "anchors clear the sticky chrome",
  /scroll-mt-\[9rem\][\s\S]*lg:scroll-mt-28/.test(page)
);
// A section's one action was hidden below `sm`, which is where nearly
// everyone reads this.
check(
  "a section's action is reachable on a phone",
  !/className="hidden shrink-0 items-center gap-1 text-sm font-semibold text-brand-200[^"]*sm:inline-flex"/.test(page)
);

/* ── Sample panels are marked as such ────────────────────────────────── */

check("the page defines a Sample badge", /function SampleTag/.test(page));
for (const section of ["wallet", "pay-later"]) {
  // Both are fed entirely from patientDemo and must declare it on the heading.
  const at = page.indexOf(`id="${section}"`);
  const next = page.indexOf('id="', at + 10);
  const block = page.slice(at, next > -1 ? next : undefined);
  check(`${section} is badged Sample`, /\bsample\b/.test(block), "no sample prop");
}
// Saved addresses sit inside the Location section, which is otherwise real —
// so the badge goes on the sub-heading rather than the section.
check(
  "saved addresses are badged inside a real section",
  /Saved addresses[\s\S]{0,120}<SampleTag \/>/.test(page)
);

check(
  "the demo module says what it is for",
  /no backend yet|does not exist|not built/i.test(demo)
);
check(
  "and warns that every panel it feeds is labelled",
  /Sample/.test(demo)
);

/* ── No invented distances ───────────────────────────────────────────── */

// Clinic.lat/lng exist and nothing populates them. /api/clinics already
// refuses to print distances for that reason; this page must too.
check(
  "no distance is printed",
  !/\bkm\b|kilometre|kilometer|distance away/i.test(page)
);
check(
  "and it says why",
  /do not hold coordinates|by area rather than by distance/i.test(page)
);

/* ── Conditions are attributed, never diagnosed ──────────────────────── */

check(
  "conditions disclaim being a diagnosis",
  /Not a diagnosis/.test(page)
);
check(
  "every condition carries its source",
  /\{c\.source\}/.test(page)
);

/* ── Membership tells the truth about renewal ────────────────────────── */

check(
  "White Collar states that nothing auto-debits",
  /Nothing auto-debits|auto-debited/i.test(page)
);
check("the perks come from the plan rows, not prose", /p\.discountPercent/.test(page));
check("scan credits are read from the plan", /p\.scanCredits/.test(page));

/* ── The derivation ──────────────────────────────────────────────────── */

// Imported from profileCore rather than profileData: that module wraps its
// query in React's cache(), which throws the moment tsx loads it. Same split
// as aiAssistCore and insightsCore, for the same reason.
const fmt = (d: Date | string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

{
  const scanDate = new Date("2026-08-01T00:00:00Z");
  const conditions = buildConditions(
    {
      createdAt: scanDate,
      topConcerns: [
        { label: "Acne", score: 30 },
        { label: "Pores", score: 72 },
      ],
    },
    [
      { reason: VisitReason.ACNE, count: 4 },
      { reason: VisitReason.HAIR_LOSS, count: 1 },
      // A booking that predates the intake form. It never said what it was
      // about, so it is not a condition — but it must not throw either.
      { reason: null, count: 9 },
    ],
    fmt
  );

  check("both sources are represented", conditions.length === 4, `got ${conditions.length}`);
  check(
    "every entry names its source",
    conditions.every((c) => c.source === SOURCE_SCAN || c.source === SOURCE_BOOKING)
  );
  check(
    "an unrecorded reason is not invented into a condition",
    !conditions.some((c) => c.key === "reason:null")
  );

  // The bar reads as SEVERITY, so the worse score must draw the longer bar.
  const acneScan = conditions.find((c) => c.key === "scan:Acne");
  const pores = conditions.find((c) => c.key === "scan:Pores");
  check("a worse score is a longer bar", (acneScan?.weight ?? 0) > (pores?.weight ?? 0),
    `acne ${acneScan?.weight} vs pores ${pores?.weight}`);
  check("severity is the inverse of the score", acneScan?.weight === 70, `got ${acneScan?.weight}`);
  check("the scan detail quotes the score verbatim", /Scored 30 of 100/.test(acneScan?.detail ?? ""));

  const acneBooking = conditions.find((c) => c.key === "reason:ACNE");
  const hair = conditions.find((c) => c.key === "reason:HAIR_LOSS");
  check("the busiest reason sets the scale", acneBooking?.weight === 100, `got ${acneBooking?.weight}`);
  check("a quieter one scales against it", hair?.weight === 25, `got ${hair?.weight}`);
  check("counts are pluralised", hair?.detail === "1 appointment", hair?.detail);
  check("and so are the plurals", acneBooking?.detail === "4 appointments", acneBooking?.detail);

  // The same reason from both sources stays as two labelled rows rather than
  // being merged into one unattributed claim.
  check(
    "the two sources are not merged",
    Boolean(acneScan) && Boolean(acneBooking) && acneScan!.source !== acneBooking!.source
  );
}

{
  // No scan yet is the common case for a new client, and must not throw.
  const only = buildConditions(null, [{ reason: VisitReason.ACNE, count: 2 }], fmt);
  check("no scan still yields the booking reasons", only.length === 1);
  check("a lone reason is a full bar, not a divide by zero", only[0].weight === 100);

  const none = buildConditions(null, [], fmt);
  check("a brand-new client gets an empty list, not a crash", none.length === 0);

  const nulls = buildConditions(null, [{ reason: null, count: 3 }], fmt);
  check("reasons with no value alone yield nothing", nulls.length === 0);
}

{
  check("a null Json perks column reads as empty", perksOf(null).length === 0);
  check("a string is not mistaken for a list", perksOf("free scan").length === 0);
  check("non-strings inside the list are dropped", perksOf(["a", 3, null, "b"]).length === 2);
}

console.log(`\n${pass} passed, ${fails.length} failed`);
if (fails.length) {
  fails.forEach((f) => console.log(`  FAIL  ${f}`));
  process.exit(1);
}
