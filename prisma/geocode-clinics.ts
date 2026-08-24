/**
 * Fill in the coordinates for clinics that have none.
 *
 * Ordering clinics by distance needs a point for each one, and two of ours had
 * never been geocoded. This is a ONE-OFF backfill, not a runtime dependency:
 * the app never calls a geocoder while somebody is waiting, it reads lat/lng
 * off the row.
 *
 * OpenStreetMap's Nominatim, because it is free and needs no key. Their usage
 * policy asks for a real User-Agent and at most one request a second, and both
 * are honoured below. Anything it cannot place is LEFT NULL rather than
 * guessed at: a clinic at the wrong coordinates would be sorted to the top of
 * somebody's list and send them across a city.
 *
 * Safe to re-run. Only touches rows where lat or lng is null.
 *
 *   npx tsx prisma/geocode-clinics.ts [--dry]
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ log: ["error"] });
const DRY = process.argv.includes("--dry");

const AGENT = "BluDerma/1.0 (clinic directory geocoding; info@bluderma.kr)";

interface Hit {
  lat: string;
  lon: string;
  display_name: string;
}

async function lookup(query: string): Promise<Hit | null> {
  const url =
    "https://nominatim.openstreetmap.org/search" +
    `?q=${encodeURIComponent(query)}&format=json&limit=1`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Hit[];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Progressively vaguer attempts.
 *
 * A full street address is the most accurate and the most likely to miss;
 * area plus city usually lands, and a bare pincode nearly always does. Stops
 * at the first hit, so a clinic with a findable address never falls back to
 * the centre of its postal district.
 */
function attempts(c: {
  addressLine1: string;
  area: string;
  city: string;
  state: string;
  pincode: string;
}): string[] {
  return [
    `${c.addressLine1}, ${c.area}, ${c.city} ${c.pincode}, ${c.state}, India`,
    `${c.area}, ${c.city} ${c.pincode}, ${c.state}, India`,
    `${c.area}, ${c.city}, ${c.state}, India`,
    `${c.pincode}, India`,
  ];
}

async function main() {
  const pending = await prisma.clinic.findMany({
    where: { OR: [{ lat: null }, { lng: null }] },
    select: {
      id: true,
      name: true,
      addressLine1: true,
      area: true,
      city: true,
      state: true,
      pincode: true,
    },
  });

  if (pending.length === 0) {
    console.log("Every clinic already has coordinates.");
    return;
  }
  console.log(`${pending.length} clinic(s) without coordinates\n`);

  let filled = 0;
  for (const c of pending) {
    let hit: Hit | null = null;
    let used = "";

    for (const q of attempts(c)) {
      hit = await lookup(q);
      if (hit) {
        used = q;
        break;
      }
      // Nominatim asks for no more than one request a second.
      await new Promise((r) => setTimeout(r, 1100));
    }

    if (!hit) {
      // Left null on purpose. See the note at the top: a clinic at the wrong
      // coordinates is worse than one with none, because it gets SORTED to
      // somebody's top instead of simply omitted from the distance ordering.
      console.log(`  ?  ${c.name}: nothing found, left without coordinates`);
      continue;
    }

    const lat = Number(hit.lat);
    const lng = Number(hit.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      console.log(`  ?  ${c.name}: unusable answer, left alone`);
      continue;
    }

    console.log(`  ok ${c.name}  ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    console.log(`     matched on: ${used}`);
    if (!DRY) {
      await prisma.clinic.update({ where: { id: c.id }, data: { lat, lng } });
      filled++;
    }
    await new Promise((r) => setTimeout(r, 1100));
  }

  const left = await prisma.clinic.count({ where: { OR: [{ lat: null }, { lng: null }] } });
  console.log(`\n${DRY ? "would fill" : "filled"} ${filled}; ${left} still without coordinates`);
  if (left > 0) {
    console.log("Those are simply left out of distance ordering, never guessed at.");
  }
}

main()
  .catch((e) => {
    console.error(e.message ?? e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
