import { GalleryStatus } from "@prisma/client";

/**
 * Whether a gallery case may be served publicly, right now.
 *
 * Lives outside the actions module because a "use server" file may only export
 * async functions, and this has to be callable synchronously from a route and
 * from a verification script alike.
 *
 * ONE answer to the question, deliberately. The rule is checked by the image
 * route on every request, by the public page's query, and by the publish
 * action; three separate spellings of it would eventually disagree, and the
 * disagreement would be a photograph of somebody's face still resolving after
 * they asked for it to come down.
 */
export function isViewable(c: {
  status: GalleryStatus;
  consentGivenAt: Date | null;
  consentWithdrawnAt: Date | null;
}): boolean {
  return (
    c.status === GalleryStatus.PUBLISHED &&
    c.consentGivenAt !== null &&
    c.consentWithdrawnAt === null
  );
}
