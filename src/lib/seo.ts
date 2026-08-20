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
