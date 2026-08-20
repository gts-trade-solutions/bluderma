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
    // Unoptimized keeps the MVP dependency-free (no sharp) and works offline-friendly.
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "plus.unsplash.com" },
      { protocol: "https", hostname: "images.pexels.com" },
      // Our own storage. Listed even though `unoptimized` currently makes
      // remotePatterns moot, because the day optimisation is turned on is
      // exactly the day nobody will remember that every image now lives here.
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
