/**
 * Four themes, and the one the reader picked.
 *
 * ── What "default" means here, and why it is absolute ────────────────────
 * `midnight` is the site exactly as it has always looked, and NOTHING in the
 * theme system touches it. Every themed rule in globals.css — the semantic
 * layer and the ~138 generated overrides — is scoped to
 * `[data-theme]:not([data-theme="midnight"])`. Adding options to a design must
 * not change the design.
 *
 * ── Why the other three needed a token layer rather than a switch ────────
 * The client surface is written in about 1,300 LITERAL dark colours:
 * `text-teal-300`, `text-white/70`, `bg-white/[0.04]`, `hover:text-brand-200`.
 * Every one was chosen to sit on navy. The first attempt at a light theme
 * flipped the tokens underneath them and left the literals alone, which
 * produced pale teal type on a white page and a hover that was one pale thing
 * washed over another.
 *
 * So each literal is repainted from a token, and a theme is a set of token
 * values. The list is GENERATED from the source by
 * prisma/gen-theme-overrides.ts and checked in CI, because a hand-written one
 * goes stale silently — the new component simply becomes unreadable on three
 * themes and nobody finds out until a screenshot arrives.
 *
 * ── What is deliberately not themed ──────────────────────────────────────
 * The doctor portal and the admin console. Both are built on several hundred
 * literal LIGHT classes (`bg-white`, `text-slate-900`) and carry
 * `.theme-light` explicitly. Inverting the tokens under them would leave
 * slate text on navy cards across about forty clinical screens. That is a
 * design pass, not a toggle.
 */

export const THEMES = ["midnight", "daylight", "sepia", "contrast"] as const;
export type ThemeName = (typeof THEMES)[number];

/** "system" resolves to midnight or daylight from the OS preference. */
export type ThemePreference = ThemeName | "system";

export interface ThemeMeta {
  value: ThemeName;
  label: string;
  /** One line: who it is for, not what colour it is. */
  hint: string;
  /** Two swatches for the picker: ground, then text. */
  swatch: [string, string];
}

export const THEME_META: ThemeMeta[] = [
  {
    value: "midnight",
    label: "Midnight",
    hint: "The original. Deep navy, the way BluDerma has always looked.",
    swatch: ["#070d1c", "#eef2f8"],
  },
  {
    value: "daylight",
    label: "Daylight",
    hint: "Light and cool. Easier in a bright room or on a phone outdoors.",
    swatch: ["#f2f6fb", "#0f172a"],
  },
  {
    value: "sepia",
    label: "Sepia",
    hint: "Warm paper. Less glare over a long read.",
    swatch: ["#f5efe4", "#3a3128"],
  },
  {
    value: "contrast",
    label: "High contrast",
    hint: "Pure black and white with heavier edges, for anyone who finds the others hard to read.",
    swatch: ["#000000", "#ffffff"],
  },
];

export const THEME_STORAGE_KEY = "bd-theme";

/** Fires on window whenever the theme changes, so hooks can re-read it. */
export const THEME_EVENT = "bd-theme-change";

function isTheme(v: unknown): v is ThemeName {
  return typeof v === "string" && (THEMES as readonly string[]).includes(v);
}

/**
 * The script that runs before first paint.
 *
 * ── Why it has to be inline and blocking ─────────────────────────────────
 * Reading the preference from an effect is one frame too late: the page paints
 * midnight, then flips, and a daylight reader gets a full-screen flash of navy
 * on every single navigation. The portal rail already does exactly this for
 * its collapsed state, for the same reason.
 *
 * Wrapped in try/catch because localStorage THROWS outright in some
 * private-browsing modes, and a colour preference is not worth a blank page.
 */
export const THEME_BOOTSTRAP = `
try {
  var K = ${JSON.stringify(THEME_STORAGE_KEY)};
  var ALL = ${JSON.stringify(THEMES)};
  var p = localStorage.getItem(K);
  var t = ALL.indexOf(p) > -1
    ? p
    : (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "daylight" : "midnight");
  document.documentElement.setAttribute("data-theme", t);
} catch (e) {
  document.documentElement.setAttribute("data-theme", "midnight");
}
`.trim();

/** What the document is showing right now. Safe to call on the server. */
export function currentTheme(): ThemeName {
  if (typeof document === "undefined") return "midnight";
  const v = document.documentElement.getAttribute("data-theme");
  return isTheme(v) ? v : "midnight";
}

/**
 * Applies a preference to the live document and remembers it.
 *
 * "system" clears the stored value rather than storing the word, so a reader
 * who picks it keeps following their operating system when they change it
 * later — which is the whole difference between "system" and "whatever it was
 * when I chose".
 */
export function applyTheme(pref: ThemePreference): ThemeName {
  const resolved: ThemeName =
    pref === "system"
      ? typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-color-scheme: light)").matches
        ? "daylight"
        : "midnight"
      : pref;

  document.documentElement.setAttribute("data-theme", resolved);

  try {
    if (pref === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    /* private browsing. The theme still applies for this page. */
  }

  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: resolved }));
  return resolved;
}

/** The stored preference, which is not the same as what is being shown. */
export function storedPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(v) ? v : "system";
  } catch {
    return "system";
  }
}

/** True for the themes that put dark text on a light ground. */
export function isLightTheme(t: ThemeName): boolean {
  return t === "daylight" || t === "sepia";
}
