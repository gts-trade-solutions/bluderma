import { Prisma } from "@prisma/client";

/**
 * The clinic fields ClinicsStep renders.
 *
 * One definition, imported by both the onboarding wizard and the My practice
 * page, because they render the SAME component and had two hand-written copies
 * of this select. They had already drifted: the practice page's copy was
 * missing nothing yet, but every field added to the form meant remembering to
 * add it in two places, and forgetting is silent — the component receives
 * `undefined` and simply renders an empty input over a value that exists.
 */
export const CLINIC_LIST_SELECT = {
  orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
  select: {
    feeInr: true,
    isPrimary: true,
    clinic: {
      select: {
        id: true,
        name: true,
        addressLine1: true,
        addressLine2: true,
        area: true,
        landmark: true,
        city: true,
        state: true,
        pincode: true,
        lat: true,
        lng: true,
        phone: true,
        colorKey: true,
        photos: { select: { kind: true, url: true } },
        facilities: {
          orderBy: { sortOrder: "asc" },
          select: { name: true, category: true },
        },
        // How many practitioners hold hours here. Drives the shared-clinic
        // read-only rule in ClinicsStep and in saveClinicStep — above one, the
        // premises belong to more than one practice and only an admin edits
        // the shared fields.
        _count: { select: { doctors: true } },
      },
    },
  },
} satisfies Prisma.Doctor$clinicsArgs;
