import "server-only";
import { concernLabel } from "@/lib/integrations/skinConcerns";

/**
 * Friendly one-paragraph summary of a skin analysis.
 *
 * If OPENAI_API_KEY is set it generates a warm, personalised paragraph via the
 * OpenAI API (no SDK dependency — plain fetch). Otherwise it falls back to a
 * deterministic, natural-reading template so the report ALWAYS shows a summary.
 * Never throws; on any AI failure it returns the template.
 */

export type SummaryInput = {
  overall: number | null;
  skinType: string | null;
  skinAge: string | null;
  concerns: { key: string; score: number }[]; // worst-first
};

function templateSummary(input: SummaryInput): string {
  const pct = input.overall != null ? Math.round(input.overall * 100) : null;
  const byScore = [...input.concerns].sort((a, b) => a.score - b.score);
  const worst = byScore.slice(0, 2).map((c) => concernLabel(c.key));
  const best = [...byScore].reverse().slice(0, 2).map((c) => concernLabel(c.key));

  const parts: string[] = [];
  if (pct != null) {
    const band =
      pct >= 75 ? "a strong result" : pct >= 50 ? "a solid baseline" : "a good place to start";
    parts.push(`Your skin scored ${pct}/100 overall, ${band}.`);
  }
  if (input.skinType) parts.push(`Your skin type reads as ${input.skinType}.`);
  if (worst.length)
    parts.push(
      `The areas most worth attention are ${worst.join(" and ")}.`
    );
  if (best.length)
    parts.push(`Meanwhile, your ${best.join(" and ")} are looking healthy.`);
  parts.push(
    "A BluDerma doctor can walk you through tailored options for these results."
  );
  return parts.join(" ");
}

async function aiSummary(input: SummaryInput): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key || input.concerns.length === 0) return null;

  const byScore = [...input.concerns].sort((a, b) => a.score - b.score);
  const focus = byScore.slice(0, 3).map((c) => concernLabel(c.key));
  const strengths = [...byScore].reverse().slice(0, 2).map((c) => concernLabel(c.key));

  const prompt = `You are a warm, encouraging skincare assistant. Write a short summary (2-4 sentences, ~55 words) of a user's AI skin analysis, speaking directly to them ("your skin"). Start with the overall score, then name EVERY focus area listed below by its EXACT name, and close on a strength. Keep it positive and non-clinical. No markdown, no bullet points, no medical claims, no product names.

Overall score: ${input.overall != null ? Math.round(input.overall * 100) + "/100" : "n/a"}
Skin type: ${input.skinType ?? "n/a"}
Estimated skin age: ${input.skinAge ?? "n/a"}
Focus areas to mention (use these EXACT words, every one): ${focus.join(", ") || "none"}
Strengths: ${strengths.join(", ") || "n/a"}`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_SUMMARY_MODEL || "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 160,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = (data?.choices?.[0]?.message?.content ?? "").trim();
    return text || null;
  } catch (e) {
    console.error("[skinSummary] AI generation failed:", e);
    return null;
  }
}

/** Always returns a summary paragraph — AI when configured, else a template. */
export async function generateSkinSummary(input: SummaryInput): Promise<string> {
  return (await aiSummary(input)) ?? templateSummary(input);
}
