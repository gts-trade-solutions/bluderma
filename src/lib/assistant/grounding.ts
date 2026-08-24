import "server-only";

import { AppointmentStatus, ApprovalState } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { reasonLabel } from "@/lib/booking/visitIntake";
import { getScanPricing } from "@/lib/integrations/skinPricing";
import type { Audience, Fact, Grounding } from "@/lib/assistant/core";

/**
 * Everything the assistant is allowed to know, looked up before it speaks.
 *
 * ── Why retrieval rather than a fine-tune or a big system prompt ─────────
 * The catalogue is 384 treatments across 30 categories and it changes when
 * the admin edits it. Anything baked into a prompt is stale the moment
 * somebody renames a row, and a model asked to remember 384 names will
 * cheerfully produce a 385th. So the question picks the rows, the rows go in
 * the prompt, and core.unknownTreatments() checks the answer against the full
 * catalogue afterwards.
 *
 * ── The identity rule ────────────────────────────────────────────────────
 * Nothing here takes an id from the caller. Every "own record" lookup is
 * keyed on the session's own user id, so there is no shape of request that
 * makes this read somebody else's bookings.
 */

const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const day = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const dayTime = (d: Date) =>
  `${day(d)} at ${d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })}`;

/* ── Picking the treatments a question is about ───────────────────────── */

const STOP = new Set(
  ("a an and are as at be but by can could do does for from get had has have how i if in is it its me my of on or our so than that the their them then there these they this to too was we what when where which who why will with you your".split(
    " "
  ))
);

function terms(question: string): string[] {
  return question
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

/**
 * Scored rather than filtered. A LIKE query on the first keyword returns
 * whatever happens to match it; scoring every candidate against every keyword
 * puts "skin booster" above "booster seat" without needing a search index for
 * a table this size.
 */
async function findTreatments(question: string, limit = 6) {
  const words = terms(question);
  if (!words.length) return [];

  const rows = await prisma.hubTreatment.findMany({
    where: {
      isActive: true,
      OR: words.flatMap((w) => [
        { name: { contains: w } },
        { blurb: { contains: w } },
        { category: { is: { name: { contains: w } } } },
      ]),
    },
    select: { name: true, blurb: true, category: { select: { name: true } } },
    take: 40,
  });

  const scored = rows.map((r) => {
    const name = r.name.toLowerCase();
    const blurb = r.blurb.toLowerCase();
    const cat = r.category.name.toLowerCase();
    let score = 0;
    for (const w of words) {
      if (name === w) score += 12;
      else if (name.includes(w)) score += 6;
      if (cat.includes(w)) score += 3;
      if (blurb.includes(w)) score += 1;
    }
    return { row: r, score };
  });

  return scored
    .sort((a, b) => b.score - a.score || a.row.name.localeCompare(b.row.name))
    .slice(0, limit)
    .map(({ row }) => ({
      name: row.name,
      blurb: row.blurb,
      category: row.category.name,
    }));
}

/** Every name in the catalogue, for the post-answer check. Deduped lowercase. */
export async function treatmentVocabulary(): Promise<Set<string>> {
  const rows = await prisma.hubTreatment.findMany({ select: { name: true } });
  const cats = await prisma.hubCategory.findMany({ select: { name: true } });
  const out = new Set<string>();
  for (const r of rows) out.add(r.name);
  for (const c of cats) out.add(c.name);
  return out;
}

/* ── How the site works ───────────────────────────────────────────────── */

async function siteFacts(): Promise<Fact[]> {
  const [pricing, clinicCount, cities] = await Promise.all([
    getScanPricing(),
    prisma.clinic.count({ where: { isActive: true } }),
    prisma.clinic.findMany({
      where: { isActive: true },
      select: { city: true },
      distinct: ["city"],
      take: 12,
    }),
  ]);

  const facts: Fact[] = [];

  facts.push({
    label: "Skin scan price",
    value: pricing.firstScanFree
      ? `The first scan is free. After that it is ${money(pricing.priceInr)}.`
      : money(pricing.priceInr),
  });

  facts.push({
    label: "Booking a consultation",
    value:
      "Choose a doctor, pick a slot, and confirm. Some doctors approve requests themselves, so a booking can sit as awaiting-approval before it is confirmed.",
  });

  facts.push({
    label: "Which treatment somebody needs",
    value:
      "Always decided by a doctor at a consultation, never by the site and never by this assistant.",
  });

  if (clinicCount) {
    const named = cities.map((c) => c.city).filter(Boolean);
    facts.push({
      label: "Clinics",
      value: `${clinicCount} active ${clinicCount === 1 ? "clinic" : "clinics"}${
        named.length ? `, in ${named.join(", ")}` : ""
      }. The site sorts them by distance once location is shared.`,
    });
  }

  return facts;
}

/* ── What a client's own record says ──────────────────────────────────── */

async function patientFacts(userId: string): Promise<Fact[]> {
  const now = new Date();

  const [next, recent, orders, cards, plans, sheets, scans, user] = await Promise.all([
    prisma.appointment.findFirst({
      where: {
        patientUserId: userId,
        scheduledAt: { gte: now },
        status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW] },
      },
      orderBy: { scheduledAt: "asc" },
      select: {
        scheduledAt: true,
        status: true,
        approvalState: true,
        reason: true,
        feeAtBooking: true,
        visitFee: true,
        doctor: { select: { name: true } },
        clinic: { select: { name: true, city: true } },
      },
    }),
    prisma.appointment.count({ where: { patientUserId: userId } }),
    prisma.medicineOrder.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { publicId: true, status: true, totalInr: true, createdAt: true },
    }),
    prisma.giftCard.findMany({
      where: { buyerUserId: userId, paidAt: { not: null } },
      select: { balanceInr: true, valueInr: true, expiresAt: true },
      take: 5,
    }),
    prisma.treatmentPlan.findMany({
      where: { patientUserId: userId, sharedAt: { not: null } },
      orderBy: { sharedAt: "desc" },
      take: 2,
      select: {
        sharedAt: true,
        doctor: { select: { name: true } },
        items: { select: { treatment: true }, orderBy: { sortOrder: "asc" }, take: 6 },
      },
    }),
    prisma.aftercareSheet.findMany({
      where: { patientUserId: userId },
      orderBy: { issuedAt: "desc" },
      take: 2,
      select: { procedure: true, procedureDate: true, issuedAt: true },
    }),
    prisma.skinAnalysis.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, overall: true, skinType: true },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, publicId: true } }),
  ]);

  const facts: Fact[] = [];

  if (user?.publicId) facts.push({ label: "Their BluDerma ID", value: user.publicId });

  if (next) {
    const where = next.clinic ? ` at ${next.clinic.name}, ${next.clinic.city}` : "";
    const why = reasonLabel(next.reason);
    const state =
      next.approvalState === ApprovalState.AWAITING_DOCTOR
        ? " This one is still awaiting the doctor's approval."
        : "";
    facts.push({
      label: "Next appointment",
      value: `${dayTime(next.scheduledAt)} with ${next.doctor.name}${where}${
        why ? `, for ${why}` : ""
      }. Fee ${money(next.feeAtBooking + next.visitFee)}.${state}`,
    });
  } else {
    facts.push({ label: "Next appointment", value: "None booked." });
  }

  if (recent > 0) facts.push({ label: "Appointments booked in total", value: String(recent) });

  for (const o of orders) {
    facts.push({
      label: `Medicine order ${o.publicId ?? ""}`.trim(),
      value: `${o.status.toLowerCase().replace(/_/g, " ")}, ${money(o.totalInr)}, placed ${day(o.createdAt)}`,
    });
  }

  const liveCards = cards.filter((c) => !c.expiresAt || c.expiresAt > now);
  if (liveCards.length) {
    const bal = liveCards.reduce((n, c) => n + c.balanceInr, 0);
    facts.push({
      label: "Gift cards they bought",
      value: `${liveCards.length}, ${money(bal)} of balance between them. Cards are a record here — there is no counter redemption yet.`,
    });
  }

  for (const p of plans) {
    facts.push({
      label: "Treatment plan",
      value: `Shared by ${p.doctor.name} on ${day(p.sharedAt!)}. Lines: ${p.items
        .map((i) => i.treatment)
        .join(", ")}`,
    });
  }

  for (const s of sheets) {
    facts.push({
      label: "Aftercare sheet",
      value: `${s.procedure}, procedure on ${day(s.procedureDate)}, issued ${day(s.issuedAt)}. It is on their aftercare page.`,
    });
  }

  if (scans) {
    const pct = `${Math.round(scans.overall * 100)}/100`;
    facts.push({
      label: "Latest skin scan",
      value: `${day(scans.createdAt)}, overall ${pct}${scans.skinType ? `, skin type ${scans.skinType}` : ""}. The full report is on their skin analysis page.`,
    });
  }

  return facts;
}

/* ── What a practitioner's own portal says ────────────────────────────── */

async function doctorFacts(doctorId: string): Promise<Fact[]> {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);

  const [today, awaiting, month, expenses, assets, orders, cards, patients] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        doctorId,
        scheduledAt: { gte: dayStart, lt: dayEnd },
        status: { notIn: [AppointmentStatus.CANCELLED] },
      },
      orderBy: { scheduledAt: "asc" },
      select: { scheduledAt: true, patientName: true, reason: true, status: true },
    }),
    prisma.appointment.count({
      where: { doctorId, approvalState: ApprovalState.AWAITING_DOCTOR, scheduledAt: { gte: now } },
    }),
    prisma.appointment.findMany({
      where: {
        doctorId,
        scheduledAt: { gte: monthStart },
        status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW] },
        approvalState: { not: ApprovalState.AWAITING_DOCTOR },
      },
      select: { feeAtBooking: true, visitFee: true },
    }),
    prisma.practiceExpense.findMany({
      where: { doctorId, spentOn: { gte: monthStart } },
      select: { amountInr: true },
    }),
    prisma.practiceAsset.findMany({
      where: { doctorId, isActive: true },
      select: { name: true, costInr: true, uses: { select: { chargedInr: true } } },
    }),
    prisma.medicineOrder.count({ where: { doctorId, status: { in: ["PLACED", "CONFIRMED"] } } }),
    prisma.giftCard.count({ where: { offer: { doctorId }, paidAt: { not: null } } }),
    prisma.appointment.findMany({
      where: { doctorId, scheduledAt: { gte: monthStart } },
      select: { patientUserId: true, patientEmail: true },
    }),
  ]);

  const facts: Fact[] = [];

  facts.push({
    label: "Today",
    value: today.length
      ? `${today.length} booked. ${today
          .slice(0, 6)
          .map(
            (a) =>
              `${a.scheduledAt.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })} ${a.patientName}${
                reasonLabel(a.reason) ? ` (${reasonLabel(a.reason)})` : ""
              }`
          )
          .join("; ")}`
      : "Nothing booked today.",
  });

  facts.push({
    label: "Waiting on the doctor to approve",
    value: awaiting ? `${awaiting} booking ${awaiting === 1 ? "request" : "requests"}` : "None",
  });

  const takings = month.reduce((n, a) => n + a.feeAtBooking + a.visitFee, 0);
  const spent = expenses.reduce((n, e) => n + e.amountInr, 0);
  facts.push({
    label: "Booked so far this month",
    value: `${money(takings)} across ${month.length} visits`,
  });
  facts.push({
    label: "Running costs this month",
    value: `${money(spent)}. Net (takings minus running costs, machine purchases excluded) is ${money(takings - spent)}.`,
  });

  const seen = new Set(patients.map((p) => p.patientUserId ?? p.patientEmail ?? "").filter(Boolean));
  if (seen.size) facts.push({ label: "Distinct patients this month", value: String(seen.size) });

  for (const a of assets) {
    const back = a.uses.reduce((n, u) => n + u.chargedInr, 0);
    facts.push({
      label: `Machine: ${a.name}`,
      value: `Cost ${money(a.costInr)}, ${money(back)} recovered over ${a.uses.length} uses, ${money(
        Math.max(0, a.costInr - back)
      )} still to go.`,
    });
  }

  if (orders) facts.push({ label: "Medicine orders to action", value: String(orders) });
  if (cards) facts.push({ label: "Gift cards sold", value: String(cards) });

  return facts;
}

/* ── The one entry point ──────────────────────────────────────────────── */

export type Viewer =
  | { audience: "visitor" }
  | { audience: "patient"; userId: string }
  | { audience: "doctor"; doctorId: string };

export async function groundingFor(question: string, viewer: Viewer): Promise<Grounding> {
  const [treatments, site, own] = await Promise.all([
    findTreatments(question),
    siteFacts(),
    viewer.audience === "patient"
      ? patientFacts(viewer.userId)
      : viewer.audience === "doctor"
        ? doctorFacts(viewer.doctorId)
        : Promise.resolve<Fact[]>([]),
  ]);

  return { treatments, site, own };
}

export type { Audience };
