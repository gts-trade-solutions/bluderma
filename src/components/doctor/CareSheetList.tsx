"use client";

import { useState } from "react";

import { Tag } from "./portalUi";

/**
 * The pre- and post-treatment sheets this patient has been issued, in full.
 *
 * ── Why the whole thing, and not a timeline line ─────────────────────────
 * The history already says "you issued aftercare for a chemical peel". That
 * is a receipt, not a record: at the next visit the question is what the
 * patient was actually told — which product to stop, how long to stay out of
 * the sun, when to come back — and answering it meant re-issuing the sheet to
 * read it.
 *
 * So the content lands here as it was sent. The lists are snapshots taken at
 * issue (see AftercareSheet), so editing a template later never changes what
 * somebody was told, and this panel shows exactly the words they got.
 *
 * Collapsed by default. A patient two years into a course can have a dozen of
 * these, and the useful default is the list of headings with the newest one
 * open.
 */

export interface CareSheet {
  id: string;
  kind: "PRE" | "POST";
  procedure: string;
  /** Already formatted; the server owns date rendering. */
  issuedOn: string;
  procedureOn: string;
  reviewOn: string | null;
  arriveAt: string | null;
  acknowledged: boolean;
  intro: string;
  dos: string[];
  donts: string[];
  warnings: string[];
  doctorNotes: string | null;
}

export default function CareSheetList({ sheets }: { sheets: CareSheet[] }) {
  const [openId, setOpenId] = useState<string | null>(sheets[0]?.id ?? null);

  return (
    <ul className="divide-y divide-graphite-100">
      {sheets.map((s) => {
        const open = openId === s.id;
        return (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => setOpenId(open ? null : s.id)}
              aria-expanded={open}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-graphite-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-azure-500 sm:px-5"
            >
              <Tag tone={s.kind === "PRE" ? "brand" : "teal"}>
                {s.kind === "PRE" ? "Before" : "After"}
              </Tag>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-graphite-900">
                  {s.procedure}
                </span>
                <span className="block text-[11px] text-graphite-600">
                  Issued {s.issuedOn} · procedure {s.procedureOn}
                  {s.reviewOn ? ` · review ${s.reviewOn}` : ""}
                </span>
              </span>
              {/* Whether they said they had read it. Never inferred from a
                  page view — see the model. */}
              <span className="shrink-0">
                {s.acknowledged ? (
                  <Tag tone="teal">Read</Tag>
                ) : (
                  <Tag tone="amber">Not confirmed</Tag>
                )}
              </span>
              <span
                aria-hidden
                className={`shrink-0 text-graphite-500 transition-transform ${open ? "rotate-180" : ""}`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </span>
            </button>

            {open && (
              <div className="space-y-3 border-t border-graphite-100 bg-graphite-50/60 px-4 py-4 text-sm sm:px-5">
                {s.arriveAt && (
                  <p className="rounded-lg bg-white px-3 py-2 text-[13px] font-semibold text-graphite-800 ring-1 ring-graphite-200">
                    Asked to arrive at {s.arriveAt}
                  </p>
                )}
                {s.intro && (
                  <p className="leading-relaxed text-graphite-700">{s.intro}</p>
                )}

                {/* The doctor's own words first when there are any: they are
                    the part written for this person, and the standard lists
                    are the part everybody gets. */}
                {s.doctorNotes && (
                  <div className="rounded-lg border-l-4 border-l-gold-500 bg-white px-3 py-2.5 ring-1 ring-graphite-200">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-graphite-500">
                      What you added for them
                    </p>
                    <p className="mt-1 whitespace-pre-line leading-relaxed text-graphite-800">
                      {s.doctorNotes}
                    </p>
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-3">
                  <Column title="Do" tone="mint" items={s.dos} />
                  <Column title="Do not" tone="coral" items={s.donts} />
                  <Column title="Call us if" tone="gold" items={s.warnings} />
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Column({
  title,
  tone,
  items,
}: {
  title: string;
  tone: "mint" | "coral" | "gold";
  items: string[];
}) {
  if (items.length === 0) return null;
  const bar = {
    mint: "bg-mint-500",
    coral: "bg-coral-500",
    gold: "bg-gold-500",
  }[tone];
  return (
    <div className="rounded-lg bg-white p-3 ring-1 ring-graphite-200">
      <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-graphite-600">
        <span aria-hidden className={`h-2.5 w-2.5 rounded-sm ${bar}`} />
        {title}
      </p>
      <ul className="mt-1.5 space-y-1">
        {items.map((t, i) => (
          <li key={i} className="text-[13px] leading-relaxed text-graphite-800">
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}
