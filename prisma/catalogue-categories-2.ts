/**
 * A second wave of categories, covering areas a full aesthetic and
 * dermatology practice offers but the first eighteen did not reach.
 *
 * Same rules as the rest of the catalogue: real procedures, realistic session
 * counts and downtime, and no prices anywhere. Where a category touches
 * genuinely medical ground — vascular disease, paediatric skin, intimate
 * health — the wording stays clinical rather than promotional, because those
 * are conditions before they are treatments.
 */

import type { SeedCategory } from "./catalogue-expansion";

export const CATEGORIES_2: SeedCategory[] = [
  {
    slug: "lips",
    name: "Lip Aesthetics",
    icon: "droplet",
    blurb: "Shape, border, hydration and the lines around the mouth.",
    intro:
      "Lips are read as a proportion of the face rather than in isolation. Most good lip work is measured in fractions of a millilitre and in restraint.",
    tint: "from-rose-400 to-fuchsia-400",
    theme: "injectable",
    treatments: [
      { slug: "lip-hydration", name: "Lip Hydration Boost", blurb: "Unstructured hyaluronic acid for texture, not volume.", meta: "2 sessions · lasts 6 months", theme: "injectable" },
      { slug: "russian-lip", name: "Russian Lip Technique", blurb: "Vertical placement for height rather than forward projection.", meta: "Lasts 9–12 months", theme: "injectable" },
      { slug: "lip-border-definition", name: "Lip Border Definition", blurb: "Restores a vermilion border blurred by age or sun.", meta: "Lasts 9–12 months", theme: "injectable" },
      { slug: "smokers-lines", name: "Perioral Line Treatment", blurb: "The fine vertical lines above the upper lip.", meta: "2–3 sessions", theme: "injectable" },
      { slug: "corner-lip-lift", name: "Corner Lift", blurb: "Raises a downturned mouth corner that reads as unhappy.", meta: "Lasts 6–9 months", theme: "injectable" },
      { slug: "lip-asymmetry", name: "Lip Asymmetry Correction", blurb: "Balances an uneven lip, often congenital rather than acquired.", meta: "1–2 sessions", theme: "injectable" },
      { slug: "lip-pigmentation", name: "Lip Pigmentation Treatment", blurb: "For darkening from smoking, sun or chronic irritation.", meta: "4–6 sessions", theme: "device" },
      { slug: "chapped-lip-programme", name: "Chronic Chapped Lip Care", blurb: "Investigates the cause rather than layering more balm.", meta: "4–6 weeks", theme: "product" },
    ],
  },
  {
    slug: "brows-lashes",
    name: "Brows & Lashes",
    icon: "eye",
    blurb: "Framing the eye — density, shape and semi-permanent definition.",
    intro:
      "Brow and lash work sits between aesthetics and dermatology: growth is a medical question, shape is a design one, and pigment is a technical craft.",
    tint: "from-amber-400 to-rose-400",
    theme: "portrait",
    treatments: [
      { slug: "microblading", name: "Microblading", blurb: "Hair-stroke pigment for sparse or over-plucked brows.", meta: "2 sessions · 6 weeks apart", theme: "portrait" },
      { slug: "powder-brows", name: "Powder Brows", blurb: "A soft shaded fill that suits oily skin better than strokes.", meta: "2 sessions", theme: "portrait" },
      { slug: "brow-lamination", name: "Brow Lamination", blurb: "Sets the hairs upward for a fuller, brushed-up shape.", meta: "Every 6–8 weeks", theme: "portrait" },
      { slug: "lash-lift-tint", name: "Lash Lift & Tint", blurb: "Curls and darkens your own lashes, no extensions.", meta: "Every 6–8 weeks", theme: "portrait" },
      { slug: "lash-extensions", name: "Lash Extensions", blurb: "Individually applied, with the aftercare that keeps lids healthy.", meta: "Refill every 3 weeks", theme: "portrait" },
      { slug: "brow-shaping-consult", name: "Brow Shape Mapping", blurb: "Measures brow position against your own facial proportions.", meta: "30 minutes", theme: "portrait" },
      { slug: "lash-line-health", name: "Lash Line Health Review", blurb: "For lids irritated by extensions, glue or blepharitis.", meta: "Assessment", theme: "clinical" },
    ],
  },
  {
    slug: "vascular",
    name: "Veins & Vascular",
    icon: "activity",
    blurb: "Thread veins, spider veins and visible vessels.",
    intro:
      "Visible vessels are common, usually harmless and often treatable in a few sessions — but leg veins deserve a proper assessment first, because some are a sign of underlying venous disease.",
    tint: "from-sky-400 to-violet-500",
    theme: "device",
    treatments: [
      { slug: "facial-thread-veins", name: "Facial Thread Veins", blurb: "Fine vessels on the nose and cheeks, closed with vascular laser.", meta: "2–3 sessions", theme: "device" },
      { slug: "leg-spider-veins", name: "Leg Spider Veins", blurb: "Sclerotherapy or laser, after a venous assessment.", meta: "3–4 sessions", theme: "body" },
      { slug: "sclerotherapy", name: "Sclerotherapy", blurb: "A solution injected to collapse the vein from within.", meta: "2–4 sessions", theme: "injectable" },
      { slug: "cherry-angioma", name: "Cherry Angioma Removal", blurb: "The small red domes that multiply with age.", meta: "1–2 sessions", theme: "clinical" },
      { slug: "venous-assessment", name: "Venous Assessment", blurb: "Doppler review before treating anything on the legs.", meta: "Assessment", theme: "clinical" },
      { slug: "rosacea-vascular", name: "Rosacea Vessel Treatment", blurb: "Targets the persistent vessels behind facial redness.", meta: "3–4 sessions", theme: "device" },
      { slug: "poikiloderma", name: "Neck & Chest Redness", blurb: "The mottled sun-related redness of the décolleté.", meta: "3–4 sessions", theme: "device" },
    ],
  },
  {
    slug: "sweat-odour",
    name: "Sweat & Odour",
    icon: "droplet",
    blurb: "Excessive sweating, treated as the medical condition it is.",
    intro:
      "Hyperhidrosis is not poor hygiene and is rarely helped by stronger antiperspirant. It responds well to treatment, which most people discover far later than they should.",
    tint: "from-sky-400 to-emerald-400",
    theme: "clinical",
    treatments: [
      { slug: "hyperhidrosis-assessment", name: "Hyperhidrosis Assessment", blurb: "Separates primary hyperhidrosis from a secondary cause.", meta: "Assessment", theme: "clinical" },
      { slug: "underarm-sweat-injection", name: "Underarm Treatment", blurb: "Blocks the nerve signal to overactive sweat glands.", meta: "Every 6–9 months", theme: "injectable" },
      { slug: "palm-sole-sweat", name: "Palms & Soles Treatment", blurb: "Effective, though it needs good anaesthesia to be tolerable.", meta: "Every 6 months", theme: "injectable" },
      { slug: "iontophoresis", name: "Iontophoresis", blurb: "A current-based treatment used at home for hands and feet.", meta: "Ongoing, several times weekly", theme: "device" },
      { slug: "microwave-sweat", name: "Microwave Gland Treatment", blurb: "Permanently reduces underarm glands in one or two sittings.", meta: "1–2 sessions", theme: "device" },
      { slug: "body-odour-treatment", name: "Body Odour Management", blurb: "Addresses the bacterial side rather than only the sweat.", meta: "4–6 weeks", theme: "clinical" },
    ],
  },
  {
    slug: "womens-health",
    name: "Women's Intimate Health",
    icon: "user",
    blurb: "Post-partum and menopausal changes, treated medically and privately.",
    intro:
      "A clinical service rather than a cosmetic one. Every treatment here is offered after examination by a female clinician, and several are as much about comfort and continence as appearance.",
    tint: "from-rose-400 to-violet-400",
    theme: "clinical",
    treatments: [
      { slug: "postpartum-assessment", name: "Post-Partum Assessment", blurb: "A structured review of recovery, including the pelvic floor.", meta: "Assessment", theme: "clinical" },
      { slug: "vaginal-laxity-laser", name: "Intimate Laser Therapy", blurb: "Fractional laser for laxity and dryness after childbirth or menopause.", meta: "3 sessions", theme: "device" },
      { slug: "menopause-skin", name: "Menopausal Skin Programme", blurb: "Addresses the collagen and barrier loss that follows oestrogen decline.", meta: "3–6 months", theme: "clinical" },
      { slug: "pelvic-floor-ems", name: "Pelvic Floor Strengthening", blurb: "Electromagnetic stimulation for stress incontinence.", meta: "6 sessions", theme: "device" },
      { slug: "intimate-pigmentation", name: "Intimate Pigmentation Care", blurb: "Gentle protocols for a delicate area, or reassurance that none is needed.", meta: "4–6 sessions", theme: "clinical" },
      { slug: "lichen-sclerosus", name: "Lichen Sclerosus Management", blurb: "A medical condition needing long-term dermatological care.", meta: "Ongoing", theme: "clinical" },
      { slug: "womens-hair-thinning", name: "Female Hair Thinning Review", blurb: "Hormonal, thyroid and iron causes investigated together.", meta: "Assessment + bloods", theme: "hair" },
    ],
  },
  {
    slug: "paediatric",
    name: "Children's Skin",
    icon: "smile",
    blurb: "Eczema, birthmarks and adolescent acne, handled gently.",
    intro:
      "Children's skin is thinner, absorbs more of what is put on it, and needs treatment chosen with that in mind. Most of what is offered here is medical rather than aesthetic.",
    tint: "from-teal-400 to-sky-400",
    theme: "clinical",
    treatments: [
      { slug: "child-eczema", name: "Childhood Eczema Care", blurb: "Barrier repair and a steroid plan parents can follow safely.", meta: "Ongoing", theme: "clinical" },
      { slug: "teen-acne", name: "Teenage Acne Programme", blurb: "Effective treatment that accounts for school and exam pressure.", meta: "3–6 months", theme: "clinical" },
      { slug: "birthmark-review", name: "Infant Birthmark Review", blurb: "Identifies which marks need early treatment and which do not.", meta: "Assessment", theme: "clinical" },
      { slug: "molluscum", name: "Molluscum Contagiosum", blurb: "Common, self-limiting, and treated only when it warrants it.", meta: "As advised", theme: "clinical" },
      { slug: "child-warts", name: "Children's Wart Treatment", blurb: "Gentler methods chosen for a child's tolerance.", meta: "2–4 sessions", theme: "clinical" },
      { slug: "nappy-rash", name: "Persistent Nappy Rash", blurb: "For rashes that have not cleared with standard barrier care.", meta: "Assessment", theme: "clinical" },
      { slug: "teen-skin-education", name: "Teen Skin Consultation", blurb: "Explains skin to the person who has it, not only to the parent.", meta: "30 minutes", theme: "clinical" },
    ],
  },
  {
    slug: "nails",
    name: "Nail Health",
    icon: "sparkles",
    blurb: "Fungal infection, ingrowth and nails that signal something else.",
    intro:
      "Nail changes are frequently the first visible sign of a systemic problem. Treating the nail without asking why it changed misses the point.",
    tint: "from-amber-400 to-emerald-400",
    theme: "body",
    treatments: [
      { slug: "fungal-nail-treatment", name: "Fungal Nail Treatment", blurb: "Confirmed by clipping and culture before any long course starts.", meta: "3–6 months", theme: "clinical" },
      { slug: "ingrown-toenail", name: "Ingrown Toenail Procedure", blurb: "Partial nail removal with the matrix treated to prevent recurrence.", meta: "1 session", theme: "clinical" },
      { slug: "nail-psoriasis", name: "Nail Psoriasis Care", blurb: "Pitting and lifting treated alongside the skin disease.", meta: "Ongoing", theme: "clinical" },
      { slug: "brittle-nails", name: "Brittle Nail Investigation", blurb: "Looks for the iron, thyroid or protein cause behind splitting.", meta: "Assessment + bloods", theme: "clinical" },
      { slug: "melanonychia", name: "Nail Pigment Band Review", blurb: "A dark stripe in a nail needs assessment, not reassurance by default.", meta: "Assessment", theme: "clinical" },
      { slug: "nail-biting-damage", name: "Nail Trauma Repair", blurb: "Rehabilitates the nail bed after chronic biting or picking.", meta: "3–6 months", theme: "body" },
    ],
  },
  {
    slug: "post-procedure",
    name: "Recovery & Aftercare",
    icon: "flask",
    blurb: "Healing well after a procedure, and rescuing it when it goes wrong.",
    intro:
      "The result of most procedures is decided in the fortnight afterwards. This is the care that protects it — and the service that treats complications from work done elsewhere.",
    tint: "from-emerald-400 to-brand-500",
    theme: "clinical",
    treatments: [
      { slug: "post-laser-care", name: "Post-Laser Recovery", blurb: "Structured aftercare through the peeling and pinkness.", meta: "7–14 days", theme: "product" },
      { slug: "post-surgical-skin", name: "Post-Surgical Skin Care", blurb: "Scar and swelling management after an operation.", meta: "6–12 weeks", theme: "clinical" },
      { slug: "bruise-clearing", name: "Bruise Clearing", blurb: "Vascular laser to fade post-injection bruising in days, not weeks.", meta: "1–2 sessions", theme: "device" },
      { slug: "complication-review", name: "Complication Review", blurb: "An honest second opinion on work done elsewhere.", meta: "Urgent slots held", theme: "clinical" },
      { slug: "filler-migration", name: "Filler Migration Correction", blurb: "Dissolving and reshaping product that has moved.", meta: "1–2 sessions", theme: "injectable" },
      { slug: "lymphatic-drainage", name: "Post-Procedure Drainage", blurb: "Manual technique to move swelling after contouring or surgery.", meta: "4–6 sessions", theme: "body" },
      { slug: "wound-care", name: "Advanced Wound Care", blurb: "For wounds healing slowly, or not at all.", meta: "Weekly review", theme: "clinical" },
      { slug: "aftercare-consult", name: "Aftercare Planning", blurb: "Booked before the procedure, because that is when it matters.", meta: "20 minutes", theme: "clinical" },
    ],
  },
];
