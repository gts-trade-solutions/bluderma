// -----------------------------------------------------------------------------
// Skin analysis model (frontend simulation)
// No backend / AI: analysis is simulated deterministically from a seed derived
// from the uploaded photo, so the same photo yields the same result.
// -----------------------------------------------------------------------------

export type MetricKey =
  | "acne"
  | "wrinkles"
  | "pores"
  | "hydration"
  | "darkCircles"
  | "redness"
  | "oiliness"
  | "radiance"
  | "firmness"
  | "texture"
  | "eyeBags"
  | "ageSpots";

export interface Metric {
  key: MetricKey;
  label: string;
  hint: string;
}

export const metrics: Metric[] = [
  { key: "acne", label: "Acne", hint: "Breakouts & blemishes" },
  { key: "wrinkles", label: "Wrinkles", hint: "Fine lines & creases" },
  { key: "pores", label: "Pores", hint: "Visibility & size" },
  { key: "hydration", label: "Hydration", hint: "Moisture level" },
  { key: "darkCircles", label: "Dark circles", hint: "Under-eye shadows" },
  { key: "redness", label: "Redness", hint: "Irritation & flushing" },
  { key: "oiliness", label: "Oiliness", hint: "Excess shine" },
  { key: "radiance", label: "Radiance", hint: "Glow & brightness" },
  { key: "firmness", label: "Firmness", hint: "Elasticity & bounce" },
  { key: "texture", label: "Texture", hint: "Smoothness & evenness" },
  { key: "eyeBags", label: "Eye bags", hint: "Puffiness" },
  { key: "ageSpots", label: "Age spots", hint: "Sun spots & pigment" },
];

export const metricLabel: Record<MetricKey, string> = metrics.reduce(
  (acc, m) => ({ ...acc, [m.key]: m.label }),
  {} as Record<MetricKey, string>
);

export interface Rating {
  label: string;
  /** Tailwind text colour class. */
  color: string;
  /** Tailwind bg colour class for bars. */
  bar: string;
  ring: string;
}

export function ratingForScore(score: number): Rating {
  if (score >= 85)
    return {
      label: "Excellent",
      color: "text-teal-600",
      bar: "bg-teal-500",
      ring: "text-teal-500",
    };
  if (score >= 70)
    return {
      label: "Good",
      color: "text-brand-600",
      bar: "bg-brand-500",
      ring: "text-brand-500",
    };
  if (score >= 55)
    return {
      label: "Fair",
      color: "text-amber-600",
      bar: "bg-amber-500",
      ring: "text-amber-500",
    };
  return {
    label: "Needs attention",
    color: "text-rose-600",
    bar: "bg-rose-500",
    ring: "text-rose-500",
  };
}

export interface AnalysisResult {
  scores: Record<MetricKey, number>;
  overall: number;
  skinType: string;
  estimatedAge: number;
  /** The three lowest-scoring concerns, worst first. */
  topConcerns: MetricKey[];
}

// Small deterministic PRNG so a given seed always gives the same scores.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Turn any string (e.g. a filename + size) into a stable numeric seed. */
export function seedFromString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function simulateAnalysis(seed: number): AnalysisResult {
  const rng = mulberry32(seed);
  const scores = {} as Record<MetricKey, number>;
  for (const m of metrics) {
    // Scores skew toward the middle-high range for a realistic feel.
    const base = 48 + Math.floor(rng() * 50); // 48–97
    scores[m.key] = Math.max(38, Math.min(98, base));
  }

  const values = Object.values(scores);
  const overall = Math.round(values.reduce((a, b) => a + b, 0) / values.length);

  const topConcerns = [...metrics]
    .sort((a, b) => scores[a.key] - scores[b.key])
    .slice(0, 3)
    .map((m) => m.key);

  // Derive a skin type from the relevant signals.
  const oily = scores.oiliness < 60;
  const dry = scores.hydration < 60;
  let skinType = "Normal";
  if (oily && dry) skinType = "Combination";
  else if (oily) skinType = "Oily";
  else if (dry) skinType = "Dry";
  if (scores.redness < 55) skinType += " · Sensitive";

  // Estimated age nudged by ageing-related signals.
  const ageingLoad =
    (100 - scores.wrinkles) + (100 - scores.firmness) + (100 - scores.ageSpots);
  const estimatedAge = Math.round(24 + ageingLoad / 12); // ~24–48

  return { scores, overall, skinType, estimatedAge, topConcerns };
}
