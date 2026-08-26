/**
 * Deciding whether two people are describing the same clinic.
 *
 * ── The problem ──────────────────────────────────────────────────────────
 * Clinic is already a shared entity — several practitioners work at one, one
 * practitioner works at several, and DoctorClinic is the join that carries the
 * per-branch fee. The data model has been right about this from the start.
 * What was missing is the only moment it matters: onboarding. Every doctor who
 * joined created a brand-new Clinic row, so three dermatologists at the same
 * Anna Nagar address produced three clinics, three addresses, three sets of
 * photographs, three pins on a map and one very confused client searching
 * nearby.
 *
 * ── Why this is a suggestion and never automatic ─────────────────────────
 * Joining is a real consequence: it puts a practitioner's name on somebody
 * else's premises page and their diary into a shared location's calendar
 * colour. So nothing here merges anything. It surfaces candidates, ranked,
 * and a human presses the button. A false positive that a doctor accepts by
 * accident is far more expensive than a duplicate row, and the only party who
 * can tell "Skin Clinic, Anna Nagar" from "Skin Clinic, Anna Nagar" is a
 * person who works at one of them.
 *
 * Pure, and in its own module, so prisma/verify-*.ts can import it — anything
 * that reaches for the Prisma client cannot be run under tsx.
 */

/** Words that carry no identifying signal in an Indian clinic name. */
const NOISE = new Set([
  "the",
  "clinic",
  "clinics",
  "centre",
  "center",
  "hospital",
  "hospitals",
  "skin",
  "care",
  "medical",
  "polyclinic",
  "speciality",
  "specialty",
  "super",
  "multi",
  "and",
  "&",
  "dr",
  "doctor",
  "dermatology",
  "derma",
  "aesthetics",
  "aesthetic",
  "cosmetic",
  "cosmetics",
  "institute",
  "pvt",
  "ltd",
  "llp",
]);

/**
 * A comparable form of a clinic name.
 *
 * "Dr. Menon's Skin & Hair Clinic (Anna Nagar)" and "Menon Skin Hair Clinic,
 * Anna Nagar" both reduce to "menon hair nagar anna" once noise is dropped and
 * the rest is sorted — which is the point: word order varies constantly and
 * carries no meaning here.
 */
export function normaliseClinicName(raw: string): string {
  const words = raw
    .toLowerCase()
    .replace(/['’]s\b/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !NOISE.has(w));

  // Everything was noise — "The Skin Clinic". Fall back to the raw form so two
  // genuinely identical generic names can still match each other.
  if (words.length === 0) {
    return raw.toLowerCase().replace(/[^a-z0-9]/g, "");
  }
  return [...new Set(words)].sort().join(" ");
}

/**
 * Address line reduced the same way, for the secondary comparison.
 *
 * The ordinal handling is the part that earns its keep. "No. 12, 2nd Main
 * Road", "12 Second Main Road" and "12, 2 Main Rd" are one address written
 * three ways, and an Indian street address genuinely is written all three
 * ways by different people at the same clinic.
 *
 * Order matters here. The suffix is stripped from a digit FIRST, anchored to
 * the digit, so that the standalone abbreviations dropped a line later - "st"
 * for street, "rd" for road - cannot eat the "st" out of "1st" or the "rd"
 * out of "23rd" on their way past.
 */
const ORDINAL_WORDS: Record<string, string> = {
  first: "1",
  second: "2",
  third: "3",
  fourth: "4",
  fifth: "5",
  sixth: "6",
  seventh: "7",
  eighth: "8",
  ninth: "9",
  tenth: "10",
};

export function normaliseAddress(raw: string): string {
  return (
    raw
      .toLowerCase()
      // "2nd" -> "2", "23rd" -> "23".
      .replace(/(\d+)(st|nd|rd|th)\b/g, "$1")
      // Spelled-out ordinals, to the same digits.
      .replace(
        /\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\b/g,
        (w) => ORDINAL_WORDS[w]
      )
      // Words that label a part of an address rather than identify it.
      .replace(/\b(no|door|plot|flat|shop|unit|floor|opp|near|behind)\b\.?/g, " ")
      // Street and road, however they are abbreviated. Safe now that no
      // ordinal suffix survives to be mistaken for one.
      .replace(/\b(st|str|rd|road|ave|avenue)\b\.?/g, " ")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/** 0-1 overlap of two normalised strings' word sets. */
function overlap(a: string, b: string): number {
  const A = new Set(a.split(" ").filter(Boolean));
  const B = new Set(b.split(" ").filter(Boolean));
  if (A.size === 0 || B.size === 0) return 0;

  let shared = 0;
  for (const w of A) if (B.has(w)) shared++;
  return shared / Math.min(A.size, B.size);
}

export interface ClinicCandidate {
  id: string;
  name: string;
  addressLine1: string;
  area: string;
  city: string;
  pincode: string;
}

export interface ScoredClinic extends ClinicCandidate {
  /** 0-1. Only what is above THRESHOLD is ever shown. */
  score: number;
  /** Why it matched, in words, shown under the suggestion. */
  reason: string;
}

/**
 * Above this, a candidate is worth showing. Below it, offering the suggestion
 * costs more attention than it saves.
 *
 * Set where it is because the pincode is already an exact match by the time
 * anything reaches here — these scores are all *within* one postal code, so
 * the bar for the name and street is genuinely about telling neighbouring
 * clinics apart, not about finding the city.
 */
export const MATCH_THRESHOLD = 0.5;

/**
 * Ranks clinics in the same pincode against what the doctor is typing.
 *
 * The pincode is assumed to match already — it is the query's WHERE clause,
 * because two clinics in different postal codes are not the same clinic
 * however alike their names are, and "Apollo" would otherwise match nationwide.
 */
export function rankClinics(
  input: { name: string; addressLine1: string },
  candidates: ClinicCandidate[]
): ScoredClinic[] {
  const wantName = normaliseClinicName(input.name);
  const wantAddr = normaliseAddress(input.addressLine1);

  const scored: ScoredClinic[] = [];

  for (const c of candidates) {
    const nameScore = overlap(wantName, normaliseClinicName(c.name));
    const addrScore = wantAddr
      ? overlap(wantAddr, normaliseAddress(c.addressLine1))
      : 0;

    // The name leads. An address alone matching is common and weak — two
    // clinics genuinely do share a building, on different floors — so it can
    // lift a decent name match but cannot carry a poor one on its own.
    const score = Math.min(1, nameScore * 0.75 + addrScore * 0.35);
    if (score < MATCH_THRESHOLD) continue;

    scored.push({
      ...c,
      score,
      reason:
        nameScore >= 0.85 && addrScore >= 0.6
          ? "Same name and street"
          : nameScore >= 0.85
            ? "Same name, same PIN code"
            : addrScore >= 0.6
              ? "Same street, similar name"
              : "Similar name in this PIN code",
    });
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, 5);
}
