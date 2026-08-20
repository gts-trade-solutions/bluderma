/**
 * Retires the em dash from copy a visitor reads.
 *
 * Not a find-and-replace. An em dash does four different jobs in this codebase
 * and each one wants a different mark, so swapping every one for a comma gives
 * you a page of comma splices, which reads worse than the dashes did.
 *
 * The four jobs, drawn from the 355 real occurrences rather than from theory:
 *
 *   1. PAIRED, around an aside.        "All content — including X — is free."
 *      -> commas.                      "All content, including X, is free."
 *
 *   2. LABEL, naming a value. The      "Video consult — your link follows"
 *      left side is three words or     -> colon.
 *      fewer and carries no verb.      "Video consult: your link follows"
 *
 *   3. JOINING a dependent tail that   "...risks — and make sure you do."
 *      opens with a conjunction or a   -> comma.
 *      relative pronoun.               "...risks, and make sure you do."
 *
 *   4. JOINING a whole sentence.       "...a hash — we never store it."
 *      -> full stop, and a capital.    "...a hash. We never store it."
 *
 * ── Order matters, and it was wrong the first time ───────────────────────
 * Testing the label rule before the sentence rule turned "Ten minutes to fill
 * in — you can stop halfway" into a colon. Testing the conjunction rule after
 * the sentence rule turned "a pasted URL — which is how it works" into a new
 * sentence beginning "Which". Both are in the cases below.
 *
 * The en dash (–) is never touched: "Jun – Aug 2026" and "1–5" are correct
 * typography, not a tell.
 */

/** Always a relative or a coordinator. Never starts a sentence of its own. */
const DEPENDENT =
  /^(and|or|but|so|yet|plus|which|who|whom|whose|because|since|although|though|while|whereas|including|excluding|such as|like|for example|e\.g\.|i\.e\.|usually|often|typically|mostly|with|without|from|to|at|in|on|by|after|before|until|unless|per|via)\b/i;

/**
 * A finite verb near the front is what makes a tail a sentence in its own
 * right. Deliberately a closed list: guessing at morphology gets "planning"
 * wrong as often as it gets "plans" right.
 */
const FINITE =
  /\b(is|are|was|were|isn't|aren't|has|have|had|hasn't|haven't|do|does|did|don't|doesn't|didn't|can|can't|cannot|could|will|won't|would|should|shouldn't|must|may|might|we|you|it|they|there|nothing|nobody|everything|everyone|gets?|comes?|comes|stays?|means?|makes?|keeps?|takes?|sits?|reads?|says?|shows?|stops?|starts?|works?|happens?|exists?|costs?|goes?|lives?|belongs?|needs?|wants?|leaves?|puts?|holds?|counts?|carries|carry|applies|apply|opens?|closes?|adds?|sends?|sets?|pays?|books?|charges?)\b/i;

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);

/** Raises the first letter, leaving an interpolation or a symbol alone. */
function capitalise(s: string): string {
  const m = s.match(/^(\s*)([a-z])/);
  return m ? s.replace(/^(\s*)([a-z])/, (_, sp, c) => sp + c.toUpperCase()) : s;
}

export type Rule =
  | "paired"
  | "label"
  | "join-clause"
  | "join-sentence"
  | "leading"
  | "skipped";

export interface Rewrite {
  before: string;
  after: string;
  rules: Rule[];
}

/** One pass over a single string of copy, exactly as a visitor sees it. */
export function deEmDash(text: string): Rewrite {
  if (!text.includes("—")) return { before: text, after: text, rules: [] };

  const rules: Rule[] = [];
  let out = text;

  // ── 1. Paired, around an aside ────────────────────────────────────────
  // Only within one sentence: across a full stop they are two separate
  // dashes doing two separate jobs.
  out = out.replace(/\s+—\s+([^—.!?]{2,80}?)\s+—\s+/g, (_a, aside: string) => {
    rules.push("paired");
    return `, ${aside.trim()}, `;
  });

  // ── 5. Leading, as an email signature or a bullet ─────────────────────
  // In a template literal a newline is written as the two characters
  // backslash and n, not as a real break. An email signature written that
  // way fell through to the clause rules and came out as a comma instead
  // of simply losing the dash.
  out = out.replace(/(^|\n|\\n)[ \t]*—[ \t]+/g, (_a, lead: string) => {
    rules.push("leading");
    return lead;
  });

  // ── 2/3/4. Single dashes, left to right ───────────────────────────────
  // Rebuilt by hand rather than with replace(), because rule 4 has to raise
  // the first letter of the text that FOLLOWS the match.
  let result = "";
  let rest = out;
  for (;;) {
    const m = rest.match(/\s*—\s*/);
    if (!m || m.index === undefined) {
      result += rest;
      break;
    }

    const left = rest.slice(0, m.index);
    let right = rest.slice(m.index + m[0].length);

    // The clause on each side, not the whole string.
    const head = (left.split(/(?<=[.!?])\s/).pop() ?? left).trim();
    const tail = right.split(/(?<=[.!?])\s/)[0] ?? right;

    let mark: string;
    if (words(head).length <= 3 && !FINITE.test(head)) {
      // 2. A label. Checked first, but kept tight at three words so it cannot
      //    swallow "Ten minutes to fill in".
      rules.push("label");
      mark = ": ";
    } else if (DEPENDENT.test(tail.trim())) {
      // 3. Leans on the head. Checked before the sentence rule, or "which is
      //    how it works" becomes a sentence starting "Which".
      rules.push("join-clause");
      mark = ", ";
    } else if (
      words(tail).length >= 3 &&
      FINITE.test(words(tail).slice(0, 6).join(" "))
    ) {
      // 4. Stands alone. A comma here would be a splice.
      rules.push("join-sentence");
      mark = ". ";
      right = capitalise(right);
    } else {
      rules.push("join-clause");
      mark = ", ";
    }

    // If the dash sat across a line break, keep the break and its indent.
    // Without this every multi-line JSX string reflows onto one line and the
    // diff stops being reviewable.
    const nl = m[0].match(/\n[ \t]*/);
    result += left + (nl ? mark.trimEnd() + nl[0] : mark);
    rest = right;
  }
  out = result;

  // Tidy the seams. Two marks should never meet.
  //
  // Expressions are masked first. A template literal reaches this function
  // whole, and the seam rules cannot tell prose punctuation from code: they
  // turned `${isDoctor ? "doctor" : "consultation"}` into `"doctor":` by
  // stripping the space before a colon that belonged to a ternary.
  // The sentinel must be something copy can never contain, and must be
  // plain text: an earlier version wrote literal NUL bytes into the source.
  const holes: string[] = [];
  out = out.replace(/\$\{[^}]*\}/g, (h) => {
    holes.push(h);
    return `@@HOLE${holes.length - 1}@@`;
  });

  out = out
    .replace(/,\s*,/g, ",")
    .replace(/:\s*,/g, ":")
    .replace(/,\s*\./g, ".")
    // Same line only. A blanket collapse flattened the indentation of every
    // multi-line JSX string, which changed nothing on screen and made the
    // diff unreadable.
    .replace(/[ \t]+([,.:;])/g, "$1")
    .replace(/([,.:;])[ \t]{2,}/g, "$1 ");

  out = out.replace(/@@HOLE(\d+)@@/g, (_a, i: string) => holes[Number(i)]);

  return { before: text, after: out, rules };
}

export const stillHasDash = (s: string) => s.includes("—");
