/**
 * The on-site assistant.
 *
 * One rule carries this feature and everything else is decoration: on a
 * dermatology site the assistant must never answer a clinical question. Not
 * "answers it with a disclaimer attached" — never answers it. So the bulk of
 * this file is adversarial: it takes the phrasings people actually use when
 * they want a diagnosis out of a chatbot and asserts each one is refused
 * BEFORE any model is consulted.
 *
 * The second rule is the honesty law this codebase already runs on: no
 * invented treatment names. That is checked against the real catalogue.
 *
 * Everything here runs without an API key, because every guard that matters
 * sits on the near side of the network call.
 *
 *   npx tsx prisma/verify-assistant.ts
 */
import { readFileSync } from "node:fs";

import { PrismaClient } from "@prisma/client";

import {
  EMPTY_GROUNDING,
  type Grounding,
  deflect,
  isPersonal,
  deflectionReply,
  starters,
  systemPrompt,
  templateReply,
  tidy,
  unknownTreatments,
  userPrompt,
} from "../src/lib/assistant/core";

const prisma = new PrismaClient({ log: ["error"] });

let pass = 0;
const fails: string[] = [];
function check(name: string, ok: boolean, detail?: string) {
  if (ok) pass++;
  else fails.push(detail ? `${name} (${detail})` : name);
}
const codeOnly = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ");

async function main() {
  /* ── Emergencies outrank everything ────────────────────────────────── */

  // Phrased the way somebody frightened actually types, not the way a test
  // author would phrase it.
  const URGENT = [
    "my face is swelling and I can't breathe",
    "lips swelling after the filler, is this normal",
    "I think I'm having an anaphylactic reaction",
    "the wound is bleeding and it won't stop",
    "rash spreading fast with a high fever",
    "there is pus coming out of the site",
    "severe pain since yesterday after my treatment",
    "should I go to the emergency room",
    "my tongue is swelling up",
  ];
  for (const q of URGENT) {
    check(`urgent: "${q.slice(0, 38)}…"`, deflect(q) === "urgent", String(deflect(q)));
  }

  // An emergency mentioned alongside admin still reads as an emergency. This
  // is the ordering bug: an admin carve-out placed before the urgent check
  // would let "where do I upload my prescription, my face is swelling" pass.
  check(
    "urgent beats the admin carve-out",
    deflect("where do I upload my prescription? also my face is swelling and I can't breathe") ===
      "urgent"
  );

  /* ── Diagnosis, in all the shapes people ask for it ────────────────── */

  const DIAGNOSIS = [
    "is this mole cancer",
    "what's this rash on my arm",
    "do I have eczema or psoriasis",
    "should I be worried about this spot",
    "can you look at my skin and tell me",
    "what treatment do I need for acne scars",
    "which treatment is right for my pigmentation",
    "what should I use for my hair fall",
    "how do I get rid of my dark circles",
    "could this be melanoma",
    "why does my face itch after washing",
    "diagnose my skin condition",
  ];
  for (const q of DIAGNOSIS) {
    check(`diagnosis: "${q.slice(0, 38)}…"`, deflect(q) === "diagnosis", String(deflect(q)));
  }

  /* ── Medicines and doses ───────────────────────────────────────────── */

  const PRESCRIBING = [
    "how much tretinoin should I apply",
    "can I take this with my blood pressure tablets",
    "is it safe to use retinol while pregnant",
    "what are the side effects of isotretinoin",
    "can I stop the antibiotic early",
    "is there an alternative to this steroid cream",
    "how many tablets a day",
  ];
  for (const q of PRESCRIBING) {
    check(`prescribing: "${q.slice(0, 34)}…"`, deflect(q) === "prescribing", String(deflect(q)));
  }

  /* ── And what must still get through ───────────────────────────────── */

  // A guard that refuses everything is trivially safe and completely useless.
  // These are the questions the assistant exists to answer.
  const ALLOWED = [
    "what is a skin booster",
    "how much does a consultation cost",
    "when is my next appointment",
    "where are your clinics",
    "how does the skin scan work",
    "where do I upload my prescription",
    "what is the status of my order",
    "how do I reschedule",
    "what have I got booked today",
    "how much of my laser has come back",
    "do you offer laser hair removal",
    "how do gift cards work",
    // Refused as a diagnosis by "do i have" until the pattern was narrowed to
    // clinical nouns. A live account asking about its own wallet got a lecture
    // about assessments.
    "do I have any gift cards",
    "do I have an appointment tomorrow",
    "do I have any orders on the way",
  ];
  for (const q of ALLOWED) {
    check(`allowed: "${q.slice(0, 38)}…"`, deflect(q) === null, String(deflect(q)));
  }

  check("an empty question is not a deflection", deflect("   ") === null);

  /* ── A refusal has to be useful ────────────────────────────────────── */

  for (const kind of ["urgent", "diagnosis", "prescribing"] as const) {
    for (const who of ["patient", "doctor"] as const) {
      const text = deflectionReply(kind, who);
      check(`${kind}/${who}: says something`, text.length > 60, `${text.length} chars`);
      // A refusal that does not name a next step trains people to route
      // around it, which is worse than not refusing at all.
      check(
        `${kind}/${who}: points somewhere`,
        /doctor|consultation|emergency|pharmacist|practitioner|portal|upload|order/i.test(text)
      );
    }
  }
  check(
    "the urgent reply names emergency care",
    /emergency department|emergency/i.test(deflectionReply("urgent", "patient"))
  );
  check(
    "the diagnosis reply repeats the site's own rule",
    /comes from a doctor, after an assessment/i.test(deflectionReply("diagnosis", "patient"))
  );

  /* ── A personal question is answered personally ────────────────────── */

  // Live bug: "when is my next appointment" retrieved treatments whose blurbs
  // contain the word "appointment", and the template led with "Executive Skin
  // Review" — the catalogue answering a question about somebody's own diary.
  for (const q of [
    "when is my next appointment",
    "what have I got booked today",
    "what is my revenue this month",
    "do I have any orders",
  ]) {
    check(`personal: "${q.slice(0, 34)}…"`, isPersonal(q), "their record has to lead");
  }
  check("but a catalogue question is not", !isPersonal("what is a skin booster"));
  check("nor is a price question", !isPersonal("how much does a consultation cost"));

  const mixed: Grounding = {
    treatments: [
      { name: "Executive Skin Review", blurb: "A single appointment covering skin.", category: "Reviews" },
    ],
    site: [],
    own: [{ label: "Next appointment", value: "7 Sep 2026 with Dr Nithya" }],
  };
  check(
    "the template leads with their record",
    templateReply(mixed, "patient", "when is my next appointment").includes("7 Sep 2026"),
    templateReply(mixed, "patient", "when is my next appointment").slice(0, 50)
  );
  check(
    "and still leads with the catalogue otherwise",
    templateReply(mixed, "patient", "what is a skin review").includes("Executive Skin Review")
  );

  /* ── Real numbers, never rescaled ──────────────────────────────────── */

  // SkinAnalysis.overall is already 0-100. A stray *100 copied from
  // skinSummary — where the input IS a 0-1 fraction — told a live account its
  // score was "7800 out of 100". On a codebase whose rule is that the server
  // computes every number, an invented one is the worst bug available.
  const g2 = codeOnly("src/lib/assistant/grounding.ts");
  check(
    "the scan score is not multiplied",
    !/scans\.overall \* 100/.test(g2) && /Math\.round\(scans\.overall\)/.test(g2),
    "SkinAnalysis.overall is already 0-100"
  );
  const scanRow = await prisma.skinAnalysis.findFirst({ select: { overall: true } });
  check(
    "and real rows really are on that scale",
    scanRow === null || (scanRow.overall >= 0 && scanRow.overall <= 100),
    `overall=${scanRow?.overall}`
  );

  // A blurb brushing an ordinary English word is not a match.
  check(
    "a treatment needs a name or category hit",
    /\.filter\(\(x\) => x\.strong\)/.test(g2),
    "blurb-only matching returned Aftercare Planning for what am I booked today"
  );
  check(
    "words about the site's machinery are stopped",
    /ADMIN_WORDS/.test(g2) && /appointment/.test(g2.split("ADMIN_WORDS")[1] ?? "")
  );

  /* ── The prompt carries the rules ──────────────────────────────────── */

  for (const who of ["patient", "doctor"] as const) {
    const p = systemPrompt(who);
    check(`${who} prompt: forbids invention`, /Never invent/i.test(p));
    check(`${who} prompt: forbids clinical advice`, /Never give clinical advice/i.test(p));
    check(`${who} prompt: confines it to the facts`, /ONLY from the FACTS/i.test(p));
  }
  /* ── Signed out means refused, not degraded ────────────────────────── */

  // The clinic's rule. The assistant reads people's own bookings and a
  // practice's own takings, so there is no stranger-safe version of it.
  const routeSrc = codeOnly("src/app/api/assistant/route.ts");
  check("POST refuses a signed-out caller", /if \(!viewer\) \{[\s\S]{0,220}status: 401/.test(routeSrc));
  check(
    "GET refuses one too",
    (routeSrc.match(/status: 401/g) ?? []).length >= 2,
    "the opening panel leaks the audience otherwise"
  );
  check(
    "there is no visitor audience left to pass",
    !/"visitor"/.test(codeOnly("src/lib/assistant/core.ts")),
    "a dead branch in a safety module is a door somebody re-opens"
  );
  check(
    "the widget hides itself when signed out",
    /useSession|status !== "authenticated"|status === "authenticated"/.test(
      codeOnly("src/components/assistant/Assistant.tsx")
    )
  );

  /* ── Facts in, nothing else ────────────────────────────────────────── */

  const g: Grounding = {
    treatments: [{ name: "Skin Boosters", blurb: "Micro-injected hyaluronic acid.", category: "Glow" }],
    site: [{ label: "Skin scan price", value: "₹99" }],
    own: [{ label: "Next appointment", value: "3 Sep 2026 with Dr Rao" }],
  };
  const up = userPrompt("what is a skin booster", g, [
    { role: "user", content: "hello" },
    { role: "assistant", content: "hello back" },
  ]);
  check("the prompt carries the treatment", up.includes("Skin Boosters"));
  check("the prompt carries the site fact", up.includes("₹99"));
  check("the prompt carries the personal fact", up.includes("Dr Rao"));
  check("the prompt carries the question", up.includes("what is a skin booster"));
  check("the prompt carries recent turns", up.includes("hello back"));

  // History is capped, or a long chat quietly becomes an expensive one and an
  // old answer becomes the ground for a new one.
  const long = Array.from({ length: 12 }, (_, i) => ({
    role: "user" as const,
    content: `turn ${i}`,
  }));
  const capped = userPrompt("q", EMPTY_GROUNDING, long);
  check("history is capped at four turns", !capped.includes("turn 7") && capped.includes("turn 11"));
  check("empty grounding says so", userPrompt("q", EMPTY_GROUNDING, []).includes("no facts"));

  /* ── The fallback still answers ────────────────────────────────────── */

  check("template quotes the treatment", templateReply(g, "patient").includes("Skin Boosters"));
  check(
    "template tells a client the doctor decides",
    /decided by a doctor/i.test(templateReply(g, "patient"))
  );
  check(
    "template does not lecture a practitioner",
    !/decided by a doctor/i.test(templateReply(g, "doctor"))
  );
  check(
    "template falls back to personal facts",
    templateReply({ ...g, treatments: [] }, "patient").includes("Dr Rao")
  );
  check(
    "template falls back to site facts",
    templateReply({ ...g, treatments: [], own: [] }, "patient").includes("₹99")
  );
  check("template with nothing still says something", templateReply(EMPTY_GROUNDING, "patient").length > 40);

  /* ── No invented treatments ────────────────────────────────────────── */

  const vocabulary = await prisma.hubTreatment.findMany({ select: { name: true } });
  const names = vocabulary.map((v) => v.name);
  check("the catalogue is loaded", names.length > 100, `${names.length}`);

  const real = names[0];
  check(
    `a real treatment passes ("${real}")`,
    unknownTreatments(`We offer ${real} at several clinics.`, names).length === 0
  );
  check(
    "an invented one is caught",
    unknownTreatments("We offer Diamond Glow Infusion at several clinics.", names).includes(
      "Diamond Glow Infusion"
    )
  );
  check(
    "a sentence opener is not mistaken for a product",
    unknownTreatments("Skin Boosters are popular. Many people ask about them.", names).length === 0
  );
  // Caught in a live smoke test: the category is "Glass Skin & Glow" and the
  // model wrote "Glass Skin", which is how a person refers to it. Rejecting
  // that served the template over a correct answer.
  const cats = await prisma.hubCategory.findMany({ select: { name: true } });
  const vocab = [...names, ...cats.map((c) => c.name)];
  const partial = cats.find((c) => c.name.includes(" & "))?.name.split(" & ")[0];
  if (partial) {
    check(
      `a short form of a real category passes ("${partial}")`,
      unknownTreatments(`People ask about ${partial} all the time.`, vocab).length === 0
    );
  }
  check(
    "but an added word is still caught",
    unknownTreatments("We offer Korean Glass Skin Programme here.", vocab).length > 0
  );

  check(
    "our own furniture is not flagged",
    unknownTreatments("Your BluDerma ID is on your profile page.", names).length === 0
  );

  /* ── Length is enforced, not requested ─────────────────────────────── */

  const wordy = Array.from({ length: 9 }, (_, i) => `Sentence number ${i}.`).join(" ");
  const trimmed = tidy(wordy);
  check("a long answer is trimmed", (trimmed.match(/\./g) ?? []).length <= 5);
  check("markdown is stripped", !tidy("**bold** and\n- a bullet").includes("**"));
  check("bullets are stripped", !/^\s*-\s/m.test(tidy("- one\n- two")));

  /* ── Openers ───────────────────────────────────────────────────────── */

  for (const who of ["patient", "doctor"] as const) {
    const s = starters(who);
    check(`${who}: four openers`, s.length === 4, `${s.length}`);
    // An opener the assistant would refuse is a trap.
    const refused = s.filter((q) => deflect(q) !== null);
    check(`${who}: no opener is refused`, refused.length === 0, refused.join(" | "));
  }

  /* ── The endpoint takes its identity from the session ──────────────── */

  const route = codeOnly("src/app/api/assistant/route.ts");
  check("the route reads the session", /getServerSession\(authOptions\)/.test(route));
  check(
    "the body carries no identity",
    !/userId|doctorId|audience/.test(route.split("const Body")[1]?.split("}")[0] ?? ""),
    "a body field naming a person is a body field somebody will forge"
  );
  check("the route rate limits", /rateLimit\(/.test(route));
  check(
    "the limit is per account, not per address",
    /assistant:\$\{who\}/.test(route) && /who =\s*viewer\.audience === "doctor"/.test(route),
    "an IP bucket lets one person spend everybody's allowance"
  );
  check("literal enum, never nativeEnum", !/nativeEnum/.test(route));

  const grounding = codeOnly("src/lib/assistant/grounding.ts");
  check(
    "own-record lookups are keyed on the session id",
    /patientUserId: userId/.test(grounding) && /where: \{ userId \}/.test(grounding)
  );

  const reply = codeOnly("src/lib/assistant/reply.ts");
  // Measured inside answer(): askModel's own declaration sits above it, so
  // comparing against that measures declaration order, not call order.
  const body = reply.slice(reply.indexOf("export async function answer"));
  check(
    "deflection happens before the call",
    body.indexOf("deflect(question)") < body.indexOf("askModel("),
    "a clinical question must cost nothing and never reach the API"
  );
  check("an invented name downgrades the answer", /invented\.length/.test(reply));
  check("the call has a timeout", /AbortController|signal/.test(reply));
  check("a failed call never throws", /catch \(e\)/.test(reply) && /return null/.test(reply));

  /* ── The widget ────────────────────────────────────────────────────── */

  const ui = codeOnly("src/components/assistant/Assistant.tsx");
  check("the panel hides on admin", /"\/admin"/.test(ui));
  check("the panel hides on auth pages", /"\/login"/.test(ui));
  check(
    "no interpolated Tailwind classes",
    !/className=\{`[^`]*\$\{(?!.*\?)/.test(ui),
    "an interpolated class compiles to nothing and the colour vanishes"
  );
  check("no text-ink in the panel", !/text-ink/.test(ui), "text-ink is near-white outside .theme-light");
  check("it says it is not medical advice", /medical advice/i.test(ui));
  // globals.css paints every input `ink.DEFAULT` — near WHITE — at specificity
  // (0,4,1), which beats a (0,1,0) text-slate-900 utility. On this white panel
  // that made people's own typing invisible. `.theme-light` re-maps the same
  // selector at (0,5,1) and is the fix this codebase already uses.
  check(
    "the panel carries theme-light so typing is visible",
    /theme-light/.test(ui),
    "without it the input paints near-white text on a white field"
  );
  check(
    "the input is 16px on a phone",
    /text-\[16px\]/.test(ui),
    "iOS Safari zooms the page in on focus for anything smaller"
  );
  check("the sheet locks the page behind it", /document\.body\.style\.overflow/.test(ui));
  check("a client sees a clinician, a practitioner sees a machine",
    /kind=\{isDoctor \? "bot" : "doctor"\}/.test(ui));

  const voice = codeOnly("src/components/assistant/useVoice.ts");
  check("capability is checked after mount", /useEffect\(\(\) => \{\s*setCanListen/.test(voice));
  check("an unsupported browser hides the mic", /voice\.canListen &&/.test(ui));
  check("speech stops when the panel closes", /speechSynthesis\.cancel/.test(voice));
  check("recognition is Indian English", /en-IN/.test(voice));

  /* ── It is actually mounted ────────────────────────────────────────── */

  const layout = codeOnly("src/app/layout.tsx");
  check("mounted in the root layout", /<Assistant \/>/.test(layout));
  check("mounted inside AuthProvider", layout.indexOf("<Assistant />") < layout.indexOf("</AuthProvider>"));

  /* ── Report ────────────────────────────────────────────────────────── */

  console.log(`\n${pass} passed, ${fails.length} failed`);
  if (fails.length) {
    for (const f of fails) console.log(`  FAIL  ${f}`);
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
