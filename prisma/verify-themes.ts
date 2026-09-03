/**
 * The theme guarantee.
 *
 * ── What this actually checks ────────────────────────────────────────────
 * Not that the CSS exists — that a person can READ it. Every text token is
 * measured against the ground it sits on using the WCAG relative-luminance
 * formula, and anything below the threshold fails the build.
 *
 * That matters because the failure mode here is silent and total. The first
 * light theme shipped with pale teal type on a white page: the CSS was valid,
 * the build passed, every string assertion anybody would have written passed,
 * and the text was invisible. A string test cannot catch that. Arithmetic can.
 *
 * ── And that nothing is left unthemed ────────────────────────────────────
 * The 138 override rules are GENERATED from the source. If somebody adds
 * `text-teal-400` to a component and does not regenerate, that colour renders
 * unthemed — which means invisible on at least one of the three. The check
 * below re-runs the generator in memory and fails if the file disagrees.
 *
 *   npx tsx prisma/verify-themes.ts
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";

let pass = 0;
const fails: string[] = [];
function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    pass++;
    console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    fails.push(`${name}${detail ? ` — ${detail}` : ""}`);
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const css = readFileSync("src/app/globals.css", "utf8");

/* --------------------------- Colour arithmetic --------------------------- */

function hex(c: string): [number, number, number] {
  const s = c.trim().replace("#", "");
  const full =
    s.length === 3 ? s.split("").map((x) => x + x).join("") : s.slice(0, 6);
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** WCAG relative luminance. */
function luminance(c: string): number {
  const [r, g, b] = hex(c).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** 1 (identical) to 21 (black on white). */
function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Flattens `color-mix(... N%, transparent)` against a known ground. */
function over(fg: string, alpha: number, bg: string): string {
  const [r1, g1, b1] = hex(fg);
  const [r2, g2, b2] = hex(bg);
  const a = alpha / 100;
  const mix = (x: number, y: number) => Math.round(x * a + y * (1 - a));
  return `#${[mix(r1, r2), mix(g1, g2), mix(b1, b2)]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")}`;
}

/* ------------------------- Reading the token sets ------------------------ */

/** The declarations inside one `:root[data-theme="x"]` block. */
/** The bare `:root {}` block, where midnight keeps its surfaces. */
/** Prose inside a token block is not a declaration.
 *  A comment reading "the --ink token" parses as `--ink: ...` and swallows
 *  every real declaration up to the next semicolon — which is exactly how
 *  --on-sheet went missing while sitting in plain sight two lines below. */
function decls(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  const clean = block.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const m of clean.matchAll(/(--[a-z-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

function baseTokens(): Record<string, string> {
  const block = css.slice(css.indexOf(":root {"), css.indexOf("}"));
  return decls(block);
}

function tokensFor(theme: string): Record<string, string> {
  const needle =
    theme === "midnight"
      ? `:root,\n:root[data-theme="midnight"] {`
      : `:root[data-theme="${theme}"] {`;
  const at = css.indexOf(needle);
  if (at === -1) return {};
  const block = css.slice(at, css.indexOf("}", at));

  // Midnight is written in two halves: the bare :root carries the surfaces,
  // the named block carries the ink. Reading only the second is why every
  // midnight surface check reported "not defined".
  return { ...(theme === "midnight" ? baseTokens() : {}), ...decls(block) };
}

/** Midnight's ground lives in the very first :root block. */
function midnightSurface(): string {
  const first = css.slice(0, css.indexOf("}"));
  return /--surface:\s*(#[0-9a-f]{3,8})/i.exec(first)?.[1] ?? "#070d1c";
}

const THEMES = ["midnight", "daylight", "sepia", "contrast"] as const;

/**
 * 4.5 is the WCAG AA floor for body text.
 *
 * Applied to the primary ink and to every accent-coloured TEXT token, because
 * on this site an accent colour is not decoration — `text-teal-300` is the
 * label above half the figures on the dashboard and `text-brand-200` is every
 * secondary link.
 *
 * The muted step is measured at 3.0 rather than 4.5. It is used for
 * timestamps, counts and hints — the large-text and incidental band — and
 * holding it to 4.5 would mean it stops being visibly quieter than the ink
 * beside it, which is the only reason it exists.
 */
const AA = 4.5;
const AA_MUTED = 3.0;

console.log("1. Every theme declares a full token set");

const REQUIRED = [
  "--ink",
  "--wash",
  "--accent-text",
  "--highlight-text",
  "--warn-text",
  "--danger-text",
  "--violet-text",
  "--emerald-text",
  "--accent-wash",
  "--highlight-wash",
  "--warn-wash",
  "--danger-wash",
  "--ink-soft-mix",
  "--ink-muted-mix",
];

for (const t of THEMES) {
  const tokens = tokensFor(t);
  const missing = REQUIRED.filter((k) => !tokens[k]);
  check(`${t} declares every token`, missing.length === 0, missing.join(", ") || undefined);
}

console.log("\n2. Text is readable on its own ground (WCAG AA)");

const TEXT_TOKENS = [
  "--ink",
  "--accent-text",
  "--highlight-text",
  "--warn-text",
  "--danger-text",
  "--violet-text",
  "--emerald-text",
];

for (const t of THEMES) {
  const tokens = tokensFor(t);
  const ground = t === "midnight" ? midnightSurface() : tokens["--surface"];
  if (!ground) {
    check(`${t} has a ground to measure against`, false);
    continue;
  }

  for (const key of TEXT_TOKENS) {
    const colour = tokens[key];
    if (!colour || !colour.startsWith("#")) continue;
    const ratio = contrast(colour, ground);
    check(
      `${t}: ${key.replace("--", "")} on the page`,
      ratio >= AA,
      `${ratio.toFixed(2)}:1`
    );
  }

  // The soft and muted steps are derived, not declared — the semantic layer
  // mixes ink toward the ground by a per-theme percentage. Read rather than
  // assumed: the whole reason they are per-theme is that one percentage does
  // not produce one ratio across four different pairs.
  const ink = tokens["--ink"];
  if (ink?.startsWith("#")) {
    const softPct = Number((tokens["--ink-soft-mix"] ?? "72%").replace("%", ""));
    const mutedPct = Number((tokens["--ink-muted-mix"] ?? "52%").replace("%", ""));
    const soft = contrast(over(ink, softPct, ground), ground);
    const muted = contrast(over(ink, mutedPct, ground), ground);
    check(`${t}: ink-soft (${softPct}%)`, soft >= AA, `${soft.toFixed(2)}:1`);
    check(
      `${t}: ink-muted (${mutedPct}%)`,
      muted >= AA_MUTED,
      `${muted.toFixed(2)}:1`
    );
    // Muted has to stay visibly quieter than soft, or the hierarchy the two
    // steps exist to create has been flattened in the name of passing.
    check(
      `${t}: muted is still quieter than soft`,
      mutedPct < softPct - 8,
      `${mutedPct}% vs ${softPct}%`
    );
  }
}

console.log("\n3. Cards and hovers stay distinguishable from the page");

for (const t of THEMES) {
  const tokens = tokensFor(t);
  const ground = t === "midnight" ? midnightSurface() : tokens["--surface"];
  const wash = tokens["--wash"];
  if (!ground || !wash?.startsWith("#")) continue;

  // A card is a 4% wash. If it does not separate from the page it is not a
  // card, which is what made the membership panel read as an empty box.
  const card = over(wash, 4, ground);
  const lift = contrast(card, ground);
  check(
    `${t}: a 4% card lifts off the page`,
    lift >= 1.02,
    `${lift.toFixed(3)}:1`
  );

  // The reported bug: a hover that was one pale thing on another. Measured
  // as the hover fill against the ground it sits on.
  const hover = over(wash, 9, ground);
  const hoverLift = contrast(hover, ground);
  check(
    `${t}: a hover is visible`,
    hoverLift >= 1.05,
    `${hoverLift.toFixed(3)}:1`
  );

  // And the text inside that hover, against the hover itself.
  const ink = tokens["--ink"];
  if (ink?.startsWith("#")) {
    const onHover = contrast(ink, hover);
    check(`${t}: text inside a hover`, onHover >= AA, `${onHover.toFixed(2)}:1`);
  }
}

console.log("\n4. A light theme darkens on hover, a dark one lightens");

for (const t of ["daylight", "sepia"] as const) {
  const tokens = tokensFor(t);
  const ground = tokens["--surface"];
  const wash = tokens["--wash"];
  if (!ground || !wash) continue;
  const hover = over(wash, 9, ground);
  check(
    `${t}: hover goes darker, not paler`,
    luminance(hover) < luminance(ground),
    "this is the light-blue-hover bug"
  );
}

const midTokens = tokensFor("midnight");
{
  const ground = midnightSurface();
  const hover = over(midTokens["--wash"] ?? "#ffffff", 9, ground);
  check(
    "midnight: hover goes lighter",
    luminance(hover) > luminance(ground)
  );
}

console.log("\n5. Nothing is left unthemed");

let genOk = true;
let genOut = "";
try {
  genOut = execFileSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["tsx", "prisma/gen-theme-overrides.ts", "--check"],
    { encoding: "utf8", stdio: "pipe" }
  );
} catch (e) {
  genOk = false;
  genOut = String((e as { stdout?: string; stderr?: string }).stderr ?? "");
}
check(
  "the generated overrides match the source",
  genOk,
  genOk ? (genOut.match(/\d+ rules/) ?? [""])[0] : "run gen-theme-overrides.ts"
);

check(
  "the default theme is excluded from every override",
  !/:root\[data-theme="midnight"\]\s+\./.test(css),
  "adding options must not change the design"
);
check(
  "the overrides are scoped, not global",
  (css.match(/:root\[data-theme\]:not\(\[data-theme="midnight"\]\)/g) ?? []).length > 100
);

console.log("\n6. The picker offers all four, and says what they are for");

const meta = readFileSync("src/lib/theme.ts", "utf8");
for (const t of THEMES) {
  check(`${t} is offered`, new RegExp(`value: "${t}"`).test(meta));
}
check(
  "each one explains who it is for",
  (meta.match(/hint:/g) ?? []).length >= 4
);
check(
  "system is a real option and stores nothing",
  /localStorage\.removeItem/.test(meta)
);
check(
  "the choice is applied before first paint",
  /THEME_BOOTSTRAP/.test(readFileSync("src/app/layout.tsx", "utf8"))
);

/* ══════════════════════════════════════════════════════════════════════
   7. Every surface moves, and the ones that do not say why

   The sections above measure COLOUR: is this text readable on that ground.
   All of them passed while whole sections of the site stayed navy on a light
   theme, because a token that is never used is still a legible token.

   What follows measures STRUCTURE instead — the two failures that actually
   shipped:

     - a background written as a literal (`bg-[#0b1220]`, `from-slate-900`)
       cannot move, so the theme changed the text on it and nothing else;
     - a background that is dark ON PURPOSE (a caption over a photograph)
       had its text repainted to the light theme's dark ink, which is how the
       Gold Collar card ended up with black type on a black card.

   One is a background that should have changed and did not. The other is
   text that should not have changed and did. Neither is a contrast ratio,
   which is why six sections of contrast ratios missed both.
   ══════════════════════════════════════════════════════════════════════ */

console.log("\n7. Every surface moves, and the ones that do not say why");

/** The files the generated layer repaints. A background is only safe to
 *  tokenise in one of these — elsewhere the text stays literal, and a
 *  lightened card under unrepainted white text is worse than a dark one. */
const SKIP_DIRS = ["/admin/", "/portal/", "/components/doctor/"];
/**
 * The exception to the skip, and the reason the first pass missed a whole card.
 *
 * `components/doctor/` holds two unrelated things: the clinical console, which
 * a theme must never touch, and the marketing for the PUBLIC /doctor page,
 * which it must. Skipping the directory wholesale meant WhyList kept a navy
 * gradient while the generated layer repainted the text on top of it — a
 * heading in near-black on a near-black card. Precisely the bug this file
 * exists to catch, and precisely the one it could not see.
 */
const PUBLIC_DOCTOR = [
  "src/components/doctor/WhyList.tsx",
  "src/components/doctor/SimpleSteps.tsx",
  "src/components/doctor/PortalPreview.tsx",
  "src/components/doctor/DoctorFaq.tsx",
  "src/components/doctor/JoinHero.tsx",
];

function themedFiles(): string[] {
  const out: string[] = [...PUBLIC_DOCTOR];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const f = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(f);
      else if (f.endsWith(".tsx") && !SKIP_DIRS.some((d) => f.includes(d))) out.push(f);
    }
  };
  walk("src/app");
  walk("src/components");
  return out;
}

const themedSrc = themedFiles().map((f) => [f, readFileSync(f, "utf8")] as const);

// ── Nothing paints its own dark ground any more ──────────────────────
// Anything at or below ~18% relative luminance is a dark surface. A literal
// one cannot respond to a theme, so it has to be a token or live inside an
// .on-dark island.
const OVERLAY_FILES = [
  "src/components/home/HeroCarousel.tsx",
  "src/components/hub/SkinScanCard.tsx",
  "src/components/hub/TreatmentLabel.tsx",
  "src/components/hub/PromoCarousel.tsx",
  "src/components/hub/RxSkinShowcase.tsx",
  "src/app/patient/explore/[category]/page.tsx",
];

const DARK_HEX = /\b(?:bg|from|via|to)-\[(#[0-9a-fA-F]{6})\](?!\/)/g;
const strays: string[] = [];
for (const [f, src] of themedSrc) {
  // A gradient that fades a photograph out from under a caption keeps its
  // literal on purpose — see OVERLAY_FILES below, where each is separately
  // required to sit inside an .on-dark.
  if (OVERLAY_FILES.includes(f)) continue;
  for (const m of src.matchAll(DARK_HEX)) {
    if (luminance(m[1]) < 0.18) strays.push(`${f}: ${m[0]}`);
  }
}
check(
  "no opaque dark background is still a literal",
  strays.length === 0,
  strays.slice(0, 6).join("; ")
);

// ── A saturated brand band keeps its light text ──────────────────────
// `from-brand-800 to-teal-800` looks the same on every theme, so the text on
// it must too. Without .on-dark the generated rule repaints that text to
// var(--ink), which on daylight is near-black.
// Slate/gray/zinc belong here too: `bg-slate-900 text-white` is a dark pill on
// every theme, and PortalPreview had one that went unmarked while its white
// text was repainted to near-black.
const BAND =
  /\b(?:bg|from|via|to)-(?:brand|teal|violet|indigo|sky|emerald|slate|gray|zinc|neutral|stone)-(?:700|800|900|950)\b/;
const unmarked: string[] = [];
for (const [f, src] of themedSrc) {
  src.split("\n").forEach((ln, i) => {
    if (!BAND.test(ln) || ln.includes("on-dark")) return;
    if (
      !/bg-gradient|bg-(?:brand|teal|violet|indigo|sky|emerald|slate|gray|zinc|neutral|stone)-(?:700|800|900|950)/.test(
        ln
      )
    )
      return;
    unmarked.push(`${f}:${i + 1}`);
  });
}
check(
  "every saturated brand band is marked .on-dark",
  unmarked.length === 0,
  unmarked.slice(0, 6).join("; ")
);

// ── A photo overlay stays inside an island ───────────────────────────
// These keep their literals on purpose: the darkness makes a caption readable
// over a picture, and a light theme does not remove the picture.
for (const f of OVERLAY_FILES) {
  check(
    `${f.split("/").pop()} keeps its photo overlay inside .on-dark`,
    readFileSync(f, "utf8").includes("on-dark")
  );
}

// ── The generated rules refuse to enter either island ────────────────
const generated = css.slice(
  css.indexOf("THEME-OVERRIDES:START"),
  css.indexOf("THEME-OVERRIDES:END")
);
const ruleLines = generated
  .split("\n")
  .filter((l) => l.trim().startsWith(":root[data-theme]"));
check(
  "every generated rule excludes .on-dark",
  ruleLines.length > 100 &&
    ruleLines.every((l) => l.includes(":not(.on-dark, .on-dark *)")),
  `${ruleLines.filter((l) => !l.includes(".on-dark")).length} rules would repaint a dark island`
);
check(
  "every generated rule excludes the professional console",
  ruleLines.every((l) => l.includes(":not(.pro-surface, .pro-surface *)"))
);
check(
  "the console is actually marked",
  ["src/app/admin/layout.tsx", "src/app/doctor/portal/layout.tsx"].every((f) =>
    readFileSync(f, "utf8").includes("pro-surface")
  )
);
check(
  "a client light island still yields to a chosen theme",
  /\.theme-light:not\(\.pro-surface\)/.test(css)
);

// ── .on-dark re-declares the tokens, not just the exclusions ─────────
// Excluding the literals leaves anything token-driven inside the island
// still resolving to the light theme's values.
const islandAt = css.indexOf(".on-dark {");
const island = islandAt < 0 ? "" : css.slice(islandAt, islandAt + 800);
for (const t of ["--ink", "--wash", "--sheet", "--hairline", "--highlight-text"]) {
  check(`.on-dark re-declares ${t}`, island.includes(`${t}:`));
}

// ── An opaque white is a card, not a wash ────────────────────────────
// The bug that made all of this necessary: `bg-white` was mapped to --wash,
// which on daylight is #0f172a, so every white card on the site turned
// near-black under text that was still slate.
check(
  "bg-white resolves to the card token, not the wash",
  /\.bg-white:not\(\.on-dark[^{]*\{ background-color: var\(--sheet\)/.test(generated)
);
check(
  "a translucent white still resolves to the wash",
  /\.bg-white\\\/10:not[^{]*\{ background-color: color-mix\(in srgb, var\(--wash\)/.test(
    generated
  )
);
check(
  "slate body text is themed",
  /\.text-slate-900:not[^{]*\{ color: var\(--ink\)/.test(generated)
);
check(
  "a slate hairline is themed",
  /\.border-slate-200:not[^{]*\{ border-color: var\(--hairline\)/.test(generated)
);

// ── Every surface token exists, on every theme, and is readable ──────
const SURFACES = [
  "--surface",
  "--sheet",
  "--panel",
  "--tint",
  "--band-a",
  "--band-b",
  "--band-c",
];
for (const theme of THEMES) {
  const t = tokensFor(theme);
  const at = (k: string) => t[k] ?? midTokens[k];
  const ink = at("--ink");

  for (const s of SURFACES) {
    const ground = at(s);
    check(`${theme}: ${s} is defined`, Boolean(ground));
    if (!ground || !/^#[0-9a-fA-F]{6}$/.test(ground)) continue;
    const r = contrast(ink, ground);
    check(`${theme}: body text is readable on ${s}`, r >= AA, `${r.toFixed(2)}:1`);
  }

  // A solid white pill's own text has to survive the pill changing colour.
  const onSheet = at("--on-sheet");
  check(`${theme}: --on-sheet is defined`, Boolean(onSheet));
  if (onSheet) {
    // On the default the pill is a literal `bg-white`; everywhere else it is
    // whatever --sheet became.
    const pill = theme === "midnight" ? "#ffffff" : at("--sheet");
    const r = contrast(onSheet, pill);
    check(`${theme}: a solid white pill keeps legible text`, r >= AA, `${r.toFixed(2)}:1`);
  }

  check(`${theme}: --scrim is defined`, Boolean(at("--scrim")));
}


// ── Nothing clinical escapes through a React portal ──────────────────
// createPortal renders to document.body, outside the layout div that carries
// .pro-surface. A console component that uses it is the one way a theme can
// reach a clinical screen.
const escapees: string[] = [];
for (const dir of ["src/app/admin", "src/app/doctor", "src/components/doctor"]) {
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const f = `${d}/${e.name}`;
      if (e.isDirectory()) { walk(f); continue; }
      if (!f.endsWith(".tsx")) continue;
      const src = readFileSync(f, "utf8");
      if (src.includes("createPortal") && !src.includes("pro-surface")) escapees.push(f);
    }
  };
  walk(dir);
}
check(
  "no console component escapes .pro-surface through createPortal",
  escapees.length === 0,
  escapees.join("; ")
);

// ── The console's own classes are genuinely immune ───────────────────
// Every rule that could repaint a clinical screen has to carry the exclusion.
const consoleClasses = ["bg-white", "text-slate-900", "border-slate-200", "bg-slate-50"];
for (const c of consoleClasses) {
  const rule = ruleLines.find((l) => l.includes(`.${c}:not(`));
  check(
    `.${c} cannot enter the console`,
    !rule || rule.includes(":not(.pro-surface, .pro-surface *)"),
    rule?.slice(0, 90)
  );
}


// A placeholder is the only label some fields have.
check(
  "placeholders are themed rather than left at slate-400",
  css.includes("input:not(.pro-surface *)::placeholder")
);
for (const theme of THEMES) {
  if (theme === "midnight") continue;
  const t = tokensFor(theme);
  const mix = Number((t["--ink-muted-mix"] ?? "52%").replace("%", ""));
  const r = contrast(over(t["--ink"], mix, t["--sheet"]), t["--sheet"]);
  check(`${theme}: a placeholder is readable in a field`, r >= AA_MUTED, `${r.toFixed(2)}:1`);
}


// ── The bar that sits over a photograph ──────────────────────────────
// Every page has it, and on the hero pages it is transparent over a picture.
// Repainting its white type to the light theme's ink hides the wordmark and
// every nav link against an image that is still dark.
const nav = readFileSync("src/components/Navbar.tsx", "utf8");
check(
  "the navbar declares itself dark only where it floats over the hero",
  nav.includes('overHero ? "on-dark " : ""')
);
// The failure this replaces: the bar painted itself from a token while a
// JavaScript branch a frame behind still believed the chrome was navy, so on
// sepia it drew cream under white type and the page scrolled visibly through
// a bar nobody could see. A bar that reads its colours from the same tokens
// as its own background cannot get out of step with them.
check(
  "and picks no colour from a JavaScript reading of the theme",
  !nav.includes("useTheme"),
  "Navbar branches on the theme in JS again"
);
check(
  "the opaque bar is the themed surface on every theme",
  nav.includes('"bg-surface-95 shadow-soft backdrop-blur"') && !nav.includes("darkChrome")
);
check(
  "the wordmark follows the theme rather than guessing",
  nav.includes('tone={overHero ? "light" : "auto"}') &&
    readFileSync("src/components/BrandLogo.tsx", "utf8").includes("var(--logo-ink)")
);

// The control has to be findable. A 9px glyph in a row of other glyphs was
// not: it read as a fourth icon rather than as the way into the feature, so
// it now floats on its own with an edge, a word and a swatch.
const toggleSrc = readFileSync("src/components/ThemeToggle.tsx", "utf8");
check(
  "the theme control carries a word and an edge, not just an icon",
  toggleSrc.includes('variant === "floating"') && toggleSrc.includes("Theme")
);
const fabSrc = readFileSync("src/components/ThemeFab.tsx", "utf8");
check("and it floats rather than hiding in the bar", fabSrc.includes('variant="floating"'));
// The drawer keeps its copy — a labelled row under an "Appearance" heading is
// findable in a way a bare glyph never was, and a phone has no floating
// corner to spare while the menu is open. What must not come back is the
// version that sat in the desktop action row between the pin and the avatar.
check(
  "it is gone from the desktop action row",
  (nav.match(/<ThemeToggle/g) ?? []).length === 1 && !nav.includes('variant="labelled"'),
  "back in the row of glyphs it was lost in"
);
check(
  "and it opens upward, because there is nothing below it",
  toggleSrc.includes('"bottom-full left-0 mb-2"')
);
check(
  "it is mounted once, at the root",
  readFileSync("src/app/layout.tsx", "utf8").includes("<ThemeFab />")
);

// The wordmark sits on the opaque bar, which is --surface on every theme.
for (const theme of THEMES) {
  const t = tokensFor(theme);
  const at = (k: string) => t[k] ?? midTokens[k];
  for (const k of ["--logo-ink", "--logo-accent"]) {
    const v = at(k);
    check(`${theme}: ${k} is defined`, Boolean(v));
    if (!v || !/^#[0-9a-fA-F]{6}$/.test(v)) continue;
    const r = contrast(v, at("--surface"));
    check(`${theme}: the wordmark is legible on the bar`, r >= AA_MUTED, `${r.toFixed(2)}:1`);
  }
}
// Adding options must not repaint the default.
check(
  "midnight keeps the exact wordmark it always had",
  midTokens["--logo-ink"] === "#ffffff" && midTokens["--logo-accent"] === "#5eead4",
  `${midTokens["--logo-ink"]} / ${midTokens["--logo-accent"]}`
);

// ── The open select list ─────────────────────────────────────────────
// The closed control states a real answer in pale blue so an unanswered
// question is visible on a long form. Those colours cascade into the <option>
// rows, and the browser draws the popup on its own ground — white, on Windows
// Chrome — so the whole list rendered pale blue on white and was unreadable.
check(
  "the open list states its own colours rather than inheriting the control's",
  /select option \{[^}]*background-color: var\(--sheet\)[^}]*color: var\(--ink\)/s.test(css),
  "pale blue on the browser's white popup is the dull unreadable list"
);
for (const theme of THEMES) {
  const t = tokensFor(theme);
  const at = (k: string) => t[k] ?? midTokens[k];
  const r = contrast(at("--ink"), at("--sheet"));
  check(`${theme}: a dropdown row is readable`, r >= AA, `${r.toFixed(2)}:1`);
}

console.log(`\n${pass} passed, ${fails.length} failed`);
if (fails.length) {
  console.log("\nFailures:");
  fails.forEach((f) => console.log(`  ${f}`));
  process.exit(1);
}
console.log("Every theme is readable.");
