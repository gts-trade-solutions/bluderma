/**
 * Shared vocabulary for the onboarding assist.
 *
 * Its own module so both the server-only half (aiAssist.ts) and the pure half
 * (aiAssistCore.ts) can use it without either importing the other, and so a
 * client component can import the tone list without dragging a `server-only`
 * module into the browser bundle.
 */

export const ABOUT_TONES = ["warm", "professional", "concise"] as const;
export type AboutTone = (typeof ABOUT_TONES)[number];

export const IMPROVE_MODES = ["improve", "shorten", "expand"] as const;
export type ImproveMode = (typeof IMPROVE_MODES)[number];

export interface AboutVariant {
  tone: AboutTone;
  text: string;
  /** Said plainly in the UI — a template draft is not an AI draft. */
  source: "ai" | "template";
}
