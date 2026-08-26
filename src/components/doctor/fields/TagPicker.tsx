"use client";

import { useId, useMemo, useRef, useState } from "react";

/**
 * Search, tap, or type your own — a list of short values, as chips.
 *
 * ── Why a third selector and not a fourth use of ChipMultiSelect ─────────
 * ChipMultiSelect is specifically the treatments picker: it carries an AI
 * "describe what you do" panel, it is bound to the catalogue vocabulary, and
 * its copy talks about treatments throughout. Three other fields need the
 * same *shape* and none of them wants any of that — languages, sub-
 * specialities, and the free-text half of "what you treat". Bending one
 * component to serve four masters with four flags is how a component stops
 * being readable, so this is the plain version and that one stays specialised.
 *
 * ── The one real design decision ─────────────────────────────────────────
 * Typing is never a dead end. Every list here is a *suggestion* list, so a
 * value the doctor types and presses Enter on is accepted exactly like one
 * they tapped. That is not a fallback: a practitioner who consults in a
 * language we did not think of, or is known for something nobody has a name
 * for yet, is precisely the practitioner worth listing accurately.
 *
 * Values reach the server as repeated hidden inputs, which formToObject()
 * collapses into an array — the same contract ChipMultiSelect uses, so the
 * actions accept either shape without a special case.
 */

export interface TagOption {
  value: string;
  /** A second string that also matches the search, e.g. an endonym. */
  alias?: string;
  /** Shown in grey beside the value. */
  note?: string;
}

export default function TagPicker({
  name,
  label,
  hint,
  placeholder = "Search, or type your own and press Enter",
  defaultSelected,
  options,
  /** Offered as one-tap chips before anybody searches. */
  common = [],
  max = 25,
  emptyNote,
  required,
}: {
  name: string;
  label: string;
  hint?: string;
  placeholder?: string;
  defaultSelected: string[];
  options: TagOption[];
  common?: string[];
  max?: number;
  /** Shown when nothing is selected. A nudge, not an error. */
  emptyNote?: string;
  /**
   * Makes the picker participate in form validation.
   *
   * Implemented with a hidden input that carries the selection's length,
   * because a set of dynamically-added hidden inputs cannot be `required` —
   * there is nothing present to be empty when the answer is "none".
   */
  required?: boolean;
}) {
  const id = useId();
  const [selected, setSelected] = useState<string[]>(defaultSelected);
  const [query, setQuery] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const has = (v: string) =>
    selected.some((s) => s.toLowerCase() === v.trim().toLowerCase());

  function add(raw: string) {
    const value = raw.trim().replace(/\s+/g, " ");
    if (!value || has(value)) return;
    if (selected.length >= max) {
      setNote(`That is the maximum of ${max}.`);
      return;
    }
    setSelected((s) => [...s, value]);
    setNote(null);
    setQuery("");
    inputRef.current?.focus();
  }

  const remove = (v: string) => setSelected((s) => s.filter((x) => x !== v));

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 1) return [];

    // Prefix matches first: somebody typing "ta" wants Tamil, not Catalan.
    const starts: TagOption[] = [];
    const contains: TagOption[] = [];
    for (const o of options) {
      if (has(o.value)) continue;
      const v = o.value.toLowerCase();
      const a = o.alias?.toLowerCase() ?? "";
      if (v.startsWith(q) || a.startsWith(q)) starts.push(o);
      else if (v.includes(q) || a.includes(q)) contains.push(o);
    }
    return [...starts, ...contains].slice(0, 10);
    // `selected` is read through has(); listing it keeps the results honest
    // as chips are added and removed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, options, selected]);

  const chips = common.filter((c) => !has(c)).slice(0, 12);
  const exactAlready = results.some(
    (r) => r.value.toLowerCase() === query.trim().toLowerCase()
  );

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-semibold text-ink"
      >
        {label}
        {required && <span className="text-brand-500"> *</span>}
      </label>
      {hint && <p className="mb-2.5 text-xs text-ink-muted">{hint}</p>}

      {/* What is actually submitted. */}
      {selected.map((s) => (
        <input key={s} type="hidden" name={name} value={s} />
      ))}
      {required && (
        // Empty string when nothing is picked, so `required` fails and the
        // shared validator reports it by this field's label like any other.
        <input
          type="text"
          name={`${name}__count`}
          required
          value={selected.length ? String(selected.length) : ""}
          readOnly
          tabIndex={-1}
          aria-hidden
          aria-label={label}
          className="sr-only"
          onChange={() => undefined}
        />
      )}

      {selected.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-1.5">
          {selected.map((s) => (
            <li key={s}>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 py-1 pl-3 pr-1.5 text-xs font-semibold text-brand-800 ring-1 ring-brand-200">
                {s}
                <button
                  type="button"
                  aria-label={`Remove ${s}`}
                  onClick={() => remove(s)}
                  className="grid h-5 w-5 place-items-center rounded-full text-brand-500 transition hover:bg-brand-100 hover:text-brand-900"
                >
                  ×
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <input
        id={id}
        ref={inputRef}
        value={query}
        autoComplete="off"
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            // Never let Enter submit the form from inside a picker — a doctor
            // adding their fourth language would send the whole step.
            e.preventDefault();
            add(results[0]?.value ?? query);
          }
          if (e.key === "Backspace" && !query && selected.length) {
            remove(selected[selected.length - 1]);
          }
        }}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
      />

      {query.trim().length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {results.map((r) => (
            <li key={r.value}>
              <button
                type="button"
                onClick={() => add(r.value)}
                className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 hover:ring-slate-300"
              >
                + {r.value}
                {r.note && (
                  <span className="ml-1.5 font-normal text-slate-400">
                    {r.note}
                  </span>
                )}
              </button>
            </li>
          ))}

          {/* The doctor's own wording, offered explicitly rather than left to
              them to discover that Enter works. */}
          {!exactAlready && !has(query) && (
            <li>
              <button
                type="button"
                onClick={() => add(query)}
                className="rounded-full bg-brand-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-700"
              >
                + Add &ldquo;{query.trim()}&rdquo;
              </button>
            </li>
          )}
        </ul>
      )}

      {chips.length > 0 && query.trim().length === 0 && (
        <div className="mt-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
            Common
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <li key={c}>
                <button
                  type="button"
                  onClick={() => add(c)}
                  className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 hover:ring-slate-300"
                >
                  + {c}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-2 text-xs text-ink-muted">
        {selected.length === 0
          ? (emptyNote ?? "Nothing selected yet.")
          : `${selected.length} selected${selected.length >= max ? " (maximum)" : ""}.`}
        {note ? ` ${note}` : ""}
      </p>
    </div>
  );
}
