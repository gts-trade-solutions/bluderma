/**
 * Rerouting, photo pins, CV editing, reviews, theme and push.
 *
 * Three rules here are worth guarding rather than eyeballing.
 *
 * A booking never moves to another practitioner without the patient saying
 * yes. In aesthetics the choice of clinician IS the product, and silently
 * swapping the name is a different consultation with a different person.
 *
 * A push notification never carries anything clinical. It lands on a lock
 * screen in front of whoever is holding the phone, and "your acne review is
 * at 4pm" is a disclosure nobody consented to by tapping Allow.
 *
 * A price pinned to a photograph of somebody's face is indicative and says
 * so. This platform has already deleted one feature for implying a financial
 * commitment it could not stand behind.
 */
import { readFileSync } from "node:fs";

for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
  if (m && process.env[m[1]] === undefined) {
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
}

import { slotLockFor } from "../src/lib/booking/slotLock";

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
/**
 * A file with its line breaks and comment gutters flattened.
 *
 * Assertions about PROSE have to match text that wraps, and a sentence
 * wrapped inside a block comment has an asterisk sitting in the middle of it.
 * Reflowing the prose to suit the test would be the wrong way round.
 */
const prose = (p: string) => read(p).replace(/[*]/g, " ").replace(/\s+/g, " ");

const codeOnly = (p: string) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

console.log("1. A booking does not move without the patient");

const reroute = codeOnly("src/lib/actions/reroute.ts");
check(
  "the doctor proposes rather than reassigns",
  /state: RerouteState\.PROPOSED|@default\(PROPOSED\)/.test(
    reroute + read("prisma/schema.prisma")
  ) && !/doctorId: d\.toDoctorId/.test(reroute.split("answerReroute")[0])
);
check(
  "only accepting touches the appointment",
  /if \(!accept\) \{[\s\S]{0,400}?RerouteState\.DECLINED/.test(reroute) &&
    /appointment\.update\(\{[\s\S]{0,200}?doctorId: row\.toDoctorId/.test(reroute)
);
check(
  "the patient must own the appointment being asked about",
  /row\.appointment\.patientUserId !== user\.id/.test(reroute)
);
check(
  "a reason is required and the patient reads it",
  /min\(10,/.test(reroute)
);
check(
  "a guest booking is refused rather than moved",
  /no client account, so there is nobody to ask/.test(read("src/lib/actions/reroute.ts"))
);
check(
  "only one open proposal at a time",
  /You have already asked about this booking/.test(read("src/lib/actions/reroute.ts"))
);

console.log("\n2. The slot lock survives the move");

check(
  "there is one definition of the lock format",
  slotLockFor("d1", new Date("2026-08-26T10:00:00.000Z")) ===
    "d1@2026-08-26T10:00:00.000Z"
);
check(
  "booking and rerouting both import it",
  /from "@\/lib\/booking\/slotLock"/.test(read("src/lib/actions/booking.ts")) &&
    /from "@\/lib\/booking\/slotLock"/.test(read("src/lib/actions/reroute.ts"))
);
check(
  "neither redefines it",
  !/`\$\{doctorId\}@\$\{at\.toISOString\(\)\}`/.test(codeOnly("src/lib/actions/reroute.ts"))
);
check(
  "accepting rekeys the lock to the new doctor",
  /slotLock: slotLockFor\(row\.toDoctorId/.test(reroute)
);
check(
  "a clash rolls the whole move back rather than half-moving it",
  /\$transaction/.test(reroute) && /P2002/.test(reroute)
);
check(
  "and the patient is told the booking stayed put",
  /stays with \$\{row\.fromDoctor\.name\}/.test(read("src/lib/actions/reroute.ts"))
);
check(
  "the fee difference is disclosed rather than assumed away",
  /may differ from what you were quoted/.test(read("src/lib/actions/reroute.ts"))
);

console.log("\n3. Pins on a photograph");

const photos = codeOnly("src/lib/actions/photos.ts");
check(
  "a blank price stays blank rather than becoming zero",
  /if \(v === undefined \|\| v === ""\) return null/.test(photos)
);
check(
  "and the reason is written down",
  /says the treatment is free/.test(prose("src/lib/actions/photos.ts"))
);
check(
  "the photograph must be one this doctor can see",
  /appointments: \{ some: \{ doctorId: owner\.doctorId \} \}/.test(photos)
);
check(
  "the number is assigned server-side, not by the caller",
  /label: \(highest\?\.label \?\? 0\) \+ 1/.test(photos)
);
check(
  "a pin can only be removed by the doctor who placed it",
  /deleteMany\(\{\s*where: \{ id, doctorId: owner\.doctorId \}/.test(photos)
);
check(
  "pins are a separate table from the freehand markup",
  /model PhotoAnnotation/.test(read("prisma/schema.prisma")) &&
    /model PhotoMarkup/.test(read("prisma/schema.prisma"))
);

console.log("\n4. The CV is editable, and the badge means something");

const doctorActions = codeOnly("src/lib/actions/doctor.ts");
check("registration can be corrected", /updateOwnCredentials/.test(doctorActions));
check(
  "changing the number clears the verified mark",
  /identityChanged && before\.verified \? \{ verified: false \}/.test(doctorActions)
);
check(
  "replacing only the certificate does not",
  /identityChanged =\s*\(before\.regCouncil/.test(doctorActions) &&
    !/licenceDocUrl.*identityChanged/.test(doctorActions)
);
check(
  "a blank certificate field means 'no change', not 'delete it'",
  /d\.licenceDocUrl \? \{ licenceDocUrl: d\.licenceDocUrl \} : \{\}/.test(doctorActions)
);
check("an admin is told", /registration-changed/.test(doctorActions));
check(
  "and the doctor is told before they find out from a missing badge",
  /verified mark is paused/.test(read("src/lib/actions/doctor.ts"))
);
check(
  "languages accept the picker's shape as well as the textarea's",
  /languages: listField\(/.test(doctorActions)
);
check(
  "the profile edits the same lists onboarding collects",
  /name="specialtyAreas"/.test(read("src/app/doctor/portal/profile/page.tsx")) &&
    /name="otherConcerns"/.test(read("src/app/doctor/portal/profile/page.tsx"))
);

console.log("\n5. Reviews reach the doctor they are about");

const doctorsQuery = read("src/lib/queries/doctors.ts");
check("a doctor's own reviews are loaded", /reviewList: \{/.test(doctorsQuery));
check(
  "only published ones, and only ones with words",
  /status: ReviewStatus\.PUBLISHED/.test(doctorsQuery) &&
    /body: \{ not: null \}/.test(doctorsQuery)
);
check(
  "the reviewer is not fully named",
  /function displayName/.test(doctorsQuery) &&
    /\$\{parts\[parts\.length - 1\]\[0\]\.toUpperCase\(\)\}/.test(doctorsQuery)
);
check(
  "the card renders nothing when nothing is published",
  /\(doctor\.reviewList\?\.length \?\? 0\) > 0 &&/.test(
    read("src/components/hub/DoctorDirectory.tsx")
  )
);
check(
  "with no fallback to somebody else's words",
  !/testimonial|placeholder/i.test(
    read("src/components/hub/DoctorDirectory.tsx").split("reviewList")[1] ?? ""
  )
);

console.log("\n6. Theme");

// The substance moved to prisma/verify-themes.ts when the two-theme switch
// was rebuilt as four themes on a token layer. That file measures actual WCAG
// contrast for every token against every ground, which is the only kind of
// check that catches the failure this feature actually had — valid CSS,
// passing build, invisible text.
//
// Four assertions used to live here and all four went stale in the rebuild.
// One of them ("light reuses the existing scope") had become an assertion
// that the BUG was still present: putting `.theme-light` on <html> is exactly
// what repainted the tokens while leaving 1,300 literal colours alone.
//
// What is left here is the boundary between the two files, so neither can
// quietly stop covering the subject.
const theme = read("src/lib/theme.ts");
check(
  "the theme system is the four-theme one",
  /THEMES = \["midnight", "daylight", "sepia", "contrast"\]/.test(theme)
);
check(
  "the default is excluded from every themed rule",
  /:root\[data-theme\]:not\(\[data-theme="midnight"\]\)/.test(
    read("src/app/globals.css")
  ),
  "adding options must not change the design"
);
check(
  "the contrast audit exists and is wired to the build",
  /verify-themes/.test(read("package.json")) &&
    /gen-theme-overrides\.ts --check/.test(read("package.json"))
);

console.log("\n7. Push carries nothing clinical");

const push = codeOnly("src/lib/push.ts");
check(
  "the payload has no field for a procedure",
  /interface PushPayload \{[\s\S]*?\}/.test(read("src/lib/push.ts")) &&
    !/procedure|diagnosis|reason|medicine/.test(
      (read("src/lib/push.ts").match(/interface PushPayload \{[\s\S]*?\n\}/) ?? [""])[0]
    )
);
const cron = read("src/app/api/cron/reminders/route.ts");
check(
  "the reminder sends a time and a name only",
  /body: `Your appointment with \$\{a\.doctor\.name\}\.`/.test(cron)
);
check(
  "a dead subscription is pruned only on 404 or 410",
  /code === 404 \|\| code === 410/.test(push)
);
check(
  "a push service outage does not unsubscribe everybody",
  /out\.failed\+\+/.test(push)
);
check(
  "one appointment cannot stack three notifications",
  /tag: `appt-\$\{a\.id\}`/.test(cron)
);
check(
  "a re-subscribe rewrites the keys rather than leaving stale ones",
  /update: \{[\s\S]{0,200}?p256dh: d\.keys\.p256dh/.test(
    codeOnly("src/app/api/push/subscribe/route.ts")
  )
);
check(
  "unsubscribing is scoped to the signed-in user",
  /where: \{ endpoint: parsed\.data\.endpoint, userId: user\.id \}/.test(
    codeOnly("src/app/api/push/subscribe/route.ts")
  )
);
check(
  "permission is asked on a press, never on page load",
  /onClick=\{state === "on" \? disable : enable\}/.test(
    read("src/components/patient/ReminderOptIn.tsx")
  )
);
check(
  "a blocked browser is told where the setting is",
  /site settings beside the address bar/.test(
    prose("src/components/patient/ReminderOptIn.tsx")
  )
);
check(
  "the service worker is at the origin root so its scope is the whole site",
  readFileSync("public/push-sw.js", "utf8").length > 500
);

console.log(`\n${pass} passed, ${fails.length} failed`);
if (fails.length) {
  fails.forEach((f) => console.log(`  FAIL  ${f}`));
  process.exit(1);
}
console.log("All checks pass.");
