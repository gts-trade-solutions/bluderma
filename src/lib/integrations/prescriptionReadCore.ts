/**
 * Reading a prescription photograph, and matching it to a doctor's own list.
 *
 * ── What this is allowed to do ───────────────────────────────────────────
 * It SUGGESTS which of the doctor's listed medicines a prescription seems to
 * mention, so a patient does not have to type them. It does not decide what
 * anybody should take, it does not read a dose, and every line it produces is
 * shown for confirmation before it can be ordered.
 *
 * The one hard rule: a name it returns must exist in the doctor's own list.
 * The model's output is intersected with that list, so a hallucinated medicine
 * cannot reach a basket however confidently it was produced. That is the same
 * guarantee treatmentPlanCore makes, for the same reason, and it matters more
 * here because the end of this path is somebody swallowing something.
 *
 * Split from the API-calling module so a verification script can exercise the
 * rules: anything reaching for a key cannot be imported under tsx.
 */

export interface Candidate {
  id: string;
  name: string;
  brand: string | null;
  strength: string | null;
}

export interface Match {
  id: string;
  name: string;
  /** Why it was matched, in words a patient can check against the paper. */
  because: string;
  /** "exact" when the text contained the name; "ai" when the model proposed it. */
  source: "exact" | "ai";
}

/** Lower case, punctuation flattened, runs of space collapsed. */
export function fold(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * The deterministic pass, which runs whether or not there is an API key.
 *
 * Looks for the medicine's name, or its brand, as a whole phrase in the text.
 * Substring matching on words alone would match "Ace" inside "Acetone"; the
 * space-padded phrase check is crude but it is only ever WRONG by missing
 * something, never by inventing a match, and a missed line costs a patient
 * one tap.
 */
export function exactMatches(text: string, list: Candidate[]): Match[] {
  const hay = ` ${fold(text)} `;
  const out: Match[] = [];

  for (const m of list) {
    for (const [what, value] of [
      ["name", m.name],
      ["brand", m.brand],
    ] as const) {
      if (!value) continue;
      const needle = ` ${fold(value)} `;
      if (needle.trim().length < 3) continue;
      if (hay.includes(needle)) {
        out.push({
          id: m.id,
          name: m.name,
          because: `The ${what} "${value}" appears in the prescription.`,
          source: "exact",
        });
        break;
      }
    }
  }
  return out;
}

/** The prompt, kept here so a suite can assert what it forbids. */
export function buildPrompt(text: string, list: Candidate[]): string {
  const options = list
    .map((m) => `- ${m.name}${m.brand ? ` (${m.brand})` : ""}${m.strength ? ` ${m.strength}` : ""}`)
    .join("\n");

  return `Below is text read from a photograph of a doctor's prescription, and a list of medicines that doctor stocks.

Say which of the listed medicines the prescription appears to mention.

Return ONLY a JSON array of objects: [{"name": "<copied exactly from the list>", "because": "<the words on the prescription that made you choose it>"}]

Rules you must follow:
- Choose ONLY names that appear in the list, copied exactly.
- Do not invent a medicine, a brand, a dose or a frequency.
- Do not interpret the prescription, advise on it, or comment on whether it is appropriate.
- If you are unsure about a line, leave it out. A missed medicine costs one tap; a wrong one is dangerous.
- If nothing in the list matches, return [].

Prescription text:
${text.slice(0, 4000)}

The doctor's list:
${options}`;
}

/**
 * Parse a model reply, discarding anything not on the doctor's list.
 *
 * Returns the LIST's spelling, never the model's, so "betnovate" cannot enter
 * an order as a medicine distinct from "Betnovate".
 */
export function parseMatches(raw: string, list: Candidate[]): Match[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const byName = new Map(list.map((m) => [fold(m.name), m]));
  const out: Match[] = [];
  const seen = new Set<string>();

  for (const row of parsed) {
    if (!row || typeof row !== "object") continue;
    const name = (row as { name?: unknown }).name;
    if (typeof name !== "string") continue;

    const hit = byName.get(fold(name));
    if (!hit || seen.has(hit.id)) continue;
    seen.add(hit.id);

    const because = (row as { because?: unknown }).because;
    out.push({
      id: hit.id,
      name: hit.name,
      because:
        typeof because === "string" && because.trim()
          ? because.slice(0, 200)
          : "Suggested from the prescription.",
      source: "ai",
    });
  }
  return out.slice(0, 12);
}

/**
 * Merge the two passes, preferring what was literally on the paper.
 *
 * An exact hit is evidence a patient can check by looking; an AI one is a
 * suggestion. Where both fire for the same medicine, the checkable reason is
 * the one worth showing.
 */
export function merge(exact: Match[], ai: Match[]): Match[] {
  const out = [...exact];
  const have = new Set(exact.map((m) => m.id));
  for (const m of ai) {
    if (!have.has(m.id)) {
      out.push(m);
      have.add(m.id);
    }
  }
  return out;
}
