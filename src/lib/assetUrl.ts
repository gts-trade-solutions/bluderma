/**
 * Resolves a built-in image path to wherever that image is actually served.
 *
 * Most imagery is referenced by a row that already holds a full URL, but a
 * handful of paths are written into source — a hero background, the fallback
 * avatar pool. Those cannot be rewritten by a database migration, so they stay
 * written as local paths here and are translated at render time.
 *
 * With NEXT_PUBLIC_ASSET_BASE_URL set, `/images/x.png` resolves to
 * `<base>/site/images/x.png`, matching the key scheme in
 * prisma/rehost-local-images.ts. Unset, the path is returned untouched and the
 * file is served from `public/` exactly as before — so this is safe to ship
 * ahead of the environment variable, and a missing variable degrades to the
 * old behaviour rather than to a broken image.
 */
const BASE = process.env.NEXT_PUBLIC_ASSET_BASE_URL?.replace(/\/$/, "");

export function assetUrl(path: string): string {
  // Anything already absolute is somebody else's URL and is left alone.
  if (!BASE || !path.startsWith("/")) return path;
  if (!path.startsWith("/images/") && !path.startsWith("/videos/")) return path;
  return `${BASE}/site${path}`;
}
