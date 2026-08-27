import type { MetadataRoute } from "next";

import { absolute } from "@/lib/seo";

/**
 * What a crawler may read, and where the map is.
 *
 * The disallow list is not security. Every path below is already enforced by
 * middleware and by `robots: { index: false }` on the pages themselves; this
 * exists so a crawler does not spend its budget on a login wall it will be
 * bounced from, and so those URLs stay out of the index in the first place.
 *
 * Everything else is open on purpose. The catalogue is the product's shop
 * window, and a treatment page that cannot be found is a treatment nobody
 * books.
 */
/**
 * The paths no crawler should spend budget on. One list, applied to every
 * agent below, so a rule added for humans cannot be forgotten for machines.
 */
const PRIVATE_PATHS = [
  "/api/",
  "/admin",
  "/doctor/portal",
  "/doctor/join",
  "/patient/profile",
  "/patient/appointments",
  "/patient/book/",
  "/patient/skin-analysis/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/forbidden",
];

/**
 * The assistants, named rather than left to the wildcard.
 *
 * A growing share of the people who will ever read this site will read it
 * through one of these instead of visiting. Being absent from that answer is
 * the same as being absent from a search result, so they are allowed
 * deliberately — but they are LISTED, for two reasons.
 *
 * First, a wildcard allow is silence, and silence is a decision nobody made.
 * Naming them makes it a decision somebody can revisit.
 *
 * Second, the same private paths apply. An assistant that reads a doctor's
 * portal or a patient's appointment list and then repeats it to somebody else
 * is a disclosure, not a crawl, and the wildcard's disallow list only ever
 * applied to agents that honour the wildcard.
 *
 * Google-Extended is a separate control from Googlebot: it governs AI
 * training and AI Overviews WITHOUT affecting normal search ranking, so
 * blocking it costs nothing in search and only removes us from the answers.
 */
const ASSISTANTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "Bingbot",
  "CCBot",
  "meta-externalagent",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: PRIVATE_PATHS,
      },
      // Same access, same exclusions, said out loud. See ASSISTANTS above.
      ...ASSISTANTS.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: PRIVATE_PATHS,
      })),
    ],
    // Only the XML one. /llms.txt is served and is found at its well-known
    // path; listing it HERE would have Search Console fetch it expecting XML
    // and report a parse error forever, which is a real cost for no gain.
    sitemap: absolute("/sitemap.xml"),
    host: absolute("/"),
  };
}
