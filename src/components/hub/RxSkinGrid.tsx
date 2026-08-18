"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import {
  CONDITION_GROUPS,
  SKIN_CONDITIONS,
  type ConditionGroup,
} from "@/data/rxSkin";

/**
 * RX SKIN (C-31 … C-33). Conditions rather than treatments, filtered by
 * group, each revealing a one-line description on hover.
 *
 * Hover alone would hide the description from anyone on a touchscreen or a
 * keyboard, so the same panel opens on focus and on tap — the hover is the
 * shortcut, not the only way in.
 */
export default function RxSkinGrid({ limit }: { limit?: number }) {
  const [group, setGroup] = useState<ConditionGroup | "All">("All");
  const [openSlug, setOpenSlug] = useState<string | null>(null);

  const list = (
    group === "All"
      ? SKIN_CONDITIONS
      : SKIN_CONDITIONS.filter((c) => c.group === group)
  ).slice(0, limit);

  return (
    <div>
      {/* Group filter */}
      <div className="mb-5 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {(["All", ...CONDITION_GROUPS] as const).map((g) => {
          const on = group === g;
          return (
            <button
              key={g}
              onClick={() => setGroup(g)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                on
                  ? "bg-white text-[#070d1c]"
                  : "bg-white/[0.04] text-ink-soft ring-1 ring-white/10 hover:text-brand-200"
              }`}
            >
              {g}
            </button>
          );
        })}
      </div>

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {list.map((c) => {
          const open = openSlug === c.slug;
          return (
            <li
              key={c.slug}
              onMouseEnter={() => setOpenSlug(c.slug)}
              onMouseLeave={() => setOpenSlug((s) => (s === c.slug ? null : s))}
              className={`flex h-full flex-col rounded-2xl border bg-white/[0.04] p-4 transition ${
                open
                  ? "border-brand-300/40 shadow-soft"
                  : "border-white/10 hover:border-brand-300/50"
              }`}
            >
              <button
                onFocus={() => setOpenSlug(c.slug)}
                onClick={() => setOpenSlug(open ? null : c.slug)}
                aria-expanded={open}
                className="text-left"
              >
                <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-300">
                  {c.group}
                </span>
                <span className="mt-1 block text-sm font-bold text-ink">
                  {c.name}
                </span>
              </button>

              {/* The one-liner (C-33) */}
              <div
                className={`grid transition-all duration-200 ${
                  open ? "mt-2 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <p className="overflow-hidden text-xs leading-relaxed text-ink-muted">
                  {c.line}
                </p>
              </div>

              <Link
                href={`/patient/explore/${c.category}`}
                className="mt-auto inline-flex items-center gap-1 pt-3 text-xs font-semibold text-brand-200 hover:underline"
              >
                What treats it
                <ArrowRight className="h-3 w-3" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
