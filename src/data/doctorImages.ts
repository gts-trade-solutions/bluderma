/**
 * Photography for the practitioner side of the site.
 *
 * Separate from `hubImages.ts` on purpose. That pool is the client
 * experience — editorial beauty portraits and macro skin shots — and it was
 * curated for a person choosing a treatment. A doctor deciding whether to
 * list is a different reader who wants to see clinical rooms, equipment and
 * consultations. Reusing the client pool is what left the doctor page
 * illustrated with the same photographs the catalogue already shows, which
 * was the note: "that banner image is already [used]".
 *
 * ── Sourcing ─────────────────────────────────────────────────────────────
 * Pexels, whose licence allows commercial use with no attribution required.
 * `images.pexels.com` is already an allowed host in next.config.js and the
 * catalogue already serves rows from it, so nothing new is trusted here.
 *
 * Every id below was verified to return HTTP 200 before it was added. That
 * check is not optional: a wrong id fails silently to a broken image, and
 * SmartImage's fallback would quietly paint a gradient where a photograph
 * should be.
 *
 * The `w=1920` query is Pexels' own resize. Our optimiser runs on top of it
 * (AVIF, per-breakpoint widths), so this only caps what we pull over the
 * wire from them.
 */

const px = (id: number, w = 1920) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}`;

export const DOCTOR_IMG = {
  /** A consultation in a modern clinic. The recruitment banner. */
  heroConsultation: px(33637448),
  /** A specialist and a client reading a tablet together. */
  briefingTablet: px(7446684),
  /** A dermatologist mid-treatment. */
  treatmentRoom: px(32260065),
  /** A treatment session, wider framing. */
  treatmentWide: px(29648642),
  /** A client in consultation with a cosmetologist. */
  consultRoom: px(4586740),
  /** A doctor examining skin with a device. */
  examining: px(7446672),
} as const;
