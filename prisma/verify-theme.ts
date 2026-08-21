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
//
// The doctor portal was on this list and is not any more. It now stands on
// --surface, the same navy every client screen uses, because a practitioner
// coming off the public site and signing in should not feel handed to a
// different company's admin tool. Dropping `.theme-light` is what makes the
// four screens that never carried a colour of their own (calendar, requests,
// practice, today) arrive correct: `card-soft` and the ink tokens mean there
// exactly what they mean on the hub. Its own checks are at the foot of this
// file, and they are the opposite of this one.
for (const f of [
  "src/app/patient/appointments/page.tsx",
  "src/app/admin/layout.tsx",
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

//
// JoinHero was on this list and is not any more. It became a LIGHT island
// on a dark page rather than a dark one on a light page: the client's note
// was that the old treatment was dull and the image was not visible under
// the overlay. It still uses translucent whites, but on a pale ground where
// they are simply correct, so `on-dark` has nothing to undo. Its hazard is
// the opposite one, and the check for it is at the foot of this file.
// Every dark surface rendered inside a theme-light page needs the class.
const DARK_SURFACE = /bg-\[#0[0-9a-f]{5}\]/;
// DashboardHome came off this list with the portal: it is no longer a light
// page with dark islands on it, it is dark throughout, so there is no
// light-to-dark boundary left for `on-dark` to repair. PortalRail stays,
// because the rail is still its own darker surface and still has to survive
// being rendered inside a theme-light page elsewhere.
for (const f of ["src/components/doctor/PortalRail.tsx"]) {
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
  /\bbg-white(?![/\d-])|\bborder-slate-[1-4]00\b|\bring-slate-[1-4]00\b/;

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
      ...src.matchAll(/text-(?:amber|brand|teal|rose|emerald)-[6-9]00\b/g),
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
  !/className="[^"]*\btheme-light\b/.test(front)
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

/* ------------------------------------------------------------------------
   One word for one person
   --------------------------------------------------------------------- */
// The site used to call the same human a "clinician" in the navbar and footer,
// a "practitioner" on /forbidden and the register form, and a "doctor" in
// every route, CTA and role label. Two of those shipped together and read as
// two different products.
//
// This walks every quoted string and JSX text node under src/ and fails on the
// retired word. Comments and identifiers are exempt: `isClinician()`
// deliberately keeps its name — it returns true for admins as well, so
// renaming it would be a lie about what it does — and the legal pages keep
// "qualified, licensed practitioner", a term of art covering more than doctors
// that must not be narrowed by a copy sweep.
const RETIRED = /\b(clinician|clinicians)\b/i;
const LEGAL_EXEMPT = /src[\/]app[\/]\(legal\)[\/]/;

/** Strips comments, so a note explaining the rename is not itself a failure. */
function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
}

/**
 * Every source file, not only the components.
 *
 * The shared `walk()` above collects `.tsx` alone, which is right for the
 * theme checks — but the label that started all this lives in
 * lib/queries/nav.ts, and a sweep that cannot see a `.ts` file would have
 * reported the site clean while the navbar still said the wrong thing.
 */
function walkSrc(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walkSrc(p, out);
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

const wordOffenders: string[] = [];
for (const f of walkSrc("src")) {
  if (LEGAL_EXEMPT.test(f)) continue;

  const body = codeOnly(read(f));
  // The JSX branch must span newlines. It did not, first time round, and the
  // guard passed with "For clinicians" put back into Footer.tsx — because
  // that label sits on its own line between a `>` and a `</Link>`, so
  // requiring both brackets on one line matched nothing at all. Non-greedy
  // and bounded by the next bracket, so it cannot run away across a file.
  for (const m of body.matchAll(/"([^"\n]{2,})"|'([^'\n]{2,})'|>([^<>{}]{2,}?)</g)) {
    const text = m[1] ?? m[2] ?? m[3] ?? "";
    if (/^[.@][\w./@-]*$/.test(text)) continue; // an import path, not copy
    if (RETIRED.test(text)) {
      wordOffenders.push(`${f.replace(/\\/g, "/")} — ${text.trim().slice(0, 70)}`);
    }
  }
}
check(
  `no visible copy still says "clinician" (${wordOffenders.length} found)`,
  wordOffenders.length === 0
);
wordOffenders.forEach((o) => fails.push(`  retired word: ${o}`));

// Non-vacuous: the detector has to fire on the exact label that shipped, and
// must not fire on "clinical", which is a different word we still use.
check("the detector catches the label that shipped", RETIRED.test("For clinicians"));
check("and is not tripped by 'Clinical note'", !RETIRED.test("Clinical note"));


/* ------------------------------------------------------------------------
   A rail must never be wider than the column it sits in
   --------------------------------------------------------------------- */
// Rail bleeds by exactly container-page's padding so the scroll surface can
// reach the edge of the screen. That is right when its parent IS the padded
// container, and wrong when it sits in a grid COLUMN: on the explore page the
// content column has a sticky analyser panel beside it, and a rail bleeding
// 32px to the right ran underneath it. The treatment cards looked cut off
// because they were being painted over.
const rail = read("src/components/hub/Rail.tsx");
check("Rail can be told it lives in a column", /bleed\?:\s*"page"\s*\|\s*"column"/.test(rail));
check(
  "and stops bleeding at lg when it does",
  /lg:mx-0 lg:px-0/.test(rail),
  "below lg the grid collapses into container-page, where the bleed is correct"
);

// Every rail rendered inside the explore page's content column, or inside a
// component only used there.
for (const f of [
  "src/app/patient/explore/page.tsx",
  "src/components/hub/CategoryRows.tsx",
  "src/components/hub/ConcernRail.tsx",
  "src/components/hub/BeforeAfter.tsx",
  "src/components/hub/CategoryPills.tsx",
]) {
  const src = read(f);
  const rails = (src.match(/<Rail/g) ?? []).length;
  const scoped = (src.match(/bleed="column"/g) ?? []).length;
  check(
    `${f.split("/").pop()} scopes every rail to its column`,
    rails === 0 || scoped >= rails,
    `${scoped} of ${rails}`
  );
}

/* ------------------------------------------------------------------------
   The three analyser cards are siblings
   --------------------------------------------------------------------- */
// The skin card was given a gradient and the other two were left flat, so the
// rail read as one real product and two afterthoughts.
const analyzer = read("src/components/hub/AnalyzerRail.tsx");
const gradients = (analyzer.match(/bg-gradient-to-br from-\w+-\d00/g) ?? []).length;
check("all three analyser cards carry a gradient", gradients >= 3, `${gradients} found`);
const hues = new Set(
  [...analyzer.matchAll(/bg-gradient-to-br from-(\w+)-\d00/g)].map((m) => m[1])
);
check("each in its own hue", hues.size >= 3, [...hues].join(", "));

/* ------------------------------------------------------------------------
   One sign-in, and it says so
   --------------------------------------------------------------------- */
const loginForm = read("src/components/auth/LoginForm.tsx");
check(
  "the login page states that one sign-in serves both roles",
  /One sign-in for clients and doctors/.test(loginForm)
);
check("and offers a doctor a way to register as one", /as=doctor/.test(loginForm));

/* ------------------------------------------------------------------------
   The site does not name cities at a visitor
   --------------------------------------------------------------------- */
const locationBtn = read("src/components/hub/LocationButton.tsx");
check(
  "the location chooser proposes no cities of its own",
  !/REGION_CITIES|REGION_STATES/.test(locationBtn)
);
check(
  "it still detects, and still takes free text",
  /Use my current location/.test(locationBtn) && /<input/.test(locationBtn)
);
// The pill echoes the VISITOR's own city, which is why the feature survives:
// a Korean visitor sees Seoul, not Chennai. What made the site read as Indian
// was the curated list it proposed, and that is what went.
check(
  "and proposes nothing of its own",
  !/RegionChip/.test(locationBtn),
  "the chip renderer is orphaned once the lists are gone"
);
check(
  "its copy names no country",
  // Comments stripped: the note explaining WHY the Indian lists went would
  // otherwise read as the lists still being there. Same trap as theme-light.
  !/India|Indian|Tamil Nadu|Chennai|Bengaluru|Mumbai/.test(codeOnly(locationBtn))
);

/* ------------------------------------------------------------------------
   Client or doctor, answered by a control rather than a paragraph
   --------------------------------------------------------------------- */
const toggle = read("src/components/auth/AudienceToggle.tsx");
check("an audience toggle exists", /export default function AudienceToggle/.test(toggle));
check("it is a tablist", /role="tablist"/.test(toggle));
// The switch must not look like it changes credentials. It changes where you
// are headed and which account "create one" makes; the role lives on the
// account and postLoginPath() routes on that.
check(
  "it writes the choice to the URL so a refresh keeps it",
  /router\.replace/.test(toggle)
);
for (const [f, key] of [
  ["src/components/auth/LoginForm.tsx", "role"],
  ["src/components/auth/RegisterForm.tsx", "as"],
] as const) {
  const src = read(f);
  check(`${f.split("/").pop()} shows the toggle`, /<AudienceToggle/.test(src));
  check(`${f.split("/").pop()} keys it on ${key}`, src.includes(key));
}
const lf = read("src/components/auth/LoginForm.tsx");
check(
  "an explicit callbackUrl still beats the toggle",
  /explicitCallback \|\|/.test(lf),
  "somebody who clicked 'sign in to book this' goes back to that booking"
);
check(
  "and the register link follows the toggle",
  /audience === "doctor"[\s\S]{0,120}as=doctor/.test(lf)
);

/* ------------------------------------------------------------------------
   The doctor page has to be looked at, not only read
   --------------------------------------------------------------------- */
// The client's note was that it "feels like the same old home page". The whole
// page carried exactly ONE photograph, the hero background, while the client
// side is built out of editorial imagery.
//
// The clinic band that briefly lived here is gone: BluDerma is a marketplace,
// not a clinic operator, and "rooms you would be consulting in" claimed a
// relationship to those premises that it does not have.
for (const f of [
  "src/components/doctor/JoinHero.tsx",
  "src/components/doctor/WhyList.tsx",
  "src/components/doctor/SimpleSteps.tsx",
]) {
  const src = read(f);
  check(`${f.split("/").pop()} carries photography`, /<SmartImage/.test(src));
}

// And it must be ITS OWN photography. Reaching into the client pool put a
// picture on the banner that a visitor had already met in the catalogue,
// which is what "that banner image is already used" meant.
const doctorImgs = read("src/data/doctorImages.ts");
check("the practitioner side has a pool of its own", /DOCTOR_IMG/.test(doctorImgs));
check(
  "sourced from a host next.config already allows",
  /images\.pexels\.com/.test(doctorImgs)
);
for (const f of [
  "src/components/doctor/JoinHero.tsx",
  "src/components/doctor/SimpleSteps.tsx",
]) {
  const src = read(f);
  check(
    `${f.split("/").pop()} does not reuse the client pool`,
    !src.includes('from "@/data/hubImages"')
  );
}

/* ------------------------------------------------------------------------
   The doctor hero is a light island on a dark page
   --------------------------------------------------------------------- */
// `text-ink` and its siblings resolve to a near-WHITE outside .theme-light,
// so on a pale ground they are invisible. Every colour in there has to be a
// literal, the same rule PortalPreview's calendar sketch documents.
const hero = read("src/components/doctor/JoinHero.tsx");
check(
  "the hero uses no dark-theme ink token",
  // Comments stripped: the note explaining WHY there is no ink token here
  // would otherwise read as an ink token. Third time this file has hit it.
  !/text-ink/.test(codeOnly(hero)),
  "they would be white type on a white ground"
);
check("it names its own slate instead", /text-slate-\d{3}/.test(hero));
// The complaint that caused the rebuild: a scrim heavy enough to carry type
// across a whole frame is heavy enough to destroy the picture under it.
// The strongest proof on the page must not be a desktop-only luxury. The
// first cut was `hidden sm:block`, which removed it entirely on phones.
check(
  "the brief card stacks on a phone rather than hiding",
  !/hidden[^"]*sm:block[^"]*rounded-2xl bg-white\/95/.test(hero) &&
    /sm:absolute sm:-bottom-5/.test(hero)
);
check(
  "the photograph carries no full-frame scrim",
  !/inset-0 bg-gradient-to-[rt] from-\[#0/.test(hero)
);

/* ------------------------------------------------------------------------
   The doctor portal is dark now, and has to stay that way
   --------------------------------------------------------------------- */
// It used to be a near-white console with white panels. The whole point of
// the change is that a doctor gets the same product the client side is, so
// the guard is the inverse of the light-page list above: the layout must NOT
// declare theme-light, and the canvas must be the shared surface rather than
// a colour of its own.
const portalLayout = read("src/app/doctor/portal/layout.tsx");
check(
  "the portal layout is not theme-light",
  !/theme-light/.test(portalLayout),
  "re-adding it repaints every translucent panel solid white"
);
check("the portal still uses the portal canvas", /portal-canvas/.test(portalLayout));
check(
  "the canvas stands on the shared surface",
  /\.portal-canvas[^}]*background-color:\s*var\(--surface\)/s.test(css),
  "a colour of its own is how it drifted into looking like a separate product"
);

// The dashboard was built in slate literals for a white ground. Those are the
// exact classes that turn it unreadable if any of them come back: slate-900
// type is near-black on navy, and a solid `bg-white` panel is a hole punched
// in the page. Comments are stripped first, because three suites in this repo
// have now failed on the note explaining a fix rather than on the code.
const PORTAL_SURFACES = [
  "src/components/doctor/dashboard/kit.tsx",
  "src/components/doctor/dashboard/DashboardHome.tsx",
  "src/components/doctor/dashboard/Charts.tsx",
  "src/components/doctor/portalUi.tsx",
];
for (const f of PORTAL_SURFACES) {
  const code = read(f)
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ");
  const name = f.split("/").pop();
  const slate = code.match(/text-slate-(?:[6-9]00|[45]00)/g) ?? [];
  check(`${name} sets no light-ground type`, slate.length === 0, slate.join(", "));
  // `bg-white/[0.04]` is the dark idiom and must not trip this: only a SOLID
  // white fill is the failure.
  const solid = code.match(/bg-white(?![\/\w-])/g) ?? [];
  check(`${name} paints no solid white panel`, solid.length === 0, `${solid.length} found`);
}

// Recharts takes SVG attributes, not classes, so nothing about the theme
// reaches a chart automatically. A series left at its light-ground colour is
// a dark blue on a dark blue, and the axis labels go with it.
const charts = read("src/components/doctor/dashboard/Charts.tsx");
check(
  "chart axes are set for a dark ground",
  /rgba\(255,255,255/.test(charts),
  "slate hex ticks disappear on navy"
);
check(
  "the tooltip is a dark card",
  /background:\s*"#0d1526"/.test(charts),
  "a white tooltip flashing over a navy chart is the worst of both"
);

console.log(`\n${pass} passed, ${fails.length} failed`);
if (fails.length) {
  fails.forEach((f) => console.log(`  FAIL  ${f}`));
  process.exit(1);
}
