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
 *   - the Gold Collar panel states that nothing auto-debits, which is the
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
/**
 * Source with its comments blanked, and it is the DEFAULT here rather than an
 * opt-in.
 *
 * Five guards across this repo have now failed on the note explaining a fix
 * instead of on the code: `theme-light`, the city list, `text-ink`, the
 * client-facing description, and `-mx-5` right below. The pattern is always
 * the same. Someone fixes a thing, writes down why, and the sentence naming
 * the old approach trips the guard that was watching for it.
 *
 * A comment cannot change behaviour, so nothing is lost by never reading one,
 * and a guard that reads a note about a fix as the fix being absent is worse
 * than no guard at all. Both JSX `{/* … *\/}` blocks and `//` lines go.
 */
const read = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ");

/** The raw file, for the rare check that genuinely wants the prose. */
const readRaw = (p: string) => readFileSync(p, "utf8");

const page = read("src/app/patient/profile/page.tsx");
const nav = read("src/components/patient/ProfileNav.tsx");
// Read raw: these two checks are about the header comment itself, which is
// the one legitimate reason to want the prose back.
const demo = readRaw("src/data/patientDemo.ts");

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
  ["gold-collar", "Gold Collar"],
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
// This guard used to require `-mx-5 ... sm:-mx-8`, which is to say it required
// the bug. The strip lived INSIDE the page's `container-page grid` and cancelled
// the gutter with negative margins; being a grid item, its `min-width: auto`
// sized the track to the pill row's intrinsic width, and /patient/profile
// measured 1,442px wide in a 390px viewport.
//
// It is full-bleed by construction now: a normal block outside the grid, with
// the gutter applied to the pill row as padding. So the check is the opposite
// one, and there is a second half that the first cannot imply on its own.
check(
  "the strip is full-bleed without negative margins",
  !/-mx-5/.test(nav),
  "a negative margin means it is back inside the grid"
);
check(
  "it gutters the pill row with padding instead",
  /overflow-x-auto[^"]*px-5/.test(nav)
);
check(
  "and it is rendered outside the page grid",
  page.indexOf("<ProfileStrip") > -1 &&
    page.indexOf("<ProfileStrip") < page.indexOf("container-page grid"),
  "inside the grid its intrinsic width sets the column"
);
/* The rail has to survive a short screen. Seventeen sections at ~46px each
   is ~780px starting 96px down, so on a laptop under about 900px tall the
   last entries fell below the fold of a STICKY element — and sticky means
   scrolling the page cannot bring them back. They were unreachable. */
check(
  "the rail caps its own height",
  /lg:max-h-\[calc\(100vh-[\d.]+rem\)\]/.test(nav),
  "a sticky rail taller than the viewport hides its last entries permanently"
);
check(
  "and scrolls within itself",
  /lg:overflow-y-auto/.test(nav) && /lg:overscroll-contain/.test(nav)
);

/* Two sections shared the label "My photos": the doctor's published
   before-and-after gallery, and the client's own uploads. Different consent
   rules, indistinguishable in the index. */
const labels = [...page.matchAll(/\{ id: "([a-z-]+)", label: "([^"]+)"/g)].map((m) => ({
  id: m[1],
  label: m[2],
}));
check("the section index was parsed", labels.length > 10, `${labels.length}`);
const dupes = labels
  .map((l) => l.label)
  .filter((l, i, all) => all.indexOf(l) !== i);
check(
  "no two sections share a label",
  dupes.length === 0,
  dupes.length ? `duplicated: ${[...new Set(dupes)].join(", ")}` : undefined
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
// The negative-margin bleed is gone entirely, so there is no width left to
// reconcile against container-page's padding. What replaced this check is the
// pair above: no -mx at all, and the strip rendered outside the grid. Any
// negative margin ANYWHERE in the nav is now the regression, not a mismatched
// one, so it is asserted on the whole file rather than on the numbers.
const bleeds = [...nav.matchAll(/-mx-(\d+)/g)].map((m) => m[1]);
check(
  "the nav takes no negative horizontal margin",
  bleeds.length === 0,
  bleeds.join(",")
);

/* ── Sample panels are marked as such ────────────────────────────────── */

// ── The one mock that is left ─────────────────────────────────────────
// Three panels here were fed from patientDemo and each carried a `Sample`
// badge. Saved addresses and pay-later are real tables now, so their badges
// went with them and the badge component itself is gone: nothing passes
// `sample` any more, and a component nobody renders is a trap, not a safety
// net.
check("no Sample badge machinery is left", !/function SampleTag/.test(page));
check("and nothing passes a sample prop", !/\bsample=\{|\n\s+sample\n/.test(page));

// The wallet is the exception, and it is deliberate: the badge was removed by
// request while the figures stayed mock. That combination is the riskiest
// state on the page, so it is pinned from both sides rather than left to
// memory. Re-badging it is fine; silently making it real is not.
{
  const at = page.indexOf('id="wallet"');
  const next = page.indexOf('id="', at + 10);
  const block = page.slice(at, next > -1 ? next : undefined);
  check("the wallet is still deliberately unbadged", !/\bsample\b/.test(block));
  check(
    "and its figures are still traceably mock",
    /DEMO_WALLET/.test(block),
    "if the wallet is real now, the note at the top of the page must change too"
  );
}

// Addresses and instalments must be the real thing, not merely unbadged: an
// empty section would also pass a "no badge" check on its own.
check("saved addresses are the editable component", /<AddressBook/.test(page));
check("instalments read the real programme", /PAY_LATER\./.test(page));
const demoSrc = readRaw("src/data/patientDemo.ts");
check(
  "patientDemo holds nothing but the wallet",
  !/DEMO_ADDRESSES\s*[:=]/.test(demoSrc) && !/DEMO_PAY_LATER\s*[:=]/.test(demoSrc)
);

/* ── Distances are real now, and still hedged ────────────────────────── */

// This block used to assert that NO distance was printed, because nothing
// populated Clinic.lat/lng. Every clinic is geocoded now, so the checks invert:
// distances may be shown, and what has to hold instead is that they never
// claim more precision than a straight line can support.
check(
  "the clinic list is ordered by proximity",
  /<NearbyClinics/.test(page),
  "the old note said distance could not be shown; it can"
);

const nearbySrc = readRaw("src/components/patient/NearbyClinics.tsx");
check(
  "distances are hedged, never exact",
  /straight-line and approximate/.test(nearbySrc),
  "a precise-looking 4.2 km that is an 11 km drive costs more trust than it buys"
);
check(
  "the ordering happens on the client, where the position already is",
  /"use client"/.test(nearbySrc) && /useClientLocation/.test(nearbySrc),
  "a person's coordinates should not be sent to a server so a list can sort"
);
check(
  "no location means no reshuffling",
  /byDistance\(clinics, from\)/.test(nearbySrc)
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
  "Gold Collar states that nothing auto-debits",
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

/* -- Illustrated data never reaches a real client -----------------------
   The wallet had no table behind it and rendered for EVERY signed-in client:
   a brand-new account with nought reports and nought appointments was shown a
   balance of Rs 2,450, a lifetime cashback total, and movement rows naming a
   doctor they had never seen and a serum they had never bought.

   A figure somebody cannot spend is not a placeholder, whatever it is
   labelled next to. So the rule is checked from both ends: the page must
   gate it, and the gate must default to hiding. */
const profilePage = read("src/app/patient/profile/page.tsx");
const demoLib = read("src/lib/demo.ts");

check(
  "the wallet is gated on the account being a demo one",
  profilePage.includes("const showWallet = isDemoAccount(user.email)"),
  "every client sees a balance they cannot spend"
);
check(
  "and every place it renders is behind that gate",
  (profilePage.match(/showWallet && \(/g) ?? []).length >= 2 &&
    profilePage.includes("...(showWallet"),
  "the nav entry, the hero band and the panel each render it separately"
);
check(
  "no demo constant is read outside the gate",
  (profilePage.match(/DEMO_WALLET/g) ?? []).length > 0 &&
    !/DEMO_[A-Z_]+/.test(profilePage.replace(/DEMO_WALLET/g, "")),
  "another illustrated constant has been added"
);
check(
  "an unknown or missing email is NOT a demo account",
  demoLib.includes("if (!email) return false"),
  "getting this wrong in that direction shows a paying client invented money"
);
check(
  "the demo domains cannot be registered by a real person",
  demoLib.includes("bluderma.local"),
  "a reachable domain means somebody could claim a demo account"
);
check(
  "the seed and the predicate name the same accounts",
  ["demo.doctor@bluderma.local", "demo.client@bluderma.local"].every(
    (e) => demoLib.includes(e) && read("prisma/seed-demo-doctor.ts").includes(e)
  )
);

console.log(`\n${pass} passed, ${fails.length} failed`);
if (fails.length) {
  fails.forEach((f) => console.log(`  FAIL  ${f}`));
  process.exit(1);
}
