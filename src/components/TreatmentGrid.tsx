import {
  Treatment,
  TreatmentCategory,
  categoryOrder,
} from "@/data/treatments";
import TreatmentCard from "./TreatmentCard";

interface TreatmentGridProps {
  treatments: Treatment[];
  audience?: "doctor" | "patient";
  grouped?: boolean;
}

export default function TreatmentGrid({
  treatments,
  audience = "doctor",
  grouped = false,
}: TreatmentGridProps) {
  if (!grouped) {
    return (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {treatments.map((t) => (
          <TreatmentCard key={t.slug} treatment={t} audience={audience} />
        ))}
      </div>
    );
  }

  const byCategory = categoryOrder
    .map((cat) => ({
      category: cat,
      items: treatments.filter((t) => t.category === cat),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-14">
      {byCategory.map((group) => (
        <div
          key={group.category}
          id={slugifyCategory(group.category)}
          className="scroll-mt-24"
        >
          <div className="mb-6 flex items-center gap-4">
            <h3 className="text-xl font-bold text-ink">{group.category}</h3>
            <span className="h-px flex-1 bg-slate-200" />
            <span className="chip">{group.items.length} treatments</span>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {group.items.map((t) => (
              <TreatmentCard key={t.slug} treatment={t} audience={audience} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function slugifyCategory(cat: TreatmentCategory): string {
  return cat.toLowerCase().replace(/[^a-z]+/g, "-").replace(/(^-|-$)/g, "");
}
