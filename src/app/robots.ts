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
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
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
        ],
      },
    ],
    sitemap: absolute("/sitemap.xml"),
    host: absolute("/"),
  };
}
