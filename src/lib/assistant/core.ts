/**
 * The rules the on-site assistant answers by.
 *
 * Pure module: no `server-only`, no `cache()`. The verification suite imports
 * it under tsx and both of those break that. The network call lives next door
 * in reply.ts; everything deciding WHAT may be said lives here, where it can
 * be tested without a key and without a socket.
 *
 * ── The line this file draws ─────────────────────────────────────────────
 * This is a dermatology marketplace, so the tempting feature — "ask our AI
 * about your skin" — is the one thing it must not do. A model that reads a
 * description of a mole and offers an opinion is practising medicine, and it
 * will eventually be wrong about something that mattered.
 *
 * So the assistant explains what the site sells and what the reader's own
 * record says, and hands every clinical question to a doctor. That is not a
 * disclaimer bolted on afterwards: deflect() runs BEFORE the model is called,
 * so a clinical question costs nothing and cannot be answered by accident
 * even if the prompt were ignored entirely.
 */

export type Audience = "patient" | "doctor" | "visitor";

export type Turn = { role: "user" | "assistant"; content: string };

/** A fact the server looked up. The model may quote these; it may not add to them. */
export type Fact = { label: string; value: string };

export type Grounding = {
  /** Real rows from hub_treatments — the only treatment names that exist here. */
  treatments: { name: string; blurb: string; category: string }[];
  /** How the site works: prices, policies, hours. Computed, never written by hand. */
  site: Fact[];
  /** The reader's own record. Empty for a visitor. */
  own: Fact[];
};

export const EMPTY_GROUNDING: Grounding = { treatments: [], site: [], own: [] };

/* ── What must never be answered ──────────────────────────────────────── */

export type Deflection = "urgent" | "diagnosis" | "prescribing" | null;

/**
 * Urgent first, and deliberately broad. A false positive costs somebody one
 * unnecessary sentence about seeking care. A false negative is the failure
 * nobody wants to explain afterwards.
 */
const URGENT: RegExp[] = [
  /(can.?t|cannot|trouble|difficulty)\s+breath/i,
  /swell(ing|ed|s)?[^.?!]{0,40}(throat|tongue|lip|face|eye)/i,
  /(throat|tongue|lip|face|eye)[^.?!]{0,40}swell/i,
  /anaphyla/i,
  /(bleeding|bleed)[^.?!]{0,30}(won.?t stop|heavily|profuse|non.?stop)/i,
  /fever[^.?!]{0,40}(rash|blister|spreading)/i,
  /(rash|blister)[^.?!]{0,40}fever/i,
  /spreading (fast|rapidly|quickly|all over)/i,
  /(severe|unbearable|worst|excruciating)[^.?!]{0,20}pain/i,
  /\bpus\b|\babscess\b|necro(tic|sis|tising)/i,
  /\bemergency\b|\bambulance\b|casualty/i,
  /suicid|self.?harm/i,
];

/** "Look at this and tell me what it is", and "what should I have?" */
const DIAGNOSIS: RegExp[] = [
  /(is|could|might)\s+(this|it|that|my)[^?]{0,60}(cancer|melanoma|carcinoma|malignant|serious|infected|contagious|permanent)/i,
  /do i have\b/i,
  /what.?s\s+(this|that|wrong with)/i,
  /what is (this|that)\s+(rash|spot|mole|lump|bump|patch|mark|growth|thing)/i,
  /diagnos/i,
  /should i (be )?(worry|worried|be worried|be concerned|get it checked)/i,
  /(look|check|tell me)[^?]{0,30}(at )?(my|this)[^?]{0,25}(mole|rash|spot|lesion|skin|photo|picture|pic)/i,
  /what treatment (do|should|would) i\b/i,
  /which treatment (is right|should i|do i|would)/i,
  /what should i (get|take|do|use|try) for my\b/i,
  /(cure|get rid of|fix)\s+my\b/i,
  /why (is|does) my (skin|face|hair)[^?]{0,30}(itch|burn|hurt|peel|flake|fall)/i,
];

/** Anything about drugs and doses. */
const PRESCRIBING: RegExp[] = [
  /(dose|dosage|how much|how many|how often)[^?]{0,40}(mg|ml|tablet|capsule|cream|apply|take|use)/i,
  /can i (take|use|apply|mix|combine|stop)\b/i,
  /(is it |)safe to\s+(take|use|apply|combine|mix|stop)/i,
  /side.?effects?( of|)\b/i,
  /(instead of|substitute for|alternative to)[^?]{0,30}(tablet|medicine|drug|cream|steroid)/i,
  /(pregnan|breastfeed|nursing)[^?]{0,40}(safe|can i|use|take|ok)/i,
  /(safe|can i|use|take)[^?]{0,40}(pregnan|breastfeed|nursing)/i,
  /allergic (to|reaction)[^?]{0,30}(can i|should i|instead)/i,
];

/**
 * Ordering a prescribed item, or asking where to upload one, is admin rather
 * than clinical. Without this carve-out the medicine flow becomes unusable:
 * "where do I upload my prescription" would be refused as drug advice.
 */
const ADMIN_NOT_CLINICAL: RegExp[] = [
  /(upload|attach|send|submit)[^?]{0,25}prescription/i,
  /(where|how)[^?]{0,30}(order|buy|reorder|track)[^?]{0,25}(medicine|order|item)/i,
  /(status|track|where is)[^?]{0,25}(my )?order/i,
];

export function deflect(question: string): Deflection {
  const q = question.trim();
  if (!q) return null;

  // Urgent outranks everything, including the admin carve-out. Somebody
  // describing an emergency while asking about an order still gets the
  // emergency answer.
  if (URGENT.some((r) => r.test(q))) return "urgent";
  if (ADMIN_NOT_CLINICAL.some((r) => r.test(q))) return null;
  if (DIAGNOSIS.some((r) => r.test(q))) return "diagnosis";
  if (PRESCRIBING.some((r) => r.test(q))) return "prescribing";
  return null;
}

/**
 * A refusal still has to be USEFUL, or people learn to route around it. Each
 * one names the thing the reader can actually do next on this site.
 */
export function deflectionReply(
  kind: Exclude<Deflection, null>,
  audience: Audience
): string {
  if (kind === "urgent") {
    return "That needs looking at now, and not by me. Please contact your nearest emergency department or call your doctor straight away. If it turns out to be less urgent than it sounds, a BluDerma practitioner can see you — but do not wait on this message to decide.";
  }

  if (kind === "diagnosis") {
    return audience === "doctor"
      ? "I do not offer clinical opinions — that is your call, not mine. What I can do is pull up what your portal already holds: a patient's visit history, the photos and notes on their record, or a plan you drafted."
      : "I cannot tell you what something is, or which treatment you need. That comes from a doctor, after an assessment — it is the whole reason the assessment exists. What I can do is tell you what a treatment involves as we describe it, or help you book a consultation.";
  }

  return audience === "doctor"
    ? "I do not advise on medicines or dosing. Your dispensary list and the prescriptions patients have uploaded are both here, and I can look up either."
    : "I cannot advise on medicines, doses, or whether something is safe to combine. Ask the doctor who prescribed it, or a pharmacist. I can show you an order's status, or where to upload a prescription.";
}

/* ── The prompt ───────────────────────────────────────────────────────── */

const SHARED_RULES = [
  "Answer ONLY from the FACTS below. If they do not cover it, say plainly that you do not have that information, and name who does.",
  "Never invent a treatment name, a price, a clinic, a doctor, a date or a figure. Every such detail must appear verbatim in the FACTS.",
  "Never give clinical advice, a diagnosis, a prognosis, or medicine and dosing guidance — even if asked directly, and even where it seems obvious.",
  "Do not describe risks, side effects, downtime or recovery times unless that exact wording appears in the FACTS.",
  "Be brief: two to four sentences. No markdown, no bullet lists, no headings.",
  "Write plainly, the way a good receptionist speaks. No sales language, no emoji, no exclamation marks.",
];

export function systemPrompt(audience: Audience): string {
  const who =
    audience === "doctor"
      ? "You are the assistant inside the BluDerma practitioner portal. You are speaking to a practitioner about their own practice: their bookings, their money, their patients' records, and how the portal works."
      : audience === "patient"
        ? "You are the assistant on BluDerma, a dermatology booking site. You are speaking to a signed-in client about their own bookings and orders, and about the treatments this site lists."
        : "You are the assistant on BluDerma, a dermatology booking site. You are speaking to a visitor who is not signed in, so you know nothing about them personally.";

  const extra =
    audience === "visitor"
      ? [
          "You have no access to any personal record. If asked about a booking or an order, say they need to sign in first.",
        ]
      : [];

  return [who, "", "Rules:", ...[...SHARED_RULES, ...extra].map((r) => `- ${r}`)].join("\n");
}

export function userPrompt(question: string, g: Grounding, history: Turn[]): string {
  const parts: string[] = [];

  if (g.treatments.length) {
    parts.push(
      "TREATMENTS THIS SITE LISTS (these names are the only ones that exist here):",
      ...g.treatments.map((t) => `- ${t.name} (${t.category}): ${t.blurb}`)
    );
  }
  if (g.site.length) {
    parts.push("", "HOW THE SITE WORKS:", ...g.site.map((f) => `- ${f.label}: ${f.value}`));
  }
  if (g.own.length) {
    parts.push("", "THIS PERSON'S OWN RECORD:", ...g.own.map((f) => `- ${f.label}: ${f.value}`));
  }
  if (!parts.length) parts.push("(no facts were found for this question)");

  // Four turns is enough for "and how much is that one?" to resolve, without
  // letting an old answer become the ground for a new one.
  const recent = history.slice(-4);
  const convo = recent.length
    ? [
        "",
        "EARLIER IN THIS CONVERSATION:",
        ...recent.map((t) => `${t.role === "user" ? "Them" : "You"}: ${t.content}`),
      ]
    : [];

  return ["FACTS", ...parts, ...convo, "", `QUESTION: ${question}`].join("\n");
}

/* ── The fallback ─────────────────────────────────────────────────────── */

/**
 * What gets said with no key, or when the call fails. It quotes the same facts
 * the model would have been handed, so the assistant degrades into something
 * terser rather than something absent. Same house rule as skinSummary.
 */
export function templateReply(g: Grounding, audience: Audience): string {
  const t = g.treatments[0];
  if (t) {
    const others = g.treatments.slice(1, 3).map((x) => x.name);
    const more = others.length ? ` We also list ${others.join(" and ")}.` : "";
    const close =
      audience === "doctor" ? "" : " Which one suits you is decided by a doctor at your consultation.";
    return `${t.name} — ${t.blurb}${more}${close}`;
  }

  if (g.own.length) {
    return g.own.slice(0, 3).map((f) => `${f.label}: ${f.value}.`).join(" ");
  }

  if (g.site.length) {
    return g.site.slice(0, 2).map((f) => `${f.label}: ${f.value}.`).join(" ");
  }

  return audience === "doctor"
    ? "I do not have anything on file for that. Bookings, money, patients, gift cards — name one and I will look it up."
    : "I do not have an answer for that one. For anything clinical you will want a doctor, and a consultation is how to reach one.";
}

/* ── After the model has spoken ───────────────────────────────────────── */

/**
 * The one guarantee worth having: no treatment this site does not sell.
 *
 * Checked against the FULL catalogue vocabulary rather than only the rows that
 * were retrieved, because a model naming a real BluDerma treatment that simply
 * was not retrieved is fine. A plausible-sounding treatment existing nowhere in
 * the catalogue is the exact failure this catches.
 */
const CAPITALISED_PHRASE = /\b([A-Z][a-zA-Z]+(?:[ -][A-Z][a-zA-Z]+)+)\b/g;

/** Capitalised pairs that are ordinary English, or our own furniture. */
const SAFE_PHRASES = new Set(
  [
    "BluDerma",
    "Blu Derma",
    "Gift Card",
    "Gift Cards",
    "Skin Analysis",
    "Skin Report",
    "Book A Consultation",
    "New Delhi",
    "Anna Nagar",
    "Tamil Nadu",
    "South Korea",
    "India Post",
  ].map((s) => s.toLowerCase())
);

export function unknownTreatments(answer: string, vocabulary: Iterable<string>): string[] {
  const known = new Set<string>();
  for (const v of vocabulary) known.add(v.toLowerCase());

  /**
   * A partial reference to a real name is not an invention.
   *
   * Caught live: the catalogue category is "Glass Skin & Glow", the model
   * wrote "Glass Skin", and an exact-match check rejected a perfectly correct
   * answer and served the template instead. A guard that fires on good output
   * is one that quietly degrades the feature every day, so a candidate also
   * passes when some real name contains it. The reverse is NOT allowed:
   * "Korean Glass Skin Programme" adds a word the catalogue never said, and
   * that is exactly the invention this exists to catch.
   */
  const isPartialOfKnown = (phrase: string) => {
    for (const k of known) if (k.includes(phrase)) return true;
    return false;
  };

  const hits = new Set<string>();
  for (const m of answer.matchAll(CAPITALISED_PHRASE)) {
    const phrase = m[1];
    const lower = phrase.toLowerCase();
    if (known.has(lower) || SAFE_PHRASES.has(lower) || isPartialOfKnown(lower)) continue;
    // A phrase opening a sentence is far more often ordinary prose than a
    // product name, so only flag one that appears mid-sentence.
    const at = m.index ?? 0;
    const before = answer.slice(Math.max(0, at - 2), at);
    if (at === 0 || /[.!?]\s$/.test(before)) continue;
    hits.add(phrase);
  }
  return [...hits];
}

/** A model that ignores the brevity rule gets trimmed rather than trusted. */
export function tidy(answer: string): string {
  let out = answer
    .replace(/\*\*/g, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/^#+\s*/gm, "");
  out = out.replace(/\s*\n\s*\n\s*/g, "\n").trim();

  const sentences = out.match(/[^.!?]+[.!?]+(\s|$)/g);
  if (sentences && sentences.length > 5) out = sentences.slice(0, 5).join("").trim();
  return out;
}

/** Openers, so an empty panel is never the first thing anybody sees. */
export function starters(audience: Audience): string[] {
  if (audience === "doctor") {
    return [
      "What have I got booked today?",
      "How is my month looking?",
      "Which visits are waiting on me?",
      "How much of my laser has come back?",
    ];
  }
  if (audience === "patient") {
    return [
      "When is my next appointment?",
      "What is a skin booster?",
      "How much is a skin scan?",
      "Where do I upload a prescription?",
    ];
  }
  return [
    "What treatments do you offer?",
    "How does the skin scan work?",
    "What does a consultation cost?",
    "Where are your clinics?",
  ];
}
