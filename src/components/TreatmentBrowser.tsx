"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Treatment,
  TreatmentCategory,
  categoryOrder,
} from "@/data/treatments";
import TreatmentCard from "./TreatmentCard";

function slugify(cat: TreatmentCategory): string {
  return cat
    .toLowerCase()
    .replace(/[^a-z]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

interface TreatmentBrowserProps {
  treatments: Treatment[];
  audience?: "doctor" | "patient";
}

/**
 * A single, evenly-filled treatment grid with category filter pills — no
 * per-category row breaks, so every row stays full. Category tiles elsewhere
 * can deep-link via a `#cat-<slug>` hash to pre-select a filter.
 */
export default function TreatmentBrowser({
  treatments,
  audience = "doctor",
}: TreatmentBrowserProps) {
  const [active, setActive] = useState<TreatmentCategory | "all">("all");

  const present = useMemo(
    () => categoryOrder.filter((c) => treatments.some((t) => t.category === c)),
    [treatments]
  );

  // Pre-select from the URL hash (e.g. #cat-injectables) and react to changes.
  useEffect(() => {
    const apply = () => {
      const hash = window.location.hash.replace(/^#/, "");
      if (hash.startsWith("cat-")) {
        const slug = hash.slice(4);
        const match = present.find((c) => slugify(c) === slug);
        if (match) {
          setActive(match);
          document
            .getElementById("treatments")
            ?.scrollIntoView({ behavior: "smooth" });
        }
      }
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, [present]);

  const filtered =
    active === "all"
      ? treatments
      : treatments.filter((t) => t.category === active);

  return (
    <div>
      {/* Filter pills */}
      <div className="mb-8 flex flex-wrap gap-2">
        <Pill active={active === "all"} onClick={() => setActive("all")}>
          All treatments
          <Count n={treatments.length} active={active === "all"} />
        </Pill>
        {present.map((cat) => (
          <Pill key={cat} active={active === cat} onClick={() => setActive(cat)}>
            {cat}
            <Count
              n={treatments.filter((t) => t.category === cat).length}
              active={active === cat}
            />
          </Pill>
        ))}
      </div>

      {/* Evenly-filled grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((t) => (
          <TreatmentCard key={t.slug} treatment={t} audience={audience} />
        ))}
      </div>
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
        active
          ? "border-brand-600 bg-brand-600 text-white shadow-soft"
          : "border-brand-200 bg-white text-brand-700 hover:border-brand-400 hover:bg-brand-50"
      }`}
    >
      {children}
    </button>
  );
}

function Count({ n, active }: { n: number; active: boolean }) {
  return (
    <span
      className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
        active ? "bg-white/20 text-white" : "bg-brand-50 text-brand-600"
      }`}
    >
      {n}
    </span>
  );
}
