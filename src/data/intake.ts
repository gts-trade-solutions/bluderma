import { IMG } from "./hubImages";

/**
 * The skin consultation quiz.
 *
 * Structured step for step on the Curology sign-up flow the client asked us
 * to follow: goals → about you → your skin → proof → sex at birth → skincare
 * history → health history → anything else → finish. Ten screens, one
 * question set each, a progress bar across the top and a fixed action bar at
 * the bottom.
 *
 * Two screens carry no questions on purpose. `proof` sits at the halfway
 * point to show results and reviews — a breather that reassures at exactly
 * the moment people abandon a form — and `finish` closes it out. Both are in
 * the reference and both earn their place.
 *
 * Everything here is content. The flow renders whatever is in STEPS, so the
 * client can reword, reorder, add or drop a screen without touching a
 * component.
 */

export type FieldKind = "text" | "choice" | "segmented" | "textarea";

export interface IntakeField {
  id: string;
  label: string;
  kind: FieldKind;
  placeholder?: string;
  options?: string[];
  required?: boolean;
}

export interface GoalOption {
  id: string;
  label: string;
  image: string;
}

export interface GoalGroup {
  title: string;
  sub: string;
  options: GoalOption[];
}

export type StepKind =
  | "goals"
  | "questions"
  | "proof"
  | "note"
  | "finish";

export interface IntakeStep {
  id: string;
  kind: StepKind;
  /** The "STEP n" badge. Omitted on screens that ask nothing. */
  step?: number;
  title: string;
  sub?: string;
  /** Header photograph. `overlay` sets the title over it. */
  image?: string;
  overlay?: boolean;
  groups?: GoalGroup[];
  fields?: IntakeField[];
  /** The "Why we ask" panel. */
  why?: string;
  /** Shows "Skip" instead of "Next". */
  skippable?: boolean;
}

export const STEPS: IntakeStep[] = [
  // ── 1 ─────────────────────────────────────────────────────────────────
  {
    id: "skin-goals",
    kind: "goals",
    step: 1,
    title: "What results matter most?",
    image: IMG.portraitGlow,
    overlay: true,
    groups: [
      {
        title: "Face",
        sub: "Select all that apply.",
        options: [
          { id: "clear-acne", label: "Clear acne", image: IMG.acne1 },
          { id: "clogged-pores", label: "Treat clogged pores", image: IMG.portraitMacro },
          { id: "dark-spots", label: "Fade dark spots", image: IMG.acne2 },
          { id: "oiliness", label: "Reduce oiliness", image: IMG.portraitSerum },
          { id: "redness", label: "Treat redness or rosacea", image: IMG.acne3 },
          { id: "wrinkles", label: "Fight wrinkles or fine lines", image: IMG.portraitCream },
          { id: "texture", label: "Smooth skin texture", image: IMG.procMicro },
          { id: "firmness", label: "Improve firmness", image: IMG.portraitStudio },
          { id: "dark-circles", label: "Brighten dark circles", image: IMG.eye1 },
          { id: "melasma", label: "Even out melasma", image: IMG.portraitTexture },
        ],
      },
      {
        title: "Body",
        sub: "Select all that apply.",
        options: [
          { id: "body-acne", label: "Clear body acne", image: IMG.body5 },
          { id: "bumpy-skin", label: "Smooth bumpy skin on body", image: IMG.body6 },
          { id: "body-spots", label: "Fade dark spots on body", image: IMG.body1 },
          { id: "unwanted-hair", label: "Remove unwanted hair", image: IMG.lhr1 },
        ],
      },
    ],
  },

  // ── 2 ─────────────────────────────────────────────────────────────────
  {
    id: "about-you",
    kind: "questions",
    step: 2,
    title: "About you",
    fields: [
      {
        id: "name",
        label: "What name do you prefer?",
        kind: "text",
        placeholder: "Enter your name",
        required: true,
      },
      {
        id: "age",
        label: "How old are you?",
        kind: "choice",
        options: ["13 to 17", "18 to 24", "25 to 34", "35 to 49", "50+"],
        required: true,
      },
    ],
    why: "Your skin changes over time. We'll tailor your experience with personalised recommendations to fit every stage of life.",
  },

  // ── 3 ─────────────────────────────────────────────────────────────────
  {
    id: "your-skin",
    kind: "questions",
    step: 3,
    title: "Tell us about your skin",
    sub: "Consider how your skin feels right after cleansing.",
    image: IMG.portraitSmile,
    fields: [
      {
        id: "skinType",
        label: "What's your skin type?",
        kind: "choice",
        options: ["Oily", "Dry", "Combination", "Not sure"],
        required: true,
      },
      {
        id: "sensitive",
        label: "Is your skin sensitive or easily irritated?",
        kind: "segmented",
        options: ["Yes", "No", "Not sure"],
        required: true,
      },
    ],
    why: "Your skin type helps us personalise recommendations, and helps your doctor select the right ingredients and the right strength for you, to minimise irritation.",
  },

  // ── 4 ─────────────────────────────────────────────────────────────────
  {
    id: "proven-results",
    kind: "proof",
    title: "You're on the way to healthier skin",
    sub: "Proven results",
  },

  // ── 5 ─────────────────────────────────────────────────────────────────
  {
    id: "sex-at-birth",
    kind: "questions",
    step: 4,
    title: "What is your assigned sex at birth?",
    fields: [
      {
        id: "sexAtBirth",
        label: "",
        kind: "choice",
        options: ["Female", "Male"],
        required: true,
      },
    ],
    why: "Hormones can have a significant impact on your skin. You'll have a chance to tell your doctor about any hormone therapy, medications or other personal information later, so we can provide safe, relevant care.",
  },

  // ── 6 ─────────────────────────────────────────────────────────────────
  {
    id: "skincare-history",
    kind: "questions",
    step: 5,
    title: "Let's review your skincare history",
    sub: "Adding a prescription to your routine can make it considerably more effective.",
    image: IMG.clinic2,
    overlay: true,
    fields: [
      {
        id: "usedPrescription",
        label: "Have you ever used prescription medication for your skin?",
        kind: "segmented",
        options: ["Yes", "No"],
        required: true,
      },
      {
        id: "hadProcedure",
        label: "Have you had a clinic procedure before?",
        kind: "segmented",
        options: ["Yes", "No"],
        required: true,
      },
    ],
    why: "Your history helps your doctor understand what has worked and what hasn't, so they can put together a more effective plan.",
  },

  // ── 7 ─────────────────────────────────────────────────────────────────
  {
    id: "health-history",
    kind: "questions",
    step: 6,
    title: "Tell us about your health",
    sub: "We keep your medical history private and use it only to personalise your treatment plan.",
    fields: [
      {
        id: "allergies",
        label: "Do you have any allergies?",
        kind: "segmented",
        options: ["Yes", "No"],
        required: true,
      },
      {
        id: "medications",
        label: "Do you take any medications or supplements?",
        kind: "segmented",
        options: ["Yes", "No"],
        required: true,
      },
      {
        id: "conditions",
        label: "Do you have any medical conditions or past surgeries?",
        kind: "segmented",
        options: ["Yes", "No"],
        required: true,
      },
      {
        id: "pregnancy",
        label: "Are you pregnant, planning or breastfeeding?",
        kind: "choice",
        options: ["No", "Pregnant", "Planning", "Breastfeeding", "Prefer not to say"],
      },
    ],
    why: "Your doctor needs to know your medical history in order to pick ingredients and treatments that are safe for you.",
  },

  // ── 8 ─────────────────────────────────────────────────────────────────
  {
    id: "more-info",
    kind: "note",
    step: 7,
    title: "Almost there. Anything else your doctor should know?",
    sub: "Interested in particular treatments or ingredients? Share your preferences, along with anything else that would help your doctor get to know you and your skin.",
    fields: [
      {
        id: "note",
        label: "Anything else your doctor should know?",
        kind: "textarea",
        placeholder: "Drop a note for your doctor.",
      },
    ],
    skippable: true,
  },

  // ── 9 ─────────────────────────────────────────────────────────────────
  {
    id: "finish",
    kind: "finish",
    title: "Your plan is ready",
    sub: "Connect with a doctor who'll review your goals and history.",
  },
];

/** The landing screen, before the quiz starts. */
export const INTAKE_LANDING = {
  title: "Get your personalised skincare in 3 minutes or less",
  sub: "Answer a few questions about your skin and your health. At the end you'll see the doctors who match, what they charge and when they're free.",
  cta: "Get started",
  points: [
    "About 3 minutes",
    "Your answers save as you go",
    "No card needed",
  ],
};

export const INTAKE_STORAGE_KEY = "bluderma-intake-v2";

/** Terms shown before the questionnaire is submitted (C-39, practo pattern). */
export const INTAKE_TERMS = [
  "The information you share here is used to match you with a doctor and to prepare for your consultation. It is not a diagnosis.",
  "Advice given online is limited by what a doctor can see on a screen. Anything that needs an examination will be moved to a clinic visit.",
  "Consultation fees are payable to the doctor and are shown before you confirm. Treatment costs are quoted only after an assessment.",
  "Appointments can be rescheduled or cancelled up to 4 hours before the slot.",
  "In an emergency, do not wait for an online consultation, go to the nearest hospital.",
];

/*
 * INTAKE_REVIEWS was removed on 19 Aug 2026.
 *
 * It held three invented client testimonials, rendered on the proof screen
 * under "Real people, real proof" beside a hardcoded five-star rating
 * attributed to "clients across our clinics". None of those clients existed.
 *
 * The proof screen now reads /api/reviews/published — real reviews a client
 * left and an admin published — and renders nothing at all when there are
 * none. Do not add a fallback here; a fallback is the same fabrication with
 * extra steps.
 */
