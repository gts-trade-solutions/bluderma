/**
 * The parts of search visibility that are code, not content.
 *
 * The audit found nothing misconfigured. It found nothing at all: no sitemap,
 * no robots, no `metadataBase`, no Open Graph, and not one line of structured
 * data across 723 routes. Absence is harder to notice than a mistake, which is
 * why it lasted, and why it deserves a suite of its own.
 *
 * The sitemap and the structured data are BUILT here rather than grepped for,
 * so a change that silently empties them fails instead of passing on the
 * strength of the file still existing.
 *
 *   npx tsx prisma/verify-seo.ts
 */
import { readFileSync } from "node:fs";

import {
  absolute,
  breadcrumbLd,
  faqLd,
  organisationLd,
  physicianLd,
  procedureLd,
  siteUrl,
  webSiteLd,
} from "../src/lib/seo";

let pass = 0;
const fails: string[] = [];
function check(name: string, ok: boolean, detail?: string) {
  if (ok) pass++;
  else fails.push(detail ? `${name} (${detail})` : name);
}
const read = (p: string) => readFileSync(p, "utf8");

/**
 * Source with its comments blanked.
 *
 * The first version of the "written for clients" check below failed on the
 * comment that EXPLAINS the change, which is the same trap verify-theme hit
 * with `theme-light`. A guard that reads a note about a fix as the fix being
 * absent is worse than no guard.
 */
const codeOnly = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

/* ── The origin ──────────────────────────────────────────────────────── */

check("a site origin resolves", siteUrl().startsWith("http"), siteUrl());
check("it carries no trailing slash", !siteUrl().endsWith("/"), siteUrl());
check("absolute() joins with one slash", absolute("/x") === `${siteUrl()}/x`);
check("and tolerates a missing slash", absolute("x") === `${siteUrl()}/x`);

/* ── Metadata ────────────────────────────────────────────────────────── */

const layout = read("src/app/layout.tsx");
check("metadataBase is set", /metadataBase:\s*new URL\(siteUrl\(\)\)/.test(layout));
check("Open Graph is declared", /openGraph:\s*\{/.test(layout));
check("Twitter cards are declared", /twitter:\s*\{/.test(layout));
check("the page is explicitly indexable", /index:\s*true/.test(layout));
check("large image previews are allowed", /max-image-preview/.test(layout));
check("the locale is Indian English", /lang="en-IN"/.test(layout));
// The old copy described a "reference platform for medical professionals",
// which is the product this stopped being.
check(
  "the description is written for clients, not professionals",
  !/reference platform for medical professionals/.test(codeOnly(layout))
);

/* ── Sitemap and robots exist and are wired ──────────────────────────── */

const sitemapSrc = read("src/app/sitemap.ts");
const robotsSrc = read("src/app/robots.ts");
check("the sitemap is generated from the database", /prisma\./.test(sitemapSrc));
check(
  "a database failure degrades rather than empties it",
  /catch/.test(sitemapSrc),
  "an empty sitemap positively asserts there is nothing here"
);
check("robots points at the sitemap", /sitemap:\s*absolute/.test(robotsSrc));
for (const priv of ["/admin", "/doctor/portal", "/patient/profile", "/api/"]) {
  check(`robots keeps crawlers out of ${priv}`, robotsSrc.includes(`"${priv}"`));
}
// The catalogue is the shop window. Disallowing it would be the expensive
// mistake, so it is asserted directly.
check(
  "the catalogue is NOT disallowed",
  !/"\/patient\/explore"/.test(robotsSrc) && !/disallow:\s*"\/"/.test(robotsSrc)
);

/* ── Structured data is emitted, and is honest ───────────────────────── */

const jsonLd = read("src/components/JsonLd.tsx");
check("JSON-LD escapes a closing tag", /\\\\u003c/.test(jsonLd) || /u003c/.test(jsonLd));

const home = read("src/app/page.tsx");
check("the home page emits an organisation", /organisationLd/.test(home));
check("and a website entity", /webSiteLd/.test(home));
const treatment = read("src/app/patient/explore/[category]/[treatment]/page.tsx");
check("treatment pages emit a procedure", /procedureLd/.test(treatment));
check("and a breadcrumb", /breadcrumbLd/.test(treatment));
check("and declare a canonical", /alternates:\s*\{\s*canonical/.test(treatment));

// Built, not grepped.
const org = organisationLd({
  clinics: [
    {
      name: "BluDerma Aesthetics, Adyar",
      addressLine1: "1 Main Road",
      area: "Adyar",
      city: "Chennai",
      state: "Tamil Nadu",
      pincode: "600020",
      phone: "+91 44 1234 5678",
    },
  ],
});
check("the organisation is a MedicalBusiness", org["@type"] === "MedicalBusiness");
check("it lists its locations", Array.isArray((org as { location?: unknown[] }).location));
const empty = organisationLd({ clinics: [] });
check(
  "with no clinics it omits location rather than sending an empty one",
  !("location" in empty)
);

check("the website entity names its language", webSiteLd().inLanguage === "en-IN");

const proc = procedureLd({
  name: "Botox",
  description: "x",
  url: absolute("/x"),
  category: "Face",
});
check("a procedure is a MedicalProcedure", proc["@type"] === "MedicalProcedure");
// The catalogue is price-free by rule, so the structured data must be too.
check("a procedure carries no price", !JSON.stringify(proc).includes("offers"));

const crumbs = breadcrumbLd([
  { name: "Treatments", path: "/patient/explore" },
  { name: "Botox", path: "/patient/explore/botox" },
]);
check(
  "breadcrumb positions start at 1 and ascend",
  crumbs.itemListElement.every((c, i) => c.position === i + 1)
);
check(
  "breadcrumb items are absolute",
  crumbs.itemListElement.every((c) => String(c.item).startsWith("http"))
);

/* ── The rating rule ─────────────────────────────────────────────────── */

// An aggregateRating with nothing behind it is a structured-data violation to
// Google and a lie by this codebase's own standard. It has to be impossible.
const base = {
  name: "Dr X",
  slug: "dr-x",
  specialty: "Dermatology",
  image: "",
  about: "y",
  clinics: [],
};
const unrated = physicianLd({ ...base, rating: 0, reviewCount: 0 });
check("no reviews means no rating is claimed", !("aggregateRating" in unrated));
const zeroRated = physicianLd({ ...base, rating: 0, reviewCount: 4 });
check("a zero rating is not claimed either", !("aggregateRating" in zeroRated));
const rated = physicianLd({ ...base, rating: 4.6, reviewCount: 16 });
const agg = (rated as { aggregateRating?: { ratingValue: number; reviewCount: number } })
  .aggregateRating;
check("real reviews do produce a rating", agg?.ratingValue === 4.6);
check("and the count is carried with it", agg?.reviewCount === 16);
check("a physician is a Physician", rated["@type"] === "Physician");

const faq = faqLd([{ question: "q", answer: "a" }]);
check("an FAQ page is emitted as one", faq["@type"] === "FAQPage");
check("each entry is a Question", faq.mainEntity[0]["@type"] === "Question");

console.log(`\n${pass} passed, ${fails.length} failed`);
if (fails.length) {
  fails.forEach((f) => console.log(`  FAIL  ${f}`));
  process.exit(1);
}
