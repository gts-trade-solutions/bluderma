/**
 * The doctor calendar's colour and state markings.
 *
 * One rule shapes everything here: colour means WHICH CLINIC. That is a good
 * use of the only pre-attentive channel a calendar has, and state must not be
 * allowed to take it. So state rides on a ring, a character and a label, none
 * of which overwrites the hue underneath.
 *
 * The other rule is the Tailwind one this repo keeps relearning: a composed
 * class name compiles to nothing and the colour silently goes missing, so
 * every class in the swatch tables is asserted to be a full literal.
 *
 *   npx tsx prisma/verify-calendar.ts
 */
import { readFileSync } from "node:fs";

import { PrismaClient } from "@prisma/client";

import {
  CLINIC_COLOR_KEYS,
  CANCELLED_SWATCH,
  hexFor,
  swatchFor,
} from "../src/components/doctor/clinicColors";
import {
  LEGEND_STATES,
  STATE_STYLES,
  stateOf,
} from "../src/components/doctor/visitStatus";

const prisma = new PrismaClient({ log: ["error"] });

let pass = 0;
const fails: string[] = [];
function check(name: string, ok: boolean, detail?: string) {
  if (ok) pass++;
  else fails.push(detail ? `${name} (${detail})` : name);
}
const read = (p: string) => readFileSync(p, "utf8");

/**
 * Source with its comments blanked.
 *
 * The composed-class check below matched the doc comment that EXPLAINS why
 * classes must not be composed. That is the eighth time in this repo a guard
 * has tripped on the note describing the rule rather than on a breach of it,
 * so this suite strips comments before it looks at anything.
 */
const codeOnly = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ");

async function main() {
  /* ── Every swatch is a literal, and distinguishable ────────────────── */

  const src = codeOnly("src/components/doctor/clinicColors.ts");
  check(
    "no class name is composed",
    !/["`]bg-\$\{|["`]border-l-\$\{|["`]text-\$\{/.test(src),
    "an interpolated class compiles to nothing and the colour vanishes"
  );

  const blocks = new Set<string>();
  for (const k of CLINIC_COLOR_KEYS) {
    const sw = swatchFor(k);
    for (const [field, value] of Object.entries(sw)) {
      check(`${k}.${field} is set`, typeof value === "string" && value.length > 0);
    }
    blocks.add(sw.block);
  }
  check(
    "every clinic gets a different block",
    blocks.size === CLINIC_COLOR_KEYS.length,
    `${blocks.size} of ${CLINIC_COLOR_KEYS.length}`
  );

  /* The point of the change: a tint of a hue is not the hue. -50 was about
     four percent of one and -100 not much more -- enough to tell two blocks
     apart if you compared them deliberately, not enough to read a day at a
     glance, which is the whole job.

     Pinned to "saturated", not to a step: 500 for most, 600 for amber and
     orange whose 500 cannot carry white type above AA. What must hold is that
     the fill is strong AND the text on it is white -- a saturated fill with
     dark type is the same unreadable block in a louder colour. */
  check(
    "fills are saturated, not tinted",
    CLINIC_COLOR_KEYS.every((k) => /bg-[a-z]+-(500|600)(?![0-9])/.test(swatchFor(k).block)),
    "a -50 or -100 fill on a white grid cannot be told apart at a glance"
  );
  check(
    "and every one carries white type",
    CLINIC_COLOR_KEYS.every((k) => /text-white/.test(swatchFor(k).block))
  );
  check(
    "and the edge is stronger still",
    CLINIC_COLOR_KEYS.every((k) => /border-l-\w+-600\b/.test(swatchFor(k).edge))
  );
  check(
    "an unknown key falls back rather than throwing",
    swatchFor("chartreuse").block === swatchFor(null).block
  );
  check("every hue has a hex twin for charts", CLINIC_COLOR_KEYS.every((k) => /^#[0-9a-f]{6}$/i.test(hexFor(k))));

  // Cancelled deliberately does NOT follow the others: it keeps its place so
  // the doctor sees the slot came back, but stops competing for attention.
  check(
    "a cancelled booking stays pale",
    /bg-slate-50/.test(CANCELLED_SWATCH.block) && /line-through/.test(CANCELLED_SWATCH.block)
  );

  /* ── State is carried without stealing the hue ─────────────────────── */

  for (const k of LEGEND_STATES) {
    check(`${k} has a label`, STATE_STYLES[k].label.length > 0);
    check(`${k} has a legend chip`, STATE_STYLES[k].chip.length > 0);
  }
  check(
    "waiting-on-you is a RING, not a fill",
    /ring-2/.test(STATE_STYLES.awaiting.block) &&
      !/\bbg-/.test(STATE_STYLES.awaiting.block),
    "a fill would overwrite which clinic the booking is at"
  );
  check(
    "and it carries a character too",
    STATE_STYLES.awaiting.tag !== null,
    "colour alone fails anyone who cannot separate amber from orange"
  );
  check("no-show is marked as well", STATE_STYLES["no-show"].tag !== null);

  /* ── The state a row is in ─────────────────────────────────────────── */

  check("cancelled wins", stateOf({ status: "CANCELLED", approvalState: "AWAITING_DOCTOR" }) === "cancelled");
  check(
    "even over awaiting",
    stateOf({ status: "CANCELLED", approvalState: "AWAITING_DOCTOR" }) !== "awaiting",
    "the slot is back and nothing is owed; flagging it sends a doctor to a dead booking"
  );
  check("a no-show is its own state", stateOf({ status: "NO_SHOW" }) === "no-show");
  check("completed is recognised", stateOf({ status: "COMPLETED" }) === "completed");
  check("awaiting is recognised", stateOf({ status: "CONFIRMED", approvalState: "AWAITING_DOCTOR" }) === "awaiting");
  check("and the default is confirmed", stateOf({ status: "CONFIRMED", approvalState: "AUTO" }) === "confirmed");

  /* ── The calendar uses both, and explains them ─────────────────────── */

  const cal = codeOnly("src/components/doctor/DoctorCalendar.tsx");
  check("blocks carry the clinic swatch", /\$\{sw\.block\}/.test(cal));
  check("and the state on top of it", /\$\{st\.block\}/.test(cal));
  check(
    "the state is announced to a screen reader",
    /sr-only.{0,40}st\.label/s.test(cal),
    "a ring says nothing to somebody who cannot see it"
  );
  check(
    "the key lists only what is on screen",
    /LEGEND_STATES\.filter/.test(cal),
    "explaining four things when two are visible teaches people to stop reading it"
  );

  /* ── Live: real clinics have distinct colours ──────────────────────── */

  const clinics = await prisma.clinic.findMany({
    where: { isActive: true },
    select: { name: true, colorKey: true },
  });
  check("clinics carry a colour key", clinics.every((c) => c.colorKey.length > 0));
  check(
    "and every key resolves to a real swatch",
    clinics.every((c) => swatchFor(c.colorKey).block !== swatchFor("nonsense-key").block ||
      c.colorKey === "slate"),
    clinics.map((c) => c.colorKey).join(", ")
  );
}

main()
  .catch((e) => fails.push(`threw: ${e.message ?? e}`))
  .finally(async () => {
    await prisma.$disconnect();
    /* -- The keys Google Calendar trained everyone to press ------------------
   Asked for Google Calendar as the benchmark. Most of the geometry was
   already there — a minute-positioned grid, overlap lanes, a now line — so
   what was missing was the part that makes it feel fast: the keyboard, and
   opening where the day actually is. */
const cal = read("src/components/doctor/DoctorCalendar.tsx");

check("D, W and M switch view", /key === "d"/.test(cal) && /key === "w"/.test(cal) && /key === "m"/.test(cal));
check("T jumps to today", /key === "t"/.test(cal));
check("the arrows step", cal.includes('e.key === "ArrowLeft"') && cal.includes('e.key === "ArrowRight"'));
check(
  "typing is never swallowed",
  cal.includes('["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)') &&
    cal.includes("el.isContentEditable"),
  "a doctor filling a field who presses d must not have the view change"
);
check(
  "and a modifier chord is left to the browser",
  cal.includes("if (e.metaKey || e.ctrlKey || e.altKey) return;"),
  "Ctrl+D has to keep bookmarking"
);
check("the shortcut is discoverable on the control", cal.includes("(press ${v[0].toUpperCase()})"));

/* -- It opens where the day is ------------------------------------------ */
check(
  "the grid scrolls to the current hour",
  cal.includes("nowMinuteOfDay()") && cal.includes("el.scrollTo"),
  "it opened at 07:00 every time, so the afternoon was always a scroll away"
);
check(
  "using clinic wall-clock, not the browser's",
  cal.includes("Date.now() + 330 * 60_000"),
  "reading local hours puts the grid five and a half hours out abroad"
);
check(
  "and does not drag the page with it",
  !/\.scrollIntoView\(/.test(cal),
  "scrollIntoView would scroll the portal under the calendar too"
);

/* -- The layout every calendar a doctor already uses -------------------- */
const rail = read("src/components/doctor/CalendarRail.tsx");

check("there is a rail beside the grid", cal.includes("<CalendarRail"));
check(
  "carrying a mini month",
  rail.includes("MINI_WEEKDAYS") && rail.includes("daysInMonth"),
  "the grid says what is happening now; the mini month says where you are in it"
);
check(
  "whose dots come from the same data the grid renders",
  cal.includes("byDay.forEach((list, seed) => m.set(seed, list.length))"),
  "a rail counting separately can disagree with what opening the day shows"
);
check(
  "and the location filter, off the toolbar",
  rail.includes("All locations") && !cal.includes("All locations"),
  "five locations in a chip row pushed the calendar itself off the screen"
);
check(
  "the rail stands down where it cannot fit",
  rail.includes("hidden") && rail.includes("xl:block"),
  "a 7x6 mini month beside a day column leaves neither readable on a phone"
);

/* -- Density: the marks that make a grid read as a calendar ------------- */
check(
  "the half hour is marked",
  cal.includes("border-dashed") && cal.includes("h * 60 + 30"),
  "a 30-minute consultation is the commonest length here"
);
check(
  "the hour rule is stronger than the half",
  cal.includes("border-t border-slate-200") && cal.includes("border-dashed border-slate-100")
);
check(
  "neither can swallow a click meant for a booking",
  (cal.match(/pointer-events-none absolute inset-x-0 border-t/g) ?? []).length >= 2
);

/* -- Toolbar order ------------------------------------------------------ */
check(
  "the controls sit together, ahead of the date",
  cal.includes('order-first flex shrink-0 items-center') && cal.includes("order-last"),
  "the heading is read; the buttons are pressed, and they should not be split"
);
check("Today is a button, not a hidden shortcut", cal.includes('title="Today (press T)"'));

console.log(`\n${pass} passed, ${fails.length} failed`);
    if (fails.length) {
      fails.forEach((f) => console.log(`  FAIL  ${f}`));
      process.exit(1);
    }
  });
