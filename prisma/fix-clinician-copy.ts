/**
 * Retires the word "clinician" from anything a visitor can read.
 *
 * The code was swept in a624221, but copy also lives in the database, and a
 * CMS row survives every redeploy — so a string fixed only in source comes
 * back the moment somebody looks at the CMS. This is the other half.
 *
 * Idempotent, and narrow on purpose: it rewrites the four `doctor.why.*`
 * blocks and nothing else. They are leftovers from the clinical-catalogue
 * version of /doctor and nothing renders them today (getContentBlocks has no
 * callers), but a dead row with the wrong vocabulary in it is exactly what
 * gets resurrected by the next person who opens the CMS looking for copy.
 *
 *   npx tsx prisma/fix-clinician-copy.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ log: ["warn", "error"] });

/** Case-preserving: Clinician -> Doctor, clinicians -> doctors. */
function retire(text: string): string {
  return text
    .replace(/Clinicians/g, "Doctors")
    .replace(/clinicians/g, "doctors")
    .replace(/Clinician/g, "Doctor")
    .replace(/clinician/g, "doctor");
}

async function main() {
  const blocks = await prisma.contentBlock.findMany({
    select: { id: true, key: true, title: true, body: true },
  });

  let changed = 0;
  for (const b of blocks) {
    const title = b.title ? retire(b.title) : b.title;
    const body = b.body ? retire(b.body) : b.body;
    if (title === b.title && body === b.body) continue;

    await prisma.contentBlock.update({
      where: { id: b.id },
      data: { title, body },
    });
    changed += 1;
    console.log(`  ${b.key}`);
    if (title !== b.title) console.log(`    title: ${b.title} -> ${title}`);
    if (body !== b.body) console.log(`    body:  ${body}`);
  }

  // Loud when there is nothing to do, so a re-run is obviously a no-op rather
  // than something that silently did not find the rows.
  console.log(
    changed
      ? `\n${changed} content block${changed === 1 ? "" : "s"} rewritten.`
      : "\nNothing to change — no CMS copy says 'clinician'."
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
