/**
 * AI treatment suggestions, and the boundary around them.
 *
 * The model reads issue scores the SERVER computed and proposes treatment
 * names. Two things must hold no matter what it returns:
 *
 *   1. A name the catalogue does not contain cannot reach the database. The
 *      prompt asks for that; the intersection GUARANTEES it, which is the
 *      difference between a rule and a hope.
 *   2. Nothing it produces is ever ACCEPTED. A machine recommendation reaching
 *      a patient with no clinician in between is the failure this feature has
 *      to be incapable of.
 *
 * Everything below runs with no API key, because that is the state this
 * deployment is actually in, and the template path has to be correct on its
 * own rather than as a degraded mode nobody tests.
 *
 *   npx tsx prisma/verify-treatment-plans.ts
 */
import { readFileSync } from "node:fs";

import { PrismaClient } from "@prisma/client";

import {
  CONCERN_THRESHOLD,
  buildPrompt,
  humanIssue,
  intersectWithCatalogue,
  parseSuggestions,
  rankedConcerns,
  templateSuggestions,
} from "../src/lib/integrations/treatmentPlanCore";

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

const VOCAB = ["Botox", "CO2 Laser Resurfacing", "Chemical Peel", "Hydrafacial"];

async function main() {
  /* ── Nothing off-catalogue survives ────────────────────────────────── */

  check(
    "an invented treatment is discarded",
    intersectWithCatalogue(["Botox", "Miracle Glow Therapy"], VOCAB).join() === "Botox",
    "the prompt asks; this is what guarantees"
  );
  check(
    "the catalogue's spelling wins",
    intersectWithCatalogue(["botox"], VOCAB)[0] === "Botox",
    "otherwise 'botox' becomes a second treatment distinct from 'Botox'"
  );
  check("duplicates collapse", intersectWithCatalogue(["Botox", "BOTOX"], VOCAB).length === 1);
  check("non-strings are ignored", intersectWithCatalogue([1, null, "Botox"], VOCAB).length === 1);
  check("a non-array is ignored", intersectWithCatalogue({ treatment: "Botox" }, VOCAB).length === 0);

  // The same guarantee, through the parser the model's reply actually goes to.
  const reply = `Here you go:
[{"treatment":"Botox","rationale":"for lines"},
 {"treatment":"Unicorn Serum Infusion","rationale":"invented"},
 {"treatment":"Chemical Peel","rationale":"for texture"}]`;
  const parsed = parseSuggestions(reply, VOCAB);
  check("the parser survives prose around the JSON", parsed.length === 2, `${parsed.length}`);
  check(
    "and drops the invented line",
    !parsed.some((p) => p.treatment.includes("Unicorn")),
    parsed.map((p) => p.treatment).join(", ")
  );
  check("malformed JSON yields nothing", parseSuggestions("not json at all", VOCAB).length === 0);
  check("an empty array yields nothing", parseSuggestions("[]", VOCAB).length === 0);
  check(
    "at most five reach the doctor",
    parseSuggestions(
      JSON.stringify(Array.from({ length: 9 }, () => ({ treatment: "Botox", rationale: "x" }))),
      VOCAB
    ).length <= 5
  );

  /* ── Only concerns worth acting on ─────────────────────────────────── */

  const issues = [
    { issueType: "acne", score: 82, severityBand: "high" },
    { issueType: "dark_circles", score: 61, severityBand: "moderate" },
    { issueType: "hydration", score: 12, severityBand: "low" },
  ];
  const ranked = rankedConcerns(issues);
  check("mild findings are left out", ranked.length === 2, `${ranked.length}`);
  check("and the worst comes first", ranked[0].issueType === "acne");
  check("the threshold is stated, not scattered", CONCERN_THRESHOLD === 45);
  check("issue names are made readable", humanIssue("dark_circles") === "dark circles");
  check("and camelCase too", humanIssue("darkCircles") === "dark circles");

  /* ── The template path stands on its own ───────────────────────────── */

  const t = templateSuggestions(
    [{ issueType: "acne", score: 82, severityBand: "high" }],
    ["Acne Scar Resurfacing", "Botox"]
  );
  check("the template matches on a real word", t[0]?.treatment === "Acne Scar Resurfacing");
  check(
    "and quotes the measured score verbatim",
    t[0]?.rationale.includes("82"),
    t[0]?.rationale
  );
  check(
    "it proposes nothing rather than guessing",
    templateSuggestions(
      [{ issueType: "pigmentation", score: 90, severityBand: "high" }],
      ["Botox"]
    ).length === 0,
    "a wrong suggestion costs more than a missing one"
  );

  /* ── The prompt forbids what it must ───────────────────────────────── */

  const prompt = buildPrompt(issues.slice(0, 1), VOCAB);
  for (const [what, needle] of [
    ["it forbids inventing", "Do not invent"],
    ["it forbids diagnosing", "Do not state a diagnosis"],
    ["it forbids new figures", "Do not quote a figure"],
    ["it allows an empty answer", "return []"],
  ] as const) {
    check(what, prompt.includes(needle), needle);
  }
  check("the vocabulary is given in full", VOCAB.every((v) => prompt.includes(v)));

  /* ── The clinician stays in the loop ───────────────────────────────── */

  const action = codeOnly("src/lib/actions/treatmentPlan.ts");
  check(
    "AI lines are created SUGGESTED",
    /source: PlanItemSource\.AI,[\s\S]{0,120}state: PlanItemState\.SUGGESTED/.test(action),
    "an accepted-by-default machine suggestion is the whole risk"
  );
  check(
    "sharing requires something accepted",
    /Accept at least one treatment before sharing/.test(action)
  );
  check(
    "a scan id from the caller is checked against the patient",
    /skinScan\.findFirst[\s\S]{0,120}userId: patientUserId/.test(action)
  );
  check(
    "item state changes reach through the plan's owner",
    /plan: \{ doctorId: owner\.doctorId \}/.test(action),
    "an item id alone says nothing about whose patient it is"
  );

  /* ── Live: the real catalogue is big enough to matter ──────────────── */

  const vocabCount = await prisma.hubTreatment.count();
  check("the real catalogue has treatments to draw on", vocabCount > 50, `${vocabCount}`);
}

main()
  .catch((e) => fails.push(`threw: ${e.message ?? e}`))
  .finally(async () => {
    await prisma.$disconnect();
    console.log(`\n${pass} passed, ${fails.length} failed`);
    if (fails.length) {
      fails.forEach((f) => console.log(`  FAIL  ${f}`));
      process.exit(1);
    }
  });
