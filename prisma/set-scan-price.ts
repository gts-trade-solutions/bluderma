/**
 * Set what a skin analysis costs, on whichever database DATABASE_URL points at.
 *
 * This exists because re-seeding does NOT fix a price. seed-policy-settings
 * upserts with `update: { label, group }` and deliberately no `value`, so a
 * deploy can add a new setting without stamping on a figure an admin has
 * changed. That is the right default and it is also why production kept
 * showing ₹499 after the code fix shipped: the row was already there, holding
 * the old number, and nothing in a deploy was ever going to touch it.
 *
 * The same job can be done in Admin, Settings, "Skin analysis and pricing".
 * This is for when you would rather not click through it, or want the same
 * numbers applied to several environments.
 *
 *   npx tsx prisma/set-scan-price.ts              # show what is set now
 *   npx tsx prisma/set-scan-price.ts 99           # charge 99, leave the anchor
 *   npx tsx prisma/set-scan-price.ts 99 499       # charge 99, "usually" 499
 *   npx tsx prisma/set-scan-price.ts 99 none      # charge 99, no strike-through
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ log: ["error"] });

const PRICE = "skin.scan_price_inr";
const LIST = "skin.scan_list_price_inr";

async function show(note: string) {
  const rows = await prisma.siteSetting.findMany({
    where: { group: "skin" },
    select: { key: true, value: true },
    orderBy: { key: "asc" },
  });
  console.log(`\n${note}`);
  for (const r of rows) console.log(`  ${r.key.padEnd(30)} ${r.value}`);

  const price = Number(rows.find((r) => r.key === PRICE)?.value);
  const list = Number(rows.find((r) => r.key === LIST)?.value);
  if (Number.isFinite(price)) {
    console.log(
      `\n  A client is charged ₹${price}. ` +
        (Number.isFinite(list) && list > price
          ? `The card shows ₹${list} struck through beside it.`
          : "No strike-through is drawn: an anchor at or below the charged price is not a saving.")
    );
  }
}

async function main() {
  const [rawPrice, rawList] = process.argv.slice(2);

  if (!rawPrice) {
    await show("Currently set:");
    console.log("\n  Pass a figure to change it. See the header of this file.");
    return;
  }

  const price = Number(rawPrice);
  if (!Number.isFinite(price) || price < 0) {
    throw new Error(`"${rawPrice}" is not a price`);
  }

  await prisma.siteSetting.upsert({
    where: { key: PRICE },
    update: { value: String(Math.round(price)) },
    create: {
      key: PRICE,
      value: String(Math.round(price)),
      group: "skin",
      type: "STRING",
      label: "Price charged per analysis after the first (INR)",
    },
  });

  if (rawList !== undefined) {
    // "none" removes the anchor rather than deleting the row, so the setting
    // stays visible and editable in Admin instead of vanishing from the page.
    const list = rawList === "none" ? price : Number(rawList);
    if (!Number.isFinite(list) || list < 0) {
      throw new Error(`"${rawList}" is not a price`);
    }
    await prisma.siteSetting.upsert({
      where: { key: LIST },
      update: { value: String(Math.round(list)) },
      create: {
        key: LIST,
        value: String(Math.round(list)),
        group: "skin",
        type: "STRING",
        label:
          "Usual price, shown struck through (INR). Ignored when at or below the charged price.",
      },
    });
  }

  await show("Now set:");
  // getScanPricing wraps its query in React's cache(), which lives for one
  // request, so a running server picks this up on the next page load. No
  // restart, no redeploy.
  console.log("\n  Live on the next page load. No restart needed.");
}

main()
  .catch((e) => {
    console.error(e.message ?? e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
