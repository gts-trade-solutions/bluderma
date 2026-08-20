/**
 * The edge cases at the edges of booking.
 *
 * Every rule here was missing, and each was missing for the same reason: the
 * happy path was carefully guarded and the unhappy one was never named. The
 * checks are written against behaviour rather than copy, and the pure ones run
 * real data through the real comparison rather than asserting on source text.
 *
 * Four rules:
 *
 *   1. A doctor may be a patient — middleware deliberately allows it — but not
 *      of themselves.
 *   2. A client cannot be in two places at once. The platform enforces exactly
 *      this for doctors, with a travel buffer, and enforced nothing for the
 *      person being seen: `slotLock` is `doctorId@instant`, so one client
 *      could hold 10:30 with three practitioners.
 *   3. A no-show cannot review, and nobody reviews their own practice.
 *   4. One client cannot sit on an unbounded number of future slots.
 *
 *   npx tsx prisma/verify-booking-guards.ts
 */
import { readFileSync } from "node:fs";
import { AppointmentStatus, PrismaClient } from "@prisma/client";

import { findClientClash, clashMessage } from "../src/lib/booking/clientClashes";

const prisma = new PrismaClient({ log: ["warn", "error"] });

let pass = 0;
const fails: string[] = [];
function check(name: string, ok: boolean, detail?: string) {
  if (ok) pass++;
  else fails.push(detail ? `${name} (${detail})` : name);
}
const read = (p: string) => readFileSync(p, "utf8");

const DAY = 86_400_000;
const MIN = 60_000;
const TAG = "guard-probe";

async function cleanup(ids: string[]): Promise<void> {
  if (!ids.length) return;
  await prisma.appointment.deleteMany({ where: { doctorId: { in: ids } } });
  await prisma.doctor.deleteMany({ where: { id: { in: ids } } });
}

/* ── The wiring is present ───────────────────────────────────────────── */

const booking = read("src/lib/actions/booking.ts");
const review = read("src/lib/actions/review.ts");

// The self-booking guard could not have been written without this: the doctor
// query never selected userId, so the comparison had no data to run on.
check(
  "the booking query loads the doctor's own account",
  /userId: true,/.test(booking.slice(0, booking.indexOf("if (!doctor)")))
);
check(
  "a doctor cannot book their own practice",
  /doctor\.userId === user\.id/.test(booking)
);
check("booking checks for a client clash", /findClientClash\(/.test(booking));
check(
  "so does rescheduling",
  (booking.match(/findClientClash\(/g) ?? []).length >= 2,
  `${(booking.match(/findClientClash\(/g) ?? []).length} call sites`
);
check("open bookings are capped", /MAX_OPEN_BOOKINGS/.test(booking));
check("a no-show cannot review", /AppointmentStatus\.NO_SHOW/.test(review));
check(
  "nobody reviews their own practice",
  /appointment\.doctor\.userId === user\.id/.test(review)
);

/* ── The overlap arithmetic, against the database ────────────────────── */

async function clashRules(): Promise<void> {
  const patient = await prisma.user.findFirst({
    where: { role: "PATIENT" },
    select: { id: true },
  });
  if (!patient) {
    check("a patient exists to test against", false, "seed one first");
    return;
  }

  const made: string[] = [];
  const doctors = [];
  for (const n of [0, 1]) {
    const d = await prisma.doctor.create({
      data: {
        slug: `${TAG}-${Date.now()}-${n}`,
        name: `Guard Probe ${n}`,
        title: "MBBS",
        specialty: "Dermatology",
        clinic: "Probe",
        location: "Chennai",
        image: "x",
        about: TAG,
        status: "APPROVED",
      },
      select: { id: true },
    });
    doctors.push(d.id);
    made.push(d.id);
  }

  // 10:00, half an hour, with the FIRST doctor.
  const at = new Date(Date.now() + 3 * DAY);
  at.setUTCHours(10, 0, 0, 0);

  const held = await prisma.appointment.create({
    data: {
      patientUserId: patient.id,
      doctorId: doctors[0],
      scheduledAt: at,
      durationMin: 30,
      mode: "CLINIC",
      status: AppointmentStatus.CONFIRMED,
      feeAtBooking: 1000,
      patientName: "Probe",
      notes: TAG,
      slotLock: `${doctors[0]}@${at.toISOString()}`,
    },
    select: { id: true },
  });

  // Exactly the same instant, a DIFFERENT doctor. slotLock cannot see this.
  const same = await findClientClash(patient.id, at, 30);
  check("the same time with another doctor clashes", same !== null);
  check(
    "and the message names the appointment in the way",
    same ? /Guard Probe 0/.test(clashMessage(same)) : false
  );

  // Overlapping by fifteen minutes.
  const overlap = await findClientClash(patient.id, new Date(at.getTime() + 15 * MIN), 30);
  check("a partial overlap clashes", overlap !== null);

  // Starting exactly when the other ends. Back to back is tight, not double
  // booked, and refusing it would break a legitimate two-clinic morning.
  const backToBack = await findClientClash(patient.id, new Date(at.getTime() + 30 * MIN), 30);
  check("touching endpoints do not clash", backToBack === null);

  const before = await findClientClash(patient.id, new Date(at.getTime() - 30 * MIN), 30);
  check("the slot ending as the other starts is free", before === null);

  const elsewhere = await findClientClash(patient.id, new Date(at.getTime() + 4 * 3_600_000), 30);
  check("a different hour is free", elsewhere === null);

  // Rescheduling must not clash with the row being moved.
  const self = await findClientClash(patient.id, at, 30, held.id);
  check("a booking never clashes with itself", self === null);

  // A cancelled booking has released its claim on the time.
  await prisma.appointment.update({
    where: { id: held.id },
    data: { status: AppointmentStatus.CANCELLED, slotLock: null },
  });
  const afterCancel = await findClientClash(patient.id, at, 30);
  check("a cancelled appointment frees the time", afterCancel === null);

  await prisma.appointment.update({
    where: { id: held.id },
    data: { status: AppointmentStatus.NO_SHOW },
  });
  check(
    "so does a no-show",
    (await findClientClash(patient.id, at, 30)) === null
  );

  await prisma.appointment.deleteMany({ where: { notes: TAG } });
  await cleanup(made);
}

clashRules()
  .catch((e) => fails.push(`threw: ${(e as Error).message}`))
  .finally(async () => {
    const strays = await prisma.doctor
      .findMany({ where: { slug: { startsWith: TAG } }, select: { id: true } })
      .catch(() => []);
    if (strays.length) await cleanup(strays.map((d) => d.id)).catch(() => {});
    await prisma.$disconnect();
    console.log(`\n${pass} passed, ${fails.length} failed`);
    if (fails.length) {
      fails.forEach((f) => console.log(`  FAIL  ${f}`));
      process.exit(1);
    }
  });
