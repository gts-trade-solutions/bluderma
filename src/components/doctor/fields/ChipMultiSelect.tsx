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
  /** Whether the full catalogue is open. See VISIBLE below. */
  const [showAll, setShowAll] = useState(false);
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
          // Was 8. A doctor who has already typed three letters has done the
          // narrowing; cutting their own search short is not help.
          .slice(0, 40)
      : [];

  const unpicked = suggestions.filter((s) => !has(s));
  /**
   * How many are offered before the list has to be opened.
   *
   * It was a hard `.slice(0, 15)` with no way past it, so on a catalogue of
   * 23 the last eight treatments existed only for somebody who guessed their
   * exact name. The screen said "Commonly offered" and looked complete, which
   * is the worst version of a truncated list: nothing tells you it is short.
   */
  const VISIBLE = 12;
  const shown = showAll ? unpicked : unpicked.slice(0, VISIBLE);

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
              <span className="inline-flex items-center gap-1.5 rounded-full bg-azure-50 py-1 pl-3 pr-1.5 text-xs font-semibold text-azure-800 ring-1 ring-azure-200">
                {s}
                <button
                  type="button"
                  aria-label={`Remove ${s}`}
                  onClick={() => remove(s)}
                  className="grid h-5 w-5 place-items-center rounded-full text-azure-600 transition hover:bg-azure-100 hover:text-azure-900"
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
        className="w-full rounded-xl border border-graphite-200 bg-white px-3.5 py-2.5 text-sm text-graphite-900 outline-none transition placeholder:text-graphite-500 focus:border-azure-400 focus:ring-2 focus:ring-azure-100"
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
                className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-graphite-700 ring-1 ring-graphite-200 transition hover:bg-graphite-50 hover:ring-graphite-300"
              >
                + {t}
              </button>
            </li>
          ))}
        </ul>
      )}

      {unpicked.length > 0 && q.length < 2 && (
        <div className="mt-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-graphite-500">
            {showAll ? `All ${unpicked.length} treatments` : "Commonly offered"}
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {shown.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => add(s)}
                  className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-graphite-700 ring-1 ring-graphite-200 transition hover:bg-graphite-50 hover:ring-graphite-300"
                >
                  + {s}
                </button>
              </li>
            ))}
          </ul>

          {unpicked.length > VISIBLE && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              aria-expanded={showAll}
              className="mt-2 text-xs font-bold text-azure-700 transition hover:underline"
            >
              {showAll
                ? "Show fewer"
                : `Show all ${unpicked.length} treatments`}
            </button>
          )}
        </div>
      )}

      {/* The long tail. Only offered when it can actually do something. */}
      {aiEnabled && (
        <div className="mt-4">
          {!describing ? (
            <button
              type="button"
              onClick={() => setDescribing(true)}
              className="text-xs font-bold text-azure-700 hover:underline"
            >
              Can&apos;t find it? Describe what you do →
            </button>
          ) : (
            <div className="rounded-xl bg-graphite-50 p-3.5 ring-1 ring-graphite-200">
              <label className="block text-xs font-semibold text-graphite-700">
                Describe it in your own words
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. I do microneedling with PRP for hair thinning"
                className="mt-1.5 w-full rounded-lg border border-graphite-200 bg-white px-3 py-2 text-sm text-graphite-900 outline-none focus:border-azure-400 focus:ring-2 focus:ring-azure-100"
              />
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  disabled={matching || description.trim().length < 3}
                  onClick={runMatch}
                  className="rounded-lg bg-azure-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-azure-700 disabled:opacity-50"
                >
                  {matching ? "Looking…" : "Find matches"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDescribing(false);
                    setMatched(null);
                  }}
                  className="text-xs font-semibold text-graphite-500 hover:text-graphite-800"
                >
                  Close
                </button>
              </div>

              <p ref={liveRef} aria-live="polite" className="sr-only" />

              {matched && (
                <div className="mt-3">
                  {matched.length === 0 ? (
                    <p className="text-xs text-graphite-600">
                      Nothing in our catalogue matched that. Type it into the
                      box above and press Enter. Your own wording is fine.
                    </p>
                  ) : (
                    <>
                      <p className="text-[11px] font-bold uppercase tracking-wide text-graphite-500">
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
                              className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-azure-800 ring-1 ring-azure-200 transition hover:bg-azure-50"
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
