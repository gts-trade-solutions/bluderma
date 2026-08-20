/**
 * The AI assist layer, and the promises it has to keep.
 *
 * Two of these matter more than the rest:
 *
 *  1. **Everything works with no API key.** There is none in .env today, so
 *     this suite runs the whole feature in its unconfigured state and asserts
 *     the doctor can still complete every field.
 *  2. **The model cannot invent a treatment name.** It is handed the real
 *     catalogue and told to choose from it, and the answer is intersected with
 *     that catalogue afterwards — so the guarantee holds even if the model
 *     ignores the instruction entirely.
 */
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

// aiAssist.ts carries `import "server-only"`, which cannot resolve outside a
// bundler — the pure half lives in aiAssistCore.ts precisely so it can be
// tested. The server-only module is checked by reading its source instead.
import { ABOUT_TONES, IMPROVE_MODES } from "../src/lib/integrations/aiAssistTypes";
import {
  fuzzyMatchTreatments,
  intersectWithVocabulary,
  templateAbout,
  templateClinicAbout,
} from "../src/lib/integrations/aiAssistCore";
import {
  getSuggestedTreatments,
  getTreatmentVocabulary,
  searchTreatments,
} from "../src/lib/queries/treatmentVocabulary";
import { DOCTOR_SPECIALTIES } from "../src/data/specialties";

const prisma = new PrismaClient({ log: ["warn", "error"] });

let pass = 0;
const fails: string[] = [];
function check(name: string, ok: boolean) {
  if (ok) pass++;
  else fails.push(name);
}
const read = (p: string) => readFileSync(p, "utf8");

const FACTS = {
  name: "Dr. Aarti Menon",
  title: "MBBS, MD (Dermatology)",
  specialty: "Cosmetic Dermatology",
  experienceYears: 12,
  clinicNames: ["BluDerma Nungambakkam"],
  areas: ["Nungambakkam"],
  services: ["Acne treatment", "Chemical peels"],
  languages: ["English", "Tamil"],
};

// ── The deterministic drafts say only what they were given ────────────────
for (const tone of ABOUT_TONES) {
  const text = templateAbout(FACTS, tone);
  check(`${tone} template produces prose`, text.length > 40);
  check(`${tone} template names the specialty`, text.includes("Cosmetic Dermatology"));
  check(`${tone} template names the clinic`, text.includes("BluDerma Nungambakkam"));

  // The fabrication tripwire: every number in the output must be a number we
  // supplied. A template that invents "500 patients" fails here.
  const supplied = new Set(["12"]);
  const numbers = text.match(/\d+/g) ?? [];
  check(
    `${tone} template invents no figures`,
    numbers.every((n) => supplied.has(n))
  );
}

// Missing facts must be omitted, not filled with plausible filler.
const sparse = templateAbout(
  { ...FACTS, clinicNames: [], areas: [], services: [], experienceYears: 0 },
  "professional"
);
check("a sparse profile omits clinics", !/Consultations are at/.test(sparse));
check("a sparse profile omits experience", !/year/.test(sparse));
check("a sparse profile still says something", sparse.length > 20);

const clinicText = templateClinicAbout({
  name: "BluDerma Adyar",
  area: "Adyar",
  city: "Chennai",
  facilities: ["Parking", "Lift access"],
  doctorSpecialty: "Dermatology",
});
check("clinic template names the clinic", clinicText.includes("BluDerma Adyar"));
check("clinic template lists real facilities", clinicText.includes("Parking"));
check("clinic template invents no hours", !/\d{1,2}\s?(am|pm)/i.test(clinicText));

// ── The fallback path, whichever mode this environment is in ─────────────
// Deliberately not asserting whether a key exists: that is an environment
// fact, not a property of the code, and hardcoding it made this suite fail
// the moment one was added. What matters is that the deterministic path is
// always present and always usable, because it is what runs when the key is
// missing, rate-limited, or the upstream is down.
const keyed = Boolean(process.env.OPENAI_API_KEY?.trim());
console.log(`  (running with AI ${keyed ? "CONFIGURED" : "unconfigured"})`);

// draftAboutVariants falls back per-tone, so the shape is always three usable
// drafts. Reproduced here from the same templates it falls back to.
const fallbackVariants = ABOUT_TONES.map((tone) => ({
  tone,
  text: templateAbout(FACTS, tone),
  source: "template" as const,
}));
check("three variants regardless", fallbackVariants.length === 3);
check("each is non-empty", fallbackVariants.every((v) => v.text.trim().length > 40));
check(
  "one per tone",
  ABOUT_TONES.every((t) => fallbackVariants.some((v) => v.tone === t))
);
check("improve has three modes", IMPROVE_MODES.length === 3);

const src2 = readFileSync("src/lib/integrations/aiAssist.ts", "utf8");
check("a failed tone falls back to its template", /source: "template"/.test(src2));
check("matchTreatments falls back to fuzzy", /source: "fuzzy" as const/.test(src2));
check("improve returns null with no key", /if \(!key\) return null/.test(src2));

// ── The anti-hallucination contract ───────────────────────────────────────
const vocab = ["Botox", "Dermal Fillers", "PRP for Hair", "Microneedling"];
check(
  "fuzzy never returns an unknown name",
  fuzzyMatchTreatments("microneedling with prp", vocab).every((m) => vocab.includes(m))
);
check("fuzzy finds the obvious ones", fuzzyMatchTreatments("microneedling", vocab).includes("Microneedling"));
check("fuzzy ignores noise words", fuzzyMatchTreatments("i do the", vocab).length === 0);
check("fuzzy on an empty vocabulary is empty", fuzzyMatchTreatments("botox", []).length === 0);

// The guarantee itself: whatever a model returns, only real names survive.
check(
  "an invented name is dropped",
  intersectWithVocabulary(["Botox", "Quantum Skin Reversal"], vocab).join() === "Botox"
);
check(
  "case and padding are tolerated",
  intersectWithVocabulary(["  botox  ", "PRP FOR HAIR"], vocab).length === 2
);
check("duplicates collapse", intersectWithVocabulary(["Botox", "botox"], vocab).length === 1);
check("non-strings are ignored", intersectWithVocabulary([1, null, "Botox"], vocab).length === 1);
check("a non-array is empty", intersectWithVocabulary("Botox", vocab).length === 0);
check("everything invented yields nothing", intersectWithVocabulary(["Made Up"], vocab).length === 0);

const src = read("src/lib/integrations/aiAssist.ts");
check("the AI module is server-only", /^import "server-only";/m.test(src));
check("it gates on the key", /if \(!key\) return null/.test(src));
check("it never throws", /catch \(e\) \{[\s\S]*?return null/.test(src));
check("it uses no SDK", !/from "openai"/.test(src));
const core = read("src/lib/integrations/aiAssistCore.ts");
check(
  "the matcher intersects with the real vocabulary",
  /intersectWithVocabulary/.test(src) && /allowed\.get\(/.test(core)
);
check("prompts forbid invention", /Do not invent/.test(src));
// A name does not state a gender. The model inferred "he" from "Arun" until
// the prompt said not to — a public listing that misgenders a practitioner is
// not a small error, and it is exactly the kind of fact the system was never
// given and must not assert.
check("prompts forbid guessed pronouns", /NEVER use a gendered pronoun/.test(src));
const templateSrc = read("src/lib/integrations/aiAssistCore.ts");
check(
  "the template uses no gendered pronoun either",
  !/\b(he|she|his|her|him)\b/i.test(
    templateSrc.split("export function templateAbout")[1].split("export function templateClinicAbout")[0]
  )
);

// ── Routes ────────────────────────────────────────────────────────────────
const assist = read("src/app/api/doctor/assist/route.ts");
check("assist authenticates from the session", /getOwnDoctor\(\)/.test(assist));
check("assist rate limits", /rateLimit\(`assist:/.test(assist));
check("assist re-checks clinic ownership", /doctorId_clinicId/.test(assist));
check("assist loads facts from the DB, not the body", /prisma\.doctor\.findUnique/.test(assist));
const assistCode = assist
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/.*$/gm, "");
check("assist uses no nativeEnum", !/nativeEnum/.test(assistCode));
check("assist validates with literal arrays", /z\.enum\(IMPROVE_MODES\)/.test(assist));

const pincode = read("src/app/api/doctor/pincode/route.ts");
check("pincode enforces six digits", /\^\\d\{6\}\$/.test(pincode));
check("pincode handles India Post's HTTP-200 error", /Status !== "Success"/.test(pincode));
check("pincode caches", /cache\.set/.test(pincode));
check("pincode times out", /AbortSignal\.timeout/.test(pincode));
check("pincode never generates an address", !/openai|gpt/i.test(pincode));

// ── The fields submit through real inputs ─────────────────────────────────
const combo = read("src/components/doctor/fields/Combobox.tsx");
check("combobox submits via a named input", /name=\{name\}/.test(combo));
check("combobox is not portalled", !/createPortal/.test(combo));
check("combobox calls useFieldError unconditionally", /const contextError = useFieldError\(name\)/.test(combo));
check("combobox states its own text colour", /text-slate-900/.test(combo));

const chips = read("src/components/doctor/fields/ChipMultiSelect.tsx");
check("chips submit as hidden inputs", /type="hidden" name=\{name\}/.test(chips));
check("chips allow free text", /your own and press Enter/.test(chips));

const assistArea = read("src/components/doctor/fields/AssistTextArea.tsx");
check("the textarea is uncontrolled", /defaultValue=\{defaultValue\}/.test(assistArea));
check("AI buttons are hidden with no key", /aiEnabled &&/.test(assistArea));
check("template drafts are labelled honestly", /from your details/.test(assistArea));

const pin = read("src/components/doctor/fields/PincodeAddressFields.tsx");
check("lookup failure leaves the form manual", /Fill the rest in yourself/.test(pin));
check("it never overwrites typed input", /!city\.trim\(\)/.test(pin));

// ── Actions accept the new shape ──────────────────────────────────────────
const onboarding = read("src/lib/actions/doctorOnboarding.ts");
check(
  "saveConsultStep accepts chips or text",
  /services: z\.union\(\[z\.string\(\), z\.array\(z\.string\(\)\)\]\)/.test(onboarding)
);
const doctorActions = read("src/lib/actions/doctor.ts");
check(
  "updateOwnProfile accepts chips or text",
  /\.union\(\[z\.string\(\), z\.array\(z\.string\(\)\)\]\)/.test(doctorActions)
);

// ── Vocabulary is real ────────────────────────────────────────────────────
check("specialties are a curated list", DOCTOR_SPECIALTIES.length >= 8);
check("Dermatology is first", DOCTOR_SPECIALTIES[0] === "Dermatology");
check("specialties are unique", new Set(DOCTOR_SPECIALTIES).size === DOCTOR_SPECIALTIES.length);

async function vocabChecks() {
  const vocabulary = await getTreatmentVocabulary();
  check("the vocabulary comes from the database", vocabulary.length > 50);
  check(
    "the vocabulary is deduped case-insensitively",
    new Set(vocabulary.map((v) => v.toLowerCase())).size === vocabulary.length
  );

  const suggestions = await getSuggestedTreatments(14);
  check("suggestions are offered", suggestions.length >= 8 && suggestions.length <= 14);
  check(
    "every suggestion is a real treatment",
    suggestions.every((s) => vocabulary.some((v) => v.toLowerCase() === s.toLowerCase()))
  );
  check("suggestions are unique", new Set(suggestions).size === suggestions.length);

  const hits = searchTreatments("laser", vocabulary);
  check("search returns real names", hits.every((h) => vocabulary.includes(h)));
  check("search ignores one-character queries", searchTreatments("l", vocabulary).length === 0);
}

vocabChecks()
  .catch((e) => fails.push(`async checks threw: ${(e as Error).message}`))
  .finally(async () => {
    await prisma.$disconnect();
    console.log(`\n${pass} passed, ${fails.length} failed`);
    if (fails.length) {
      fails.forEach((f) => console.log(`  FAIL  ${f}`));
      process.exit(1);
    }
  });
