import SmartImage from "./SmartImage";
import type { TreatmentImageDTO } from "@/lib/queries/treatments";

const KIND_LABEL: Record<TreatmentImageDTO["kind"], string> = {
  HERO: "",
  BEFORE_AFTER: "Before & after",
  RESULT: "Results",
  HOW_IT_WORKS: "How it works",
  GALLERY: "Gallery",
};

/**
 * Renders a treatment's typed image slots (before/after, result, how-it-works,
 * gallery), grouped by kind. Renders nothing when there are no images, so the
 * page is unchanged until an admin adds them.
 */
export default function TreatmentImages({
  images,
  name,
}: {
  images: TreatmentImageDTO[];
  name: string;
}) {
  const shown = images.filter((i) => i.kind !== "HERO");
  if (shown.length === 0) return null;

  // Preserve the query's kind ordering while grouping.
  const order: TreatmentImageDTO["kind"][] = [];
  const groups = new Map<TreatmentImageDTO["kind"], TreatmentImageDTO[]>();
  for (const img of shown) {
    if (!groups.has(img.kind)) {
      groups.set(img.kind, []);
      order.push(img.kind);
    }
    groups.get(img.kind)!.push(img);
  }

  return (
    <div className="space-y-8">
      {order.map((kind) => {
        const items = groups.get(kind)!;
        return (
          <section key={kind}>
            <p className="section-eyebrow">{KIND_LABEL[kind]}</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {items.map((img, i) => (
                <figure
                  key={i}
                  className="overflow-hidden rounded-2xl bg-white shadow-soft ring-1 ring-black/[0.04]"
                >
                  <div className="relative aspect-[4/3]">
                    <SmartImage
                      src={img.url}
                      alt={img.caption ?? `${name} — ${KIND_LABEL[kind]}`}
                      sizes="(max-width: 768px) 100vw, 50vw"
                    />
                  </div>
                  {img.caption && (
                    <figcaption className="p-3 text-xs text-ink-muted">
                      {img.caption}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
