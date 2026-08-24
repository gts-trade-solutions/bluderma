/**
 * Nearest clinic first.
 *
 * The example the clinic gave: somebody in Padi or Koyambedu should see Anna
 * Nagar at the top. That is worked through against the real clinic rows below,
 * not asserted in the abstract.
 *
 * The rule that matters more than the arithmetic: a clinic with no coordinates
 * sorts to the END. The naive `distance ?? 0` puts unplaced rows first, so the
 * ones we know least about would lead every list.
 *
 *   npx tsx prisma/verify-nearby.ts
 */
import { readFileSync } from "node:fs";

import { PrismaClient } from "@prisma/client";

import {
  byDistance,
  distanceKm,
  distanceLabel,
  pointOf,
} from "../src/lib/queries/nearby";

const prisma = new PrismaClient({ log: ["error"] });

let pass = 0;
const fails: string[] = [];
function check(name: string, ok: boolean, detail?: string) {
  if (ok) pass++;
  else fails.push(detail ? `${name} (${detail})` : name);
}

// Chennai neighbourhoods, from OpenStreetMap.
const PADI = { lat: 13.0989, lng: 80.1878 };
const KOYAMBEDU = { lat: 13.0694, lng: 80.1948 };
const ADYAR = { lat: 13.0067, lng: 80.2572 };

async function main() {
  /* ── The arithmetic ────────────────────────────────────────────────── */

  check("a point to itself is zero", distanceKm(PADI, PADI) < 0.001);
  const padiToAnna = distanceKm(PADI, { lat: 13.0878, lng: 80.2101 });
  check(
    "Padi to Anna Nagar is a couple of kilometres",
    padiToAnna > 1 && padiToAnna < 4,
    `${padiToAnna.toFixed(1)} km`
  );
  const padiToAdyar = distanceKm(PADI, ADYAR);
  check(
    "and Padi to Adyar is much further",
    padiToAdyar > padiToAnna * 3,
    `${padiToAdyar.toFixed(1)} km`
  );
  check("distance is symmetric", Math.abs(distanceKm(PADI, ADYAR) - distanceKm(ADYAR, PADI)) < 0.001);

  /* ── Labels claim only what the method can support ─────────────────── */

  check("under a kilometre gets no decimal", distanceLabel(0.42) === "under a kilometre");
  check("a few kilometres gets one", /^about 3\.4 km$/.test(distanceLabel(3.42)));
  check("a long way gets none", /^about 24 km$/.test(distanceLabel(23.6)));
  const src = readFileSync("src/lib/queries/nearby.ts", "utf8");
  check(
    "the label says 'about', never an exact figure",
    !/`\$\{km\}\s*km`/.test(src),
    "straight-line distance is not drive distance, and must not look like it"
  );

  /* ── Unplaced rows never lead ──────────────────────────────────────── */

  check("a missing coordinate is not a point", pointOf({ lat: null, lng: 1 }) === null);
  check("nor is a partial one", pointOf({ lat: 12, lng: null }) === null);
  check(
    "and nor is 0,0",
    pointOf({ lat: 0, lng: 0 }) === null,
    "that is the Gulf of Guinea, i.e. a default that escaped"
  );

  const mixed = byDistance(
    [
      { id: "far", lat: ADYAR.lat, lng: ADYAR.lng },
      { id: "unplaced", lat: null, lng: null },
      { id: "near", lat: 13.0878, lng: 80.2101 },
    ],
    PADI
  );
  check("the nearest comes first", mixed[0].item.id === "near", mixed[0].item.id);
  check(
    "and the unplaced one comes LAST",
    mixed[mixed.length - 1].item.id === "unplaced",
    "`distance ?? 0` would have put it first"
  );
  check("an unplaced row has no distance", mixed[mixed.length - 1].km === null);
  check("and no label", mixed[mixed.length - 1].label === null);

  /* ── No location means no reshuffling ──────────────────────────────── */

  const original = [
    { id: "a", lat: 1, lng: 1 },
    { id: "b", lat: 2, lng: 2 },
    { id: "c", lat: 3, lng: 3 },
  ];
  const unsorted = byDistance(original, null);
  check(
    "with no visitor location the order is untouched",
    unsorted.map((r) => r.item.id).join() === "a,b,c",
    "a list shuffled for no reason is worse than one that is not sorted"
  );
  check("and nothing claims a distance", unsorted.every((r) => r.km === null));

  /* ── Against the real clinics ──────────────────────────────────────── */

  const clinics = await prisma.clinic.findMany({
    where: { isActive: true },
    select: { id: true, name: true, area: true, city: true, lat: true, lng: true },
  });
  check("there are clinics to order", clinics.length > 0, `${clinics.length}`);
  check(
    "every one of them has coordinates",
    clinics.every((c) => pointOf(c) !== null),
    `${clinics.filter((c) => pointOf(c) === null).length} without`
  );

  const chennai = clinics.filter((c) => c.city === "Chennai");
  if (chennai.length >= 2) {
    // The clinic's own example, end to end.
    for (const [name, from] of [
      ["Padi", PADI],
      ["Koyambedu", KOYAMBEDU],
    ] as const) {
      const ordered = byDistance(chennai, from);
      const top = ordered[0];
      check(
        `from ${name}, the nearest Chennai clinic leads`,
        top.km !== null &&
          ordered.every((r) => r.km === null || r.km >= (top.km as number)),
        `${top.item.area} at ${top.label}`
      );
      check(
        `and from ${name} it is Anna Nagar`,
        /anna nagar/i.test(top.item.area),
        `${top.item.area} at ${top.label}`
      );
    }

    // From Adyar the answer must be different, or the ordering is not
    // responding to the visitor at all.
    const fromAdyar = byDistance(chennai, ADYAR)[0];
    const fromPadi = byDistance(chennai, PADI)[0];
    check(
      "a visitor in Adyar gets a different clinic than one in Padi",
      fromAdyar.item.id !== fromPadi.item.id,
      `${fromAdyar.item.area} vs ${fromPadi.item.area}`
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
