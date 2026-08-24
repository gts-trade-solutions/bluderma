import "server-only";

import {
  type Audience,
  type Grounding,
  type Turn,
  deflect,
  deflectionReply,
  systemPrompt,
  templateReply,
  tidy,
  unknownTreatments,
  userPrompt,
} from "@/lib/assistant/core";

/**
 * Turning a question into an answer.
 *
 * Follows the house pattern from skinSummary.ts: plain fetch, no SDK, a
 * deterministic template when there is no key, and it never throws — a failed
 * call degrades the answer rather than breaking the panel.
 *
 * ── Four things happen before a model sees anything ──────────────────────
 * 1. deflect() — clinical questions never reach the API at all
 * 2. grounding — facts are looked up and pasted in; the model adds nothing
 * 3. the answer is trimmed to the brevity rule rather than trusted to follow it
 * 4. unknownTreatments() — an invented procedure name downgrades the whole
 *    answer to the template, because on a medical site a confident wrong
 *    treatment name is worse than a terse right one
 */

export type ReplyResult = {
  answer: string;
  /** What produced it. Surfaced in the UI so nobody mistakes a template for a model. */
  source: "deflected" | "ai" | "template";
  /** Set when step 4 fired. Logged, so a bad prompt shows up as a pattern. */
  rejected?: string[];
};

const MODEL = process.env.OPENAI_ASSISTANT_MODEL || "gpt-4o-mini";

async function askModel(
  question: string,
  g: Grounding,
  history: Turn[],
  audience: Audience
): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const controller = new AbortController();
  // Somebody watching a typing indicator will not wait longer than this, and a
  // slow answer they have already navigated away from costs money for nothing.
  const timer = setTimeout(() => controller.abort(), 12_000);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt(audience) },
          { role: "user", content: userPrompt(question, g, history) },
        ],
        // Low, not zero. This answers the same question many ways across many
        // people; zero makes it read like a vending machine. It is not low
        // enough to let it get inventive with a fact.
        temperature: 0.3,
        max_tokens: 220,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error("[assistant] OpenAI returned", res.status);
      return null;
    }
    const data = await res.json();
    const text = (data?.choices?.[0]?.message?.content ?? "").trim();
    return text || null;
  } catch (e) {
    console.error("[assistant] call failed:", e);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function answer(
  question: string,
  g: Grounding,
  history: Turn[],
  audience: Audience,
  vocabulary: Iterable<string>
): Promise<ReplyResult> {
  const kind = deflect(question);
  if (kind) return { answer: deflectionReply(kind, audience), source: "deflected" };

  const raw = await askModel(question, g, history, audience);
  if (!raw) return { answer: templateReply(g, audience, question), source: "template" };

  const cleaned = tidy(raw);

  // Everything the model was handed counts as known — clinic names, doctors,
  // cities, the lot. A name that was put in front of it is by definition real,
  // and rejecting a correct answer for quoting its own source material is a
  // guard that degrades the feature every day. ("BluDerma Aesthetics" is how
  // this was found.)
  const known = [...vocabulary, ...g.treatments.map((t) => t.name)];
  const groundedText = [
    ...g.treatments.map((t) => `${t.name} ${t.category} ${t.blurb}`),
    ...g.site.map((f) => `${f.label} ${f.value}`),
    ...g.own.map((f) => `${f.label} ${f.value}`),
  ].join(" ");

  const invented = unknownTreatments(cleaned, known, groundedText);
  if (invented.length) {
    console.error("[assistant] rejected an answer naming", invented, "for:", question);
    return {
      answer: templateReply(g, audience, question),
      source: "template",
      rejected: invented,
    };
  }

  return { answer: cleaned, source: "ai" };
}
