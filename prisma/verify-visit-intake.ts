/**
 * The booking intake, the doctor's view of it, and social profile links.
 *
 * Covers the reported gap: a doctor opened their day and saw a name and a
 * time, because the only thing the booking form asked was an optional free
 * text note that patients almost never filled in. "The appointment was
 * scheduled" was the whole of what they knew.
 */
import { readFileSync } from "node:fs";
import { VisitReason, SymptomDuration } from "@prisma/client";

import { bookingSchema } from "../src/lib/validation";
import {
  SEVERITIES,
  SYMPTOM_DURATION_VALUES,
  VISIT_REASON_VALUES,
  SYMPTOM_DURATIONS,
  VISIT_REASONS,
  durationLabel,
  intakeEmailBlock,
  intakeSummary,
  isUrgent,
  reasonLabel,
  severityLabel,
} from "../src/lib/booking/visitIntake";
import {
  displayHandle,
  normaliseSocial,
  normaliseSocials,
  socialLinks,
} from "../src/lib/social";

let pass = 0;
const fails: string[] = [];
function check(name: string, ok: boolean) {
  if (ok) pass++;
  else fails.push(name);
}
const read = (p: string) => readFileSync(p, "utf8");

const VALID = {
  doctorSlug: "aarti-menon",
  daySeed: "2026-09-01",
  time: "10:30",
  mode: "clinic" as const,
  patientName: "Test Patient",
  reason: VisitReason.ACNE,
  reasonDetail: "Breakouts along my jaw for three months.",
  symptomDuration: SymptomDuration.MONTHS_1_6,
  severity: 3,
};

// ── The form cannot be skipped ─────────────────────────────────────────────
check("a complete intake passes", bookingSchema.safeParse(VALID).success);

for (const missing of [
  "reason",
  "reasonDetail",
  "symptomDuration",
  "severity",
] as const) {
  const input: Record<string, unknown> = { ...VALID };
  delete input[missing];
  check(`${missing} is required`, !bookingSchema.safeParse(input).success);
}

check(
  "a one-word description is refused",
  !bookingSchema.safeParse({ ...VALID, reasonDetail: "acne" }).success
);
check(
  "an invented reason is refused",
  !bookingSchema.safeParse({ ...VALID, reason: "TELEPORTATION" }).success
);
check(
  "severity outside 1-5 is refused",
  !bookingSchema.safeParse({ ...VALID, severity: 9 }).success
);

// Photo consent must never default to true — it is a medico-legal record.
const parsed = bookingSchema.parse(VALID);
check("photo consent defaults to false", parsed.photoConsent === false);
check("first visit defaults to true", parsed.isFirstVisit === true);
check(
  "consent is recorded when given",
  bookingSchema.parse({ ...VALID, photoConsent: true }).photoConsent === true
);

// ── The vocabulary is complete ─────────────────────────────────────────────
check(
  "every VisitReason has a label",
  Object.values(VisitReason).every((v) => VISIT_REASONS.some((r) => r.value === v))
);
check(
  "every SymptomDuration has a label",
  Object.values(SymptomDuration).every((v) =>
    SYMPTOM_DURATIONS.some((d) => d.value === v)
  )
);
check("severity runs 1 to 5", SEVERITIES.length === 5);
check("reasonLabel resolves", reasonLabel(VisitReason.HAIR_LOSS) === "Hair loss or thinning");
check("durationLabel resolves", durationLabel(SymptomDuration.OVER_YEAR) === "More than a year");
check("severityLabel reads as a scale", severityLabel(4) === "4/5 · Marked");
check("nulls stay null", reasonLabel(null) === null && durationLabel(null) === null);

// ── Triage ─────────────────────────────────────────────────────────────────
check("severity 4 is urgent", isUrgent(4));
check("severity 5 is urgent", isUrgent(5));
check("severity 3 is not urgent", !isUrgent(3));
check("no severity is not urgent", !isUrgent(null));

const summary = intakeSummary({
  reason: VisitReason.ACNE,
  symptomDuration: SymptomDuration.MONTHS_1_6,
  severity: 3,
  isFirstVisit: true,
});
check("summary names the concern", summary.includes("Acne"));
check("summary says how long", summary.includes("1 to 6 months"));
check("summary marks a first visit", summary.includes("First visit"));
check(
  "an empty intake says so rather than pretending",
  intakeSummary({
    reason: null,
    symptomDuration: null,
    severity: null,
    isFirstVisit: true,
  }).includes("No reason given") === false ||
    intakeSummary({
      reason: null,
      symptomDuration: null,
      severity: null,
      isFirstVisit: true,
    }).includes("First visit")
);

// ── The schema must not depend on the generated enum OBJECT ────────────────
// A dev server started before the last `prisma generate` holds a stale client
// where VisitReason is undefined. z.nativeEnum(undefined) then threw "Cannot
// convert undefined or null to object" while rendering an unrelated page.
const validationSrc = read("src/lib/validation.ts");
check("no nativeEnum on a generated enum", !/nativeEnum/.test(validationSrc));
check(
  "validation imports the literal values instead",
  /VISIT_REASON_VALUES/.test(validationSrc)
);
const intakeSrc = read("src/lib/booking/visitIntake.ts");
check(
  "the vocabulary imports prisma types only",
  /^import type \{ VisitReason, SymptomDuration \}/m.test(intakeSrc)
);
check(
  "the literal values match the real enum",
  VISIT_REASON_VALUES.length === Object.values(VisitReason).length &&
    VISIT_REASON_VALUES.every((v) => Object.values(VisitReason).includes(v))
);
check(
  "the duration values match the real enum",
  SYMPTOM_DURATION_VALUES.length === Object.values(SymptomDuration).length &&
    SYMPTOM_DURATION_VALUES.every((v) =>
      Object.values(SymptomDuration).includes(v)
    )
);

// ── Photographs ────────────────────────────────────────────────────────────
check(
  "at most four photos are accepted",
  !bookingSchema.safeParse({ ...VALID, photoKeys: ["a", "b", "c", "d", "e"] }).success
);
check(
  "four photos are fine",
  bookingSchema.safeParse({ ...VALID, photoKeys: ["a", "b", "c", "d"] }).success
);
check("photos are optional", bookingSchema.safeParse(VALID).success);

const actionSrc = read("src/lib/actions/booking.ts");
check(
  "photo keys are checked against the uploader",
  /uploadedById: user\.id/.test(actionSrc)
);
const storageSrc = read("src/lib/storage.ts");
check(
  "patient photos are a PRIVATE prefix",
  /PRIVATE_PREFIXES = \[[^\]]*"patients"/.test(storageSrc)
);
const setupSrc = read("prisma/setup-s3.ts");
check(
  "the bucket keeps patients/ private too",
  /PRIVATE_PREFIXES = \[[^\]]*"patients"/.test(setupSrc)
);
// Scoped to the PUBLIC array only — a loose match runs on into the private
// list, which of course does contain "patients", and passes for the wrong
// reason. Putting a clinical-photo prefix in the public list would be a leak,
// so this check has to actually mean something.
const publicArray = setupSrc.slice(
  setupSrc.indexOf("const PUBLIC_PREFIXES = ["),
  setupSrc.indexOf("];", setupSrc.indexOf("const PUBLIC_PREFIXES = ["))
);
check("patients/ is never in the public list", !publicArray.includes('"patients"'));
check("credentials/ is never in the public list", !publicArray.includes('"credentials"'));
check("prescriptions/ is never in the public list", !publicArray.includes('"prescriptions"'));
check("the public list is non-empty", publicArray.includes('"doctors"'));
const presignSrc = read("src/app/api/uploads/presign/route.ts");
check(
  "a patient may upload only to patients/",
  /PATIENT_FOLDERS = new Set\(\["patients"\]\)/.test(presignSrc)
);
const viewSrc = read("src/app/api/uploads/view/route.ts");
check(
  "only the treating doctor or the patient may view a photo",
  /appointment: \{ doctor: \{ userId \} \}/.test(viewSrc)
);
const photoUi = read("src/components/booking/PhotoAttach.tsx");
check("the uploader says who can see them", /Only your doctor can see them/.test(photoUi));
check("the uploader is mobile-first", /grid-cols-3 gap-2 sm:grid-cols-4/.test(photoUi));
const drawerSrc2 = read("src/components/doctor/AppointmentDrawer.tsx");
check("the doctor sees the photos", /Photos from the client/.test(drawerSrc2));
check(
  "photos are served through the signed route",
  /api\/uploads\/view\?url=\$\{encodeURIComponent\(ph\.url\)\}/.test(drawerSrc2)
);

// ── The doctor's email ─────────────────────────────────────────────────────
const email = intakeEmailBlock({
  reason: VisitReason.ACNE,
  reasonDetail: "Jawline breakouts.",
  symptomDuration: SymptomDuration.MONTHS_1_6,
  severity: 4,
  priorTreatment: "Benzoyl peroxide",
  medications: null,
  allergies: null,
  isFirstVisit: true,
  patientAge: 27,
  patientGender: "FEMALE",
});
check("email names the reason", email.includes("Acne"));
check("email carries their own words", email.includes("Jawline breakouts."));
check("email carries what they tried", email.includes("Benzoyl peroxide"));
check("email gives age and sex", email.includes("27y") && email.includes("female"));
// A blank allergies line reads as "not asked". It always is asked.
check("email states allergies explicitly", email.includes("Allergies: none reported"));
check("email omits fields with nothing in them", !email.includes("Medication:"));

// ── Social links ───────────────────────────────────────────────────────────
check(
  "a bare handle becomes a URL",
  normaliseSocial("instagram", "@drmenon") === "https://instagram.com/drmenon"
);
check(
  "a handle without @ works too",
  normaliseSocial("instagram", "drmenon") === "https://instagram.com/drmenon"
);
check(
  "a full URL is kept",
  normaliseSocial("instagram", "https://instagram.com/drmenon") ===
    "https://instagram.com/drmenon"
);
check(
  "http is upgraded to https",
  normaliseSocial("instagram", "http://instagram.com/drmenon")?.startsWith("https://") === true
);
check("youtube keeps its @", normaliseSocial("youtube", "drmenon")?.includes("/@drmenon") === true);
check(
  "a linkedin URL in the instagram field is refused",
  normaliseSocial("instagram", "https://linkedin.com/in/drmenon") === null
);
check(
  "a hostile host is refused",
  normaliseSocial("facebook", "https://evil.example/drmenon") === null
);
check(
  "a credentialed URL is refused",
  normaliseSocial("website", "https://user:pass@example.com") === null
);
check("blank clears the link", normaliseSocial("instagram", "  ") === null);
check("a free website is allowed any host", normaliseSocial("website", "myclinic.in") === "https://myclinic.in");

const all = normaliseSocials({ instagram: "@a", facebook: "", linkedin: "nope://x" });
check("normaliseSocials clears what it cannot parse", all.facebook === null && all.linkedin === null);
check("normaliseSocials keeps what it can", all.instagram === "https://instagram.com/a");

check("handle displays back", displayHandle("instagram", "https://instagram.com/drmenon") === "@drmenon");
check("website shows its host", displayHandle("website", "https://www.myclinic.in/x") === "myclinic.in");
check(
  "socialLinks skips the empty ones",
  socialLinks({ instagram: "https://instagram.com/a", facebook: null }).length === 1
);

// ── It is actually wired through ───────────────────────────────────────────
const action = read("src/lib/actions/booking.ts");
check("the booking persists the reason", /reason: d\.reason/.test(action));
check("age and sex are snapshotted", /patientAge: profile\?\.age/.test(action));
check(
  "an attached report is ownership-checked",
  /userId: user\.id/.test(action) && /skinReportSource === "scan"/.test(action)
);
check("the doctor's email carries the intake", /intakeEmailBlock\(/.test(action));

const drawer = read("src/components/doctor/AppointmentDrawer.tsx");
check("the drawer has a reason section", /Why they are coming/.test(drawer));
check("the drawer always states allergies", /None reported/.test(drawer));
check("the drawer flags missing photo consent", /ask before photographing/.test(drawer));

const wizard = read("src/components/booking/BookingWizard.tsx");
check("the wizard has a reason step", /stepId === "reason"/.test(wizard));
check("the reason step gates Continue", /disabled=\{!reasonDone\}/.test(wizard));
check("the wizard attaches a skin report", /SkinReportAttach/.test(wizard));

const attach = read("src/components/booking/SkinReportAttach.tsx");
check("no-report state offers a free scan", /Run a free analysis/.test(attach));
check("no-report state says so plainly", /don&apos;t have a skin analysis yet/.test(attach));
check("a network error is not reported as 'no scan'", /could not check for your report/.test(attach));

const patientView = read("src/components/patient/AppointmentsView.tsx");
check("the patient sees what they submitted", /What you told the clinic/.test(patientView));

const profile = read("src/app/doctor/portal/profile/page.tsx");
check("the doctor can edit their links", /Your links/.test(profile));
check("the doctor sees their whole listing", /How your listing reads/.test(profile));
check("the listing names what is missing", /Your listing is missing/.test(profile));

// ── Mobile ─────────────────────────────────────────────────────────────────
const controls = read("src/components/patient/AppointmentControls.tsx");
check(
  "reschedule slots drop to 3 columns on a phone",
  /grid-cols-3 gap-1\.5 sm:grid-cols-4/.test(controls)
);
const preview = read("src/components/doctor/PortalPreview.tsx");
check("the week preview scrolls rather than squeezes", /overflow-x-auto/.test(preview));

console.log(`\n${pass} passed, ${fails.length} failed`);
if (fails.length) {
  fails.forEach((f) => console.log(`  FAIL  ${f}`));
  process.exit(1);
}
