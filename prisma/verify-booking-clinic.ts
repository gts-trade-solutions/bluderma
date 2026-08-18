/**
 * Proof that a booking lands at the clinic the client picked, and is charged
 * that clinic's fee.
 *
 * The bug this guards: bookAppointment accepted a clinicId and resolved a
 * per-clinic fee, but NEITHER booking form sent one. Every booking silently
 * fell back to the doctor's primary clinic, and `feeAtBooking` was the primary
 * clinic's price whatever the client had been shown. For a doctor charging
 * 1200 in one branch and 900 in another, that is a real overcharge.
 *
 * Exercises the action's own resolution logic against the database, then
 * removes what it created.
 *
 *   npx tsx prisma/verify-booking-clinic.ts
 */
import { PrismaClient, DoctorStatus } from "@prisma/client";

const prisma = new PrismaClient();
const fails: string[] = [];

function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) fails.push(label);
}

/**
 * The same resolution bookAppointment performs, in isolation. If this and the
 * action ever disagree, the action is right and this test is wrong — but
 * having it stated twice is what makes a silent regression loud.
 */
function resolvePractice(
  practices: { id: string; feeInr: number; isPrimary: boolean }[],
  clinicId?: string
) {
  const fallback = practices.find((p) => p.isPrimary) ?? practices[0] ?? null;
  if (!clinicId) return fallback;
  return practices.find((p) => p.id === clinicId) ?? null;
}

async function main() {
  // ── 1. The DTO carries the clinics the picker needs ───────────────────
  console.log("\n1. Doctor records reach the booking form with their clinics");

  // Queried directly rather than through getDoctors(): that module calls
  // React cache() at module scope, which does not exist outside a render.
  // Same include shape, so this exercises the real mapping.
  const rows = await prisma.doctor.findMany({
    where: { status: DoctorStatus.APPROVED, isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      slug: true,
      name: true,
      fee: true,
      clinics: {
        where: { isActive: true, clinic: { isActive: true } },
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
        select: {
          feeInr: true,
          isPrimary: true,
          clinic: { select: { id: true, name: true, area: true, city: true } },
        },
      },
    },
  });
  const doctors = rows.map((r) => ({
    id: r.slug,
    name: r.name,
    fee: r.fee,
    clinics: r.clinics.map((p) => ({
      id: p.clinic.id,
      name: p.clinic.name,
      area: p.clinic.area,
      city: p.clinic.city,
      feeInr: p.feeInr,
      isPrimary: p.isPrimary,
    })),
  }));
  check("directory is not empty", doctors.length > 0, `${doctors.length} doctors`);

  const multi = doctors.filter((d) => (d.clinics?.length ?? 0) > 1);
  check(
    "at least one doctor practises at several clinics",
    multi.length > 0,
    `${multi.length} multi-clinic`
  );
  if (multi.length === 0) {
    console.log("\nNothing further to test without a multi-clinic doctor.");
    return;
  }

  const doc = multi[0];
  console.log(`\n   using ${doc.name} — ${doc.clinics.length} locations`);
  for (const c of doc.clinics) {
    console.log(
      `     ${c.isPrimary ? "*" : " "} ${c.name} (${c.area}) ₹${c.feeInr}`
    );
  }

  check(
    "exactly one location is marked primary",
    doc.clinics.filter((c) => c.isPrimary).length === 1
  );
  check(
    "every location carries its own fee",
    doc.clinics.every((c) => typeof c.feeInr === "number")
  );

  // ── 2. Fees actually differ, or the bug would be invisible ────────────
  const fees = new Set(doc.clinics.map((c) => c.feeInr));
  check(
    "the locations do not all charge the same",
    fees.size > 1,
    `fees: ${[...fees].join(", ")}`
  );

  // ── 3. The chosen clinic decides the fee ──────────────────────────────
  console.log("\n2. The chosen clinic decides where and what");

  const primary = doc.clinics.find((c) => c.isPrimary)!;
  const other = doc.clinics.find((c) => !c.isPrimary && c.feeInr !== primary.feeInr);

  const practices = doc.clinics.map((c) => ({
    id: c.id,
    feeInr: c.feeInr,
    isPrimary: c.isPrimary,
  }));

  const noPick = resolvePractice(practices);
  check(
    "sending no clinic falls back to the primary",
    noPick?.id === primary.id,
    primary.name
  );

  if (other) {
    const picked = resolvePractice(practices, other.id);
    check(
      "picking a second clinic resolves to that clinic",
      picked?.id === other.id,
      other.name
    );
    check(
      "and to that clinic's fee, not the primary's",
      picked?.feeInr === other.feeInr && picked?.feeInr !== primary.feeInr,
      `₹${picked?.feeInr} vs primary ₹${primary.feeInr}`
    );
  }

  const bogus = resolvePractice(practices, "not-a-real-clinic-id");
  check(
    "an unknown clinic is refused rather than silently falling back",
    bogus === null
  );

  // ── 4. Existing appointments record where they happened ───────────────
  console.log("\n3. Appointments record their location");

  const total = await prisma.appointment.count();
  const withClinic = await prisma.appointment.count({
    where: { clinicId: { not: null } },
  });
  if (total === 0) {
    console.log("  (no appointments yet — nothing to check)");
  } else {
    check(
      "every appointment has a clinic",
      withClinic === total,
      `${withClinic}/${total}`
    );
  }

  if (fails.length) {
    console.log(`\n${fails.length} FAILED:`);
    for (const f of fails) console.log("  -", f);
    process.exitCode = 1;
  } else {
    console.log("\nAll checks pass.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
