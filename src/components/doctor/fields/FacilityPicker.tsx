"use client";

import { useMemo, useState } from "react";

import {
  ALL_FACILITIES,
  CATEGORY_LABEL,
  FACILITY_GROUPS,
  categoryOf,
} from "@/data/facilities";

/**
 * Everything the clinic has, tapped rather than typed.
 *
 * ── Why this is not a textarea any more ──────────────────────────────────
 * See the long note in src/data/facilities.ts. Briefly: a comma-separated box
 * got three items out of most practitioners, spelled six different ways, and
 * never once got the equipment list — which is the single most persuasive
 * thing an aesthetics clinic can put on its page and the one thing nobody
 * volunteers unprompted.
 *
 * ── The shape ────────────────────────────────────────────────────────────
 * Groups are collapsed by default except the first, because thirty equipment
 * chips opened on arrival buries the address fields underneath. A search box
 * cuts across all groups at once, which is how somebody who knows they have a
 * pico laser finds it without opening anything.
 *
 * Custom entries are first class. They submit identically and are stored with
 * a null category, which the clinic page renders under "Also here".
 */

export default function FacilityPicker({
  name,
  defaultSelected,
  max = 40,
}: {
  name: string;
  defaultSelected: string[];
  max?: number;
}) {
  const [selected, setSelected] = useState<string[]>(defaultSelected);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string[]>([FACILITY_GROUPS[0].category]);
  const [note, setNote] = useState<string | null>(null);

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
  }

  const toggle = (v: string) =>
    has(v) ? setSelected((s) => s.filter((x) => x.toLowerCase() !== v.toLowerCase())) : add(v);

  const remove = (v: string) => setSelected((s) => s.filter((x) => x !== v));

  const q = query.trim().toLowerCase();
  const matches = useMemo(
    () => (q.length < 2 ? [] : ALL_FACILITIES.filter((f) => f.toLowerCase().includes(q)).slice(0, 12)),
    [q]
  );
  const exactSuggested = ALL_FACILITIES.some((f) => f.toLowerCase() === q);

  // Custom entries, so they can be shown apart from the curated ones.
  const custom = selected.filter((s) => categoryOf(s) === null);

  return (
    <div>
      <p className="text-sm font-semibold text-slate-800">
        Facilities, services and equipment
      </p>
      <p className="mt-1 text-xs text-slate-500">
        Everything a client would want to know before they arrive, and
        everything you have in the building. The equipment list is the part
        people read hardest, so it is worth going through properly.
      </p>

      {/* What is submitted. */}
      {selected.map((s) => (
        <input key={s} type="hidden" name={name} value={s} />
      ))}

      {selected.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {selected.map((s) => {
            const cat = categoryOf(s);
            return (
              <li key={s}>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 py-1 pl-3 pr-1.5 text-xs font-semibold text-brand-800 ring-1 ring-brand-200">
                  {s}
                  {cat === null && (
                    <span className="text-[10px] font-bold uppercase text-brand-400">
                      yours
                    </span>
                  )}
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
            );
          })}
        </ul>
      )}

      {/* ── Search across every group ──────────────────────────────── */}
      <input
        value={query}
        autoComplete="off"
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add(matches[0] ?? query);
            setQuery("");
          }
        }}
        placeholder="Search — parking, laser, pharmacy, UPI…"
        className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
      />

      {q.length >= 2 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {matches.map((m) => (
            <li key={m}>
              <button
                type="button"
                onClick={() => {
                  toggle(m);
                  setQuery("");
                }}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition ${
                  has(m)
                    ? "bg-brand-600 text-white ring-brand-600"
                    : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
                }`}
              >
                {has(m) ? "✓" : "+"} {m}
              </button>
            </li>
          ))}
          {!exactSuggested && !has(query) && (
            <li>
              <button
                type="button"
                onClick={() => {
                  add(query);
                  setQuery("");
                }}
                className="rounded-full bg-brand-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-700"
              >
                + Add &ldquo;{query.trim()}&rdquo;
              </button>
            </li>
          )}
        </ul>
      )}

      {/* ── The groups ─────────────────────────────────────────────── */}
      <div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200">
        {FACILITY_GROUPS.map((g) => {
          const isOpen = open.includes(g.category);
          const count = g.items.filter(has).length;

          return (
            <div key={g.category}>
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() =>
                  setOpen((o) =>
                    o.includes(g.category)
                      ? o.filter((x) => x !== g.category)
                      : [...o, g.category]
                  )
                }
                className="flex w-full items-center gap-2 px-3.5 py-3 text-left transition hover:bg-slate-50"
              >
                <span
                  aria-hidden
                  className={`text-slate-400 transition-transform ${isOpen ? "rotate-90" : ""}`}
                >
                  ›
                </span>
                <span className="flex-1 text-sm font-bold text-slate-800">
                  {g.label}
                </span>
                {count > 0 && (
                  <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-bold text-brand-800">
                    {count}
                  </span>
                )}
              </button>

              {isOpen && (
                <div className="px-3.5 pb-4">
                  <p className="mb-2 text-xs text-slate-500">{g.hint}</p>
                  <ul className="flex flex-wrap gap-1.5">
                    {g.items.map((item) => (
                      <li key={item}>
                        <button
                          type="button"
                          aria-pressed={has(item)}
                          onClick={() => toggle(item)}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition ${
                            has(item)
                              ? "bg-brand-600 text-white ring-brand-600"
                              : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50 hover:ring-slate-300"
                          }`}
                        >
                          {has(item) ? "✓" : "+"} {item}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}

        {/* ── Anything we did not think of ─────────────────────────── */}
        <CustomRow onAdd={add} existing={custom} />
      </div>

      <p className="mt-2 text-xs text-slate-500">
        {selected.length === 0
          ? "Nothing selected yet. Even three or four helps a client choose."
          : `${selected.length} selected` +
            (custom.length ? `, ${custom.length} of them your own.` : ".")}
        {note ? ` ${note}` : ""}
      </p>
    </div>
  );
}

/**
 * The "we have something you have not listed" row.
 *
 * Deliberately a labelled section at the bottom of the groups rather than a
 * hint under the search box: a practitioner with an unusual piece of kit
 * needs to see that adding it is expected, not permitted.
 */
function CustomRow({
  onAdd,
  existing,
}: {
  onAdd: (v: string) => void;
  existing: string[];
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  return (
    <div className="px-3.5 py-3">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-sm font-bold text-brand-700 transition hover:underline"
        >
          + Add your own
          <span className="ml-1.5 font-normal text-slate-500">
            something we have not listed
            {existing.length > 0 ? ` (${existing.length} added)` : ""}
          </span>
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onAdd(value);
                setValue("");
              }
              if (e.key === "Escape") setOpen(false);
            }}
            placeholder="e.g. Rooftop recovery lounge"
            className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
          <button
            type="button"
            onClick={() => {
              onAdd(value);
              setValue("");
            }}
            disabled={!value.trim()}
            className="rounded-xl bg-brand-600 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}

export { CATEGORY_LABEL };
