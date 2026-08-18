/**
 * Seeds the launch-offer wording as editable rows in Admin → Settings
 * (group "offer"). Idempotent — existing values are left alone so admin
 * edits survive a re-run; only missing keys are created.
 *
 * Run: npx tsx prisma/seed-offer-settings.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ROWS: { key: string; value: string; label: string }[] = [
  { key: "offer.enabled", value: "true", label: "Offer band shown on the home page" },
  { key: "offer.badge", value: "New here", label: "Small badge above the headline" },
  { key: "offer.headline", value: "FIRST SKIN SCAN FREE", label: "Offer headline" },
  { key: "offer.regular_label", value: "Every scan", label: "Struck-out price label" },
  { key: "offer.regular_price", value: "₹99", label: "Struck-out price" },
  { key: "offer.free_label", value: "Your first scan", label: "Offer price label" },
  { key: "offer.free_price", value: "₹0", label: "Offer price" },
  { key: "offer.discount_tag", value: "100% off", label: "Rotated discount tag" },
  { key: "offer.cta", value: "Claim my free scan", label: "Offer button" },
  { key: "offer.footnote", value: "One free scan per account · no card needed", label: "Line under the button" },
];

async function main() {
  for (const r of ROWS) {
    await prisma.siteSetting.upsert({
      where: { key: r.key },
      create: { ...r, group: "offer", type: "STRING" },
      update: { label: r.label, group: "offer" },
    });
  }
  console.log(`offer settings present: ${ROWS.length}`);
}

main().finally(() => prisma.$disconnect());
