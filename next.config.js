/**
 * The S3 bucket and CDN we serve our own imagery from, read from the same env
 * vars lib/storage.ts uses so the two cannot disagree.
 */
function ownImageHosts() {
  const hosts = [];
  if (process.env.S3_BUCKET && process.env.AWS_REGION) {
    hosts.push(`${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com`);
    hosts.push(`s3.${process.env.AWS_REGION}.amazonaws.com`);
  }
  if (process.env.CDN_BASE_URL) {
    try {
      hosts.push(new URL(process.env.CDN_BASE_URL).hostname);
    } catch {
      /* a malformed CDN_BASE_URL should not take the build down */
    }
  }
  return hosts.map((hostname) => ({ protocol: "https", hostname }));
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Lets a production build run while `next dev` holds .next — set
  // NEXT_DIST_DIR to a scratch folder instead of stopping the dev server.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Don't leak the framework version in a response header.
  poweredByHeader: false,
  images: {
    // Optimisation is ON as of 20 Aug 2026. It was off so the MVP could ship
    // without sharp, and the cost of that had grown: every photograph on a
    // photograph-heavy site was served at full size, in its original format,
    // at whatever dimensions the source happened to be. That is the largest
    // single drag on Largest Contentful Paint here, and LCP is a ranking
    // input, not just a nicety.
    //
    // THE CONSEQUENCE TO KNOW: with `unoptimized: true`, remotePatterns were
    // not enforced and any host worked. They are enforced now, so an image
    // from a host not listed below returns 400 rather than rendering. Every
    // host currently in the database is covered — 884 rows on our own S3
    // bucket and 9 on Pexels — and a new one has to be added here.
    formats: ["image/avif", "image/webp"],
    // A day. These are catalogue photographs that change when an admin
    // replaces them, not per-request content.
    minimumCacheTTL: 86_400,
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "plus.unsplash.com" },
      { protocol: "https", hostname: "images.pexels.com" },
      // Our own storage. This is the day the comment above was written for.
      ...ownImageHosts(),
    ],
  },
  async redirects() {
    // /patient was a page component calling redirect("/"). That leaves the
    // bouncing entry in browser history, so pressing Back lands on it and
    // bounces forward again — the user is stuck. A config redirect is issued
    // before any history entry exists.
    return [{ source: "/patient", destination: "/", permanent: true }];
  },
  async headers() {
    // Baseline security headers on every response. A full Content-Security-
    // Policy is intentionally deferred: the app uses styled-jsx and Next's
    // inline bootstrap scripts, so a correct CSP needs nonce plumbing and is a
    // fast-follow rather than something to half-apply here.
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            // Geolocation is allowed for our own origin only — the client hub
            // lets a visitor fetch their own location for the navbar pill.
            key: "Permissions-Policy",
            value: "geolocation=(self), microphone=(), payment=()",
          },
          {
            // Harmless over http; enforced by browsers only on https.
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
