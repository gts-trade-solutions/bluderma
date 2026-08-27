/**
 * Read-model shapes returned by the query layer.
 *
 * These deliberately mirror the interfaces that used to live in src/data/*.ts
 * so the components rendering them didn't have to be rewritten when the source
 * moved to MySQL. The one intentional difference: `category` is a plain string
 * rather than a closed union, because categories are admin-editable now.
 */

export interface ProductSolutionDTO {
  name: string;
  descriptor: string;
}

export interface TreatmentDTO {
  slug: string;
  name: string;
  category: string;
  categorySlug: string;
  tagline: string;
  image: string;
  summary: string;
  concern: string;
  concernPoints: string[];
  howItWorks: string;
  procedureSteps: string[];
  benefits: string[];
  idealFor: string[];
  facts: {
    sessions: string;
    downtime: string;
    results: string;
    duration: string;
  };
  product: ProductSolutionDTO;
  seoTitle: string | null;
  seoDescription: string | null;
  /**
   * When this page's content last changed.
   *
   * Carried for `dateModified` and `lastReviewed` in the page's structured
   * data. Freshness is one of the few signals that separates two otherwise
   * equal medical pages, and an assistant deciding which source to cite has
   * very little else to go on.
   */
  updatedAt: Date;
}

export interface CategoryDTO {
  slug: string;
  name: string;
  blurb: string | null;
  image: string | null;
  count: number;
}

export type ConsultModeDTO = "clinic" | "video";

/**
 * One location a doctor practises at, as the booking UI needs it.
 *
 * The fee lives here rather than on the doctor because branches of the same
 * practice charge differently — and until the booking form sent a clinicId,
 * every booking silently landed at the primary clinic and was charged the
 * primary clinic's fee whatever the client thought they had picked.
 */
export interface DoctorClinicDTO {
  id: string;
  name: string;
  area: string;
  city: string;
  /** "Opposite the Krishna temple". How the address is actually given. */
  landmark: string | null;
  /** Null until the clinic has been pinned. Never assume 0,0. */
  lat: number | null;
  lng: number | null;
  feeInr: number;
  isPrimary: boolean;
}

/**
 * One published review, as a client reading a doctor's card sees it.
 *
 * Only the reviewer's first name and last initial. A full name against a
 * dermatology consultation is more than anybody agreed to publish — the same
 * rule /api/reviews/published already applies, restated here because this is
 * the second place it is shown and a rule with one enforcement point is a
 * rule that gets forgotten at the third.
 */
export interface DoctorReviewDTO {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  /** "Priya R." */
  author: string;
  /** ISO date. */
  at: string;
}

export interface DoctorDTO {
  /** The public handle — what used to be Doctor.id in the seed data. */
  id: string;
  name: string;
  title: string;
  specialty: string;
  focus: string[];
  rating: number;
  reviews: number;
  experienceYears: number;
  clinic: string;
  location: string;
  image: string;
  fee: number;
  languages: string[];
  services: string[];
  /**
   * What the practitioner is known FOR, as distinct from their qualification
   * (`specialty`) and from the procedures they perform (`services`).
   */
  specialtyAreas: string[];
  /**
   * Concerns they named themselves, because the catalogue has no row for
   * them. Shown on the profile; deliberately NOT part of `focus`, which is
   * what the analyzer matches on — see DoctorConcernOther.
   */
  otherFocus: string[];
  modes: ConsultModeDTO[];
  about: string;
  verified: boolean;
  general?: boolean;
  /** Every location this doctor consults at. Empty for a directory-only
   *  record that has not been migrated onto clinics yet. */
  clinics: DoctorClinicDTO[];
  /**
   * Published reviews of THIS doctor, newest first.
   *
   * `rating` and `reviews` above are the aggregate, recomputed from exactly
   * these rows by recomputeDoctorRating(). A patient choosing between two
   * practitioners is choosing on what people said, not on a number, and the
   * words were being kept on a site-wide testimonials strip where they could
   * not be attached to the doctor they were about.
   *
   * Empty until real clients have reviewed and an admin has published them.
   * Nothing falls back to anything: this codebase has already deleted one set
   * of invented testimonials.
   */
  reviewList: DoctorReviewDTO[];
}

export interface ConcernDTO {
  key: string;
  legacyKey: string | null;
  label: string;
  hint: string;
  description: string | null;
}

export interface TestimonialDTO {
  id: string;
  authorName: string;
  authorRole: string | null;
  avatarUrl: string | null;
  quote: string;
  rating: number | null;
}

export interface ContentBlockDTO {
  key: string;
  title: string | null;
  subtitle: string | null;
  body: string | null;
  image: string | null;
  icon: string | null;
}

export interface FaqDTO {
  id: string;
  question: string;
  answer: string;
  category: string | null;
}

export interface BannerDTO {
  id: string;
  eyebrow: string | null;
  title: string | null;
  /** Second title line, rendered with the brand gradient accent. */
  titleAccent: string | null;
  subtitle: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  mediaType: "IMAGE" | "VIDEO";
  /** Desktop artwork; tablet/mobile fall back to it when unset. */
  mediaUrl: string;
  mediaUrlTablet: string | null;
  mediaUrlMobile: string | null;
  posterUrl: string | null;
}
