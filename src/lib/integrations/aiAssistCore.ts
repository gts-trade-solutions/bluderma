import type { AboutTone } from "./aiAssistTypes";

/**
 * The deterministic half of the onboarding assist.
 *
 * Split out of aiAssist.ts, which carries `import "server-only"` — correct for
 * a module that reads OPENAI_API_KEY, and fatal for anything that wants to
 * test it, because `server-only` does not resolve outside a bundler. Same
 * reason queries/doctorAccess.ts is separate from queries/doctors.ts.
 *
 * Everything here is pure and needs no key, which is also what makes it the
 * fallback: this is what a practitioner gets when the AI is unavailable, and
 * it has to be good enough to ship on its own.
 */

export interface AboutFacts {
  name: string;
  title: string;
  specialty: string;
  experienceYears: number;
  clinicNames: string[];
  areas: string[];
  services: string[];
  languages: string[];
}

export interface ClinicFacts {
  name: string;
  area: string;
  city: string;
  facilities: string[];
  doctorSpecialty: string;
}

/**
 * An introduction assembled from fields that are actually set.
 *
 * Every clause is guarded by the fact it depends on, so a half-filled profile
 * produces a shorter paragraph rather than a sentence about nothing.
 */
export function templateAbout(facts: AboutFacts, tone: AboutTone): string {
  const who = facts.name.replace(/^Dr\.?\s+/i, "").trim() || "This practitioner";
  const parts: string[] = [];

  const creds = [facts.title.trim(), facts.specialty.trim()]
    .filter(Boolean)
    .join(", ");
  const years =
    facts.experienceYears > 0
      ? `${facts.experienceYears} year${facts.experienceYears === 1 ? "" : "s"}`
      : null;

  if (creds && years) {
    parts.push(`Dr. ${who} is a ${creds} practitioner with ${years} in practice.`);
  } else if (creds) {
    parts.push(`Dr. ${who} is a ${creds} practitioner.`);
  } else if (years) {
    parts.push(`Dr. ${who} has ${years} in practice.`);
  } else {
    parts.push(`Dr. ${who} consults on BluDerma.`);
  }

  if (facts.clinicNames.length) {
    const where = facts.areas.length
      ? `${facts.clinicNames[0]} in ${facts.areas[0]}`
      : facts.clinicNames[0];
    const others = facts.clinicNames.length - 1;
    const more =
      others > 0
        ? ` and ${others} other location${others > 1 ? "s" : ""}`
        : "";
    parts.push(`Consultations are at ${where}${more}.`);
  }

  if (facts.services.length) {
    parts.push(`Areas of focus include ${facts.services.slice(0, 4).join(", ")}.`);
  }

  if (tone !== "concise" && facts.languages.length > 1) {
    parts.push(`Consultations are available in ${facts.languages.join(", ")}.`);
  }

  if (tone === "warm") {
    parts.push(
      "Every consultation starts by understanding what is bothering you and what you have already tried."
    );
  }

  return parts.join(" ").trim();
}

export function templateClinicAbout(facts: ClinicFacts): string {
  const parts: string[] = [];
  const where = [facts.area, facts.city].filter(Boolean).join(", ");
  parts.push(where ? `${facts.name} is located in ${where}.` : `${facts.name}.`);
  if (facts.doctorSpecialty.trim()) {
    parts.push(
      `The clinic offers ${facts.doctorSpecialty.toLowerCase()} consultations.`
    );
  }
  if (facts.facilities.length) {
    parts.push(`Facilities include ${facts.facilities.join(", ")}.`);
  }
  return parts.join(" ");
}

/**
 * Token-overlap matching against the real catalogue.
 *
 * The no-key path for "I do microneedling with PRP", and the fallback whenever
 * the model's answer is unusable. Scores by matched token length so a longer,
 * more specific word counts for more than a short common one.
 */
export function fuzzyMatchTreatments(
  query: string,
  vocabulary: string[],
  limit = 8
): string[] {
  const tokens = query
    .toLowerCase()
    .split(/[^a-z0-9+]+/)
    .filter((t) => t.length > 2);
  if (!tokens.length) return [];

  return vocabulary
    .map((name) => {
      const lower = name.toLowerCase();
      let score = 0;
      for (const t of tokens) if (lower.includes(t)) score += t.length;
      return { name, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.name);
}

/**
 * Keeps only names the catalogue actually contains.
 *
 * The guarantee behind the treatment matcher: whatever a model returns, this
 * runs afterwards, so an invented treatment name cannot reach a profile even
 * if the prompt is ignored entirely.
 */
export function intersectWithVocabulary(
  candidates: unknown,
  vocabulary: string[]
): string[] {
  if (!Array.isArray(candidates)) return [];
  const allowed = new Map(vocabulary.map((v) => [v.toLowerCase(), v]));
  const out: string[] = [];
  for (const item of candidates) {
    if (typeof item !== "string") continue;
    const real = allowed.get(item.trim().toLowerCase());
    if (real && !out.includes(real)) out.push(real);
  }
  return out;
}
