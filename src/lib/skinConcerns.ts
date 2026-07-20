// Concern definitions used by the "what we analyze" grid on the analyzer.
export interface ConcernInfo {
  name: string;
  description: string;
}

export const CONCERN_INFO: Record<string, ConcernInfo> = {
  acne: { name: "Acne", description: "Active breakouts, blemishes and congestion." },
  wrinkles: { name: "Wrinkles", description: "Fine lines and expression creases." },
  pores: { name: "Pores", description: "Visibility and enlargement of pores." },
  moisture: { name: "Hydration", description: "How well your skin holds moisture." },
  dark_circle: {
    name: "Dark circles",
    description: "Shadowing and darkness under the eyes.",
  },
  redness: { name: "Redness", description: "Irritation, flushing and sensitivity." },
  oiliness: { name: "Oiliness", description: "Excess shine and sebum production." },
  radiance: { name: "Radiance", description: "Overall glow and brightness." },
  firmness: { name: "Firmness", description: "Elasticity, bounce and tightness." },
  texture: { name: "Texture", description: "Smoothness and surface evenness." },
  eye_bag: { name: "Eye bags", description: "Puffiness and swelling under the eyes." },
  age_spot: {
    name: "Age spots",
    description: "Sun-induced pigmentation and dark spots.",
  },
};
