/**
 * Turning a skin analysis into treatment suggestions.
 *
 * Split from the AI module for the reason profileCore and payLaterCore exist:
 * anything wrapped in React's cache(), or reaching for an API key, cannot be
 * imported by a tsx verification script. The rules are here so a suite can
 * exercise them.
 *
 * ── What the model is and is not allowed to do ───────────────────────────
 * It never sees a patient. It sees issue names and scores the SERVER computed
 * from the scan, and it proposes treatment NAMES. Its output is then
 * intersected with the real catalogue, so a name the catalogue does not
 * contain cannot survive to the database however confidently it was produced.
 *
 * Everything it produces arrives SUGGESTED. A suggestion becomes part of a
 * plan only when the treating doctor accepts it. That boundary is the whole
 * design: an invented treatment name is a nuisance, but a machine
 * recommendation reaching a patient with no clinician in between is not.
 */

export interface ScanIssue {
  issueType: string;
  score: number | null;
  severityBand: string | null;
}

export interface Suggestion {
  treatment: string;
  rationale: string;
}

/**
 * Which issues are worth proposing anything for.
 *
 * Scores run 0-100 and higher is worse in this analyser. Everything below the
 * threshold is skipped rather than padded out: a plan that lists nine
 * treatments because nine issues were measured tells a doctor nothing about
 * which two matter.
 */
export const CONCERN_THRESHOLD = 45;

export function rankedConcerns(issues: ScanIssue[], limit = 4): ScanIssue[] {
  return issues
    .filter((i) => (i.score ?? 0) >= CONCERN_THRESHOLD)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, limit);
}

/** "dark_circles" and "darkCircles" both read as "dark circles". */
export function humanIssue(issueType: string): string {
  return issueType
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .trim();
}

/**
 * Keep only names the catalogue genuinely contains.
 *
 * Case-insensitive, and it returns the CATALOGUE's spelling rather than the
 * model's, so "botox" cannot enter the database as a treatment distinct from
 * "Botox". Duplicates collapse for the same reason.
 */
export function intersectWithCatalogue(
  proposed: unknown,
  vocabulary: string[]
): string[] {
  if (!Array.isArray(proposed)) return [];
  const canonical = new Map(vocabulary.map((v) => [v.toLowerCase().trim(), v]));
  const out: string[] = [];
  for (const raw of proposed) {
    if (typeof raw !== "string") continue;
    const hit = canonical.get(raw.toLowerCase().trim());
    if (hit && !out.includes(hit)) out.push(hit);
  }
  return out;
}

/**
 * The deterministic suggestions, used whenever there is no API key and as the
 * floor under the model's answer.
 *
 * Matches a concern against catalogue names by word overlap. Crude on purpose:
 * its job is to be RIGHT rather than clever, so it only proposes a treatment
 * whose name literally shares a word with the concern, and proposes nothing
 * when it cannot. A wrong suggestion in a clinical setting costs more than a
 * missing one, and the doctor is about to read every line of this anyway.
 */
export function templateSuggestions(
  concerns: ScanIssue[],
  vocabulary: string[]
): Suggestion[] {
  const out: Suggestion[] = [];
  const used = new Set<string>();

  for (const c of concerns) {
    const words = humanIssue(c.issueType).split(" ").filter((w) => w.length > 3);
    if (!words.length) continue;

    for (const name of vocabulary) {
      if (used.has(name)) continue;
      const lower = name.toLowerCase();
      if (!words.some((w) => lower.includes(w))) continue;

      used.add(name);
      out.push({
        treatment: name,
        // The score is quoted verbatim from what the server measured. Nothing
        // here interprets it, because interpreting it is the doctor's job.
        rationale: `${humanIssue(c.issueType)} scored ${Math.round(c.score ?? 0)}${
          c.severityBand ? ` (${c.severityBand})` : ""
        } in this analysis.`,
      });
      break;
    }
  }
  return out;
}

/** The prompt, kept here so the suite can assert what it forbids. */
export function buildPrompt(concerns: ScanIssue[], vocabulary: string[]): string {
  const lines = concerns
    .map((c) => `- ${humanIssue(c.issueType)}: ${Math.round(c.score ?? 0)}/100${c.severityBand ? ` (${c.severityBand})` : ""}`)
    .join("\n");

  return `A dermatology patient's skin analysis returned these measured concerns.

${lines}

From the list of treatments below, choose the ones a dermatologist would consider for these concerns. Choose at most five, most relevant first.

Return ONLY a JSON array of objects: [{"treatment": "<copied exactly from the list>", "rationale": "<one short sentence>"}]

Rules you must follow:
- Choose ONLY names that appear in the list, copied exactly.
- Do not invent a treatment, a product, a brand or a dosage.
- Do not state a diagnosis, a prognosis or an outcome.
- Do not quote a figure that is not in the concerns above.
- If nothing in the list fits, return [].

List:
${vocabulary.join("\n")}`;
}

/** Parse a model reply into suggestions, discarding anything off-catalogue. */
export function parseSuggestions(
  raw: string,
  vocabulary: string[]
): Suggestion[] {
  let parsed: unknown;
  try {
    // Models wrap JSON in prose or a code fence often enough to plan for it.
    parsed = JSON.parse(raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const canonical = new Map(vocabulary.map((v) => [v.toLowerCase().trim(), v]));
  const out: Suggestion[] = [];
  const seen = new Set<string>();

  for (const row of parsed) {
    if (!row || typeof row !== "object") continue;
    const name = (row as { treatment?: unknown }).treatment;
    if (typeof name !== "string") continue;
    const hit = canonical.get(name.toLowerCase().trim());
    if (!hit || seen.has(hit)) continue;

    const why = (row as { rationale?: unknown }).rationale;
    seen.add(hit);
    out.push({
      treatment: hit,
      rationale: typeof why === "string" ? why.slice(0, 300) : "",
    });
  }
  return out.slice(0, 5);
}
