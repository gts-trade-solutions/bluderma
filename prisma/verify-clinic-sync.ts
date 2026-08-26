/**
 * Cross-doctor clinic sync, and the rest of onboarding v2.
 *
 * The thing being protected here is a rule with real consequences: a
 * practitioner may join an existing clinic, and once two of them share one,
 * NEITHER may edit the premises' shared details from inside their own form.
 * Get that wrong and a stranger can rename your clinic, move its map pin and
 * replace its photographs, with no notification and no audit trail.
 *
 * The matcher is pure, so most of this is arithmetic rather than a database
 * round trip. The database half checks the schema actually carries what the
 * form now collects.
 */
import { readFileSync } from "node:fs";

for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
  if (m && process.env[m[1]] === undefined) {
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
}

import {
  MATCH_THRESHOLD,
  normaliseAddress,
  normaliseClinicName,
  rankClinics,
  type ClinicCandidate,
} from "../src/lib/clinicMatch";
import { ALL_FACILITIES, categoryOf, FACILITY_GROUPS } from "../src/data/facilities";
import { LANGUAGES, searchLanguages } from "../src/data/languages";
import { REGISTRATION_YEARS } from "../src/data/doctorJoin";

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

const at = (
  id: string,
  name: string,
  addressLine1: string,
  pincode = "600040"
): ClinicCandidate => ({
  id,
  name,
  addressLine1,
  area: "Anna Nagar",
  city: "Chennai",
  pincode,
});

console.log("1. The name normaliser");

check(
  "word order does not matter",
  normaliseClinicName("Menon Skin Clinic") ===
    normaliseClinicName("Skin Clinic Menon")
);
check(
  "punctuation and possessives are dropped",
  normaliseClinicName("Dr. Menon's Skin & Hair Clinic (Anna Nagar)") ===
    normaliseClinicName("Menon Skin Hair Clinic, Anna Nagar")
);
check(
  "generic words carry no signal",
  normaliseClinicName("Menon Dermatology Centre") ===
    normaliseClinicName("Menon Clinic")
);
check(
  "an all-generic name still compares to itself",
  normaliseClinicName("The Skin Clinic") === normaliseClinicName("The Skin Clinic") &&
    normaliseClinicName("The Skin Clinic").length > 0
);
check(
  "two different practices do NOT collapse together",
  normaliseClinicName("Menon Skin Clinic") !==
    normaliseClinicName("Raghavan Skin Clinic")
);
check(
  "door numbers are dropped from an address",
  normaliseAddress("No. 12, 2nd Main Road") === normaliseAddress("12 2 Main Road")
);

console.log("\n2. Ranking");

const candidates = [
  at("a", "Menon Skin Clinic", "12 2nd Main Road"),
  at("b", "Raghavan Dental Care", "88 Poonamallee High Road"),
  at("c", "Menon Skin & Hair Clinic", "12 Second Main Rd"),
];

const ranked = rankClinics(
  { name: "Dr. Menon's Skin Clinic", addressLine1: "No. 12, 2nd Main Road" },
  candidates
);

check("the same clinic is found", ranked.length > 0, `${ranked.length} candidate(s)`);
check(
  "an unrelated practice in the same PIN code is not offered",
  !ranked.some((r) => r.id === "b")
);
check(
  "the closest match ranks first",
  ranked[0]?.id === "a" || ranked[0]?.id === "c",
  ranked[0]?.name
);
check(
  "every offered candidate clears the threshold",
  ranked.every((r) => r.score >= MATCH_THRESHOLD)
);
check(
  "each one says why it matched",
  ranked.every((r) => r.reason.length > 0),
  ranked[0]?.reason
);
check(
  "a genuinely different name is never offered",
  rankClinics(
    { name: "Coastal Aesthetics", addressLine1: "5 Beach Road" },
    candidates
  ).length === 0
);
check(
  "a shared address alone cannot carry a poor name match",
  // Two practices on the same floor of one building is a real thing.
  rankClinics(
    { name: "Vasanth Trichology", addressLine1: "12 2nd Main Road" },
    [at("a", "Menon Skin Clinic", "12 2nd Main Road")]
  ).length === 0
);
check("never more than five suggestions", ranked.length <= 5);

console.log("\n3. The rule that stops a stranger editing your clinic");

const action = read("src/lib/actions/doctorOnboarding.ts");
check(
  "joining takes its own branch and writes no clinic row",
  /if \(d\.joinClinicId\)/.test(action)
);
check(
  "the shared fields are gated on being the only occupant",
  /const occupants = await tx\.doctorClinic\.count/.test(action) &&
    /mayEditShared = occupants <= 1/.test(action)
);
check(
  "photographs and facilities are behind the same gate",
  /if \(mayEditShared\) \{[\s\S]*?clinicPhoto\.deleteMany/.test(action)
);
check(
  "a doctor cannot join a clinic twice",
  /You already practise at that location/.test(action)
);
check(
  "the fee is still theirs alone on a joined clinic",
  /clinicId: target\.id,\s*\n\s*feeInr: d\.feeInr/.test(action)
);

const step = read("src/components/doctor/join/ClinicsStep.tsx");
check(
  "the form also refuses to offer the shared fields",
  /const shared = \(c\?\._count\.doctors \?\? 0\) > 1/.test(step)
);
check("nothing is ever merged without a person pressing a button", /This is mine/.test(step));

console.log("\n4. Coordinates");

check(
  "an empty coordinate does not become zero",
  /optionalCoord/.test(action) && /Gulf of Guinea/.test(action)
);
check(
  "the pin is optional and the map is deferred",
  /Pin it on the map/.test(read("src/components/doctor/fields/LocationPicker.tsx"))
);

console.log("\n5. Facilities");

check("the equipment group exists", FACILITY_GROUPS.some((g) => g.category === "EQUIPMENT"));
check(
  "equipment is the biggest group, because it is the one nobody types",
  (FACILITY_GROUPS.find((g) => g.category === "EQUIPMENT")?.items.length ?? 0) >= 20
);
check("no facility is listed twice", new Set(ALL_FACILITIES).size === ALL_FACILITIES.length);
check("a curated facility knows its group", categoryOf("Fractional CO2 laser") === "EQUIPMENT");
check("a doctor's own wording has no group", categoryOf("Rooftop recovery lounge") === null);
check(
  "the category is persisted, so the clinic page can group them",
  /category: categoryOf\(name\)/.test(action)
);

console.log("\n6. Languages");

check("every scheduled Indian language is offered", [
  "Hindi", "Bengali", "Marathi", "Telugu", "Tamil", "Gujarati", "Urdu",
  "Kannada", "Odia", "Malayalam", "Punjabi", "Assamese", "Maithili",
  "Santali", "Kashmiri", "Nepali", "Konkani", "Sindhi", "Dogri",
  "Manipuri", "Bodo", "Sanskrit",
].every((n) => LANGUAGES.some((l) => l.name === n)));
check("no language is listed twice", new Set(LANGUAGES.map((l) => l.name)).size === LANGUAGES.length);
check(
  "searching the endonym finds it",
  searchLanguages("தமிழ்").some((l) => l.name === "Tamil")
);
check(
  "a prefix beats a substring",
  searchLanguages("ta")[0]?.name === "Tamil",
  searchLanguages("ta")[0]?.name
);

console.log("\n7. The registration year");

check("newest first", REGISTRATION_YEARS[0] === new Date().getUTCFullYear());
check("cannot be in the future", REGISTRATION_YEARS.every((y) => y <= new Date().getUTCFullYear()));
check("reaches far enough back", REGISTRATION_YEARS[REGISTRATION_YEARS.length - 1] === 1945);
check(
  "it is a dropdown, not a spinner",
  /SelectField[\s\S]{0,200}name="regYear"/.test(
    read("src/components/doctor/join/CredentialsStep.tsx")
  )
);

console.log("\n8. The last question");

check(
  "unanswered is storable and distinct from no",
  /listedElsewhere\s+Boolean\?/.test(read("prisma/schema.prisma"))
);
check(
  "the form never says the word optional",
  !/optional/i.test(read("src/components/doctor/join/ListedElsewhere.tsx").replace(/\/\*\*[\s\S]*?\*\//g, ""))
);
check(
  "the admin queue can tell 'no' from 'not answered'",
  /Not answered/.test(read("src/app/admin/doctor-applications/page.tsx"))
);

console.log("\n9. The demo dashboard");

const dash = read("src/components/doctor/dashboard/DashboardHome.tsx");
check("the tour renders the REAL dashboard", /demo\?: DemoBundle/.test(dash));
check("a demo run makes no database query", /const \[m, gaps\] = demo/.test(dash));
check(
  "demo figures never reach the insight cache",
  /\{!demo && \(\s*<Suspense/.test(dash)
);
check(
  "the disclosure cannot be scrolled away",
  /sticky top-0[\s\S]{0,400}Demo data/.test(read("src/app/doctor/portal/demo/page.tsx"))
);
check(
  "the waiting screen still shows em dashes rather than invented numbers",
  /value="—"/.test(read("src/components/doctor/onboarding/PendingPreview.tsx"))
);

console.log(`\n${pass} passed, ${fails.length} failed`);
if (fails.length) {
  fails.forEach((f) => console.log(`  FAIL  ${f}`));
  process.exit(1);
}
console.log("All checks pass.");
