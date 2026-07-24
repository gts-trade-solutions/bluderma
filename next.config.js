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
    ],
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
            key: "Permissions-Policy",
            value: "geolocation=(), microphone=(), payment=()",
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
