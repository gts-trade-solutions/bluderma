import { IMG } from "./hubImages";

/**
 * Content catalogue for the client hub (`/patient/explore`).
 *
 * The shape follows the marketplace pattern used by unni.app — a broad
 * category grid, concern shortcuts, promotional rails and deal cards — with
 * the vocabulary widened using Curology's concern language and the service
 * lists a full-scope aesthetic clinic publishes.
 *
 * Two deliberate omissions, because BluDerma is enquiry-only:
 *  - no clinic names or locations on a treatment card
 *  - no prices anywhere; deals carry a discount badge and a perk instead
 *
 * This lives in code (not the database) so the hub can ship ahead of the
 * catalogue migration. `href` is set only where a published Treatment row
 * already exists, so those cards deep-link to the real page.
 */

export interface HubTreatment {
  slug: string;
  name: string;
  blurb: string;
  image: string;
  beforeImage?: string;
  afterImage?: string;
  beforeAfterCases?: {
    beforeImage: string;
    afterImage: string;
  }[];
  /** Session count / downtime style micro-facts. No pricing. */
  meta?: string;
}

export interface HubCategory {
  slug: string;
  name: string;
  /** Key into ICONS in components/hub/icons.tsx. */
  icon: string;
  /** Short line under the tile. */
  blurb: string;
  /** Longer intro shown on the category page. */
  intro: string;
  image: string;
  /** Tailwind gradient classes for the icon chip. */
  tint: string;
  treatments: HubTreatment[];
}

export interface HubConcern {
  slug: string;
  label: string;
  hint: string;
  image: string;
  /** Category to open when tapped. */
  category: string;
}

export interface HubDeal {
  slug: string;
  title: string;
  treatment: string;
  categorySlug: string;
  categoryLabel: string;
  image: string;
  /** Percentage off — the only number we show. No rupee amounts. */
  discount: number;
  perk: string;
  /** Social proof, matching the marketplace feel. */
  claimed: number;
  endsIn: string;
  hot?: boolean;
}

export interface HubPromo {
  slug: string;
  eyebrow: string;
  title: string;
  body: string;
  image: string;
  cta: string;
  href: string;
}

export interface BeforeAfterCase {
  slug: string;
  concern: string;
  treatment: string;
  categorySlug: string;
  sessions: string;
  timeframe: string;
  before: string;
  after: string;
  quote?: string;
  initials?: string;
  age?: string;
}

// ─────────────────────────────────────────────────────────────────────────
// Categories
// ─────────────────────────────────────────────────────────────────────────

export const HUB_CATEGORIES: HubCategory[] = [
  {
    slug: "glass-skin",
    name: "Glass Skin & Glow",
    icon: "sparkles",
    blurb: "Boosters, medi-facials, brightening",
    intro:
      "The hydration-first route to that lit-from-within finish — injectable boosters, medical facials and barrier repair, layered over weeks rather than forced in one sitting.",
    image: IMG.portraitGlow,
    tint: "from-sky-400/20 to-cyan-400/20 text-sky-200",
    treatments: [
      {
        slug: "skin-boosters",
        name: "Skin Boosters",
        blurb: "Micro-injected hyaluronic acid that rehydrates from within.",
        image: IMG.procInject3,
        meta: "3–4 sessions · no downtime",
      },
      {
        slug: "profhilo-bioremodelling",
        name: "Bio-Remodelling Therapy",
        blurb: "Slow-release HA that stimulates collagen and elastin together.",
        image: IMG.portraitDewy,
        meta: "2 sessions · 4 weeks apart",
      },
      {
        slug: "hydrafacial",
        name: "Medi-Facial (Hydra)",
        blurb: "Cleanse, extract and infuse in one 45-minute pass.",
        image: IMG.facial2,
        meta: "Monthly · zero downtime",
      },
      {
        slug: "glutathione-brightening",
        name: "Brightening Protocol",
        blurb: "Antioxidant-led course for uneven, tired-looking skin tone.",
        image: IMG.portraitTexture,
        meta: "6–8 sessions",
      },
      {
        slug: "exosome-therapy",
        name: "Exosome Therapy",
        blurb: "Next-gen regenerative signalling for barrier and glow.",
        image: IMG.procDerma,
        meta: "3 sessions",
      },
      {
        slug: "cosmeceuticals",
        name: "Doctor-Led Skincare",
        blurb: "A prescription-grade routine matched to your skin reading.",
        image: IMG.prod1,
        meta: "Daily at home",
      },
    ],
  },
  {
    slug: "lifting",
    name: "Lifting & Tightening",
    icon: "lift",
    blurb: "Threads, HIFU, RF microneedling",
    intro:
      "Non-surgical lift — energy devices and absorbable threads that tighten laxity along the jawline, cheeks and neck without a scalpel.",
    image: IMG.portraitStudio,
    tint: "from-violet-400/20 to-fuchsia-400/20 text-violet-200",
    treatments: [
      {
        slug: "thread-lift",
        name: "Thread Lift",
        blurb: "Absorbable PDO threads that reposition and hold soft tissue.",
        image: IMG.pairLiftA,
        meta: "1 session · 5–7 days social downtime",
      },
      {
        slug: "hifu-ultherapy",
        name: "HIFU Skin Tightening",
        blurb: "Focused ultrasound reaching the SMAS layer for a true lift.",
        image: IMG.procDevice,
        meta: "1–2 sessions · no downtime",
      },
      {
        slug: "rf-microneedling",
        name: "RF Microneedling",
        blurb: "Radiofrequency delivered at depth for firmness and texture.",
        image: IMG.procMicro,
        meta: "3–4 sessions",
      },
      {
        slug: "collagen-biostimulators",
        name: "Collagen Biostimulators",
        blurb: "Poly-L-lactic and CaHA stimulators that rebuild structure.",
        image: IMG.procInject2,
        meta: "2–3 sessions",
      },
      {
        slug: "neck-lift-nonsurgical",
        name: "Neck & Décolleté Lift",
        blurb: "Combined energy protocol for crepey neck and chest skin.",
        image: IMG.portraitSoft,
        meta: "3 sessions",
      },
      {
        slug: "jawline-definition",
        name: "Jawline Definition",
        blurb: "Lift plus contour so the lower face reads sharper.",
        image: IMG.portraitHero,
        meta: "1–2 sessions",
      },
    ],
  },
  {
    slug: "botox",
    name: "Botox & Anti-Wrinkle",
    icon: "syringe",
    blurb: "Lines, sweating, slimming",
    intro:
      "Botulinum toxin, dosed conservatively. Softens expression lines while keeping movement — and treats sweating, jaw clenching and a heavy masseter too.",
    image: IMG.procInject,
    tint: "from-blue-400/20 to-indigo-400/20 text-blue-200",
    treatments: [
      {
        slug: "botox",
        name: "Anti-Wrinkle (Forehead & Frown)",
        blurb: "The classic upper-face three: forehead, glabella and crow's feet.",
        image: IMG.procInject,
        meta: "Every 4–6 months",
      },
      {
        slug: "baby-botox",
        name: "Baby Botox",
        blurb: "Micro-dosing for prevention with a fully natural finish.",
        image: IMG.portraitGlow,
        meta: "Every 3–4 months",
      },
      {
        slug: "masseter-slimming",
        name: "Jaw Slimming (Masseter)",
        blurb: "Relaxes an overworked chewing muscle; softens a square jaw.",
        image: IMG.procInject3,
        meta: "2 sessions · 6 months apart",
      },
      {
        slug: "hyperhidrosis",
        name: "Underarm Sweat Control",
        blurb: "Targets overactive sweat glands for 6–9 dry months.",
        image: IMG.procPrep,
        meta: "1 session · lasts 6–9 months",
      },
      {
        slug: "gummy-smile",
        name: "Gummy Smile Correction",
        blurb: "A few precise units to lower a high smile line.",
        image: IMG.smile1,
        meta: "1 session",
      },
      {
        slug: "neck-bands",
        name: "Neck Band Softening",
        blurb: "Relaxes platysmal bands for a smoother neckline.",
        image: IMG.portraitDeep,
        meta: "1 session",
      },
    ],
  },
  {
    slug: "fillers",
    name: "Fillers & Volume",
    icon: "droplet",
    blurb: "Lips, cheeks, chin, under-eye",
    intro:
      "Hyaluronic acid placed to restore what time removed — never to add what was never there. Every filler used here is reversible.",
    image: IMG.procFiller,
    tint: "from-rose-400/20 to-pink-400/20 text-rose-300",
    treatments: [
      {
        slug: "dermal-fillers",
        name: "Dermal Fillers",
        blurb: "Structural HA for cheeks, temples and midface support.",
        image: IMG.procFiller,
        meta: "Lasts 9–18 months",
      },
      {
        slug: "lip-filler",
        name: "Lip Enhancement",
        blurb: "Definition and hydration, sized to your own proportions.",
        image: IMG.smile3,
        meta: "1 session · 2–3 days swelling",
      },
      {
        slug: "under-eye-filler",
        name: "Under-Eye (Tear Trough)",
        blurb: "Softens hollowing that makes you look permanently tired.",
        image: IMG.eye1,
        meta: "1 session · advanced technique",
      },
      {
        slug: "chin-jaw-filler",
        name: "Chin & Jaw Contour",
        blurb: "Projection and angle for a balanced profile.",
        image: IMG.portraitStudio,
        meta: "Lasts 12–18 months",
      },
      {
        slug: "nasolabial-fold",
        name: "Smile Line Softening",
        blurb: "Nasolabial and marionette folds, treated at the cause.",
        image: IMG.portraitSmile,
        meta: "1 session",
      },
      {
        slug: "filler-dissolving",
        name: "Filler Dissolving",
        blurb: "Hyaluronidase to reverse or reset previous work.",
        image: IMG.procPrep,
        meta: "1–2 sessions",
      },
    ],
  },
  {
    slug: "laser",
    name: "Laser & Energy",
    icon: "zap",
    blurb: "Toning, resurfacing, redness",
    intro:
      "Wavelength chosen for your concern and your skin tone. Indian and South-Asian skin needs conservative settings — that is the default here, not an option.",
    image: IMG.procLaserFace,
    tint: "from-amber-400/20 to-orange-400/20 text-amber-300",
    treatments: [
      {
        slug: "laser-toning",
        name: "Laser Toning",
        blurb: "Low-fluence Q-switched passes that even out overall tone.",
        image: IMG.procLaserFace,
        meta: "6–8 sessions",
      },
      {
        slug: "carbon-peel",
        name: "Carbon Laser Peel",
        blurb: "The 'Hollywood peel' — instant clarity before an event.",
        image: IMG.procPeel,
        meta: "Single session · no downtime",
      },
      {
        slug: "fractional-co2",
        name: "Fractional Resurfacing",
        blurb: "Controlled columns of injury that rebuild texture and scars.",
        image: IMG.procMicro,
        meta: "2–3 sessions · 5 days downtime",
      },
      {
        slug: "ipl-photofacial",
        name: "IPL Photofacial",
        blurb: "Broadband light for redness, flushing and sun freckling.",
        image: IMG.procFacial,
        meta: "3–5 sessions",
      },
      {
        slug: "pico-laser",
        name: "Pico Laser",
        blurb: "Picosecond pulses for stubborn pigment and tattoo removal.",
        image: IMG.portraitTexture,
        meta: "4–6 sessions",
      },
      {
        slug: "vascular-laser",
        name: "Vascular Laser",
        blurb: "Closes visible capillaries and spider veins on the face.",
        image: IMG.portraitMacro,
        meta: "1–3 sessions",
      },
    ],
  },
  {
    slug: "hair-removal",
    name: "Laser Hair Removal",
    icon: "scissors",
    blurb: "Face, body, full-package",
    intro:
      "Diode and Nd:YAG platforms selected by skin type, with cooling throughout. Course-based — hair only responds in its growth phase.",
    image: IMG.lhr1,
    tint: "from-teal-400/20 to-emerald-400/20 text-teal-200",
    treatments: [
      {
        slug: "lhr-full-face",
        name: "Full Face",
        blurb: "Upper lip, chin, cheeks and sideburn line in one sitting.",
        image: IMG.lhr3,
        meta: "6–8 sessions · 4 weeks apart",
      },
      {
        slug: "lhr-underarms",
        name: "Underarms",
        blurb: "Fast, high-satisfaction area — usually under ten minutes.",
        image: IMG.lhr1,
        meta: "6 sessions",
      },
      {
        slug: "lhr-full-legs",
        name: "Full Legs",
        blurb: "Thigh to ankle, front and back, with contact cooling.",
        image: IMG.lhr4,
        meta: "6–8 sessions",
      },
      {
        slug: "lhr-full-body",
        name: "Full Body Package",
        blurb: "Every standard area bundled into one managed course.",
        image: IMG.lhr2,
        meta: "8 sessions",
      },
      {
        slug: "lhr-bikini",
        name: "Bikini & Intimate",
        blurb: "Discreet, female-clinician-led sessions on request.",
        image: IMG.lhr5,
        meta: "6–8 sessions",
      },
      {
        slug: "lhr-mens-beard",
        name: "Beard Shaping (Men)",
        blurb: "Cleans the neckline and cheek line without daily shaving.",
        image: IMG.lhr6,
        meta: "6 sessions",
      },
    ],
  },
  {
    slug: "hair-restoration",
    name: "Hair Restoration",
    icon: "sprout",
    blurb: "PRP, GFC, transplant, hair fall",
    intro:
      "Hair loss is diagnosed before it is treated — bloodwork and trichoscopy first, then the regenerative or surgical route that actually fits the pattern.",
    image: IMG.hair1,
    tint: "from-lime-400/20 to-green-400/20 text-green-200",
    treatments: [
      {
        slug: "prp-hair",
        name: "PRP Hair Therapy",
        blurb: "Your own platelet concentrate injected into thinning zones.",
        image: IMG.hair3,
        meta: "6 sessions · monthly",
      },
      {
        slug: "gfc-therapy",
        name: "GFC Growth Factor",
        blurb: "Concentrated growth factors — a step beyond standard PRP.",
        image: IMG.hair4,
        meta: "4–6 sessions",
      },
      {
        slug: "hair-mesotherapy",
        name: "Scalp Mesotherapy",
        blurb: "Micro-infusion of vitamins and peptides into the scalp.",
        image: IMG.hair6,
        meta: "8 sessions",
      },
      {
        slug: "hair-transplant-fue",
        name: "FUE Hair Transplant",
        blurb: "Follicular unit extraction for permanent density.",
        image: IMG.hair2,
        meta: "1 procedure · 12-month result",
      },
      {
        slug: "hairline-design",
        name: "Hairline Design",
        blurb: "Planning the frame of the face before any graft is placed.",
        image: IMG.hair5,
        meta: "Consultation-led",
      },
      {
        slug: "hair-fall-workup",
        name: "Hair Fall Diagnostics",
        blurb: "Bloods, trichoscopy and a written cause-first plan.",
        image: IMG.clinic3,
        meta: "1 visit",
      },
    ],
  },
  {
    slug: "acne-scars",
    name: "Acne & Scars",
    icon: "scan",
    blurb: "Active acne, marks, ice-pick scars",
    intro:
      "Active acne is calmed first, then the marks it left are resurfaced. Reversing that order is the single most common reason scar treatment fails.",
    image: IMG.acne1,
    tint: "from-orange-400/20 to-red-400/20 text-orange-200",
    treatments: [
      {
        slug: "acne-treatment",
        name: "Active Acne Programme",
        blurb: "Medical control of oil, bacteria and inflammation.",
        image: IMG.acne1,
        meta: "8–12 weeks",
      },
      {
        slug: "scar-revision",
        name: "Acne Scar Revision",
        blurb: "Subcision, resurfacing and fillers matched to scar type.",
        image: IMG.pairScarA,
        meta: "3–5 sessions",
      },
      {
        slug: "microneedling",
        name: "Microneedling",
        blurb: "Collagen induction for rolling scars and open texture.",
        image: IMG.procMicro,
        meta: "4–6 sessions",
      },
      {
        slug: "chemical-peels",
        name: "Chemical Peels",
        blurb: "Salicylic, mandelic and TCA depths for marks and congestion.",
        image: IMG.procPeel,
        meta: "4–6 sessions",
      },
      {
        slug: "comedone-extraction",
        name: "Medical Extraction",
        blurb: "Sterile clearing of comedones — never at home, never nails.",
        image: IMG.acne3,
        meta: "Monthly",
      },
      {
        slug: "post-acne-marks",
        name: "Post-Acne Mark Fading",
        blurb: "Targets the brown and red marks that outlast the spot.",
        image: IMG.acne2,
        meta: "6–8 weeks",
      },
    ],
  },
  {
    slug: "pigmentation",
    name: "Pigmentation & Melasma",
    icon: "sun",
    blurb: "Melasma, dark spots, tanning",
    intro:
      "Pigment is stubborn and it recurs. The plan here is always three-part: reduce, protect and maintain — with sun protection treated as part of the treatment.",
    image: IMG.pairPigmentA,
    tint: "from-yellow-400/20 to-amber-400/20 text-amber-300",
    treatments: [
      {
        slug: "melasma-treatment",
        name: "Melasma Protocol",
        blurb: "Layered, low-aggression care for the hardest pigment of all.",
        image: IMG.portraitDeep,
        meta: "12 weeks · ongoing maintenance",
      },
      {
        slug: "pigmentation",
        name: "Pigmentation Treatment",
        blurb: "Targets sun spots, freckling and post-inflammatory marks.",
        image: IMG.pairPigmentA,
        meta: "6 sessions",
      },
      {
        slug: "underarm-lightening",
        name: "Underarm & Intimate Lightening",
        blurb: "Gentle, dermatologist-supervised tone correction.",
        image: IMG.body5,
        meta: "4–6 sessions",
      },
      {
        slug: "tan-removal",
        name: "De-Tan Programme",
        blurb: "Reverses accumulated sun exposure over four weeks.",
        image: IMG.portraitCalm,
        meta: "3–4 sessions",
      },
      {
        slug: "dark-circles",
        name: "Dark Circle Correction",
        blurb: "Distinguishes pigment, hollow and vascular causes first.",
        image: IMG.eye2,
        meta: "4–6 sessions",
      },
      {
        slug: "freckle-removal",
        name: "Freckle & Sunspot Clearing",
        blurb: "Spot-by-spot laser clearance with a healing plan.",
        image: IMG.portraitMacro,
        meta: "1–3 sessions",
      },
    ],
  },
  {
    slug: "eyes",
    name: "Eye Rejuvenation",
    icon: "eye",
    blurb: "Hollows, hooding, fine lines",
    intro:
      "The eye area ages first and shows every late night. Non-surgical options now cover most of what used to need a blepharoplasty.",
    image: IMG.eye1,
    tint: "from-indigo-400/20 to-blue-400/20 text-indigo-200",
    treatments: [
      {
        slug: "tear-trough-correction",
        name: "Tear Trough Correction",
        blurb: "Volume replaced in the hollow that casts the shadow.",
        image: IMG.eye3,
        meta: "1 session",
      },
      {
        slug: "crows-feet",
        name: "Crow's Feet Softening",
        blurb: "Keeps the smile, softens the lines around it.",
        image: IMG.portraitSmile,
        meta: "Every 4–6 months",
      },
      {
        slug: "eyelid-tightening",
        name: "Non-Surgical Eyelid Tightening",
        blurb: "Plasma and RF for mild hooding without cutting.",
        image: IMG.eye5,
        meta: "1–2 sessions",
      },
      {
        slug: "eye-brightening",
        name: "Under-Eye Brightening",
        blurb: "Peels and boosters formulated for thin periocular skin.",
        image: IMG.eye6,
        meta: "4 sessions",
      },
      {
        slug: "brow-lift",
        name: "Chemical Brow Lift",
        blurb: "A few units to open the eye and lift the tail of the brow.",
        image: IMG.pairLiftA,
        meta: "1 session",
      },
      {
        slug: "eyelash-growth",
        name: "Lash Growth Therapy",
        blurb: "Prescription lash serum with a review at six weeks.",
        image: IMG.portraitSerum,
        meta: "Daily · 12 weeks",
      },
    ],
  },
  {
    slug: "nose",
    name: "Nose Reshaping",
    icon: "aperture",
    blurb: "Liquid rhinoplasty, tip refinement",
    intro:
      "Non-surgical nose work — camouflage of a dorsal hump, tip support and bridge definition using filler and threads. Reversible, and done in under an hour.",
    image: IMG.portraitSerum,
    tint: "from-slate-400/20 to-zinc-400/20 text-white/75",
    treatments: [
      {
        slug: "liquid-rhinoplasty",
        name: "Liquid Rhinoplasty",
        blurb: "Structural filler to straighten the profile line.",
        image: IMG.procFiller,
        meta: "1 session · 30 minutes",
      },
      {
        slug: "nose-tip-lift",
        name: "Tip Lift & Refinement",
        blurb: "Raises a drooping tip and refines the nasal base.",
        image: IMG.portraitSoft,
        meta: "1 session",
      },
      {
        slug: "nose-thread-lift",
        name: "Nose Thread Lift",
        blurb: "Absorbable threads for bridge height and definition.",
        image: IMG.procInject,
        meta: "1 session",
      },
      {
        slug: "nostril-slimming",
        name: "Nostril Slimming",
        blurb: "Reduces flare width with targeted toxin placement.",
        image: IMG.portraitClean,
        meta: "1 session",
      },
      {
        slug: "nose-bump-camouflage",
        name: "Dorsal Hump Camouflage",
        blurb: "Fills above and below the bump to smooth the line.",
        image: IMG.portraitStudio,
        meta: "1 session",
      },
      {
        slug: "nose-revision-assessment",
        name: "Revision Assessment",
        blurb: "Second-opinion review of previous nose work.",
        image: IMG.clinic1,
        meta: "Consultation",
      },
    ],
  },
  {
    slug: "face-contour",
    name: "Face Contouring",
    icon: "hexagon",
    blurb: "V-line, double chin, cheeks",
    intro:
      "Shaping the lower face — slimming what is heavy, supporting what has dropped and defining the border between face and neck.",
    image: IMG.pairLiftA,
    tint: "from-purple-400/20 to-violet-400/20 text-purple-200",
    treatments: [
      {
        slug: "v-line-contouring",
        name: "V-Line Contouring",
        blurb: "Combined slimming and lifting for a tapered lower face.",
        image: IMG.procDevice,
        meta: "2 sessions",
      },
      {
        slug: "double-chin-reduction",
        name: "Double Chin Reduction",
        blurb: "Dissolves the submental fat pad in a short course.",
        image: IMG.body1,
        meta: "2–4 sessions",
      },
      {
        slug: "cheek-definition",
        name: "Cheek Definition",
        blurb: "Structural support high on the midface, not volume for its own sake.",
        image: IMG.portraitCream,
        meta: "1 session",
      },
      {
        slug: "buccal-slimming",
        name: "Buccal Slimming (Non-Surgical)",
        blurb: "Energy-based reduction of a full lower cheek.",
        image: IMG.portraitClean,
        meta: "2–3 sessions",
      },
      {
        slug: "temple-hollowing",
        name: "Temple Restoration",
        blurb: "Refills the hollow that makes the face read gaunt.",
        image: IMG.procInject3,
        meta: "1–2 sessions",
      },
      {
        slug: "facial-balancing",
        name: "Full Facial Balancing",
        blurb: "One assessment, one staged plan across the whole face.",
        image: IMG.portraitHero,
        meta: "Staged over 3 months",
      },
    ],
  },
  {
    slug: "body-fat",
    name: "Body & Fat Reduction",
    icon: "activity",
    blurb: "Fat dissolving, contouring, cellulite",
    intro:
      "For stubborn pockets that diet and training do not reach. Body work is an adjunct to a healthy weight, never a substitute for one.",
    image: IMG.body1,
    tint: "from-cyan-400/20 to-sky-400/20 text-cyan-200",
    treatments: [
      {
        slug: "fat-dissolving",
        name: "Fat Dissolving (Lipolysis)",
        blurb: "Injectable lipolytics for localised, resistant pockets.",
        image: IMG.procInject,
        meta: "3–4 sessions",
      },
      {
        slug: "body-contouring",
        name: "Body Contouring",
        blurb: "Device-led shaping across abdomen, flanks and arms.",
        image: IMG.body1,
        meta: "6–8 sessions",
      },
      {
        slug: "cellulite-therapy",
        name: "Cellulite Therapy",
        blurb: "Targets the fibrous bands that cause dimpling.",
        image: IMG.body6,
        meta: "6 sessions",
      },
      {
        slug: "stretch-mark-therapy",
        name: "Stretch Mark Therapy",
        blurb: "Microneedling and resurfacing for striae, old and new.",
        image: IMG.body3,
        meta: "4–6 sessions",
      },
      {
        slug: "skin-tightening-body",
        name: "Body Skin Tightening",
        blurb: "Post-weight-loss firming for arms, abdomen and thighs.",
        image: IMG.body4,
        meta: "4–6 sessions",
      },
      {
        slug: "back-body-acne",
        name: "Back & Body Acne",
        blurb: "Body-strength peels and medical management.",
        image: IMG.body5,
        meta: "8 weeks",
      },
    ],
  },
  {
    slug: "wellness",
    name: "IV Drips & Wellness",
    icon: "heart-pulse",
    blurb: "Drips, deficiencies, skin nutrition",
    intro:
      "Skin reflects what is happening internally. Deficiency screening first, then targeted repletion — oral where it works, intravenous where it does not.",
    image: IMG.iv2,
    tint: "from-emerald-400/20 to-teal-400/20 text-emerald-200",
    treatments: [
      {
        slug: "iv-wellness-drips",
        name: "IV Wellness Drips",
        blurb: "Clinician-supervised infusions matched to your bloodwork.",
        image: IMG.iv1,
        meta: "45 minutes",
      },
      {
        slug: "glutathione-drip",
        name: "Antioxidant Drip",
        blurb: "Glutathione and vitamin C for oxidative load and dullness.",
        image: IMG.iv3,
        meta: "6–8 sessions",
      },
      {
        slug: "deficiency-screening",
        name: "Deficiency Screening",
        blurb: "Ferritin, D, B12 and thyroid — the four that show on skin.",
        image: IMG.clinic2,
        meta: "1 visit",
      },
      {
        slug: "hydration-drip",
        name: "Rehydration Drip",
        blurb: "Fluid and electrolyte correction after illness or travel.",
        image: IMG.iv4,
        meta: "Single session",
      },
      {
        slug: "skin-nutrition-plan",
        name: "Skin Nutrition Plan",
        blurb: "A diet and supplement plan written around your skin goals.",
        image: IMG.prod4,
        meta: "Reviewed at 8 weeks",
      },
      {
        slug: "stress-sleep-skin",
        name: "Stress, Sleep & Skin",
        blurb: "Addresses the cortisol and sleep drivers behind flares.",
        image: IMG.iv5,
        meta: "Ongoing",
      },
    ],
  },
  {
    slug: "bridal",
    name: "Bridal & Pre-Event",
    icon: "crown",
    blurb: "Timed countdown packages",
    intro:
      "Everything reverse-engineered from your date. Nothing new is started inside the final fortnight — that rule is what keeps the day itself uneventful.",
    image: IMG.bridal1,
    tint: "from-pink-400/20 to-rose-400/20 text-pink-200",
    treatments: [
      {
        slug: "bridal-6-month",
        name: "6-Month Bridal Plan",
        blurb: "The full runway — acne, pigment, texture, then glow.",
        image: IMG.bridal2,
        meta: "Staged over 24 weeks",
      },
      {
        slug: "bridal-3-month",
        name: "3-Month Express Plan",
        blurb: "Condensed course when the date is closer than ideal.",
        image: IMG.portraitSerum,
        meta: "Staged over 12 weeks",
      },
      {
        slug: "groom-package",
        name: "Groom's Package",
        blurb: "Beard shaping, tan reversal and a pre-day medi-facial.",
        image: IMG.bridal6,
        meta: "8 weeks",
      },
      {
        slug: "pre-event-glow",
        name: "Pre-Event Glow Facial",
        blurb: "Safe 72 hours before — no peeling, no surprises.",
        image: IMG.facial1,
        meta: "Single session",
      },
      {
        slug: "bridal-body-prep",
        name: "Bridal Body Prep",
        blurb: "Back, arms and décolleté brought to the same standard as the face.",
        image: IMG.bridal4,
        meta: "6–8 sessions",
      },
      {
        slug: "family-package",
        name: "Family & Bridesmaid Package",
        blurb: "Group plans for the people standing next to you.",
        image: IMG.bridal5,
        meta: "Flexible",
      },
    ],
  },
  {
    slug: "mens",
    name: "Men's Aesthetics",
    icon: "user",
    blurb: "Beard, hair, jaw, sweat",
    intro:
      "Male skin is thicker, oilier and more vascular. Same devices, different settings — and a plan that survives a shave every morning.",
    image: IMG.men1,
    tint: "from-zinc-400/20 to-slate-400/20 text-zinc-200",
    treatments: [
      {
        slug: "mens-hair-loss",
        name: "Male Pattern Hair Loss",
        blurb: "Medical plus regenerative, staged by Norwood grade.",
        image: IMG.hair1,
        meta: "Reviewed at 6 months",
      },
      {
        slug: "mens-jawline",
        name: "Jawline Sharpening",
        blurb: "Contour and slimming for a defined lower face.",
        image: IMG.men2,
        meta: "1–2 sessions",
      },
      {
        slug: "mens-acne",
        name: "Shaving Acne & Ingrowns",
        blurb: "Pseudofolliculitis handled with laser and technique change.",
        image: IMG.men3,
        meta: "6 sessions",
      },
      {
        slug: "mens-sweat",
        name: "Sweat & Odour Control",
        blurb: "Underarm, palm and sole hyperhidrosis treatment.",
        image: IMG.men4,
        meta: "Lasts 6–9 months",
      },
      {
        slug: "mens-antiaging",
        name: "Anti-Ageing (Men)",
        blurb: "Conservative dosing that keeps expression intact.",
        image: IMG.men5,
        meta: "Every 5–6 months",
      },
      {
        slug: "mens-back-hair",
        name: "Back & Chest Hair Removal",
        blurb: "Large-area laser sessions with high-power cooling.",
        image: IMG.men6,
        meta: "6–8 sessions",
      },
    ],
  },
  {
    slug: "dental",
    name: "Smile Aesthetics",
    icon: "smile",
    blurb: "Whitening, alignment, gum contour",
    intro:
      "The lower third of the face is judged as one unit. Smile work is coordinated with lip and chin planning rather than treated in isolation.",
    image: IMG.smile1,
    tint: "from-sky-400/20 to-blue-400/20 text-sky-200",
    treatments: [
      {
        slug: "teeth-whitening",
        name: "Professional Whitening",
        blurb: "In-chair whitening with a shade check before and after.",
        image: IMG.smile1,
        meta: "1–2 sessions",
      },
      {
        slug: "clear-aligners",
        name: "Clear Aligners",
        blurb: "Removable alignment planned on a digital scan.",
        image: IMG.smile2,
        meta: "6–18 months",
      },
      {
        slug: "gum-contouring",
        name: "Gum Contouring",
        blurb: "Reshapes an uneven gum line to balance the smile.",
        image: IMG.smile5,
        meta: "1 session",
      },
      {
        slug: "smile-lip-balance",
        name: "Smile & Lip Balance",
        blurb: "Coordinates lip position with the teeth beneath it.",
        image: IMG.smile3,
        meta: "Consultation-led",
      },
      {
        slug: "veneers",
        name: "Veneers",
        blurb: "Shape and shade correction with a preview mock-up first.",
        image: IMG.smile4,
        meta: "2–3 visits",
      },
      {
        slug: "smile-consult",
        name: "Smile Design Consult",
        blurb: "Photographic and digital planning before anything is done.",
        image: IMG.smile6,
        meta: "1 visit",
      },
    ],
  },
  {
    slug: "skin-health",
    name: "Medical Dermatology",
    icon: "flask",
    blurb: "Rosacea, eczema, sensitivity",
    intro:
      "The medical half of the clinic. Conditions that need a diagnosis and a prescription before anything cosmetic is even discussed.",
    image: IMG.portraitCalm,
    tint: "from-red-400/20 to-rose-400/20 text-red-200",
    treatments: [
      {
        slug: "rosacea-treatment",
        name: "Rosacea Management",
        blurb: "Calms flushing and papules, then holds it stable.",
        image: IMG.portraitCalm,
        meta: "12 weeks · then maintenance",
      },
      {
        slug: "anti-aging-program",
        name: "Anti-Ageing Programme",
        blurb: "A structured, year-long plan rather than one-off procedures.",
        image: IMG.portraitSoft,
        meta: "12 months",
      },
      {
        slug: "eczema-barrier",
        name: "Eczema & Barrier Repair",
        blurb: "Rebuilds a compromised barrier before anything active.",
        image: IMG.portraitCream,
        meta: "8–12 weeks",
      },
      {
        slug: "sensitive-skin",
        name: "Sensitised Skin Reset",
        blurb: "Recovery plan after over-exfoliation or product overload.",
        image: IMG.portraitMask,
        meta: "6 weeks",
      },
      {
        slug: "mole-check",
        name: "Mole & Skin Check",
        blurb: "Dermoscopic review of changing or worrying lesions.",
        image: IMG.procDerma2,
        meta: "1 visit",
      },
      {
        slug: "patch-testing",
        name: "Allergy Patch Testing",
        blurb: "Identifies the contact allergen behind recurring reactions.",
        image: IMG.clinic4,
        meta: "3 visits over a week",
      },
    ],
  },
];

export const CATEGORY_BY_SLUG = new Map(HUB_CATEGORIES.map((c) => [c.slug, c]));

export function getHubCategory(slug: string): HubCategory | undefined {
  return CATEGORY_BY_SLUG.get(slug);
}

export const TOTAL_TREATMENTS = HUB_CATEGORIES.reduce(
  (n, c) => n + c.treatments.length,
  0
);

// ─────────────────────────────────────────────────────────────────────────
// Concerns — the Curology-style "what's bothering you" entry point
// ─────────────────────────────────────────────────────────────────────────

export const HUB_CONCERNS: HubConcern[] = [
  {
    slug: "acne",
    label: "Acne",
    hint: "Breakouts & congestion",
    image: IMG.acne1,
    category: "acne-scars",
  },
  {
    slug: "dark-spots",
    label: "Dark spots",
    hint: "Marks that outstay the spot",
    image: IMG.portraitTexture,
    category: "pigmentation",
  },
  {
    slug: "melasma",
    label: "Melasma",
    hint: "Patchy, symmetric pigment",
    image: IMG.portraitDeep,
    category: "pigmentation",
  },
  {
    slug: "wrinkles",
    label: "Fine lines",
    hint: "Expression & static lines",
    image: IMG.procInject,
    category: "botox",
  },
  {
    slug: "redness",
    label: "Redness",
    hint: "Flushing & rosacea",
    image: IMG.portraitCalm,
    category: "skin-health",
  },
  {
    slug: "large-pores",
    label: "Open pores",
    hint: "Texture & oiliness",
    image: IMG.portraitMacro,
    category: "glass-skin",
  },
  {
    slug: "dullness",
    label: "Dullness",
    hint: "Tired, uneven tone",
    image: IMG.portraitGlow,
    category: "glass-skin",
  },
  {
    slug: "dryness",
    label: "Dehydration",
    hint: "Tight, flaky, rough",
    image: IMG.prod1,
    category: "glass-skin",
  },
  {
    slug: "dark-circles",
    label: "Dark circles",
    hint: "Hollows & shadows",
    image: IMG.eye1,
    category: "eyes",
  },
  {
    slug: "sagging",
    label: "Sagging",
    hint: "Jawline & cheek laxity",
    image: IMG.portraitStudio,
    category: "lifting",
  },
  {
    slug: "scars",
    label: "Scars",
    hint: "Acne, surgical, stretch marks",
    image: IMG.acne4,
    category: "acne-scars",
  },
  {
    slug: "hair-fall",
    label: "Hair fall",
    hint: "Thinning & shedding",
    image: IMG.hair1,
    category: "hair-restoration",
  },
];

// ─────────────────────────────────────────────────────────────────────────
// Promotional rail (the marketplace banner carousel)
// ─────────────────────────────────────────────────────────────────────────

export const HUB_PROMOS: HubPromo[] = [
  {
    slug: "first-scan",
    eyebrow: "New here",
    title: "Your first AI skin reading is on us",
    body: "12+ signals scored in about 30 seconds, then matched to the treatments that actually address them.",
    image: IMG.portraitHero,
    cta: "Scan my skin",
    href: "/patient/skin-analyzer",
  },
  {
    slug: "monsoon-glow",
    eyebrow: "This month",
    title: "Glow season starts before the season does",
    body: "Booster and medi-facial courses booked now finish right on time for the festive run.",
    image: IMG.portraitGlow,
    cta: "See glow treatments",
    href: "/patient/explore/glass-skin",
  },
  {
    slug: "acne-clear",
    eyebrow: "Most booked",
    title: "Clear skin, in the right order",
    body: "Active acne calmed first, marks treated second. Skipping step one is why most plans stall.",
    image: IMG.acne1,
    cta: "Start with acne",
    href: "/patient/explore/acne-scars",
  },
  {
    slug: "bridal-countdown",
    eyebrow: "Countdown",
    title: "Six months out is the sweet spot",
    body: "Every bridal plan is reverse-engineered from your date — and nothing new starts in the last fortnight.",
    image: IMG.bridal1,
    cta: "Plan my countdown",
    href: "/patient/explore/bridal",
  },
];

// ─────────────────────────────────────────────────────────────────────────
// Deals — discount + perk only. BluDerma is enquiry-only, so no prices.
// ─────────────────────────────────────────────────────────────────────────

export const HUB_DEALS: HubDeal[] = [
  {
    slug: "hot-booster-course",
    title: "Glass Skin Booster Course",
    treatment: "Skin Boosters × 3",
    categorySlug: "glass-skin",
    categoryLabel: "Glass Skin & Glow",
    image: IMG.portraitDewy,
    discount: 40,
    perk: "Free skin analysis + barrier kit",
    claimed: 312,
    endsIn: "2 days",
    hot: true,
  },
  {
    slug: "hot-acne-reset",
    title: "90-Day Acne Reset",
    treatment: "Medical acne programme",
    categorySlug: "acne-scars",
    categoryLabel: "Acne & Scars",
    image: IMG.acne1,
    discount: 35,
    perk: "Includes 2 review consults",
    claimed: 486,
    endsIn: "5 days",
    hot: true,
  },
  {
    slug: "hot-lhr-full-body",
    title: "Full Body Laser Package",
    treatment: "Laser hair removal × 8",
    categorySlug: "hair-removal",
    categoryLabel: "Laser Hair Removal",
    image: IMG.lhr1,
    discount: 45,
    perk: "Patch test + numbing included",
    claimed: 724,
    endsIn: "Today",
    hot: true,
  },
  {
    slug: "hot-prp-hair",
    title: "Hair Fall Rescue Course",
    treatment: "PRP × 6 + diagnostics",
    categorySlug: "hair-restoration",
    categoryLabel: "Hair Restoration",
    image: IMG.hair1,
    discount: 30,
    perk: "Bloodwork & trichoscopy free",
    claimed: 258,
    endsIn: "3 days",
    hot: true,
  },
  {
    slug: "deal-medifacial",
    title: "Monthly Medi-Facial",
    treatment: "Hydra medi-facial",
    categorySlug: "glass-skin",
    categoryLabel: "Glass Skin & Glow",
    image: IMG.facial2,
    discount: 20,
    perk: "Add-on mask free",
    claimed: 140,
    endsIn: "12 days",
  },
  {
    slug: "deal-peel-course",
    title: "Peel Course of 4",
    treatment: "Chemical peels × 4",
    categorySlug: "acne-scars",
    categoryLabel: "Acne & Scars",
    image: IMG.procPeel,
    discount: 25,
    perk: "Aftercare kit included",
    claimed: 96,
    endsIn: "9 days",
  },
  {
    slug: "deal-detan",
    title: "De-Tan Programme",
    treatment: "De-tan × 3",
    categorySlug: "pigmentation",
    categoryLabel: "Pigmentation & Melasma",
    image: IMG.portraitCalm,
    discount: 22,
    perk: "SPF starter pack",
    claimed: 178,
    endsIn: "14 days",
  },
  {
    slug: "deal-hifu",
    title: "Lift & Tighten Intro",
    treatment: "HIFU full face",
    categorySlug: "lifting",
    categoryLabel: "Lifting & Tightening",
    image: IMG.procDevice,
    discount: 18,
    perk: "Free 3-month review",
    claimed: 63,
    endsIn: "20 days",
  },
  {
    slug: "deal-groom",
    title: "Groom's Pre-Wedding Set",
    treatment: "Beard, tan & glow",
    categorySlug: "bridal",
    categoryLabel: "Bridal & Pre-Event",
    image: IMG.men1,
    discount: 28,
    perk: "Two medi-facials included",
    claimed: 51,
    endsIn: "18 days",
  },
  {
    slug: "deal-iv",
    title: "Wellness Drip Trio",
    treatment: "IV drips × 3",
    categorySlug: "wellness",
    categoryLabel: "IV Drips & Wellness",
    image: IMG.iv2,
    discount: 15,
    perk: "Deficiency panel at cost",
    claimed: 44,
    endsIn: "25 days",
  },
];

export const HOT_DEALS = HUB_DEALS.filter((d) => d.hot);
export const REGULAR_DEALS = HUB_DEALS.filter((d) => !d.hot);

// ─────────────────────────────────────────────────────────────────────────
// Before & after
//
// NOT photographs of BluDerma clients. These are illustrative pairs showing
// the kind of change each course aims at, and the component says so where a
// reader will see it.
//
// The `quote`, `initials` and `age` fields on each case were invented, and are
// no longer rendered — a fictional testimonial reads as a real person however
// carefully the photographs are disclaimed. They are left on the type only so
// existing rows parse; do not display them. Real before/after work needs
// consented client images and consented client words.
//
// The admin can replace each pair from Admin → Treatments → Images.
// ─────────────────────────────────────────────────────────────────────────

export const BEFORE_AFTER: BeforeAfterCase[] = [
  {
    slug: "ba-acne",
    concern: "Inflammatory acne",
    treatment: "Medical acne programme + peels",
    categorySlug: "acne-scars",
    sessions: "4 sessions",
    timeframe: "12 weeks",
    before: IMG.pairAcneA,
    after: IMG.pairAcneB,
    quote:
      "The redness settled by week four. The marks took longer, but they went.",
    initials: "R.K.",
    age: "24",
  },
  {
    slug: "ba-melasma",
    concern: "Melasma across the cheeks",
    treatment: "Melasma protocol + strict photoprotection",
    categorySlug: "pigmentation",
    sessions: "6 sessions",
    timeframe: "16 weeks",
    before: IMG.pairPigmentA,
    after: IMG.pairPigmentB,
    quote: "I was told it would come back if I stopped the sunscreen. It didn't, because I didn't.",
    initials: "S.M.",
    age: "36",
  },
  {
    slug: "ba-scars",
    concern: "Rolling acne scars",
    treatment: "Subcision + fractional resurfacing",
    categorySlug: "acne-scars",
    sessions: "3 sessions",
    timeframe: "6 months",
    before: IMG.pairScarA,
    after: IMG.pairScarB,
    quote: "Not gone — but I stopped noticing them in photos, which was the goal.",
    initials: "A.D.",
    age: "29",
  },
  {
    slug: "ba-lifting",
    concern: "Lower-face laxity",
    treatment: "Thread lift + HIFU",
    categorySlug: "lifting",
    sessions: "2 sessions",
    timeframe: "5 months",
    before: IMG.pairLiftA,
    after: IMG.pairLiftB,
    quote: "It looks like I slept properly for a year. Nobody has asked what I had done.",
    initials: "P.N.",
    age: "43",
  },
  {
    slug: "ba-hair",
    concern: "Diffuse hair thinning",
    treatment: "PRP course + deficiency correction",
    categorySlug: "hair-restoration",
    sessions: "6 sessions",
    timeframe: "9 months",
    before: IMG.pairHairA,
    after: IMG.pairHairB,
    quote: "The bloodwork found the actual cause. The PRP did the rest.",
    initials: "V.S.",
    age: "31",
  },
  {
    slug: "ba-glow",
    concern: "Dull, dehydrated skin",
    treatment: "Skin boosters + barrier repair",
    categorySlug: "glass-skin",
    sessions: "3 sessions",
    timeframe: "10 weeks",
    before: IMG.pairGlowA,
    after: IMG.pairGlowB,
    quote: "First time my skin has felt comfortable rather than just looked fine.",
    initials: "T.J.",
    age: "27",
  },
];

// ─────────────────────────────────────────────────────────────────────────
// Cities offered when a client declines or blocks browser location.
// ─────────────────────────────────────────────────────────────────────────

export const POPULAR_CITIES = [
  "Chennai",
  "Bengaluru",
  "Hyderabad",
  "Mumbai",
  "Delhi NCR",
  "Pune",
  "Kochi",
  "Coimbatore",
];
