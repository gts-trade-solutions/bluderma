/**
 * Repaints the category icon chips.
 *
 * Every tint was a pair of `/20` translucent stops over the dark canvas, which
 * on screen collapsed to the same near-grey eighteen times over — the icons
 * carried no information at all. This takes each one to full saturation in the
 * hue it already had, so nothing has to be re-learned and the catalogue is
 * legible by colour.
 *
 * Idempotent: rows already carrying the vivid string are left alone. The
 * static mirror in src/data/hub.ts is edited in the same shape.
 *
 *   npx tsx prisma/recolor-hub-categories.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** slug → gradient. Every value ends in a glyph colour. */
const TINTS: Record<string, string> = {
  "glass-skin": "from-sky-500 to-cyan-400 text-white",
  lifting: "from-violet-500 to-fuchsia-400 text-white",
  botox: "from-blue-600 to-indigo-500 text-white",
  fillers: "from-rose-500 to-pink-400 text-white",
  laser: "from-amber-500 to-orange-400 text-white",
  "hair-removal": "from-teal-500 to-emerald-400 text-white",
  "hair-restoration": "from-lime-500 to-green-400 text-white",
  "acne-scars": "from-orange-500 to-red-400 text-white",
  pigmentation: "from-yellow-500 to-amber-400 text-white",
  eyes: "from-indigo-500 to-blue-400 text-white",
  nose: "from-slate-500 to-zinc-400 text-white",
  "face-contour": "from-purple-500 to-violet-400 text-white",
  "body-fat": "from-cyan-500 to-sky-400 text-white",
  wellness: "from-emerald-500 to-teal-400 text-white",
  bridal: "from-pink-500 to-rose-400 text-white",
  mens: "from-zinc-600 to-slate-500 text-white",
  dental: "from-sky-600 to-blue-500 text-white",
  "skin-health": "from-red-500 to-rose-400 text-white",
  // The nine added by the catalogue expansion already had solid stops but no
  // glyph colour, so their icons inherited the muted body text.
  "tattoo-removal": "from-slate-600 to-violet-500 text-white",
  regenerative: "from-teal-500 to-brand-500 text-white",
  "scars-marks": "from-orange-500 to-rose-400 text-white",
  "hands-feet": "from-amber-500 to-teal-400 text-white",
  lips: "from-rose-500 to-fuchsia-400 text-white",
  "brows-lashes": "from-amber-500 to-rose-400 text-white",
  vascular: "from-sky-500 to-violet-500 text-white",
  "sweat-odour": "from-sky-500 to-emerald-400 text-white",
  "womens-health": "from-rose-500 to-violet-400 text-white",
  paediatric: "from-sky-400 to-teal-400 text-white",
  nails: "from-fuchsia-500 to-purple-400 text-white",
  "post-procedure": "from-emerald-600 to-lime-400 text-white",
};

async function main() {
  const rows = await prisma.hubCategory.findMany({
    select: { id: true, slug: true, name: true, tint: true },
  });

  let changed = 0;
  const missing: string[] = [];

  for (const row of rows) {
    const next = TINTS[row.slug];
    if (!next) {
      missing.push(row.slug);
      continue;
    }
    if (row.tint === next) continue;
    await prisma.hubCategory.update({
      where: { id: row.id },
      data: { tint: next },
    });
    changed += 1;
    console.log(`  ${row.name.padEnd(28)} ${next}`);
  }

  console.log(`\n${changed} of ${rows.length} categories repainted.`);
  if (missing.length) {
    // Loud rather than silent: an unlisted slug keeps its old grey chip and
    // would otherwise be the one tile nobody notices is still wrong.
    console.log(`No tint listed for: ${missing.join(", ")}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
