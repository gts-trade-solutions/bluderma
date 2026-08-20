/**
 * Applies deEmDash.ts to every string a visitor can read, in source.
 *
 * The hard part is not the rewriting, it is the aim. Only quoted strings, JSX
 * text and template literals reach a browser; the other 697 em dashes in this
 * repository are in code comments, where they are prose written for whoever
 * reads the file next and are none of a visitor's business. A blunt pass over
 * whole files would rewrite the comments too and leave a diff nobody can
 * review.
 *
 * Spans are collected with their offsets and spliced back in reverse, so an
 * edit never shifts the position of one not yet applied.
 *
 *   npx tsx prisma/fix-em-dashes.ts --dry     print what would change
 *   npx tsx prisma/fix-em-dashes.ts           write it
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { deEmDash, type Rule } from "./deEmDash";

const DRY = process.argv.includes("--dry");
// Defaults to the app. A path can be passed instead, which is how the seed
// scripts get cleaned: their string literals are copy that lands in the
// database, so leaving them alone would reintroduce every dash on the next
// re-seed.
const ROOT = process.argv.find((a) => !a.startsWith("-") && /^(src|prisma)/.test(a)) ?? "src";

function walk(dir: string, out: string[] = []): string[] {
  // A single file is a legitimate target: the seeds are cleaned one at a time.
  if (statSync(dir).isFile()) return /\.tsx?$/.test(dir) ? [dir] : [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

/** Blanks comments so their offsets still line up but they never match. */
function maskComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length))
    .replace(/^([ \t]*)\/\/.*$/gm, (m) => " ".repeat(m.length));
}

/** Quoted strings, template literals and JSX text, with their offsets. */
function spans(masked: string): { start: number; end: number; text: string }[] {
  const out: { start: number; end: number; text: string }[] = [];
  // JSX text is delimited by a tag bracket OR an interpolation brace on either
  // side. The first version matched only `>...<`, so any run of text that
  // FOLLOWED a `{...}` was invisible to it. Since the leftover count used the
  // same pattern, the script confirmed its own blind spot and reported that no
  // em dash remained while "on the cards — that comes from a doctor" sat
  // untouched on the explore page.
  //
  // Both JSX branches must END at `<`. Allowing them to end at `{` as well
  // matched plain code between two interpolations — in profileData.ts it
  // swallowed `sessions: "1 session", doctor: a.doctorName, }));` and offered
  // to rewrite it.
  const re =
    /"([^"\n]{2,})"|'([^'\n]{2,})'|`([^`]{2,})`|>([^<>{}]{2,}?)<|\}([^<>{}]{2,}?)</g;
  for (const m of masked.matchAll(re)) {
    const body = m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5] ?? "";
    if (!body.includes("—")) continue;
    // An import path is a filename, not copy.
    if (/^[.@][\w./@-]*$/.test(body)) continue;
    // The JSX-text branch can run from the `>` of one tag through the
    // ATTRIBUTES of the next when an interpolation sits between them. Rewriting
    // that would reflow real code, so anything carrying attribute syntax is
    // not text and is left alone.
    if (/[A-Za-z-]+\s*=\s*["'{]/.test(body)) continue;
    // Needs to actually be prose.
    if (!/[a-z]{2}/i.test(body)) continue;
    // Where the captured group sits inside the whole match.
    const offset = m[0].indexOf(body);
    const start = (m.index ?? 0) + offset;
    out.push({ start, end: start + body.length, text: body });
  }
  return out;
}

let filesChanged = 0;
let dashesRemoved = 0;
const tally: Record<string, number> = {};
const preview: string[] = [];

for (const file of walk(ROOT)) {
  const original = readFileSync(file, "utf8");
  if (!original.includes("—")) continue;

  const masked = maskComments(original);
  const found = spans(masked);
  if (!found.length) continue;

  let next = original;
  let touched = 0;

  // Reverse order: an earlier splice must not move a later offset.
  for (const s of [...found].reverse()) {
    const { after, rules } = deEmDash(s.text);
    if (after === s.text) continue;
    for (const r of rules) tally[r] = (tally[r] ?? 0) + 1;
    dashesRemoved += (s.text.match(/—/g) ?? []).length;
    touched += 1;
    next = next.slice(0, s.start) + after + next.slice(s.end);
    if (preview.length < 25) {
      preview.push(
        `${file.replace(/\\/g, "/")}\n  -  ${s.text.trim().slice(0, 110)}\n  +  ${after.trim().slice(0, 110)}`
      );
    }
  }

  if (!touched) continue;
  filesChanged += 1;
  if (!DRY) writeFileSync(file, next, "utf8");
}

console.log(preview.join("\n\n"));
console.log(`\n${DRY ? "WOULD CHANGE" : "CHANGED"}: ${filesChanged} files, ${dashesRemoved} em dashes`);
console.log("By rule:");
for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(16)} ${v}`);
}

// Anything left is a shape the rules did not recognise, and a human should
// look at it rather than have it silently rewritten by a rule that guessed.
if (!DRY) {
  let leftover = 0;
  const where: string[] = [];
  for (const file of walk(ROOT)) {
    const masked = maskComments(readFileSync(file, "utf8"));
    for (const s of spans(masked)) {
      leftover += (s.text.match(/—/g) ?? []).length;
      if (where.length < 10) where.push(`  ${file.replace(/\\/g, "/")}: ${s.text.trim().slice(0, 90)}`);
    }
  }
  console.log(
    leftover
      ? `\n${leftover} left for a human:\n${where.join("\n")}`
      : "\nNo em dash remains in any visible string."
  );
}
