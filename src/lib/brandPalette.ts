/**
 * The five colours of the mark, as the one place they are written down.
 *
 * ── Why this file exists ─────────────────────────────────────────────────
 * They were in two: `tailwind.config.ts` for everything that styles itself
 * with a class, and a hand-copied hex table in `clinicColors.ts` for the
 * charts, because recharts takes SVG attributes and cannot be handed
 * `bg-azure-500`. Two tables of the same numbers, kept in step by memory, and
 * the failure is invisible — a clinic's calendar block and its dashboard bar
 * quietly stop being the same colour, which is the entire point of giving it
 * one.
 *
 * So both now read from here. The scales are hand-tuned rather than generated:
 * -500 is the colour from the mark, the -600/-700 steps are the ones that
 * carry white text at AA, and -50/-100 are the fills that carry -800 text at
 * AA. Anything picked outside those pairs has not been checked.
 *
 * Plain data with no imports on purpose: this is read by the Tailwind config,
 * which is loaded outside the app's module graph and cannot resolve the `@/`
 * alias or anything that reaches for React.
 */

/** #3E8CCB — what the reader can act on: links, primary figures, bookings. */
export const AZURE = {
  50: "#f0f7fc",
  100: "#dbedf8",
  200: "#b9dbf1",
  300: "#8cc2e6",
  400: "#5ea6d9",
  500: "#3e8ccb",
  600: "#2f72ab",
  700: "#285c8a",
  800: "#244d71",
  900: "#22415e",
  950: "#16293c",
} as const;

/** #F15256 — what went wrong or is about to: cancelled, overdue, now. */
export const CORAL = {
  50: "#fef3f3",
  100: "#fde4e5",
  200: "#fbcccd",
  300: "#f8a7a9",
  400: "#f47b7e",
  500: "#f15256",
  600: "#dc3238",
  700: "#b9262c",
  800: "#992429",
  900: "#7f2428",
  950: "#450e11",
} as const;

/** #58BE9F — what went well: completed, collected, growth. */
export const MINT = {
  50: "#eefaf6",
  100: "#d1f2e7",
  200: "#a6e5d2",
  300: "#8fdcc4",
  400: "#6fcbae",
  500: "#58be9f",
  600: "#3fa287",
  700: "#33826d",
  800: "#2b6857",
  900: "#255548",
  950: "#11322a",
} as const;

/** #FFC80B — the call to action, and time not yet sold. Always black on it. */
export const GOLD = {
  50: "#fffcea",
  100: "#fff6c4",
  200: "#ffec8a",
  300: "#ffdf47",
  400: "#ffd11a",
  500: "#ffc80b",
  600: "#e0a800",
  700: "#b58100",
  800: "#8f6800",
  900: "#765400",
  950: "#452f00",
} as const;

/** #2F2F2F — every word on the page, and the rail they sit beside. */
export const GRAPHITE = {
  50: "#f7f7f7",
  100: "#ededed",
  200: "#dcdcdc",
  300: "#bdbdbd",
  400: "#9a9a9a",
  500: "#7a7a7a",
  600: "#5c5c5c",
  700: "#454545",
  800: "#383838",
  900: "#2f2f2f",
  950: "#1f1f1f",
} as const;

export const BRAND_PALETTE = {
  azure: AZURE,
  coral: CORAL,
  mint: MINT,
  gold: GOLD,
  graphite: GRAPHITE,
} as const;
