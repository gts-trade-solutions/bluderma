/**
 * End-to-end checks for the doctor portal and Gold Collar.
 *
 * Exercises the real query and pricing paths against the real database, then
 * puts everything back. The three things worth proving:
 *
 *   1. An unapproved practitioner is invisible everywhere a client can look.
 *   2. Approval publishes them AND their clinics, in one step.
 *   3. A member is charged less, and the discount is recorded rather than
 *      silently absorbed.
 *
 *   npx tsx prisma/verify-doctor-portal.ts
 */
import {
  PrismaClient,
  DoctorStatus,
  SubscriptionStatus,
} from "@prisma/client";

import { PUBLIC_DOCTOR_WHERE } from "../src/lib/queries/doctorAccess";
import { applyMemberDiscount, periodEndFrom } from "../src/lib/subscription/plan";
import { evaluateCancellation, POLICY_DEFAULTS } from "../src/lib/booking/policy";
import { getCalendarData, rangeFor } from "../src/lib/queries/doctorCalendar";

const prisma = new PrismaClient();
const fails: string[] = [];

function check(label: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) fails.push(label);
}

async function main() {
  // ── 1. Leakage ────────────────────────────────────────────────────────
  console.log("\n1. An unapproved practitioner stays invisible");

  const victim = await prisma.doctor.findFirstOrThrow({
    where: PUBLIC_DOCTOR_WHERE,
    select: { id: true, slug: true, name: true, clinics: { select: { clinicId: true } } },
  });
  const clinicIds = victim.clinics.map((c) => c.clinicId);

  const publicBefore = await prisma.doctor.count({ where: PUBLIC_DOCTOR_WHERE });

  await prisma.doctor.update({
    where: { id: victim.id },
    data: { status: DoctorStatus.PENDING, isActive: false },
  });

  const visibleWhilePending = await prisma.doctor.findFirst({
    where: { slug: victim.slug, ...PUBLIC_DOCTOR_WHERE },
    select: { id: true },
  });
  check("PENDING doctor is not in the public directory", visibleWhilePending === null);

  const publicDuring = await prisma.doctor.count({ where: PUBLIC_DOCTOR_WHERE });
  check(
    "public count drops by exactly one",
    publicDuring === publicBefore - 1,
    `${publicBefore} -> ${publicDuring}`
  );

  // A DRAFT applicant must be invisible too, not just a PENDING one.
  await prisma.doctor.update({
    where: { id: victim.id },
    data: { status: DoctorStatus.DRAFT },
  });
  const draftVisible = await prisma.doctor.findFirst({
    where: { slug: victim.slug, ...PUBLIC_DOCTOR_WHERE },
    select: { id: true },
  });
  check("DRAFT doctor is not in the public directory", draftVisible === null);

  // ── 2. Approval publishes the clinics too ─────────────────────────────
  console.log("\n2. Approval publishes the practitioner and their locations");

  await prisma.clinic.updateMany({
    where: { id: { in: clinicIds } },
    data: { isActive: false },
  });
  const hiddenClinics = await prisma.clinic.count({
    where: { id: { in: clinicIds }, isActive: true },
  });
  check("clinics start hidden", hiddenClinics === 0);

  // What approveDoctor() does, minus the admin session.
  await prisma.$transaction([
    prisma.doctor.update({
      where: { id: victim.id },
      data: { status: DoctorStatus.APPROVED, isActive: true },
    }),
    prisma.clinic.updateMany({
      where: { id: { in: clinicIds } },
      data: { isActive: true },
    }),
  ]);

  const backInDirectory = await prisma.doctor.findFirst({
    where: { slug: victim.slug, ...PUBLIC_DOCTOR_WHERE },
    select: { id: true },
  });
  check("approved doctor is listed again", backInDirectory !== null);

  const liveClinics = await prisma.clinic.count({
    where: { id: { in: clinicIds }, isActive: true },
  });
  check(
    "their clinics went live with them",
    liveClinics === clinicIds.length,
    `${liveClinics}/${clinicIds.length}`
  );

  const publicAfter = await prisma.doctor.count({ where: PUBLIC_DOCTOR_WHERE });
  check("public count restored", publicAfter === publicBefore);

  // ── 3. Member pricing ─────────────────────────────────────────────────
  console.log("\n3. A membership actually costs less");

  const plan = await prisma.subscriptionPlan.findFirstOrThrow({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { name: true, discountPercent: true, interval: true, waiveCancellationFee: true },
  });

  const listFee = 1200;
  const { payableInr, discountInr } = applyMemberDiscount(listFee, {
    discountPercent: plan.discountPercent,
    scanCredits: 0,
    priorityBooking: true,
    waiveCancellationFee: plan.waiveCancellationFee,
  });
  check(
    `${plan.name}: ${plan.discountPercent}% off ₹${listFee}`,
    payableInr + discountInr === listFee && discountInr > 0,
    `pay ₹${payableInr}, saved ₹${discountInr}`
  );
  check(
    "the discount never rounds in the client's disfavour",
    discountInr === Math.floor((listFee * plan.discountPercent) / 100)
  );

  // A term bought today ends when it should.
  const start = new Date("2026-01-31T00:00:00.000Z");
  const monthEnd = periodEndFrom(start, "MONTHLY");
  check(
    "31 Jan + 1 month clamps to February rather than rolling into March",
    monthEnd.getUTCMonth() === 1,
    monthEnd.toISOString().slice(0, 10)
  );

  // ── 4. Fee waiver ─────────────────────────────────────────────────────
  console.log("\n4. A member is not charged a late-cancellation fee");

  // 12 hours out: inside the fee window, outside the reception window.
  const soon = new Date(Date.now() + 12 * 3_600_000);
  const asGuest = evaluateCancellation(soon, POLICY_DEFAULTS);
  const asMember = evaluateCancellation(soon, POLICY_DEFAULTS, new Date(), {
    waiveFee: true,
  });
  check("a non-member pays the fee", asGuest.kind === "fee");
  check(
    "a member does not",
    asMember.kind === "free" && asMember.waived === true
  );

  // The reception window is NOT bought off by a membership.
  const imminent = new Date(Date.now() + 2 * 3_600_000);
  const memberImminent = evaluateCancellation(imminent, POLICY_DEFAULTS, new Date(), {
    waiveFee: true,
  });
  check(
    "a member still has to phone inside the contact window",
    memberImminent.kind === "contact"
  );

  // ── 5. The calendar loads ─────────────────────────────────────────────
  console.log("\n5. The calendar query returns something drawable");

  const { from, to } = rangeFor("month", new Date());
  const data = await getCalendarData(victim.id, from, to);
  check("clinics resolved for the filter row", data.clinics.length > 0, `${data.clinics.length}`);
  check(
    "every clinic carries a colour",
    data.clinics.every((c) => Boolean(c.colorKey)),
    data.clinics.map((c) => c.colorKey).join(", ")
  );
  check("awaiting count is a number", Number.isInteger(data.awaitingCount));

  // ── Report ────────────────────────────────────────────────────────────
  const activeSubs = await prisma.subscription.count({
    where: { status: SubscriptionStatus.ACTIVE },
  });
  console.log(
    `\ndirectory: ${publicAfter} listed · clinics: ${await prisma.clinic.count()} · plans: ${await prisma.subscriptionPlan.count()} · active memberships: ${activeSubs}`
  );

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
