import { cache } from "react";

import { prisma } from "@/lib/prisma";

/**
 * The navigation menu is built on the server and handed to the (client)
 * Navbar as a prop — it can't query the database itself.
 */

export interface NavLeaf {
  label: string;
  href: string;
}

export interface NavNode {
  label: string;
  href?: string;
  children?: NavLeaf[];
}

/** Category names grouped under each top-level menu entry. */
const MENU_GROUPS: { label: string; categories: string[] }[] = [
  { label: "Injectables", categories: ["Injectables"] },
  {
    label: "Skin Treatments",
    categories: ["Laser & Energy", "Peels & Resurfacing", "Skin Health"],
  },
  { label: "Lifting", categories: ["Lifting & Contouring"] },
  { label: "Hair", categories: ["Hair Restoration"] },
];

const getNavTreatments = cache(async () => {
  return prisma.treatment.findMany({
    where: { isPublished: true },
    orderBy: { sortOrder: "asc" },
    select: { slug: true, name: true, category: { select: { name: true } } },
  });
});

export const buildMenu = cache(
  async (
    hubPath: string,
    opts: { analyzerHref?: string } = {}
  ): Promise<NavNode[]> => {
    const treatments = await getNavTreatments();

    const leaves = (categories: string[]): NavLeaf[] =>
      treatments
        .filter((t) => categories.includes(t.category.name))
        .map((t) => ({ label: t.name, href: `/treatments/${t.slug}` }));

    const base: NavNode[] = [
      {
        label: "About",
        children: [
          { label: "Our Clinic", href: `${hubPath}#about` },
          { label: "Why BluDerma", href: `${hubPath}#why` },
          { label: "Directions & Contact", href: `${hubPath}#contact` },
        ],
      },
      // Groups with no published treatments are dropped rather than rendering
      // an empty dropdown.
      ...MENU_GROUPS.map((g) => ({
        label: g.label,
        children: leaves(g.categories),
      })).filter((g) => g.children.length > 0),
      { label: "Pricing", href: `${hubPath}#pricing` },
    ];

    if (opts.analyzerHref) {
      return [{ label: "Skin Analyzer", href: opts.analyzerHref }, ...base];
    }
    return base;
  }
);

export function buildPatientMenu(): NavNode[] {
  return [
    { label: "Skin Analyzer", href: "/patient/skin-analyzer" },
    { label: "My Appointments", href: "/patient/appointments" },
    { label: "My Profile", href: "/patient/profile" },
  ];
}
