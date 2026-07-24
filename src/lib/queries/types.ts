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
}

export interface CategoryDTO {
  slug: string;
  name: string;
  blurb: string | null;
  image: string | null;
  count: number;
}

export type ConsultModeDTO = "clinic" | "video";

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
  modes: ConsultModeDTO[];
  about: string;
  verified: boolean;
  general?: boolean;
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
  title: string | null;
  subtitle: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  mediaType: "IMAGE" | "VIDEO";
  mediaUrl: string;
  posterUrl: string | null;
}
