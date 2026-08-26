/**
 * Pre-treatment sheets, dictation, and the AI rephrase.
 *
 * The rule worth guarding hardest here is not a data one. It is that a model
 * never rewords a clinical instruction between the doctor saying it and the
 * patient reading it without a human accepting the change, with the original
 * still on screen. A rephrase that slid into the field on its own is one
 * nobody checked, and afterwards neither the patient nor the doctor can tell
 * which sentence came from whom.
 *
 * The rest is the snapshot rule the aftercare sheet already had, extended to
 * the half that did not exist: a sheet is a record of what was said on the
 * day, and revising the standard wording later must never rewrite a document
 * somebody is already following.
 */
import { readFileSync } from "node:fs";

for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
  if (m && process.env[m[1]] === undefined) {
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
}

import {
  STANDARD_AFTERCARE,
  STANDARD_PRETREATMENT,
  standardFor,
  treatmentKey,
} from "../src/lib/aftercare/standard";

let pass = 0;
const fails: string[] = [];
function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    pass++;
    console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    fails.push(name);
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}
const read = (p: string) => readFileSync(p, "utf8");
/** Comments describe intent; assertions should read the code. */
const codeOnly = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

console.log("1. The before half exists and is not a copy of the after half");

check("there is standard pre-treatment content", STANDARD_PRETREATMENT.dos.length > 5);
check(
  "it is not the aftercare content under another name",
  STANDARD_PRETREATMENT.intro !== STANDARD_AFTERCARE.intro &&
    STANDARD_PRETREATMENT.dos[0] !== STANDARD_AFTERCARE.dos[0]
);
check("standardFor picks the right one", standardFor("PRE") === STANDARD_PRETREATMENT &&
  standardFor("POST") === STANDARD_AFTERCARE);

// The four things that actually waste an appointment or cause a complication.
for (const [what, needle] of [
  ["blood thinners and NSAIDs", /aspirin|ibuprofen|blood thinner/i],
  ["a fresh tan", /tan|tanning/i],
  ["retinoids and acids", /retinol|tretinoin|AHA|BHA/i],
  ["cold sores", /cold sore/i],
  ["waxing", /wax/i],
] as const) {
  const all = [
    ...STANDARD_PRETREATMENT.dos,
    ...STANDARD_PRETREATMENT.donts,
    ...STANDARD_PRETREATMENT.warnings,
  ].join(" ");
  check(`it warns about ${what}`, needle.test(all));
}

check(
  "its warnings are reasons to postpone, not reasons to seek urgent care",
  /before you come/i.test(STANDARD_PRETREATMENT.warningsLead)
);
check(
  "the aftercare warnings still are urgent",
  /immediately/i.test(STANDARD_AFTERCARE.warningsLead)
);

console.log("\n2. One model, two documents");

const schema = read("prisma/schema.prisma");
check("the sheet knows which side it is", /kind\s+SheetKind\s+@default\(POST\)/.test(schema));
check(
  "POST is the default, so existing rows keep their meaning",
  /enum SheetKind \{[\s\S]*?PRE[\s\S]*?POST[\s\S]*?\}/.test(schema) &&
    (schema.match(/kind\s+SheetKind\s+@default\(POST\)/g) ?? []).length >= 2
);
check(
  "standing notes are kept per side",
  /@@unique\(\[doctorId, treatmentKey, kind\]\)/.test(schema)
);
check(
  "a review date and an arrival time are not the same field",
  /reviewOn\s+DateTime\?/.test(schema) && /arriveAt\s+String\?/.test(schema)
);

const action = codeOnly("src/lib/actions/aftercare.ts");
check("the content is chosen by kind", /standardFor\(d\.kind\)/.test(action));
check(
  "and snapshotted rather than referenced",
  /intro: standard\.intro/.test(action) && /dos: standard\.dos/.test(action)
);
check(
  "a review date is dropped on a PRE sheet and vice versa",
  /reviewOn: isPre \? null : reviewOn/.test(action) &&
    /arriveAt: isPre \? d\.arriveAt \|\| null : null/.test(action)
);
check(
  "a PRE sheet dated in the past is refused rather than silently issued",
  /already passed/.test(read("src/lib/actions/aftercare.ts"))
);

console.log("\n3. The patient is actually told");

const notify = codeOnly("src/lib/doctor/notify.ts");
check("issuing sends an email", /export async function notifySheetIssued/.test(notify));
check("the action calls it", /notifySheetIssued\(\{/.test(action));
check(
  "the email carries a link, not the instructions",
  /patient\/aftercare\/\$\{p\.sheetId\}/.test(notify) &&
    // Nothing from the standard lists is interpolated into the mail body.
    !/dos|donts|warnings|doctorNotes/.test(notify.split("notifySheetIssued")[1] ?? "")
);
check(
  "a mail failure does not roll back the sheet",
  /catch\(\(e\) => console\.error\("sheet email failed"/.test(notify)
);
check(
  "the before email says to read it now rather than the night before",
  /rather than the night before/.test(read("src/lib/doctor/notify.ts"))
);

console.log("\n4. Dictation");

const dictate = codeOnly("src/app/api/doctor/dictate/route.ts");
check("only a signed-in practitioner may dictate", /getOwnDoctor\(\)/.test(dictate));
check("it is rate limited", /rateLimit\(`dictate:/.test(dictate));
check("a stuck recorder cannot upload without limit", /MAX_BYTES/.test(dictate));
check(
  "no audio is stored",
  !/uploadObject|s3|S3|mediaAsset|prisma/.test(dictate),
  "nothing in the route reaches storage or the database"
);
check(
  "no transcript is stored either",
  !/create\(|update\(/.test(dictate)
);
check(
  "it transcribes and does not interpret",
  /transcriptions/.test(dictate) && !/summari|rewrite|improve/i.test(dictate)
);

const field = codeOnly("src/components/doctor/fields/ClinicalNoteField.tsx");
check(
  "the microphone is released when the field goes away",
  /getTracks\(\)\.forEach\(\(t\) => t\.stop\(\)\)/.test(field)
);
check(
  "a recording nobody ended is stopped for them",
  /MAX_SECONDS/.test(field)
);
check(
  "the transcript goes straight in — it is the doctor's own words",
  /append\(data\.text as string\)/.test(field)
);

console.log("\n5. The rephrase is a confirmation, never a replacement");

check(
  "the suggestion is held for review, not written into the field",
  /setPhase\(\{\s*kind: "review"/.test(field) &&
    !/put\(data\.text\)/.test(field)
);
check(
  "the original stays on screen beside it",
  /What you said/.test(read("src/components/doctor/fields/ClinicalNoteField.tsx")) &&
    /For the patient/.test(read("src/components/doctor/fields/ClinicalNoteField.tsx"))
);
check(
  "keeping your own version is one press",
  /Keep mine/.test(read("src/components/doctor/fields/ClinicalNoteField.tsx"))
);
check(
  "and accepting it lands in an editable field, not in a submit",
  /ref\.current\.value = phase\.suggestion/.test(field)
);

const assist = read("src/lib/integrations/aiAssist.ts");
check(
  "the brief forbids adding anything",
  /Do NOT add any instruction/.test(assist)
);
check(
  "it forbids softening a duration",
  /must not become "avoid it for about a week"/.test(assist)
);
check(
  "numbers and doses are pinned",
  /Keep every number, dose, strength, duration and product name exactly as given/.test(assist)
);
check(
  "there is no fake fallback when the model is unavailable",
  /ai_unavailable/.test(read("src/app/api/doctor/assist/route.ts"))
);

console.log("\n6. Issuing asks first");

const form = codeOnly("src/components/doctor/AftercareForm.tsx");
check("submitting opens a confirmation", /setConfirming\(\{/.test(form));
check(
  "the action runs from the modal, not from the submit",
  /<ConfirmModal/.test(form) && /issueAftercareSheet\(\{/.test(form)
);
check(
  "the confirmation names the patient",
  /confirming\.patientName/.test(form)
);
check(
  "and restates what they will be told",
  /ConfirmRow label="Your notes"/.test(form)
);
const modal = codeOnly("src/components/doctor/ConfirmModal.tsx");
check("escape closes it", /e\.key === "Escape"/.test(modal));
check("the backdrop closes it", /onClick=\{\(\) => !busy && onCancel\(\)\}/.test(modal));
check(
  "the confirm button is not autofocused",
  !/autoFocus/.test(modal),
  "Enter is the most-pressed key on a form"
);
check("focus returns to whatever opened it", /returnTo\.current\?\.focus/.test(modal));

console.log("\n7. Naming");

check(
  "the rail says both halves",
  /Pre & post care/.test(read("src/app/doctor/portal/layout.tsx"))
);
check(
  "so does the patient's profile",
  /Before and after your treatment/.test(read("src/app/patient/profile/page.tsx"))
);
check(
  "and each sheet says which it is",
  /a\.kind === "PRE" \? "Before" : "After"/.test(read("src/app/patient/profile/page.tsx"))
);
check("treatmentKey still folds the same treatment together",
  treatmentKey("CO2 Laser") === treatmentKey("co2 laser "));

console.log(`\n${pass} passed, ${fails.length} failed`);
if (fails.length) {
  fails.forEach((f) => console.log(`  FAIL  ${f}`));
  process.exit(1);
}
console.log("All checks pass.");
