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

/* ── It has to work on a phone ───────────────────────────────────────── */

// Four lists (appointments, treatments, wallet, orders) each wrote out the
// same row by hand: `justify-between` with a `min-w-0` that had no `flex-1`
// beside it. On a phone the meta was pushed to the far edge while there was
// room, then dropped onto its own line LEFT-aligned the moment there was not,
// so the same list changed shape between a small phone and a large one.
check(
  "list rows go through one shared component",
  (page.match(/<Row/g) ?? []).length >= 4,
  `${(page.match(/<Row/g) ?? []).length} found`
);
check("that component exists", /function Row\(/.test(page));
check(
  "no row still hand-rolls the old pattern",
  !/flex flex-wrap items-center justify-between gap-3 px-5 py-4/.test(page)
);
// The fix that matters: the title column has to GROW, or justify-between
// strands the meta against the far edge.
check(
  "the title column grows rather than just permitting shrink",
  /min-w-0 flex-1/.test(page)
);
check(
  "rows stack below sm instead of wrapping",
  /flex flex-col gap-2 px-4 py-3\.5 sm:flex-row/.test(page)
);
check(
  "and pay less padding to the gutter on a phone",
  /px-4 py-3\.5 sm:[\s\S]{0,60}sm:px-5/.test(page)
);
// A price or a status pill must never be squeezed by a long title.
check("meta never shrinks", /flex shrink-0 flex-wrap items-center/.test(page));

// Anything that sits beside prose and cannot usefully compress.
for (const [what, near] of [
  ["the skin-type pill", "shrink-0 rounded-full bg-white/10"],
  ["the prescription PDF button", "btn-ghost shrink-0"],
  ["the plan price", 'shrink-0 text-right'],
] as const) {
  check(`${what} is protected from squeeze`, page.includes(near));
}

// The strip: ten pills, hidden scrollbar. Without an affordance it reads as a
// complete list of the four that happen to fit.
check("the phone strip hints that it scrolls", /mask-image:linear-gradient/.test(nav));
check(
  "the active pill is scrolled into view",
  /scrollIntoView\(\{ inline: "nearest"/.test(nav)
);
check(
  "pills meet a 44px touch target",
  /min-h-11/.test(nav),
  "min-h-11 is 2.75rem = 44px, the smallest comfortable tap"
);

// Nothing may be wider than the viewport.
for (const [file, src] of [
  ["profile/page.tsx", page],
  ["ProfileNav.tsx", nav],
] as const) {
  check(`${file} uses no viewport-width unit`, !/w-screen|100vw/.test(src));
}
// The one negative margin is deliberate: it matches container-page's own
// px-5 sm:px-8 so the strip bleeds edge to edge without overflowing.
const bleeds = [...nav.matchAll(/-mx-(\d+)/g)].map((m) => m[1]);
check(
  "the strip's bleed matches the container's padding",
  bleeds.length > 0 && bleeds.every((n) => n === "5" || n === "8"),
  bleeds.join(",") || "none"
);

/* ── Sample panels are marked as such ────────────────────────────────── */

check("the page defines a Sample badge", /function SampleTag/.test(page));

// The wallet USED to be on this list. Its badge was removed by request, so it
// now renders DEMO_WALLET as though it were a live balance. That is a product
// decision and not this suite's to overturn, but it does move the risk: the
// figure a client is most likely to act on is the one they can no longer tell
// is illustrative. So the check inverts rather than disappearing. The badge is
// asserted GONE, and the source of the number asserted still to be the mock,
// so whoever wires a real wallet up is told by a failing test to come here.
{
  const at = page.indexOf('id="wallet"');
  const next = page.indexOf('id="', at + 10);
  const block = page.slice(at, next > -1 ? next : undefined);
  check(
    "the wallet is deliberately unbadged",
    !/\bsample\b/.test(block),
    "re-badging it is fine, but then put it back on the list below"
  );
  check(
    "and its figures still come from patientDemo",
    /DEMO_WALLET/.test(block),
    "if the wallet is real now, patientDemo's header exception must go too"
  );
}

for (const section of ["pay-later"]) {
  // Fed entirely from patientDemo and must declare it on the heading.
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
