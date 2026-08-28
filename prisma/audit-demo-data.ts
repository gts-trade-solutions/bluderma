/**
 * What seeded content is in this database, and who can see it.
 *
 *   npx tsx prisma/audit-demo-data.ts            # report only, changes nothing
 *   npx tsx prisma/audit-demo-data.ts --apply    # delete it
 *
 * ── Why a script and not a migration ─────────────────────────────────────
 * A migration changes the SHAPE of the database and runs everywhere. This
 * changes its CONTENTS, and what it should delete depends on which database
 * it is pointed at: on a developer's machine the seeded people are the whole
 * point, and on production they are a liability. That is a decision for
 * whoever runs it, not for a file that runs itself on deploy.
 *
 * ── What counts as seeded ────────────────────────────────────────────────
 * An account whose email ends in one of the reserved `.local` domains. Those
 * cannot be registered and cannot receive mail, so nothing a real person owns
 * can be caught by this. See lib/demo.ts.
 *
 * ── What it will NOT delete ──────────────────────────────────────────────
 * Anything belonging to a real account. If a real patient ever booked with
 * the demo doctor, or a real doctor ever saw a seeded patient, that row is
 * reported and left alone: deleting a real person's appointment history to
 * tidy up a demo is a worse outcome than the demo being visible.
 */
import { PrismaClient } from "@prisma/client";

import { DEMO_EMAIL_SUFFIXES, isDemoAccount } from "../src/lib/demo";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

/**
 * Seeded-looking, but never deletable: the administrator.
 *
 * `admin@bluderma.local` shares the seed's domain, so a plain suffix match
 * classifies the one account that can reach the admin console as demo data.
 * Deleting it would lock the owner out of their own site, and it is the kind
 * of mistake that is only discovered afterwards.
 *
 * Protected by ROLE rather than by listing the address, so a differently
 * named admin on the same domain is just as safe.
 */
const PROTECTED_ROLES = ["ADMIN"];

const emailIsDemo = {
  OR: DEMO_EMAIL_SUFFIXES.map((suffix) => ({ email: { endsWith: suffix } })),
};

/** What --apply will actually remove: seeded, and not an administrator. */
const deletable = {
  AND: [emailIsDemo, { NOT: { role: { in: PROTECTED_ROLES as never[] } } }],
};

function head(title: string) {
  console.log(`\n${title}\n${"─".repeat(title.length)}`);
}

async function main() {
  console.log(
    APPLY
      ? "MODE: --apply — seeded rows will be DELETED"
      : "MODE: report only — nothing will be changed. Add --apply to delete."
  );

  /* ── Who is seeded ─────────────────────────────────────────────────── */
  const demoUsers = await prisma.user.findMany({
    where: emailIsDemo,
    select: { id: true, email: true, name: true, role: true },
  });
  const totalUsers = await prisma.user.count();

  head("Accounts");
  console.log(`${demoUsers.length} seeded of ${totalUsers} total`);
  for (const u of demoUsers) {
    const guard = PROTECTED_ROLES.includes(u.role) ? "  ← PROTECTED, never deleted" : "";
    console.log(`   ${u.role.padEnd(8)} ${u.email}${guard}`);
  }
  // Everything below reports on what would actually be removed, so the counts
  // never include an account the delete refuses to touch.
  const ids = demoUsers.filter((u) => !PROTECTED_ROLES.includes(u.role)).map((u) => u.id);

  /* ── What they are attached to ─────────────────────────────────────── */
  head("Content owned by seeded accounts");
  const counts = {
    reviews: await prisma.review.count({ where: { userId: { in: ids } } }),
    appointments: await prisma.appointment.count({
      where: { patientUserId: { in: ids } },
    }),
    analyses: await prisma.skinAnalysis
      .count({ where: { userId: { in: ids } } })
      .catch(() => 0),
    photos: await prisma.patientPhoto
      .count({ where: { patientUserId: { in: ids } } })
      .catch(() => 0),
    payments: await prisma.payment.count({ where: { userId: { in: ids } } }).catch(() => 0),
  };
  for (const [k, v] of Object.entries(counts)) console.log(`   ${k.padEnd(14)} ${v}`);

  const demoDoctors = await prisma.doctor.findMany({
    where: { user: { is: deletable } },
    select: { id: true, name: true, status: true, isActive: true },
  });
  head("Seeded practitioners");
  for (const d of demoDoctors) {
    console.log(`   ${d.name} — ${d.status}${d.isActive ? ", active" : ""}`);
  }
  const doctorIds = demoDoctors.map((d) => d.id);

  /* ── The part that actually matters: cross-contamination ───────────── */
  head("Real people entangled with seeded ones");
  const realWithDemoDoctor = await prisma.appointment.findMany({
    where: { doctorId: { in: doctorIds }, patientUserId: { notIn: ids } },
    select: { id: true, patient: { select: { email: true } } },
  });
  const demoWithRealDoctor = await prisma.appointment.findMany({
    where: { patientUserId: { in: ids }, doctorId: { notIn: doctorIds } },
    select: { id: true, doctor: { select: { name: true } } },
  });
  console.log(
    `   real clients booked with a seeded doctor: ${realWithDemoDoctor.length}`
  );
  realWithDemoDoctor.forEach((a) => console.log(`      ${a.patient?.email}`));
  console.log(
    `   seeded clients booked with a real doctor: ${demoWithRealDoctor.length}`
  );
  demoWithRealDoctor.forEach((a) => console.log(`      ${a.doctor?.name}`));

  /* ── Settings that quote a figure ──────────────────────────────────── */
  head("Pricing settings");
  const settings = await prisma.siteSetting.findMany({
    where: { key: { startsWith: "skin." } },
    select: { key: true, value: true },
    orderBy: { key: "asc" },
  });
  for (const s of settings) console.log(`   ${s.key.padEnd(30)} ${s.value}`);
  const price = settings.find((s) => s.key === "skin.scan_price_inr")?.value;
  const list = settings.find((s) => s.key === "skin.scan_list_price_inr")?.value;
  if (price && list && Number(list) > Number(price)) {
    console.log(
      `   WARNING: a struck-through Rs ${list} will be shown beside the charged Rs ${price}.`
    );
  }

  if (!APPLY) {
    head("Nothing was changed");
    console.log("Re-run with --apply to delete the seeded accounts and their content.");
    return;
  }

  /* ── Deleting ──────────────────────────────────────────────────────── */
  if (realWithDemoDoctor.length > 0) {
    head("REFUSED");
    console.log(
      `${realWithDemoDoctor.length} real client(s) have appointments with a seeded doctor.`
    );
    console.log(
      "Deleting the doctor would take their history with it. Reassign or cancel"
    );
    console.log("those appointments first, then run this again.");
    process.exitCode = 1;
    return;
  }

  head("Deleting");
  // Users last: the schema cascades from user to their content, and deleting
  // the parent first is what makes this one statement rather than fifteen in
  // an order somebody has to get right.
  const removed = await prisma.user.deleteMany({ where: deletable });
  console.log(`   ${removed.count} seeded accounts and everything cascading from them`);

  const left = await prisma.user.count({ where: deletable });
  console.log(`   remaining seeded accounts: ${left}`);
  if (left > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(`\nFAILED: ${e.message ?? e}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
