/**
 * Regression check: proof that the multi-clinic slot rules actually bite.
 *
 * Builds a deliberately awkward scenario — two clinics with adjacent windows
 * on the same day — books into one, and checks the other reacts. Cleans up
 * after itself.
 */
import { PrismaClient, AppointmentStatus, ConsultMode } from "@prisma/client";
import { getSlotsForDoctor } from "../src/lib/queries/availability";

const prisma = new PrismaClient();
const SLUG = "meera-iyer";

function show(title: string, slots: Awaited<ReturnType<typeof getSlotsForDoctor>>) {
  console.log(`\n${title}`);
  const byClinic = new Map<string, typeof slots>();
  for (const s of slots) {
    const k = s.clinicName ?? "(no clinic)";
    if (!byClinic.has(k)) byClinic.set(k, []);
    byClinic.get(k)!.push(s);
  }
  for (const [clinic, list] of byClinic) {
    const rendered = list
      .map((s) => (s.available ? s.label : `${s.label}[${s.blockedBy}]`))
      .join(" ");
    console.log(`  ${clinic}\n    ${rendered}`);
  }
}

/** The next Monday, far enough out that nothing is "past". */
function nextMonday(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 7);
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const day = nextMonday();
  const doctor = await prisma.doctor.findUniqueOrThrow({
    where: { slug: SLUG },
    select: { id: true, travelBufferMin: true },
  });
  const nung = await prisma.clinic.findUniqueOrThrow({
    where: { slug: "bluderma-aesthetics-nungambakkam" },
    select: { id: true, name: true },
  });
  const adyar = await prisma.clinic.findUniqueOrThrow({
    where: { slug: "bluderma-aesthetics-adyar" },
    select: { id: true, name: true },
  });

  console.log(`doctor ${SLUG}, travel buffer ${doctor.travelBufferMin} min, day ${day} (Monday)`);

  // Move the Adyar Monday session up against the Nungambakkam one so the
  // buffer has something to do. Seed hours are 17:00; 13:30 makes it tight.
  const adyarMon = await prisma.doctorAvailability.findFirstOrThrow({
    where: { doctorId: doctor.id, clinicId: adyar.id, dayOfWeek: 1 },
  });
  const originalStart = adyarMon.startTime;
  await prisma.doctorAvailability.update({
    where: { id: adyarMon.id },
    data: { startTime: "13:30", endTime: "16:00" },
  });

  show("BEFORE any booking", await getSlotsForDoctor(SLUG, day));

  // Book the last Nungambakkam slot of the morning.
  const at = new Date(`${day}T13:00:00.000Z`);
  const appt = await prisma.appointment.create({
    data: {
      doctorId: doctor.id,
      clinicId: nung.id,
      scheduledAt: at,
      durationMin: 30,
      mode: ConsultMode.CLINIC,
      status: AppointmentStatus.CONFIRMED,
      feeAtBooking: 1200,
      patientName: "Slot rule probe",
      slotLock: `${doctor.id}@${at.toISOString()}`,
    },
  });

  const after = await getSlotsForDoctor(SLUG, day);
  show(`AFTER booking 13:00 at ${nung.name}`, after);

  // ── Assertions ────────────────────────────────────────────────────────
  const fail: string[] = [];

  const taken = after.find((s) => s.label === "13:00" && s.clinicId === nung.id);
  if (taken?.available !== false || taken.blockedBy !== "taken") {
    fail.push(`13:00 at ${nung.name} should be taken, got ${JSON.stringify(taken)}`);
  }

  // 13:00 + 30min + 45min buffer = blocked through 14:15 at the other clinic.
  const travelBlocked = after.filter(
    (s) => s.clinicId === adyar.id && s.blockedBy === "travel"
  );
  if (travelBlocked.length === 0) {
    fail.push("expected some Adyar slots blocked by travel time, got none");
  }

  const adyarLate = after.find((s) => s.label === "15:00" && s.clinicId === adyar.id);
  if (adyarLate?.available !== true) {
    fail.push(`15:00 at ${adyar.name} is beyond the buffer and should be free`);
  }

  console.log("\ntravel-blocked at Adyar:", travelBlocked.map((s) => s.label).join(" ") || "(none)");

  // ── Clean up ──────────────────────────────────────────────────────────
  await prisma.appointment.delete({ where: { id: appt.id } });
  await prisma.doctorAvailability.update({
    where: { id: adyarMon.id },
    data: { startTime: originalStart, endTime: "20:00" },
  });

  if (fail.length) {
    console.log("\nFAILED:");
    for (const f of fail) console.log("  -", f);
    process.exitCode = 1;
  } else {
    console.log("\nAll slot rules hold.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
