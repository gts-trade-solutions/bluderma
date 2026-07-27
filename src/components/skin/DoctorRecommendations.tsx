export type RecommendedDoctor = {
  slug: string;
  name: string;
  title: string | null;
  specialty: string | null;
  clinic: string | null;
  location: string | null;
  image: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
};

function initials(name: string): string {
  const parts = name.replace(/^(dr\.?|clinic)\s+/i, "").trim().split(/\s+/);
  return (
    (parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")
  ).toUpperCase();
}

/** Whether an image URL is a real photo (imported clinics have no DP). */
function hasPhoto(url: string | null): url is string {
  return !!url && /^https?:\/\//.test(url) && !url.includes("/brand/");
}

/**
 * Lists clinics/doctors a client can reach out to after a scan. Not concern-
 * matched — every active doctor is shown. Falls back to an initials avatar for
 * contacts imported without a photo.
 */
export default function DoctorRecommendations({
  doctors,
}: {
  doctors: RecommendedDoctor[];
}) {
  if (doctors.length === 0) return null;

  return (
    <div>
      <h2 className="mb-1 text-lg font-bold text-ink">
        Talk to a BluDerma clinic
      </h2>
      <p className="mb-4 text-sm text-ink-muted">
        Share these results with a clinic to discuss tailored treatment options.
      </p>
      {/* Mobile: horizontal slider (less scroll). Desktop: 2-col grid. */}
      <ul className="flex snap-x gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0">
        {doctors.map((d) => (
          <li
            key={d.slug}
            className="flex w-[82%] shrink-0 snap-start items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:w-auto"
          >
            {hasPhoto(d.image) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={d.image}
                alt={d.name}
                className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-slate-200"
              />
            ) : (
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-700 ring-1 ring-brand-100">
                {initials(d.name) || "BD"}
              </span>
            )}
            <div className="min-w-0">
              <div className="truncate font-semibold text-ink">{d.name}</div>
              <div className="truncate text-xs text-ink-muted">
                {[d.specialty || d.title, d.location].filter(Boolean).join(" · ")}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                {d.phone && (
                  <a
                    href={`tel:${d.phone.replace(/\s+/g, "")}`}
                    className="font-medium text-brand-600 hover:text-brand-700"
                  >
                    {d.phone}
                  </a>
                )}
                {d.email && (
                  <a
                    href={`mailto:${d.email}`}
                    className="truncate font-medium text-brand-600 hover:text-brand-700"
                  >
                    {d.email}
                  </a>
                )}
                {d.website && (
                  <a
                    href={d.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-brand-600 hover:text-brand-700"
                  >
                    Website
                  </a>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
