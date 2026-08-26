"use client";

import type { FieldProblem } from "@/lib/formValidation";

/**
 * The list of what is still missing, at the top of the form.
 *
 * Every entry is a button rather than a line of text, because the thing a
 * person wants to do on reading "Consultation fee is needed" is go and answer
 * it — and on a six-card step that is a scroll they should not have to
 * perform. Anchored to the field's `name`, which is the only identifier
 * shared by the summary, the field itself and the server's own error map.
 *
 * `role="alert"` so a screen reader announces the whole list on the failed
 * submit rather than leaving somebody to discover it.
 */
export default function ValidationSummary({
  problems,
  onJump,
}: {
  problems: FieldProblem[];
  onJump: (name: string) => void;
}) {
  if (problems.length === 0) return null;

  return (
    <div
      role="alert"
      className="rounded-xl bg-rose-50 px-4 py-3.5 text-sm ring-1 ring-inset ring-rose-200"
    >
      <p className="font-bold text-rose-900">
        {problems.length === 1
          ? "One thing still needs an answer"
          : `${problems.length} things still need an answer`}
      </p>
      <ul className="mt-2 space-y-1">
        {problems.map((p) => (
          <li key={p.name}>
            <button
              type="button"
              onClick={() => onJump(p.name)}
              className="text-left font-medium text-rose-700 underline decoration-rose-300 underline-offset-2 transition hover:text-rose-900 hover:decoration-rose-500"
            >
              {p.message}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
