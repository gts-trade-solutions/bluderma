import "server-only";

import {
  ABOUT_TONES,
  type AboutTone,
  type AboutVariant,
  type ImproveMode,
} from "./aiAssistTypes";
import {
  type AboutFacts,
  type ClinicFacts,
  fuzzyMatchTreatments,
  intersectWithVocabulary,
  templateAbout,
  templateClinicAbout,
} from "./aiAssistCore";

/**
 * AI help for the practitioner onboarding form.
 *
 * Same shape as lib/integrations/skinSummary.ts — plain fetch, no SDK, a
 * deterministic fallback for everything — because the form has to work with no
 * API key at all. Nothing here throws: a failed call returns null and the
 * caller uses the template.
 *
 * The rule this file exists under: **the AI writes prose, it does not supply
 * facts.** Drafts are built from values already in the database, the prompts
 * forbid inventing anything beyond them, and the treatment matcher's output is
 * intersected with the real catalogue so a hallucinated name cannot survive
 * even if the model ignores the instruction. A doctor reads and corrects; they
 * are never shown a qualification or a figure the system made up.
 *
 * The pure half lives in aiAssistCore.ts — `server-only` cannot be resolved
 * outside a bundler, which would make everything here untestable.
 */

const ENDPOINT = "https://api.openai.com/v1/chat/completions";

export { ABOUT_TONES, IMPROVE_MODES } from "./aiAssistTypes";
export type { AboutTone, AboutVariant, ImproveMode } from "./aiAssistTypes";
export {
  templateAbout,
  templateClinicAbout,
  fuzzyMatchTreatments,
} from "./aiAssistCore";
export type { AboutFacts, ClinicFacts } from "./aiAssistCore";

/** Whether the AI affordances should be offered at all. */
export function aiEnabled(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

async function chat(
  prompt: string,
  opts: { maxTokens: number; temperature: number }
): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_ASSIST_MODEL || "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: opts.temperature,
        max_tokens: opts.maxTokens,
      }),
      // A form field must not hang on a slow upstream.
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = (data?.choices?.[0]?.message?.content ?? "").trim();
    return text || null;
  } catch (e) {
    console.error("[aiAssist] generation failed:", e);
    return null;
  }
}

/* ------------------------------ About you ------------------------------- */

const TONE_BRIEF: Record<AboutTone, string> = {
  warm: "Warm and personal, as if speaking to a nervous first-time patient.",
  professional: "Measured and clinical, the register of a hospital profile.",
  concise: "Brisk and factual. Two sentences at most.",
};

/**
 * Three drafts in three registers, so the doctor picks rather than edits.
 *
 * Always returns one variant per tone: a tone the model failed on falls back to
 * its template, so the feature never half-works.
 */
export async function draftAboutVariants(
  facts: AboutFacts
): Promise<AboutVariant[]> {
  const factLines = [
    `Name: ${facts.name}`,
    `Qualifications: ${facts.title || "not stated"}`,
    `Specialty: ${facts.specialty || "not stated"}`,
    facts.experienceYears > 0 ? `Years in practice: ${facts.experienceYears}` : null,
    facts.clinicNames.length ? `Clinics: ${facts.clinicNames.join("; ")}` : null,
    facts.areas.length ? `Areas: ${facts.areas.join("; ")}` : null,
    facts.services.length ? `Treatments offered: ${facts.services.join("; ")}` : null,
    facts.languages.length ? `Languages: ${facts.languages.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return Promise.all(
    ABOUT_TONES.map(async (tone): Promise<AboutVariant> => {
      const text = await chat(
        `Write a public profile introduction for a dermatology practitioner, for prospective patients to read before booking.

Use ONLY the facts listed below. Do not invent qualifications, awards, hospital names, patient numbers, success rates, years of experience, or any statistic that is not listed. Do not promise outcomes. Do not mention prices.

Write in the third person, and NEVER use a gendered pronoun. The practitioner's gender is not given and must not be guessed from their name. Refer to them by name, by "the doctor", or rewrite the sentence. Do not use "he", "she", "his" or "her".

60 to 110 words. Plain prose: no markdown, no bullet points, no headings.

Tone: ${TONE_BRIEF[tone]}

Facts:
${factLines}`,
        { maxTokens: 280, temperature: 0.7 }
      );

      return text
        ? { tone, text, source: "ai" }
        : { tone, text: templateAbout(facts, tone), source: "template" };
    })
  );
}

/* ------------------------------- Clinics -------------------------------- */

export async function draftClinicAbout(
  facts: ClinicFacts
): Promise<{ text: string; source: "ai" | "template" }> {
  const text = await chat(
    `Write a short description of a dermatology clinic for patients deciding where to book.

Use ONLY the facts below. Do not invent equipment, staff numbers, awards, opening hours, or claims about results. 40 to 70 words. Plain prose, no markdown.

Facts:
Clinic name: ${facts.name}
Area: ${facts.area || "not stated"}
City: ${facts.city || "not stated"}
Specialty practised here: ${facts.doctorSpecialty || "not stated"}
Facilities: ${facts.facilities.join(", ") || "not stated"}`,
    { maxTokens: 200, temperature: 0.6 }
  );

  return text
    ? { text, source: "ai" }
    : { text: templateClinicAbout(facts), source: "template" };
}

/* ------------------------------- Improve -------------------------------- */

const IMPROVE_BRIEF: Record<ImproveMode, string> = {
  improve: "Make it clearer and easier to read.",
  shorten: "Make it about half the length.",
  expand: "Make it fuller, around twice the length.",
};

/**
 * Rewrites what the doctor already wrote.
 *
 * Returns null with no key — there is no honest deterministic version of "make
 * this better", so the button is simply not offered rather than faked.
 */
export async function improveText(
  text: string,
  mode: ImproveMode
): Promise<string | null> {
  return chat(
    `Rewrite the text below. ${IMPROVE_BRIEF[mode]}

Preserve every factual claim exactly as written. Do not add any qualification, statistic, location, treatment or claim that is not already present. Do not remove a factual claim. Plain prose, no markdown.

Text:
${text}`,
    { maxTokens: 400, temperature: 0.4 }
  );
}

/* ----------------------------- Treatments ------------------------------- */

/**
 * Turns "I do microneedling with PRP for hair" into real treatment names.
 *
 * The model is given the catalogue and told to choose from it — and then the
 * answer is intersected with that catalogue anyway. That second step is the
 * actual guarantee: whatever comes back, only names the catalogue genuinely
 * contains can reach a doctor's profile.
 */
export async function matchTreatments(
  query: string,
  vocabulary: string[]
): Promise<{ matches: string[]; source: "ai" | "fuzzy" }> {
  const fallback = () => ({
    matches: fuzzyMatchTreatments(query, vocabulary),
    source: "fuzzy" as const,
  });

  if (!aiEnabled() || vocabulary.length === 0) return fallback();

  // Narrow the candidates first: the full catalogue is ~380 names, which is a
  // lot of prompt for a field-level helper.
  const shortlist = fuzzyMatchTreatments(query, vocabulary, 60);
  const candidates = shortlist.length >= 5 ? shortlist : vocabulary.slice(0, 120);

  const raw = await chat(
    `A dermatology practitioner described what they offer. Choose every treatment from the list that matches their description.

Return ONLY a JSON array of strings, each copied exactly from the list. Choose nothing that is not in the list. If nothing matches, return [].

Description:
${query}

List:
${candidates.join("\n")}`,
    { maxTokens: 200, temperature: 0 }
  );
  if (!raw) return fallback();

  let parsed: unknown;
  try {
    // Models sometimes wrap JSON in prose or a code fence.
    parsed = JSON.parse(raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1));
  } catch {
    return fallback();
  }

  const matches = intersectWithVocabulary(parsed, vocabulary);
  return matches.length ? { matches, source: "ai" } : fallback();
}
