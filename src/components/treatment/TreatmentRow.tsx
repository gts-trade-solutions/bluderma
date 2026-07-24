import SmartImage from "@/components/SmartImage";

/**
 * One alternating content↔image row (the "zig-zag" layout). Text and an image
 * sit side by side and flip sides on alternate rows via `reverse`. Collapses to
 * a single column on mobile with the image on top.
 */
export default function TreatmentRow({
  eyebrow,
  title,
  image,
  imageAlt,
  reverse = false,
  children,
}: {
  eyebrow: string;
  title: string;
  image: string;
  imageAlt: string;
  reverse?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
      <div className={reverse ? "lg:order-2" : ""}>
        <p className="section-eyebrow">{eyebrow}</p>
        <h2 className="mt-2 text-2xl font-bold text-ink sm:text-3xl">{title}</h2>
        <div className="mt-5">{children}</div>
      </div>

      <div className={reverse ? "lg:order-1" : ""}>
        <div className="relative aspect-[4/3] overflow-hidden rounded-3xl shadow-card ring-1 ring-black/[0.04]">
          <SmartImage
            src={image}
            alt={imageAlt}
            sizes="(max-width: 1024px) 100vw, 45vw"
            className="transition-transform duration-700 hover:scale-[1.03]"
          />
        </div>
      </div>
    </div>
  );
}
