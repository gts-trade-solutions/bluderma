import { treatments, TreatmentCategory } from "./treatments";

export interface NavLeaf {
  label: string;
  href: string;
}

export interface NavNode {
  label: string;
  href?: string;
  children?: NavLeaf[];
}

const bySlug = (slug: string) => `/treatments/${slug}`;

function leavesForCategories(cats: TreatmentCategory[]): NavLeaf[] {
  return treatments
    .filter((t) => cats.includes(t.category))
    .map((t) => ({ label: t.name, href: bySlug(t.slug) }));
}

/**
 * Reference-style category dropdown menu. `hubPath` is where the content
 * sections live so anchors resolve. `analyzerHref`, when set, prepends a
 * "Skin Analyzer" entry (patient experience).
 */
export function buildMenu(
  hubPath: string,
  opts: { analyzerHref?: string } = {}
): NavNode[] {
  const base: NavNode[] = [
    {
      label: "About",
      children: [
        { label: "Our Clinic", href: `${hubPath}#about` },
        { label: "Why BluDerma", href: `${hubPath}#why` },
        { label: "Directions & Contact", href: `${hubPath}#contact` },
      ],
    },
    {
      label: "Injectables",
      children: leavesForCategories(["Injectables"]),
    },
    {
      label: "Skin Treatments",
      children: leavesForCategories([
        "Laser & Energy",
        "Peels & Resurfacing",
        "Skin Health",
      ]),
    },
    {
      label: "Lifting",
      children: leavesForCategories(["Lifting & Contouring"]),
    },
    {
      label: "Hair",
      children: leavesForCategories(["Hair Restoration"]),
    },
    {
      label: "Pricing",
      href: `${hubPath}#pricing`,
    },
  ];

  if (opts.analyzerHref) {
    return [{ label: "Skin Analyzer", href: opts.analyzerHref }, ...base];
  }
  return base;
}

/**
 * Patient-only menu. Patients never see the clinical/treatment reference
 * navigation — just their own tools.
 */
export function buildPatientMenu(): NavNode[] {
  return [
    { label: "Skin Analyzer", href: "/patient/skin-analyzer" },
    { label: "My Appointments", href: "/patient/appointments" },
    { label: "My Profile", href: "/patient/profile" },
  ];
}

export interface CategoryTile {
  category: TreatmentCategory;
  anchor: string;
  blurb: string;
  image: string;
  count: number;
}

function anchorFor(cat: TreatmentCategory): string {
  return cat
    .toLowerCase()
    .replace(/[^a-z]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const blurbs: Record<TreatmentCategory, string> = {
  Injectables: "Skin boosters, anti-wrinkle and dermal fillers.",
  "Laser & Energy": "Laser toning and energy-based skin brightening.",
  "Lifting & Contouring": "Non-surgical lifting with threads and ultrasound.",
  "Peels & Resurfacing": "Peels, microneedling and scar resurfacing.",
  "Skin Health": "Pigmentation, acne, rosacea, melasma and anti-ageing.",
  "Hair Restoration": "Regenerative PRP therapy for thinning hair.",
};

/** One representative tile per category, using its first treatment's image. */
export function categoryTiles(): CategoryTile[] {
  const seen = new Map<TreatmentCategory, CategoryTile>();
  for (const t of treatments) {
    if (!seen.has(t.category)) {
      seen.set(t.category, {
        category: t.category,
        anchor: anchorFor(t.category),
        blurb: blurbs[t.category],
        image: t.image,
        count: 0,
      });
    }
    seen.get(t.category)!.count += 1;
  }
  return Array.from(seen.values());
}
