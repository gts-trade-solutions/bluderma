"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The treatments a practitioner offers, as chips.
 *
 * Replaces a textarea that asked a doctor to type a list from memory. Three
 * ways in, in the order they help: tap a suggestion, type and pick from the
 * real catalogue, or describe it in a sentence and let the matcher find it.
 *
 * Every name offered here is a treatment the catalogue genuinely contains —
 * the suggestions come from the database and the AI matcher's answer is
 * intersected with that same vocabulary server-side. Free text stays allowed,
 * because a practitioner may legitimately offer something we do not list yet;
 * it is just never *suggested* by a machine.
 *
 * Values reach the server as repeated hidden inputs, which formToObject()
 * collapses into an array — so `services` arrives as string[] and the action
 * accepts either shape.
 */

const CAP = 40;

export default function ChipMultiSelect({
  name,
  label,
  hint,
  defaultSelected,
  suggestions,
  vocabulary,
  aiEnabled,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultSelected: string[];
  /** Shown before the doctor types anything. Real catalogue names. */
  suggestions: string[];
  /** The full catalogue, for the typeahead. */
  vocabulary: string[];
  aiEnabled: boolean;
}) {
  const [selected, setSelected] = useState<string[]>(defaultSelected);
  const [query, setQuery] = useState("");
  const [describing, setDescribing] = useState(false);
  const [description, setDescription] = useState("");
  const [matching, setMatching] = useState(false);
  const [matched, setMatched] = useState<string[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const liveRef = useRef<HTMLParagraphElement>(null);

  const has = (v: string) =>
    selected.some((s) => s.toLowerCase() === v.toLowerCase());

  const add = (v: string) => {
    const value = v.trim();
    if (!value) return;
    if (has(value)) return;
    if (selected.length >= CAP) {
      setNote(`That is the maximum of ${CAP}.`);
      return;
    }
    setSelected((s) => [...s, value]);
    setNote(null);
  };

  const remove = (v: string) =>
    setSelected((s) => s.filter((x) => x !== v));

  const q = query.trim().toLowerCase();
  const typeahead =
    q.length >= 2
      ? vocabulary
          .filter((v) => v.toLowerCase().includes(q) && !has(v))
          .slice(0, 8)
      : [];

  const unpicked = suggestions.filter((s) => !has(s)).slice(0, 15);

  useEffect(() => {
    if (matched && liveRef.current) {
      liveRef.current.textContent = matched.length
        ? `${matched.length} treatments found`
        : "No matches found";
    }
  }, [matched]);

  async function runMatch() {
    if (description.trim().length < 3) return;
    setMatching(true);
    setMatched(null);
    setNote(null);
    try {
      const res = await fetch("/api/doctor/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "match-treatments", query: description.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setNote("Could not look that up. Try the search box above.");
        return;
      }
      setMatched((data.matches as string[]).filter((m) => !has(m)));
    } catch {
      setNote("Could not look that up. Try the search box above.");
    } finally {
      setMatching(false);
    }
  }

  return (
    <div>
      <p className="mb-1.5 text-sm font-semibold text-ink">{label}</p>
      {hint && <p className="mb-2.5 text-xs text-ink-muted">{hint}</p>}

      {/* What is submitted. */}
      {selected.map((s) => (
        <input key={s} type="hidden" name={name} value={s} />
      ))}

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
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add(typeahead[0] ?? query);
            setQuery("");
          }
        }}
        placeholder="Search treatments, or type your own and press Enter"
        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
      />

      {typeahead.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {typeahead.map((t) => (
            <li key={t}>
              <button
                type="button"
                onClick={() => {
                  add(t);
                  setQuery("");
                }}
                className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 hover:ring-slate-300"
              >
                + {t}
              </button>
            </li>
          ))}
        </ul>
      )}

      {unpicked.length > 0 && q.length < 2 && (
        <div className="mt-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
            Commonly offered
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {unpicked.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => add(s)}
                  className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 hover:ring-slate-300"
                >
                  + {s}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* The long tail. Only offered when it can actually do something. */}
      {aiEnabled && (
        <div className="mt-4">
          {!describing ? (
            <button
              type="button"
              onClick={() => setDescribing(true)}
              className="text-xs font-bold text-brand-700 hover:underline"
            >
              Can&apos;t find it? Describe what you do →
            </button>
          ) : (
            <div className="rounded-xl bg-slate-50 p-3.5 ring-1 ring-slate-200">
              <label className="block text-xs font-semibold text-slate-700">
                Describe it in your own words
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. I do microneedling with PRP for hair thinning"
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  disabled={matching || description.trim().length < 3}
                  onClick={runMatch}
                  className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-700 disabled:opacity-50"
                >
                  {matching ? "Looking…" : "Find matches"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDescribing(false);
                    setMatched(null);
                  }}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                >
                  Close
                </button>
              </div>

              <p ref={liveRef} aria-live="polite" className="sr-only" />

              {matched && (
                <div className="mt-3">
                  {matched.length === 0 ? (
                    <p className="text-xs text-slate-600">
                      Nothing in our catalogue matched that. Type it into the
                      box above and press Enter — your own wording is fine.
                    </p>
                  ) : (
                    <>
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                        Did you mean
                      </p>
                      <ul className="mt-1.5 flex flex-wrap gap-1.5">
                        {matched.map((m) => (
                          <li key={m}>
                            <button
                              type="button"
                              onClick={() => {
                                add(m);
                                setMatched((x) => x?.filter((y) => y !== m) ?? null);
                              }}
                              className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-brand-800 ring-1 ring-brand-200 transition hover:bg-brand-50"
                            >
                              + {m}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <p className="mt-2 text-xs text-ink-muted">
        {selected.length} selected{selected.length >= CAP ? ` (maximum)` : ""}.
        {note ? ` ${note}` : ""}
      </p>
    </div>
  );
}
