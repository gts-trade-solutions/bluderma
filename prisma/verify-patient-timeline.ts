/**
 * The patient history a doctor sees.
 *
 * Two properties matter more than the contents:
 *
 *   1. A doctor sees what happened between this patient and THEM. Not the
 *      person's bookings elsewhere, not their analyses in general.
 *   2. Nothing is inferred. Every event carries a date from a real column, and
 *      a rate is withheld rather than computed from a sample too small to mean
 *      anything.
 *
 *   npx tsx prisma/verify-patient-timeline.ts
 */
import { readFileSync } from "node:fs";

import { AppointmentStatus, PrismaClient } from "@prisma/client";

import { getPatientTimeline, summarise } from "../src/lib/doctor/patientTimeline";

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

const ev = (kind: string) =>
  ({ id: kind, at: new Date(), kind, summary: "" }) as Parameters<typeof summarise>[0][number];

async function main() {
  /* ── The rate is withheld on a thin sample ─────────────────────────── */

  const thin = summarise([ev("booked"), ev("booked"), ev("cancelled")]);
  check(
    "no cancel rate from two bookings",
    thin.cancelRate === null,
    "one out of two is 50%, and printing that invites a judgement the data cannot support"
  );
  check("but the counts are still exact", thin.bookings === 2 && thin.cancellations === 1);

  const enough = summarise([
    ...Array.from({ length: 5 }, () => ev("booked")),
    ev("cancelled"),
    ev("cancelled"),
  ]);
  check("five bookings earns a rate", enough.cancelRate !== null);
  check("and it is right", Math.round((enough.cancelRate ?? 0) * 100) === 40);

  /* ── The flag only fires when it should ────────────────────────────── */

  check("nothing to say stays silent", summarise([ev("booked")]).flag === null);
  check(
    "two no-shows are worth flagging",
    /no-shows/.test(summarise([ev("no-show"), ev("no-show")]).flag ?? "")
  );
  check(
    "a regular is recognised too, not only a problem",
    /regular/.test(
      summarise(Array.from({ length: 5 }, () => ev("completed"))).flag ?? ""
    ),
    "a history screen that only ever warns is one nobody opens"
  );

  /* ── It is derived, not logged ─────────────────────────────────────── */

  const src = codeOnly("src/lib/doctor/patientTimeline.ts");
  check(
    "every query is scoped to the doctor",
    (src.match(/doctorId/g) ?? []).length >= 4,
    "a practitioner has no business reading someone else's dealings"
  );
  check(
    "a scan only counts when attached to this doctor's booking",
    /skinScan: \{ select/.test(src),
    "somebody's analyses in general are not their doctor's business"
  );
  check(
    "no activity table was introduced",
    !/prisma\.patientActivity|model PatientActivity/.test(
      src + readFileSync("prisma/schema.prisma", "utf8")
    ),
    "a log would have started empty on the day it shipped"
  );
  check(
    "the reschedule date admits what it is",
    /Dated from the last change/.test(readFileSync("src/lib/doctor/patientTimeline.ts", "utf8")),
    "there is no reschedule timestamp, only a counter"
  );

  const page = codeOnly("src/app/doctor/portal/patients/[id]/page.tsx");
  check(
    "the page refuses a patient this doctor has not seen",
    /appointment\.findFirst[\s\S]{0,140}doctorId: owner\.doctorId/.test(page) &&
      /notFound\(\)/.test(page)
  );

  /* ── Live, against real rows ───────────────────────────────────────── */

  const appt = await prisma.appointment.findFirst({
    where: { patientUserId: { not: null } },
    select: { doctorId: true, patientUserId: true },
  });
  if (!appt?.patientUserId) {
    fails.push("need an appointment with a signed-in patient");
    return;
  }

  const { events: mine, truncated, totalBookings } = await getPatientTimeline(
    appt.doctorId,
    appt.patientUserId
  );
  check("a real patient has a timeline", mine.length > 0, `${mine.length} events`);
  check(
    "it is newest first",
    mine.every((e, i) => i === 0 || mine[i - 1].at.getTime() >= e.at.getTime())
  );
  check("every event carries a real date", mine.every((e) => !Number.isNaN(e.at.getTime())));
  check("and a written summary", mine.every((e) => e.summary.length > 0));
  check(
    "the booking count is the real one, not the slice",
    totalBookings >= mine.filter((e) => e.kind === "booked").length,
    `${totalBookings}`
  );
  // A patient with a long history must be TOLD the list is partial. Silent
  // truncation makes a partial history look like a complete one, on the very
  // screen used to judge whether somebody cancels a lot.
  if (totalBookings > mine.length) {
    check("a long history is declared partial", truncated);
  }

  // The scoping rule, exercised rather than read.
  const otherDoctor = await prisma.doctor.findFirst({
    where: { id: { not: appt.doctorId } },
    select: { id: true },
  });
  if (otherDoctor) {
    const theirs = await getPatientTimeline(otherDoctor.id, appt.patientUserId);
    const overlap = theirs.events.filter((t) => mine.some((m) => m.id === t.id));
    check(
      "another doctor sees none of these events",
      overlap.length === 0,
      `${overlap.length} leaked`
    );
  }

  // A cancelled booking must produce a cancellation event, not just vanish.
  const cancelled = await prisma.appointment.findFirst({
    where: {
      patientUserId: { not: null },
      status: AppointmentStatus.CANCELLED,
      cancelledAt: { not: null },
    },
    select: { doctorId: true, patientUserId: true, id: true },
  });
  if (cancelled?.patientUserId) {
    // Asked for a window wide enough to reach it. This patient turned out to
    // have 150 appointments, which is what surfaced the truncation problem in
    // the first place.
    const t = await getPatientTimeline(cancelled.doctorId, cancelled.patientUserId, 1000);
    check(
      "a cancellation appears in the history",
      t.events.some((e) => e.id === `${cancelled.id}-cancelled`),
      "this is the event the whole screen was asked for"
    );
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
