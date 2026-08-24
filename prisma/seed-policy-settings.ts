/**
 * Booking-policy and scan-pricing settings, editable in Admin → Settings.
 * Idempotent: only missing keys are created, so admin edits survive a re-run.
 *
 * Run: npx tsx prisma/seed-policy-settings.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ROWS = [
  // Cancellation and rescheduling
  { key: "booking.cancel_free_hours", value: "24", group: "booking", label: "Free cancellation window (hours before)" },
  { key: "booking.cancel_fee_inr", value: "300", group: "booking", label: "Late cancellation fee (INR)" },
  { key: "booking.cancel_contact_hours", value: "4", group: "booking", label: "Inside this many hours, client must call reception" },
  { key: "booking.max_reschedules", value: "2", group: "booking", label: "How many times a booking may be moved" },
  { key: "booking.reschedule_min_hours", value: "4", group: "booking", label: "Minimum notice to reschedule (hours)" },
  { key: "booking.reception_phone", value: "", group: "booking", label: "Reception number shown in cancellation messages" },
  // Skin analysis
  { key: "skin.first_scan_free", value: "true", group: "skin", label: "First analysis is free" },
  { key: "skin.scan_price_inr", value: "99", group: "skin", label: "Price charged per analysis after the first (INR)" },
  { key: "skin.scan_list_price_inr", value: "499", group: "skin", label: "Usual price, shown struck through (INR). Ignored when at or below the charged price." },
  { key: "skin.allow_access_requests", value: "true", group: "skin", label: "Clients may request a free analysis" },
  // Instalments are OFF until somebody names the lender. See
  // src/lib/queries/payLater.ts for why both halves are required: the mock
  // this replaced quoted a 60,000 limit through a provider that does not
  // exist, to clients deciding whether they could afford treatment.
  { key: "paylater.enabled", value: "false", group: "paylater", label: "Offer instalment plans" },
  { key: "paylater.provider", value: "", group: "paylater", label: "Credit provider's name (required before plans can be offered)" },
  { key: "paylater.limit_inr", value: "0", group: "paylater", label: "Published limit (INR). 0 shows no limit." },
  { key: "paylater.interest_free_months", value: "0", group: "paylater", label: "Interest-free months" },
];

async function main() {
  for (const r of ROWS) {
    await prisma.siteSetting.upsert({
      where: { key: r.key },
      create: { ...r, type: "STRING" },
      update: { label: r.label, group: r.group },
    });
  }
  console.log(`policy settings present: ${ROWS.length}`);
}

main().finally(() => prisma.$disconnect());
