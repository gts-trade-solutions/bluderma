import Link from "next/link";
import type { TreatmentDTO } from "@/lib/queries/types";
import SmartImage from "./SmartImage";

interface TreatmentCardProps {
  treatment: TreatmentDTO;
  /** Patient view uses friendlier framing. */
  audience?: "doctor" | "patient";
}

export default function TreatmentCard({
  treatment,
  audience = "doctor",
}: TreatmentCardProps) {
  return (
    <Link
      href={`/treatments/${treatment.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-black/[0.03] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_45px_-15px_rgba(16,42,71,0.28)]"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <SmartImage
          src={treatment.image}
          alt={treatment.name}
          sizes="(max-width: 768px) 100vw, 33vw"
          className="transition-transform duration-500 group-hover:scale-105"
        />
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-brand-700 backdrop-blur">
          {treatment.category}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-base font-bold text-ink transition-colors group-hover:text-brand-700">
          {treatment.name}
        </h3>
        <p className="mt-1.5 line-clamp-2 text-sm text-ink-muted">
          {audience === "patient" ? treatment.summary : treatment.tagline}
        </p>
        <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-teal-600">
          {audience === "patient" ? "Learn more" : "View treatment"}
          <svg
            viewBox="0 0 20 20"
            className="h-4 w-4 transition-transform group-hover:translate-x-1"
            fill="none"
          >
            <path
              d="m8 5 5 5-5 5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
    </Link>
  );
}
