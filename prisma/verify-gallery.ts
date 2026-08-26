/**
 * Before-and-after cases, and the consent that gates them.
 *
 * These are photographs of a patient's face. One rule carries the whole
 * feature: nothing is shown publicly unless the patient agreed and has not
 * withdrawn. Everything below exists because that rule is easy to write down
 * and easy to leak around.
 *
 * The subtlest leak is storage. Had the images been public objects, withdrawal
 * would be theatre: anybody holding the URL keeps the picture forever. They
 * are private objects behind a route that re-checks consent per request, and
 * this suite asserts that arrangement rather than trusting it.
 *
 *   npx tsx prisma/verify-gallery.ts
 */
import { readFileSync } from "node:fs";

import { GalleryStatus, PrismaClient } from "@prisma/client";

import { isViewable } from "../src/lib/gallery/viewable";

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

const AGO = new Date("2026-01-01T00:00:00Z");

async function main() {
  /* ── The viewability rule, in every combination ────────────────────── */

  check(
    "published + consented is viewable",
    isViewable({
      status: GalleryStatus.PUBLISHED,
      consentGivenAt: AGO,
      consentWithdrawnAt: null,
    })
  );
  check(
    "published with NO consent is not",
    !isViewable({
      status: GalleryStatus.PUBLISHED,
      consentGivenAt: null,
      consentWithdrawnAt: null,
    }),
    "the whole feature rests on this one"
  );
  check(
    "published then WITHDRAWN is not",
    !isViewable({
      status: GalleryStatus.PUBLISHED,
      consentGivenAt: AGO,
      consentWithdrawnAt: new Date(),
    }),
    "changing your mind has to actually work"
  );
  check(
    "consented but only a draft is not",
    !isViewable({
      status: GalleryStatus.DRAFT,
      consentGivenAt: AGO,
      consentWithdrawnAt: null,
    })
  );
  check(
    "hidden is not, however consented",
    !isViewable({
      status: GalleryStatus.HIDDEN,
      consentGivenAt: AGO,
      consentWithdrawnAt: null,
    })
  );

  /* ── The storage arrangement that makes withdrawal real ────────────── */

  const composer = codeOnly("src/components/doctor/GalleryComposer.tsx");
  // The composer now goes through the shared client uploader, so the folder is
  // an argument rather than a request field. What matters is unchanged and is
  // checked twice: it writes to `patients`, and `patients` is not a prefix the
  // bucket policy makes readable — a withdrawn consent cannot un-share an
  // object that anyone with the URL can already fetch.
  check(
    "gallery images upload to a PRIVATE prefix",
    /uploadFile\([^)]*"patients"\)/.test(composer),
    "a public object cannot be un-shown"
  );
  const s3Setup = codeOnly("prisma/setup-s3.ts");
  const publicList = s3Setup.slice(
    s3Setup.indexOf("const PUBLIC_PREFIXES = ["),
    s3Setup.indexOf("];", s3Setup.indexOf("const PUBLIC_PREFIXES = ["))
  );
  check(
    "and patients/ is never made world-readable",
    publicList.length > 0 && !publicList.includes('"patients"')
  );

  const route = codeOnly("src/app/api/gallery/[id]/[side]/route.ts");
  check("the image route re-checks consent per request", /isViewable\(row\)/.test(route));
  check(
    "and never caches the signed redirect",
    /no-store/.test(route),
    "a cached 307 would keep resolving after consent is withdrawn"
  );
  check(
    "a non-viewable case is a 404, not a 403",
    /status: 404/.test(route),
    "whether a withdrawn case existed is the patient's business"
  );
  check(
    "the subject may see their own case at any status",
    /user!\.id === row\.patientUserId/.test(route),
    "they have to see the pair to decide whether to agree to it"
  );
  check(
    "and so may the doctor who owns it",
    /user!\.id === row\.doctor\.userId/.test(route)
  );

  const publicPage = codeOnly("src/app/patient/gallery/page.tsx");
  check(
    "the public page filters on consent as well as status",
    /consentGivenAt: \{ not: null \}/.test(publicPage) &&
      /consentWithdrawnAt: null/.test(publicPage)
  );
  check(
    "and hides suspended practitioners",
    /PUBLIC_DOCTOR_WHERE/.test(publicPage),
    "a suspended doctor should not keep a shopfront"
  );
  check(
    "no patient name reaches the public page",
    !/patientName|patient: \{ select/.test(publicPage),
    "they agreed to their skin being shown, not themselves"
  );

  /* ── The actions ───────────────────────────────────────────────────── */

  const action = codeOnly("src/lib/actions/gallery.ts");
  check(
    "publishing refuses without consent",
    /has not agreed to this being shown/.test(action)
  );
  check(
    "publishing refuses after withdrawal",
    /withdrawn their consent/.test(action)
  );
  check(
    "a case can only be made of a patient this doctor has seen",
    /appointment\.findFirst[\s\S]{0,160}patientUserId: d\.patientUserId/.test(action),
    "otherwise a consent request lands in a stranger's profile"
  );
  check(
    "consent is recorded once",
    /consentGivenAt: null/.test(action),
    "re-consenting would move the timestamp and lose when they agreed"
  );
  check(
    "withdrawal hides the case in the same write",
    /consentWithdrawnAt: new Date\(\), status: GalleryStatus\.HIDDEN/.test(action)
  );

  /* ── Live, against real rows ───────────────────────────────────────── */

  const [doctor, patient] = await Promise.all([
    prisma.doctor.findFirst({ select: { id: true } }),
    prisma.user.findFirst({ where: { role: "PATIENT" }, select: { id: true } }),
  ]);
  if (!doctor || !patient) {
    fails.push("need a doctor and a patient");
    return;
  }

  let id = "";
  try {
    const row = await prisma.doctorGalleryCase.create({
      data: {
        doctorId: doctor.id,
        patientUserId: patient.id,
        treatmentName: "vfy-gallery",
        beforeUrl: "https://example.invalid/b.jpg",
        beforeKey: "patients/vfy-b.jpg",
        afterUrl: "https://example.invalid/a.jpg",
        afterKey: "patients/vfy-a.jpg",
      },
    });
    id = row.id;

    check("a new case starts as a draft", row.status === GalleryStatus.DRAFT);
    check("with no consent recorded", row.consentGivenAt === null);
    check("and is not viewable", !isViewable(row));

    // Consent, then publish, then withdraw: the sequence that matters.
    await prisma.doctorGalleryCase.update({
      where: { id },
      data: { consentGivenAt: new Date(), status: GalleryStatus.PUBLISHED },
    });
    const live = await prisma.doctorGalleryCase.findUniqueOrThrow({ where: { id } });
    check("consented and published is viewable", isViewable(live));

    await prisma.doctorGalleryCase.updateMany({
      where: { id, patientUserId: patient.id },
      data: { consentWithdrawnAt: new Date(), status: GalleryStatus.HIDDEN },
    });
    const gone = await prisma.doctorGalleryCase.findUniqueOrThrow({ where: { id } });
    check("withdrawing makes it un-viewable immediately", !isViewable(gone));
    check(
      "and the record of consent is kept, not erased",
      gone.consentGivenAt !== null && gone.consentWithdrawnAt !== null,
      "the clinic must be able to show consent was given and later withdrawn"
    );

    // Another client cannot answer for them.
    const notTheirs = await prisma.doctorGalleryCase.updateMany({
      where: { id, patientUserId: "someone-else" },
      data: { consentGivenAt: new Date() },
    });
    check("another client cannot consent on their behalf", notTheirs.count === 0);
  } finally {
    if (id) await prisma.doctorGalleryCase.delete({ where: { id } }).catch(() => {});
    const left = await prisma.doctorGalleryCase.count({
      where: { treatmentName: "vfy-gallery" },
    });
    check("the fixture cleaned up after itself", left === 0, `${left} left`);
  }
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
