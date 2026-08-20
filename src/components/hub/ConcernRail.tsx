import Link from "next/link";

import type { HubConcern } from "@/data/hub";
import SmartImage from "@/components/SmartImage";
import Rail from "./Rail";

/** "What's bothering you?" — concern-first shortcuts into the categories. */
export default function ConcernRail({ concerns }: { concerns: HubConcern[] }) {
  return (
    <Rail ariaLabel="Skin concerns" bleed="column">
      {concerns.map((c) => (
        <Link
          key={c.slug}
          href={`/patient/explore/${c.category}?concern=${c.slug}`}
          className="group w-[8.5rem] shrink-0 snap-start sm:w-40"
        >
          <div className="relative aspect-square overflow-hidden rounded-2xl ring-1 ring-black/5">
            <SmartImage
              src={c.image}
              alt={c.label}
              sizes="180px"
              className="transition-transform duration-500 group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
            <div className="absolute inset-x-2.5 bottom-2.5">
              <p className="display-sm text-sm text-white">{c.label}</p>
              <p className="text-[10px] leading-tight text-white/70">{c.hint}</p>
            </div>
          </div>
        </Link>
      ))}
    </Rail>
  );
}
