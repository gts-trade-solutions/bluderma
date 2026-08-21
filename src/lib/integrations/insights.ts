import "server-only";

import {
  INSIGHT_ICONS,
  type InsightItem,
  type InsightMetrics,
  figuresAreSupported,
  allowedMetrics,
  templateInsights,
} from "./insightsCore";

/**
 * Turns a practice's figures into a few sentences worth acting on.
 *
 * The model receives the computed metrics as JSON and is told to quote them
 * verbatim. It is not asked to calculate, compare or project — all of that
 * already happened in lib/doctor/metrics.ts, deterministically, and a
 * dashboard about somebody's income is the last place to let a language model
 * do arithmetic.
 *
 * Output is then checked: every number in the generated prose must appear in
 * the metrics it was given. A single unsupported figure discards the whole
 * response and the deterministic pointers are used instead. That is a blunt
 * rule, and deliberately so — a doctor reading "you earned ₹48,000" that we
 * invented is worse than a doctor reading a plainer sentence that is true.
 */

export interface InsightResult {
  items: InsightItem[];
  source: "ai" | "template";
  model: string | null;
}

export async function generateInsights(
  m: InsightMetrics
): Promise<InsightResult> {
  const fallback = (): InsightResult => ({
    items: templateInsights(m),
    source: "template",
    model: null,
  });

  const key = process.env.OPENAI_API_KEY;
  if (!key) return fallback();

  const model = process.env.OPENAI_INSIGHTS_MODEL || "gpt-4o-mini";

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: `You advise a dermatology practitioner on running their clinic. Below are their actual figures as JSON.

Write 3 or 4 suggestions. These are read at a glance on a dashboard, so they
must be very short. The number does the work, not the sentence.

Rules:
- "metric": copied CHARACTER FOR CHARACTER from the "Figures you may quote"
  list below, including its currency mark or per-cent sign. Never retype a
  rupee figure without its symbol, and never put a money figure under a title
  that reads like a count. Omit "metric" entirely if none of them fits.
- "title": at most 4 words, written as a human phrase, never the JSON field name. "Thursday is quietest", not "Emptiest Free".
- "body": at most 12 words. One clause naming the action. No preamble like "Consider" or "You should".
- Vary "kind" to match the subject: calendar for scheduling, money for revenue, people for patients, star for reviews, clock for things waiting on you.
- Each suggestion must be about a different thing. Do not restate one figure three ways.
- Quote figures ONLY as they appear in the JSON. Never calculate, add, average, compare or project a new number.
- Do not invent any figure, date, name, treatment or competitor.
- "kind": one of calendar, money, people, star, clock, spark.
- Never use a gendered pronoun about anyone. No medical advice.

Return ONLY a JSON array like:
[{"kind":"clock","metric":"2","title":"Waiting on you","body":"Holding slots nobody else can take."}]

Figures you may quote as "metric" (exactly as written):
${allowedMetrics(m).map((v) => `  ${v}`).join("\n")}

Full figures for context:
${JSON.stringify(m, null, 2)}`,
          },
        ],
        temperature: 0.4,
        max_tokens: 500,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return fallback();

    const data = await res.json();
    const raw: string = (data?.choices?.[0]?.message?.content ?? "").trim();
    if (!raw) return fallback();

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1));
    } catch {
      return fallback();
    }
    if (!Array.isArray(parsed) || parsed.length === 0) return fallback();

    const permitted = new Set(allowedMetrics(m));
    const items: InsightItem[] = [];
    for (const entry of parsed.slice(0, 4)) {
      if (!entry || typeof entry !== "object") continue;
      const e = entry as InsightItem;
      const title = String(e.title ?? "").trim();
      const body = String(e.body ?? "").trim();
      if (!title || !body) continue;
      // Hard caps: these sit in a small card, and a model asked for "short"
      // will still occasionally write a paragraph.
      if (title.length > 40 || body.length > 90) continue;

      // A metric that is not one of the pre-rendered strings is dropped
      // rather than printed. The card keeps its sentence; it just loses the
      // big number, which is the correct trade when the alternative is a
      // rupee total displayed as though it were a count of appointments.
      const claimed = e.metric ? String(e.metric).trim().slice(0, 16) : undefined;
      const metric = claimed && permitted.has(claimed) ? claimed : undefined;
      const kind =
        e.kind && (INSIGHT_ICONS as readonly string[]).includes(String(e.kind))
          ? String(e.kind)
          : "spark";

      // The tripwire. An unsupported figure means the model computed or
      // invented something, and none of it is trustworthy after that.
      if (!figuresAreSupported(`${title} ${body} ${metric ?? ""}`, m)) {
        return fallback();
      }

      items.push({ title, body, metric, kind });
    }

    return items.length >= 2
      ? { items, source: "ai", model }
      : fallback();
  } catch (e) {
    console.error("[insights] generation failed:", e);
    return fallback();
  }
}

export { templateInsights } from "./insightsCore";
export type { InsightItem, InsightMetrics } from "./insightsCore";
