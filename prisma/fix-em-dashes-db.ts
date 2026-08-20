/**
 * The other half of the copy: everything stored in the database.
 *
 * Roughly half this site's prose is CMS content — treatment descriptions,
 * category intros, doctor biographies, clinic notes, FAQs, banners — and a
 * source-only pass leaves every word of it untouched. It also survives every
 * redeploy, so the dashes would come back looking like a regression.
 *
 * Driven off information_schema rather than a hand-written column list, so a
 * column somebody adds later cannot quietly escape.
 *
 * ── What it will not touch ───────────────────────────────────────────────
 * A cell whose entire value is "—" is the no-value placeholder this codebase
 * uses deliberately: the honesty rule is to print a dash rather than invent a
 * figure, and `verify-doctor-metrics` asserts it. Those are left exactly as
 * they are.
 *
 *   npx tsx prisma/fix-em-dashes-db.ts --dry
 *   npx tsx prisma/fix-em-dashes-db.ts
 */
import { PrismaClient } from "@prisma/client";

import { deEmDash } from "./deEmDash";

const prisma = new PrismaClient({ log: ["error"] });
const DRY = process.argv.includes("--dry");

interface Col {
  TABLE_NAME: string;
  COLUMN_NAME: string;
}

/** The primary key column, so an update can target one row. */
async function primaryKey(table: string): Promise<string | null> {
  const rows = await prisma.$queryRawUnsafe<{ COLUMN_NAME: string }[]>(
    `SELECT COLUMN_NAME FROM information_schema.key_column_usage
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = 'PRIMARY'
     ORDER BY ORDINAL_POSITION`,
    table
  );
  // A composite key has no single column to address, and none of the copy
  // tables use one.
  return rows.length === 1 ? rows[0].COLUMN_NAME : null;
}

async function main(): Promise<void> {
  const cols = await prisma.$queryRawUnsafe<Col[]>(`
    SELECT TABLE_NAME, COLUMN_NAME
    FROM information_schema.columns
    WHERE TABLE_SCHEMA = DATABASE()
      AND DATA_TYPE IN ('varchar','text','mediumtext','longtext')
    ORDER BY TABLE_NAME, COLUMN_NAME
  `);

  const byTable = new Map<string, string[]>();
  for (const c of cols) {
    byTable.set(c.TABLE_NAME, [...(byTable.get(c.TABLE_NAME) ?? []), c.COLUMN_NAME]);
  }

  let changedCells = 0;
  let dashes = 0;
  let placeholders = 0;
  const preview: string[] = [];

  for (const [table, columns] of byTable) {
    const pk = await primaryKey(table);
    if (!pk) continue;

    for (const col of columns) {
      let rows: Record<string, string>[];
      try {
        rows = await prisma.$queryRawUnsafe(
          `SELECT \`${pk}\` AS pk, \`${col}\` AS val FROM \`${table}\` WHERE \`${col}\` LIKE '%—%'`
        );
      } catch {
        continue;
      }

      for (const row of rows) {
        const value = row.val;
        if (typeof value !== "string") continue;

        // The deliberate placeholder.
        if (value.trim() === "—") {
          placeholders += 1;
          continue;
        }

        const { after } = deEmDash(value);
        if (after === value) continue;

        dashes += (value.match(/—/g) ?? []).length;
        changedCells += 1;
        if (preview.length < 20) {
          preview.push(
            `${table}.${col}\n  -  ${value.replace(/\s+/g, " ").slice(0, 108)}\n  +  ${after.replace(/\s+/g, " ").slice(0, 108)}`
          );
        }

        if (!DRY) {
          await prisma.$executeRawUnsafe(
            `UPDATE \`${table}\` SET \`${col}\` = ? WHERE \`${pk}\` = ?`,
            after,
            row.pk
          );
        }
      }
    }
  }

  console.log(preview.join("\n\n"));
  console.log(
    `\n${DRY ? "WOULD CHANGE" : "CHANGED"}: ${changedCells} cells, ${dashes} em dashes`
  );
  console.log(`Placeholders left alone: ${placeholders}`);

  if (!DRY) {
    // Counted again from scratch rather than trusting the loop above, and
    // with the placeholder rule applied, so the number means something.
    let left = 0;
    for (const [table, columns] of byTable) {
      for (const col of columns) {
        try {
          const rows = await prisma.$queryRawUnsafe<{ val: string }[]>(
            `SELECT \`${col}\` AS val FROM \`${table}\` WHERE \`${col}\` LIKE '%—%'`
          );
          for (const r of rows) {
            if (typeof r.val === "string" && r.val.trim() !== "—") {
              left += (r.val.match(/—/g) ?? []).length;
            }
          }
        } catch {
          /* not a readable column */
        }
      }
    }
    console.log(
      left
        ? `\n${left} em dashes remain in prose. Re-run, or look at them by hand.`
        : "\nNo em dash remains in any stored prose."
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
