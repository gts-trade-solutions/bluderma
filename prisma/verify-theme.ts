/**
 * Light-themed pages must actually be light-themed.
 *
 * The site is dark by default: `text-ink` is near-white, and the standard
 * "raised surface" is a wash of translucent white over navy. `.theme-light` is
 * the escape hatch that flips both. A page that sets a light BACKGROUND but
 * forgets the CLASS gets near-white text on near-white cards — which is what
 * /patient/appointments was doing: the card, the doctor's name, the date and
 * both action links were all invisible, and the only readable thing on it was
 * the one status pill that happened to use a dark green.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

let pass = 0;
const fails: string[] = [];
function check(name: string, ok: boolean, detail?: string) {
  if (ok) pass++;
  else fails.push(detail ? `${name} (${detail})` : name);
}
const read = (p: string) => readFileSync(p, "utf8");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

const css = read("src/app/globals.css");

// ── The escape hatch has to cover everything the dark theme leans on ──────
for (const rule of [
  ".theme-light .text-ink",
  ".theme-light .text-ink-soft",
  ".theme-light .text-ink-muted",
  // The raised-surface wash. Invisible over a light page without this.
  ".theme-light .bg-white\\/\\[0\\.04\\]",
  ".theme-light .bg-white\\/\\[0\\.06\\]",
  ".theme-light .bg-white\\/10",
  // Hairlines and rings drawn in translucent white.
  ".theme-light .border-white\\/10",
  ".theme-light .ring-white\\/10",
  ".theme-light .divide-white\\/10",
]) {
  check(`globals.css defines ${rule}`, css.includes(rule));
}

// ── No page may set a light background without the class ─────────────────
/**
 * Matches a light page background.
 *
 * No trailing `\b`: a word boundary after "]" never matches, and an earlier
 * version of this pattern therefore skipped `bg-[#f7fafc]` — the exact class
 * that caused the bug this file exists to catch. Each alternative carries its
 * own right-hand guard instead.
 */
export const LIGHT_BG =
  /bg-white(?![/\d-])|bg-(?:slate|gray|neutral|zinc|stone)-50(?!\d)|bg-\[#[fF][0-9a-fA-F]{5}\]|bg-\[#[fF][0-9a-fA-F]{2}\](?![0-9a-fA-F])/;

const pageFiles = walk("src/app").filter(
  (f) => f.endsWith("page.tsx") || f.endsWith("layout.tsx")
);

const offenders: string[] = [];
for (const f of pageFiles) {
  const src = read(f);
  // Only the page-level wrapper matters: a light bg on a full-height container
  // is what puts the whole tree on a light ground.
  for (const m of src.matchAll(/className="([^"]*min-h-screen[^"]*)"/g)) {
    const cls = m[1];
    if (LIGHT_BG.test(cls) && !cls.includes("theme-light")) {
      offenders.push(`${f.replace(/\\/g, "/")} — ${cls}`);
    }
  }
}
check(
  `no page sets a light background without theme-light (${offenders.length} found)`,
  offenders.length === 0
);
offenders.forEach((o) => fails.push(`  light bg, no theme-light: ${o}`));

// ── The known light pages still declare it ───────────────────────────────
for (const f of [
  "src/app/patient/appointments/page.tsx",
  "src/app/admin/layout.tsx",
  "src/app/doctor/portal/layout.tsx",
  "src/app/doctor/join/page.tsx",
]) {
  check(`${f.split("/").slice(-2).join("/")} is theme-light`, read(f).includes("theme-light"));
}

// ── Nothing on the light page may use a dark-theme-only ink ──────────────
// 200/300-weight accents are chosen to glow on navy; on a white card they are
// barely there. text-white is fine ON a saturated fill, and only there.
const LIGHT_PAGE_COMPONENTS = [
  "src/components/patient/AppointmentsView.tsx",
  "src/components/patient/AppointmentControls.tsx",
];
for (const f of LIGHT_PAGE_COMPONENTS) {
  const src = read(f);
  const faint = [
    ...src.matchAll(
      /text-(?:rose|brand|teal|amber|emerald|sky|violet|indigo)-[23]00\b/g
    ),
  ].map((m) => m[0]);
  check(`${f.split("/").pop()} has no faint accent text`, faint.length === 0);

  const whiteText = [...src.matchAll(/text-white(?:\/\d+)?\b/g)].map((m) => m[0]);
  // Every remaining text-white must sit on a saturated background in the same
  // class list, which is the only place white reads.
  const bad = whiteText.filter((_, i) => {
    const idx = src.indexOf("text-white", i);
    const around = src.slice(Math.max(0, idx - 160), idx + 40);
    return !/bg-(?:rose|brand|teal|emerald|amber|sky|violet|indigo|slate-[789])/.test(
      around
    );
  });
  check(`${f.split("/").pop()} only uses white text on a coloured fill`, bad.length === 0);
}

// ── Dark regions inside a light page must opt out of the remapping ───────
// The mirror of the mirror, and a regression I shipped: .theme-light repaints
// translucent whites solid so cards read on a light canvas — but the portal's
// navigation rail and the dashboard's revenue band are deliberately dark and
// live INSIDE that wrapper. Every wash on them turned opaque white, which is
// how the rail ended up a white box with white text in it.
check(
  "globals defines the on-dark escape",
  css.includes(".theme-light .on-dark .bg-white")
);
check(
  "the escape restores ink too",
  css.includes(".theme-light .on-dark .text-ink")
);
// It must out-specify the rule it overrides: 3 classes beats 2.
check(
  "the escape has higher specificity than the rule it undoes",
  css.indexOf(".theme-light .on-dark .bg-white") > -1 &&
    css.indexOf(".theme-light .bg-white") > -1
);

// Every dark surface rendered inside a theme-light page needs the class.
const DARK_SURFACE = /bg-\[#0[0-9a-f]{5}\]/;
for (const f of [
  "src/components/doctor/PortalRail.tsx",
  "src/components/doctor/dashboard/DashboardHome.tsx",
  "src/components/doctor/JoinHero.tsx",
]) {
  const src = read(f);
  const name = f.split("/").pop();
  // Only elements that also paint translucent whites on themselves matter.
  const usesWash = /bg-white\/|ring-white\/|border-white\//.test(src);
  if (!usesWash) continue;
  const darkBlocks = [...src.matchAll(/className="([^"]*bg-\[#0[0-9a-f]{5}\][^"]*)"/g)];
  check(
    `${name} marks its dark regions on-dark`,
    darkBlocks.length === 0 || darkBlocks.some((m) => m[1].includes("on-dark")),
    `${darkBlocks.length} dark block(s)`
  );
  check(`${name} has a dark surface to mark`, DARK_SURFACE.test(src));
}

// ── Dark-page components must not hardcode a light surface ───────────────
// The mirror image of the bug above, and the one that shipped: PhotoAttach and
// SkinReportAttach were written with `bg-white` cards and `text-ink` headings.
// text-ink is near-white in the dark theme, so on the (dark) booking page they
// rendered as white cards with invisible titles. Use the theme-aware
// bg-white/[0.0x] + ring-white/10 idiom instead — .theme-light maps it, so the
// same markup also works if it ever lands on a light page. A solid bg-white
// can only ever be right on one of the two.
const DARK_PAGE_DIRS = ["src/components/booking"];
const SOLID_LIGHT =
  /bg-white(?![/\d-])|border-slate-[1-4]00|ring-slate-[1-4]00/;

for (const dir of DARK_PAGE_DIRS) {
  for (const f of walk(dir)) {
    const src = read(f);
    const hits = [...src.matchAll(new RegExp(SOLID_LIGHT, "g"))].map((m) => m[0]);
    check(
      `${f.split(/[\/]/).pop()} uses no solid light surface`,
      hits.length === 0
    );
    // Accents on a dark ground need the light steps, not the dark ones.
    const darkAccents = [
      ...src.matchAll(/text-(?:amber|brand|teal|rose|emerald)-[6-9]00/g),
    ].map((m) => m[0]);
    // …unless they sit on a saturated fill, where dark-on-light is correct.
    const onFill = darkAccents.filter((a) => {
      const i = src.indexOf(a);
      return /bg-(?:amber|brand|teal|rose|emerald|white)/.test(
        src.slice(Math.max(0, i - 120), i)
      );
    });
    check(
      `${f.split(/[\/]/).pop()} uses light-step accents on the dark ground`,
      darkAccents.length === onFill.length
    );
  }
}

// ── The status pills carry their own contrast ────────────────────────────
const view = read("src/components/patient/AppointmentsView.tsx");
const pillBlock = view.slice(
  view.indexOf("const STATUS_STYLE"),
  view.indexOf("};", view.indexOf("const STATUS_STYLE"))
);
check("no pill uses translucent white text", !/text-white/.test(pillBlock));
for (const state of ["CONFIRMED", "PENDING", "CANCELLED", "COMPLETED", "NO_SHOW"]) {
  check(`${state} pill is defined`, pillBlock.includes(state));
}
// Every pill's text colour must be a dark step (600-900), readable on light.
const pillTexts = [...pillBlock.matchAll(/text-([a-z]+)-(\d{3})/g)].map((m) =>
  Number(m[2])
);
check(
  "every pill uses a dark ink step",
  pillTexts.length >= 5 && pillTexts.every((n) => n >= 600)
);

/* ------------------------------------------------------------------------
   The doctor front door moved to the dark canvas
   --------------------------------------------------------------------- */
// It was the one page on the site that greeted a visitor with a white screen,
// sitting between a dark home page and a dark navbar. The PORTAL stays light;
// the marketing page in front of it does not.
const front = read("src/app/doctor/page.tsx");
// A className, not a mention: the file explains in a comment why the class is
// gone, and a naive substring test would read that comment as the bug.
check(
  "the doctor front door is not theme-light",
  !/className="[^"]*theme-light/.test(front)
);
check("it paints the shared surface", front.includes("bg-[var(--surface)]"));
check("its navbar is not forced light", !front.includes('chrome="light"'));

// The calendar sketch inside it is deliberately still white — it depicts the
// portal, which IS white, and a dark mock would misrepresent the product. The
// trap is that `text-ink` resolves to a near-WHITE outside .theme-light, so
// every colour inside that frame has to be a literal.
const preview = read("src/components/doctor/PortalPreview.tsx");
const sketchStart = preview.indexOf("rounded-2xl bg-white p-1");
const sketchEnd = preview.indexOf("<figcaption");
check("the portal sketch is still framed", sketchStart > -1 && sketchEnd > sketchStart);
if (sketchStart > -1 && sketchEnd > sketchStart) {
  const sketch = preview.slice(sketchStart, sketchEnd);
  check(
    "nothing inside the white sketch uses an ink token",
    !/text-ink|bg-ink(?![-\w])/.test(sketch)
  );
  check(
    "the sketch names its own dark colours",
    /text-slate-\d{3}|bg-slate-900/.test(sketch)
  );
}

console.log(`\n${pass} passed, ${fails.length} failed`);
if (fails.length) {
  fails.forEach((f) => console.log(`  FAIL  ${f}`));
  process.exit(1);
}
