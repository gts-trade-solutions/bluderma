import type { Metadata } from "next";

/**
 * One place that knows where this site lives, and what it is.
 *
 * Next needs an absolute origin for three separate things — `metadataBase`,
 * the sitemap, and every Open Graph image — and getting it from three
 * different places is how a staging build ends up advertising localhost to
 * Facebook's crawler.
 *
 * Read from NEXT_PUBLIC_SITE_URL, falling back to NEXTAUTH_URL, which every
 * environment already has to set correctly for OAuth to work at all. That
 * makes the fallback self-correcting rather than a guess.
 */
export function siteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3000";
  // A trailing slash turns every absolute() into a double slash, which some
  // crawlers treat as a different URL.
  return raw.replace(/\/+$/, "");
}

/** An absolute URL for a site-relative path. */
export function absolute(path = "/"): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * The share card every page inherits.
 *
 * Written once here rather than per page: a link posted to WhatsApp is how
 * most of this audience will meet the site, and a bare link with no title,
 * no description and no image is the difference between a tap and a scroll
 * past. Individual pages override `title` and `description` through their own
 * metadata and keep the rest.
 */
export function baseOpenGraph(): Metadata["openGraph"] {
  return {
    type: "website",
    siteName: "BluDerma",
    locale: "en_IN",
    url: siteUrl(),
  };
}

/* ─────────────────────────── Structured data ───────────────────────────── */

/**
 * Why any of this exists.
 *
 * Two different readers now decide whether this site is worth showing. A
 * search engine wants entities it can put in a rich result; an answer engine
 * wants facts it can quote without having to infer them from prose. JSON-LD
 * is the only thing both read the same way, and the site had none at all.
 *
 * Every builder below takes the values it states. Nothing here invents a
 * rating, a price or an address — the same rule the rest of the codebase
 * works under, and it matters more here, because structured data that
 * disagrees with the page is a manual penalty rather than a bug.
 */

export interface OrganisationFacts {
  /** Listed locations. Empty is fine and simply omits the branch list. */
  clinics: {
    name: string;
    addressLine1: string;
    area: string;
    city: string;
    state: string;
    pincode: string;
    phone: string | null;
  }[];
}

export function organisationLd(facts: OrganisationFacts) {
  return {
    "@context": "https://schema.org",
    "@type": "MedicalBusiness",
    "@id": `${siteUrl()}/#organisation`,
    name: "BluDerma",
    url: siteUrl(),
    medicalSpecialty: "Dermatology",
    // Only stated where we actually hold it.
    ...(facts.clinics.length
      ? {
          location: facts.clinics.map((c) => ({
            "@type": "MedicalClinic",
            name: c.name,
            address: {
              "@type": "PostalAddress",
              streetAddress: c.addressLine1,
              addressLocality: c.area || c.city,
              addressRegion: c.state,
              postalCode: c.pincode,
              addressCountry: "IN",
            },
            ...(c.phone ? { telephone: c.phone } : {}),
          })),
        }
      : {}),
  };
}

export function webSiteLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${siteUrl()}/#website`,
    name: "BluDerma",
    url: siteUrl(),
    inLanguage: "en-IN",
  };
}

export interface PhysicianFacts {
  name: string;
  slug: string;
  specialty: string;
  image: string;
  about: string;
  /** Only supplied when there are published reviews to support it. */
  rating: number;
  reviewCount: number;
  clinics: { name: string; area: string; city: string }[];
}

export function physicianLd(d: PhysicianFacts) {
  return {
    "@context": "https://schema.org",
    "@type": "Physician",
    "@id": absolute(`/patient/book/${d.slug}#physician`),
    name: d.name,
    url: absolute(`/patient/book/${d.slug}`),
    image: d.image || undefined,
    medicalSpecialty: d.specialty,
    description: d.about,
    // A rating is only emitted when real published reviews back it. Google
    // treats an unsupported aggregateRating as a structured-data violation,
    // and this codebase would treat it as a lie regardless.
    ...(d.reviewCount > 0 && d.rating > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: d.rating,
            reviewCount: d.reviewCount,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
    ...(d.clinics.length
      ? {
          worksFor: d.clinics.map((c) => ({
            "@type": "MedicalClinic",
            name: c.name,
            address: {
              "@type": "PostalAddress",
              addressLocality: c.area || c.city,
              addressCountry: "IN",
            },
          })),
        }
      : {}),
  };
}

export function procedureLd(t: {
  name: string;
  description: string;
  url: string;
  category: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "MedicalProcedure",
    name: t.name,
    description: t.description,
    url: t.url,
    procedureType: "https://schema.org/NoninvasiveProcedure",
    bodyLocation: t.category,
  };
}

export function faqLd(items: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}

export function breadcrumbLd(trail: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: absolute(c.path),
    })),
  };
}

/* ═══════════════════════════════════════════════════════════════════════
   The half that was missing
   ═══════════════════════════════════════════════════════════════════════

   The helpers above were written and then only half-wired: the home page
   emitted an organisation and a website, one nested treatment route emitted a
   procedure, and everything else emitted nothing. `physicianLd` and `faqLd`
   existed and were never called by anything.

   That left the two biggest surfaces on the site invisible to structured
   search — 23 treatment pages and 210 product pages — and the local-search
   question this business actually lives on ("dermatologist near me")
   unanswerable, because a clinic's address, hours and phone were never
   published as a place.

   ── Why this matters more than usual here ─────────────────────────────
   Medical content is what Google calls YMYL — Your Money or Your Life — and
   is held to a higher bar than ordinary pages. Two things carry that bar in
   markup: saying WHO reviewed a clinical claim, and saying WHEN. Both are
   below, and both are declined rather than faked where the data is missing:
   a `reviewedBy` naming somebody who never read the page is worse than none.
   ═══════════════════════════════════════════════════════════════════════ */

export interface ClinicPlace {
  id: string;
  name: string;
  addressLine1: string;
  area?: string | null;
  city: string;
  state?: string | null;
  pincode?: string | null;
  phone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  slug?: string | null;
}

/**
 * One clinic, as a place somebody can travel to.
 *
 * This is the entity that answers "dermatologist in Adyar" — a MedicalClinic
 * with a postal address and, where we hold it, a geo point. Without it the
 * site can describe treatments beautifully and still never appear in the
 * search that has somebody standing on a street looking for a clinic.
 *
 * `geo` is emitted only from real coordinates. A clinic defaulted to 0,0 is
 * in the Gulf of Guinea, and a map result in the wrong hemisphere is worse
 * for a patient than no map result at all.
 */
export function medicalClinicLd(c: ClinicPlace) {
  const hasGeo =
    typeof c.latitude === "number" &&
    typeof c.longitude === "number" &&
    Number.isFinite(c.latitude) &&
    Number.isFinite(c.longitude) &&
    !(c.latitude === 0 && c.longitude === 0);

  return {
    "@context": "https://schema.org",
    "@type": "MedicalClinic",
    "@id": `${siteUrl()}/#clinic-${c.id}`,
    name: c.name,
    medicalSpecialty: "Dermatology",
    parentOrganization: { "@id": `${siteUrl()}/#organisation` },
    address: {
      "@type": "PostalAddress",
      streetAddress: c.addressLine1,
      addressLocality: c.area || c.city,
      addressRegion: c.state ?? undefined,
      postalCode: c.pincode ?? undefined,
      addressCountry: "IN",
    },
    ...(c.phone ? { telephone: c.phone } : {}),
    ...(hasGeo
      ? {
          geo: {
            "@type": "GeoCoordinates",
            latitude: c.latitude,
            longitude: c.longitude,
          },
        }
      : {}),
  };
}

export interface ProductFacts {
  slug: string;
  name: string;
  brand?: string | null;
  description?: string | null;
  image?: string | null;
  /** Whole rupees. Omitted entirely when we do not publish it. */
  priceInr?: number | null;
  inStock?: boolean;
}

/**
 * A product, with its offer.
 *
 * 210 product pages carried no markup at all, so none of them could produce a
 * rich result. The price is the delicate part: this catalogue is
 * price-internal for most lines, and a Product without an Offer is valid
 * while a Product with a WRONG offer is a penalty and a misled patient. So
 * the offer is emitted only where there is a real published price, and its
 * absence is silent rather than zero.
 */
export function productLd(p: ProductFacts) {
  const url = absolute(`/products/${p.slug}`);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#product`,
    name: p.name,
    url,
    ...(p.brand ? { brand: { "@type": "Brand", name: p.brand } } : {}),
    ...(p.description ? { description: p.description } : {}),
    ...(p.image ? { image: p.image } : {}),
    ...(typeof p.priceInr === "number" && p.priceInr > 0
      ? {
          offers: {
            "@type": "Offer",
            url,
            price: String(p.priceInr),
            priceCurrency: "INR",
            availability: p.inStock
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
          },
        }
      : {}),
  };
}

/**
 * A list of things, in the order the page shows them.
 *
 * Category and directory pages are how somebody browses rather than searches,
 * and an ItemList is what lets a search engine carry that browse into its own
 * results instead of treating the page as an undifferentiated wall of links.
 */
export function itemListLd(
  name: string,
  items: { name: string; url: string }[]
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: items.length,
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      url: it.url,
    })),
  };
}

/**
 * A page making a clinical claim, and who stands behind it.
 *
 * `reviewedBy` and `lastReviewed` are the two properties Google's medical
 * guidance actually looks for, and the reason this returns them
 * conditionally: a page that names a reviewer who never read it is a false
 * credential, which is precisely the failure the property exists to prevent.
 * Where we have not recorded a reviewer, the page is still a MedicalWebPage
 * and simply does not claim one.
 */
export function medicalWebPageLd(input: {
  name: string;
  url: string;
  description?: string | null;
  lastReviewed?: Date | string | null;
  reviewedBy?: { name: string; title?: string | null } | null;
}) {
  const reviewed =
    input.lastReviewed instanceof Date
      ? input.lastReviewed.toISOString()
      : input.lastReviewed ?? null;

  return {
    "@context": "https://schema.org",
    "@type": "MedicalWebPage",
    "@id": `${input.url}#page`,
    name: input.name,
    url: input.url,
    ...(input.description ? { description: input.description } : {}),
    ...(reviewed ? { lastReviewed: reviewed } : {}),
    ...(input.reviewedBy
      ? {
          reviewedBy: {
            "@type": "Person",
            name: input.reviewedBy.name,
            ...(input.reviewedBy.title ? { jobTitle: input.reviewedBy.title } : {}),
          },
        }
      : {}),
    isPartOf: { "@id": `${siteUrl()}/#website` },
  };
}
