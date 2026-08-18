/*
 * NOT dead code, despite having no importer under src/.
 *
 * prisma/seed.ts reads `treatments` and `categoryOrder` from here to populate
 * the Treatment table. The app itself reads the database, never this file —
 * so an orphan sweep will flag it. Leave it.
 */
// -----------------------------------------------------------------------------
// BluDerma treatment catalogue
// Original reference content written for the BluDerma MVP.
// Images come from the reviewed local Korean client-image set.
// -----------------------------------------------------------------------------

import { IMG } from "./hubImages";

export type TreatmentCategory =
  | "Injectables"
  | "Laser & Energy"
  | "Skin Health"
  | "Peels & Resurfacing"
  | "Lifting & Contouring"
  | "Hair Restoration";

export interface ProductSolution {
  name: string;
  descriptor: string;
}

export interface Treatment {
  slug: string;
  name: string;
  category: TreatmentCategory;
  tagline: string;
  image: string;
  summary: string;
  /** The patient concern / indication this treatment addresses. */
  concern: string;
  concernPoints: string[];
  /** How the treatment works — the clinical solution. */
  howItWorks: string;
  procedureSteps: string[];
  benefits: string[];
  idealFor: string[];
  /** Quick facts shown as a spec strip. */
  facts: {
    sessions: string;
    downtime: string;
    results: string;
    duration: string;
  };
  /** Note aimed at the referring / treating clinician. */
  clinicalNote: string;
  /** The product/solution a clinic can enquire to order. */
  product: ProductSolution;
}

export const treatments: Treatment[] = [
  {
    slug: "skin-boosters",
    name: "Skin Boosters",
    category: "Injectables",
    tagline: "Micro-injected hydration for luminous, resilient skin",
    image: IMG.procInject,
    summary:
      "Injectable hyaluronic-acid micro-boosters that rehydrate the dermis from within, improving elasticity, fine lines and overall glow without adding volume.",
    concern:
      "Patients presenting with dull, dehydrated or crepey skin, early fine lines and a loss of the healthy 'bounce' associated with youthful skin are ideal candidates. Topical routines alone often fail to reach the dermal layer where hydration and structural support are generated.",
    concernPoints: [
      "Dehydrated, dull or tired-looking skin",
      "Fine 'crepey' lines on cheeks, neck and around the eyes",
      "Reduced elasticity and skin bounce",
      "Enlarged-looking pores and uneven surface texture",
    ],
    howItWorks:
      "A series of micro-droplet injections deliver stabilised hyaluronic acid (and, in some formulations, a complex of amino acids, vitamins and antioxidants) directly into the dermis. Rather than filling or lifting, the product attracts and binds water while stimulating fibroblasts to produce new collagen and elastin over the following weeks.",
    procedureSteps: [
      "Consultation, skin analysis and mapping of injection zones",
      "Application of topical anaesthetic for comfort",
      "Micro-droplet injections placed across the treatment area",
      "Post-care guidance; results build over 2–4 weeks",
    ],
    benefits: [
      "Deep, long-lasting dermal hydration",
      "Smoother texture and softened fine lines",
      "Improved elasticity and radiance",
      "Natural result with no added facial volume",
    ],
    idealFor: [
      "First-time aesthetic patients wanting subtle improvement",
      "Dry, dull or environmentally-stressed skin",
      "Neck, décolletage and back-of-hand rejuvenation",
    ],
    facts: {
      sessions: "2–3, spaced 3–4 weeks apart",
      downtime: "Minimal (small bumps settle within hours)",
      results: "Visible from 2–4 weeks",
      duration: "4–6 months, then maintenance",
    },
    clinicalNote:
      "Best sequenced as an initial 2–3 session course followed by biannual maintenance. Combines well with energy-based resurfacing performed on separate visits.",
    product: {
      name: "BluDerma HydraBooster Kit",
      descriptor: "Cross-linked HA skin-booster ampoules + fine-gauge protocol",
    },
  },
  {
    slug: "botox",
    name: "Anti-Wrinkle (Botulinum Toxin)",
    category: "Injectables",
    tagline: "Relax dynamic lines for a smoother, rested expression",
    image: IMG.procInject2,
    summary:
      "Precisely dosed botulinum toxin softens the muscle activity that drives expression lines on the forehead, between the brows and around the eyes.",
    concern:
      "Dynamic wrinkles — the lines that appear or deepen when a patient frowns, raises the brows or smiles — respond poorly to creams because their cause is repetitive muscle movement. Left untreated, these etch into static lines over time.",
    concernPoints: [
      "Horizontal forehead lines",
      "Frown lines between the eyebrows (glabella)",
      "Crow's feet around the eyes",
      "Bunny lines, gummy smile and jaw slimming (advanced uses)",
    ],
    howItWorks:
      "Small quantities of purified botulinum toxin type A are injected into targeted muscles. The toxin temporarily blocks the nerve signal that tells the muscle to contract, allowing the overlying skin to smooth out while preserving natural expression when dosed conservatively.",
    procedureSteps: [
      "Assessment of muscle strength and expression pattern",
      "Marking of precise injection points",
      "A few near-painless micro-injections per zone",
      "Onset from day 3, full effect by day 14",
    ],
    benefits: [
      "Smoother forehead and softened frown lines",
      "A refreshed, less 'tired' appearance",
      "Preventative effect on future static wrinkles",
      "Quick, lunchtime-friendly procedure",
    ],
    idealFor: [
      "Expression lines that look etched even at rest",
      "Patients seeking a subtle, natural refresh",
      "Preventative treatment in the late 20s–30s",
    ],
    facts: {
      sessions: "Single visit; repeat as effect fades",
      downtime: "None",
      results: "3–14 days",
      duration: "3–4 months",
    },
    clinicalNote:
      "Document baseline muscle activity photographs. Micro / 'baby' dosing preserves movement for patients wanting the most natural outcome; review at 2 weeks for optional touch-up.",
    product: {
      name: "BluDerma Neuro-Smooth Protocol",
      descriptor: "Reconstitution guide + dosing map for facial expression zones",
    },
  },
  {
    slug: "dermal-fillers",
    name: "Dermal Fillers",
    category: "Injectables",
    tagline: "Restore volume, contour and structural support",
    image: IMG.procFiller,
    summary:
      "Hyaluronic-acid fillers replace lost volume and redefine facial contours — cheeks, lips, chin, jawline and tear troughs — with immediate, reversible results.",
    concern:
      "Age-related fat-pad descent and bone remodelling flatten the midface, deepen folds and blunt the jawline. Some patients also seek enhancement of naturally under-projected features such as lips or chin.",
    concernPoints: [
      "Flattened cheeks and loss of midface support",
      "Deep nasolabial folds and marionette lines",
      "Thin or asymmetric lips",
      "Under-defined chin and jawline; hollow tear troughs",
    ],
    howItWorks:
      "Gel formulations of hyaluronic acid with varying densities are placed at specific depths and planes. Firmer gels rebuild deep structural support on bone, while softer gels refine superficial contours and hydrate. Results are immediate and can be adjusted or dissolved with hyaluronidase if needed.",
    procedureSteps: [
      "Full-face assessment and contour planning",
      "Numbing via topical anaesthetic and lidocaine-containing filler",
      "Cannula or needle placement at planned depths",
      "Immediate review, moulding and symmetry check",
    ],
    benefits: [
      "Instant, visible volume restoration",
      "Sculpted, balanced facial contours",
      "Reversible and highly controllable",
      "Collagen stimulation with certain products",
    ],
    idealFor: [
      "Volume loss in cheeks, temples or lips",
      "Non-surgical jaw and chin definition",
      "Correction of asymmetry",
    ],
    facts: {
      sessions: "1 visit; layered plans over 2–3 visits",
      downtime: "Swelling/bruising for 2–7 days",
      results: "Immediate",
      duration: "6–18 months by product & area",
    },
    clinicalNote:
      "Aspirate or use cannula in high-risk zones; keep hyaluronidase on site. Treat structurally (bone-up) before superficial refinement for natural balance.",
    product: {
      name: "BluDerma Contour Filler Range",
      descriptor: "Volumising to fine-line HA gels with cannula starter set",
    },
  },
  {
    slug: "laser-toning",
    name: "Laser Toning",
    category: "Laser & Energy",
    tagline: "Even tone, refined pores and controlled pigment clearance",
    image: IMG.procLaserFace,
    summary:
      "Low-fluence Q-switched laser sessions gently break down excess melanin and stimulate remodelling for brighter, more even-toned skin with minimal downtime.",
    concern:
      "Diffuse pigmentation, dullness, enlarged pores and mild melasma are difficult to address with topicals alone, especially in richly pigmented skin where aggressive lasers risk post-inflammatory hyperpigmentation.",
    concernPoints: [
      "Uneven skin tone and generalised dullness",
      "Sun-induced pigmentation and mild melasma",
      "Enlarged pores and oily, lacklustre texture",
      "Early photoageing",
    ],
    howItWorks:
      "Rapid, low-energy laser pulses are passed across the skin over multiple sessions. The light is absorbed by melanin, fragmenting pigment into particles the body clears naturally, while sub-cellular heating encourages a subtle collagen response — all at energy levels tuned to be safe for darker skin types.",
    procedureSteps: [
      "Skin-type and pigment assessment",
      "Eye shielding and cooling preparation",
      "Multiple low-fluence passes across the area",
      "Sunscreen and barrier care; series of sessions scheduled",
    ],
    benefits: [
      "Brighter, more uniform complexion",
      "Reduced pore appearance and oiliness",
      "Low risk of downtime or peeling",
      "Suitable for a range of skin tones",
    ],
    idealFor: [
      "Maintenance 'glow' programmes",
      "Mild-to-moderate diffuse pigmentation",
      "Patients wanting no-downtime brightening",
    ],
    facts: {
      sessions: "5–10, spaced 1–2 weeks apart",
      downtime: "None to minimal",
      results: "Gradual over the course",
      duration: "Maintained with periodic top-ups",
    },
    clinicalNote:
      "Under-treat rather than over-treat in Fitzpatrick IV–VI; pair with strict photoprotection and a tyrosinase-inhibitor at home to prevent rebound pigment.",
    product: {
      name: "BluDerma Tone Laser Consumables",
      descriptor: "Cooling gel, eye shields and session-tracking cards",
    },
  },
  {
    slug: "thread-lift",
    name: "Thread Lift",
    category: "Lifting & Contouring",
    tagline: "Non-surgical lift with absorbable suspension threads",
    image: IMG.procInject3,
    summary:
      "Absorbable PDO/PLLA threads are placed under the skin to reposition mild sagging and stimulate fresh collagen along their path for a subtle, natural lift.",
    concern:
      "Patients with early-to-moderate laxity of the cheeks, jowls or brow who are not ready for surgery often want a definable lift with limited downtime. Fillers restore volume but do not always reposition descended tissue.",
    concernPoints: [
      "Mild sagging of cheeks and jowls",
      "Early jawline and neck laxity",
      "Drooping brow or flattened midface",
      "Desire to avoid surgery and general anaesthesia",
    ],
    howItWorks:
      "Fine absorbable threads with tiny barbs or cones are introduced through a cannula and gently anchored to reposition soft tissue. Beyond the immediate mechanical lift, the threads trigger a controlled healing response that lays down new collagen along their length before dissolving over months.",
    procedureSteps: [
      "Vector planning and marking of lift direction",
      "Local anaesthesia at entry points",
      "Thread insertion via cannula and gentle tissue elevation",
      "Trimming and smoothing; immediate lift visible",
    ],
    benefits: [
      "Immediate, natural-looking lift",
      "Progressive collagen stimulation",
      "No general anaesthesia or major scars",
      "Short procedure, faster recovery than surgery",
    ],
    idealFor: [
      "Early jowl and midface descent",
      "Patients seeking a bridge before surgery",
      "Combination with fillers or energy devices",
    ],
    facts: {
      sessions: "1 visit; repeat 12–18 months",
      downtime: "2–7 days of tightness/swelling",
      results: "Immediate + progressive",
      duration: "12–18 months",
    },
    clinicalNote:
      "Set realistic expectations: threads reposition, they do not remove tissue. Ideal in patients with good skin quality and minimal excess laxity.",
    product: {
      name: "BluDerma Lift Thread System",
      descriptor: "Assorted PDO/PLLA barbed threads with cannula kit",
    },
  },
  {
    slug: "chemical-peels",
    name: "Chemical Peels",
    category: "Peels & Resurfacing",
    tagline: "Controlled exfoliation for clarity, tone and texture",
    image: IMG.procPeel,
    summary:
      "Medical-grade acid formulations remove damaged surface layers to reveal smoother, brighter skin and treat acne, pigmentation and early ageing.",
    concern:
      "A build-up of dull, damaged surface cells contributes to rough texture, breakouts, blocked pores and uneven pigment. Home exfoliation is often too weak to make a meaningful difference.",
    concernPoints: [
      "Rough, congested or dull skin surface",
      "Active acne and post-acne marks",
      "Superficial pigmentation and sun damage",
      "Fine lines and enlarged pores",
    ],
    howItWorks:
      "A tailored blend of acids (such as glycolic, salicylic, lactic, mandelic or TCA at varying strengths) is applied for a controlled time to loosen and remove damaged layers. As the skin heals, it renews with improved tone, clarity and collagen density. Depth is matched to the concern and skin type.",
    procedureSteps: [
      "Skin prep and priming (often 2–4 weeks at home)",
      "Degreasing and acid application under timing",
      "Neutralisation and cooling",
      "Barrier repair and strict sun protection",
    ],
    benefits: [
      "Brighter, smoother, clearer skin",
      "Fewer breakouts and unclogged pores",
      "Reduced superficial pigmentation",
      "Adjustable from lunchtime-light to deeper resurfacing",
    ],
    idealFor: [
      "Acne-prone and congested skin",
      "Dullness and mild pigmentation",
      "Maintenance 'glow' facials",
    ],
    facts: {
      sessions: "Course of 4–6 for best results",
      downtime: "None to a few days of flaking",
      results: "From the first peel, building over the course",
      duration: "Maintained with periodic peels",
    },
    clinicalNote:
      "Prime Fitzpatrick IV–VI skin and avoid over-frequent deep peels to prevent PIH. Always pair with daily broad-spectrum SPF.",
    product: {
      name: "BluDerma Peel Solutions",
      descriptor: "Graded glycolic / salicylic / mandelic peel range + neutraliser",
    },
  },
  {
    slug: "prp-hair",
    name: "PRP Hair Restoration",
    category: "Hair Restoration",
    tagline: "Regenerative platelet therapy for thinning hair",
    image: IMG.hair1,
    summary:
      "Platelet-rich plasma from the patient's own blood is injected into the scalp to strengthen weakening follicles, reduce shedding and improve density.",
    concern:
      "Early androgenetic thinning, increased shedding and reduced volume cause significant distress. Many patients want a natural, drug-sparing option or an adjunct that improves the results of medical therapy.",
    concernPoints: [
      "Early male and female pattern thinning",
      "Increased hair fall and reduced density",
      "Weak, miniaturising follicles",
      "Support after hair transplant surgery",
    ],
    howItWorks:
      "A small blood sample is centrifuged to concentrate platelets and their growth factors. This plasma is injected across the thinning scalp, where the growth factors prolong the active growth phase, improve follicle vascularity and reduce miniaturisation over a treatment course.",
    procedureSteps: [
      "Blood draw and centrifugation to isolate PRP",
      "Scalp cleansing and optional numbing",
      "Grid injections across the target zones",
      "Series scheduled monthly, then maintenance",
    ],
    benefits: [
      "Reduced shedding and stronger strands",
      "Improved density and coverage over time",
      "Uses the patient's own biological material",
      "Complements medical and surgical treatment",
    ],
    idealFor: [
      "Early-to-moderate pattern hair loss",
      "Patients avoiding or augmenting medication",
      "Post-transplant graft support",
    ],
    facts: {
      sessions: "3–4 monthly, then every 4–6 months",
      downtime: "None (mild tenderness)",
      results: "From 3–4 months",
      duration: "Maintained with top-ups",
    },
    clinicalNote:
      "Set expectations that PRP slows loss and improves quality more reliably than it regrows dense hair; strongest as part of a combination protocol.",
    product: {
      name: "BluDerma PRP Kit",
      descriptor: "Single-spin tubes, centrifuge protocol and scalp needle set",
    },
  },
  {
    slug: "pigmentation",
    name: "Pigmentation Treatment",
    category: "Skin Health",
    tagline: "Targeted clearance of spots, patches and dark marks",
    image: IMG.pairPigmentA,
    summary:
      "A combination approach — topicals, peels and laser — that lightens sunspots, freckles and post-inflammatory marks while protecting against recurrence.",
    concern:
      "Localised dark spots from sun exposure, hormones or previous inflammation create an uneven, aged appearance. Single-modality treatment often disappoints because pigment sits at different depths and is driven by ongoing triggers.",
    concernPoints: [
      "Sunspots, freckles and age spots",
      "Post-inflammatory marks after acne or injury",
      "Uneven blotchy tone",
      "Recurrence despite home creams",
    ],
    howItWorks:
      "Treatment is layered to the pigment's depth and cause: prescription tyrosinase inhibitors reduce new melanin, superficial peels lift epidermal pigment, and targeted laser or IPL clears stubborn deposits. Rigorous sun protection prevents the pigment returning.",
    procedureSteps: [
      "Wood's-lamp / dermatoscopic depth assessment",
      "Home priming with brightening actives",
      "In-clinic peels and/or laser sessions",
      "Long-term maintenance and photoprotection",
    ],
    benefits: [
      "Clearer, more even complexion",
      "Reduced visibility of spots and patches",
      "Personalised, cause-based plan",
      "Strategy to prevent recurrence",
    ],
    idealFor: [
      "Sun-damaged and blotchy skin",
      "Post-acne pigmentation",
      "Patients committed to sun protection",
    ],
    facts: {
      sessions: "Programme over 8–12 weeks+",
      downtime: "Varies by modality",
      results: "Progressive; weeks to months",
      duration: "Maintained with protection & upkeep",
    },
    clinicalNote:
      "Distinguish epidermal from dermal/mixed pigment before choosing energy devices. In deeper phototypes, prioritise topicals and gentle peels first.",
    product: {
      name: "BluDerma Bright Complex",
      descriptor: "Tyrosinase-inhibitor serum + high-protection SPF system",
    },
  },
  {
    slug: "acne-treatment",
    name: "Acne Treatment",
    category: "Skin Health",
    tagline: "Clear active breakouts and prevent scarring",
    image: IMG.acne1,
    summary:
      "A staged medical programme combining topicals, in-clinic procedures and lifestyle guidance to control active acne and limit long-term scarring.",
    concern:
      "Persistent breakouts affect confidence and, when inflamed, risk permanent scarring. Over-the-counter products frequently under-treat moderate-to-severe acne or irritate the skin barrier.",
    concernPoints: [
      "Active whiteheads, blackheads and inflamed spots",
      "Oily, congested skin",
      "Recurrent breakouts along the jaw and cheeks",
      "Early scarring and post-acne marks",
    ],
    howItWorks:
      "Care is matched to acne severity: topical or oral prescriptions calm inflammation and regulate oil, salicylic peels de-congest pores, and gentle extractions or light-based therapy target lesions. The goal is rapid control while protecting the barrier and preventing scarring.",
    procedureSteps: [
      "Grading of acne type and severity",
      "Prescription regimen and barrier support",
      "In-clinic peels / extractions as indicated",
      "Regular review and step-down maintenance",
    ],
    benefits: [
      "Fewer and less severe breakouts",
      "Reduced oiliness and congestion",
      "Lower risk of permanent scarring",
      "A sustainable long-term routine",
    ],
    idealFor: [
      "Teen and adult acne",
      "Hormonal jawline breakouts",
      "Patients wanting a medical, structured plan",
    ],
    facts: {
      sessions: "Ongoing programme with reviews",
      downtime: "Minimal",
      results: "6–12 weeks for meaningful control",
      duration: "Maintained; relapse-prone skin",
    },
    clinicalNote:
      "Treat early and adequately to prevent scarring. Consider hormonal work-up in adult female patients with jawline-pattern acne.",
    product: {
      name: "BluDerma Clear Regimen",
      descriptor: "Purifying cleanser, salicylic actives and barrier moisturiser",
    },
  },
  {
    slug: "rosacea-treatment",
    name: "Rosacea Management",
    category: "Skin Health",
    tagline: "Calm redness, flushing and reactive skin",
    image: IMG.portraitCalm,
    summary:
      "A gentle, evidence-based plan to reduce facial redness, visible vessels and flushing while rebuilding a resilient, comfortable skin barrier.",
    concern:
      "Chronic central-face redness, stinging and visible vessels are easily aggravated by the wrong products and by everyday triggers, leaving skin reactive and uncomfortable.",
    concernPoints: [
      "Persistent redness across cheeks and nose",
      "Flushing and burning/stinging sensations",
      "Visible small blood vessels (telangiectasia)",
      "Sensitivity to common skincare",
    ],
    howItWorks:
      "Management combines trigger identification, barrier-friendly skincare and targeted prescriptions to calm inflammation. Vascular laser or IPL can reduce persistent redness and visible vessels, while gentle maintenance keeps the barrier resilient.",
    procedureSteps: [
      "Subtype assessment and trigger review",
      "Barrier-repair skincare and prescriptions",
      "Vascular light/laser sessions if indicated",
      "Ongoing maintenance and flare management",
    ],
    benefits: [
      "Reduced background redness and flushing",
      "Fewer visible vessels",
      "A calmer, more comfortable barrier",
      "Personalised trigger-avoidance plan",
    ],
    idealFor: [
      "Chronic facial redness and flushing",
      "Sensitive, reactive skin",
      "Visible vessels seeking light therapy",
    ],
    facts: {
      sessions: "Ongoing; 2–4 light sessions if used",
      downtime: "Minimal",
      results: "Weeks; vessels reduce per session",
      duration: "Maintained; chronic condition",
    },
    clinicalNote:
      "Emphasise gentle, fragrance-free routines and daily mineral SPF. Manage expectations: control, not cure, is the realistic goal.",
    product: {
      name: "BluDerma Calm Line",
      descriptor: "Anti-redness serum, barrier cream and mineral SPF",
    },
  },
  {
    slug: "microneedling",
    name: "Microneedling",
    category: "Peels & Resurfacing",
    tagline: "Collagen induction for texture, scars and pores",
    image: IMG.procMicro,
    summary:
      "Fine needles create controlled micro-channels that trigger natural collagen production, improving acne scars, texture, pores and fine lines.",
    concern:
      "Textural concerns — acne scarring, enlarged pores, crepey fine lines and dull surface — are hard to shift topically because they originate in the skin's structural layers.",
    concernPoints: [
      "Rolling and boxcar acne scars",
      "Enlarged pores and uneven texture",
      "Fine lines and early laxity",
      "Dull, tired-looking skin",
    ],
    howItWorks:
      "A sterile device advances fine needles to a controlled depth, creating thousands of micro-injuries. The healing response stimulates fibroblasts to produce fresh collagen and elastin, remodelling scars and refining texture. Serums or PRP can be paired to enhance results.",
    procedureSteps: [
      "Cleanse and topical numbing",
      "Controlled-depth needling passes across the area",
      "Application of a soothing/regenerative serum",
      "Barrier care; course of sessions scheduled",
    ],
    benefits: [
      "Smoother texture and refined pores",
      "Improved acne scarring over a course",
      "Boosted product and PRP absorption",
      "Suitable across many skin tones",
    ],
    idealFor: [
      "Acne scarring and rough texture",
      "Early fine lines and large pores",
      "Combination with PRP for enhanced results",
    ],
    facts: {
      sessions: "3–6, spaced 4 weeks apart",
      downtime: "1–3 days of redness",
      results: "Progressive over the course",
      duration: "Long-lasting with maintenance",
    },
    clinicalNote:
      "Maintain sterile single-use tips and appropriate depth per zone. Avoid over-treating active acne or inflamed skin.",
    product: {
      name: "BluDerma Micro-Roller System",
      descriptor: "Motorised pen, sterile cartridges and recovery serum",
    },
  },
  {
    slug: "hifu-ultherapy",
    name: "HIFU Skin Tightening",
    category: "Lifting & Contouring",
    tagline: "Focused ultrasound lifting from the inside out",
    image: IMG.procDevice,
    summary:
      "High-intensity focused ultrasound delivers energy to deep support layers, tightening and subtly lifting skin on the face and neck with no surgery.",
    concern:
      "Mild skin laxity along the jawline, neck and brow makes patients look tired or older, yet many are unwilling to consider surgery or downtime.",
    concernPoints: [
      "Loosening along the jawline and neck",
      "Mild brow and cheek descent",
      "Early loss of skin firmness",
      "Desire for a no-surgery, no-downtime option",
    ],
    howItWorks:
      "Focused ultrasound is delivered to precise depths, including the deep support layer targeted in facelift surgery. The controlled thermal coagulation points trigger tissue contraction and a months-long collagen-rebuilding response, gradually tightening and lifting the skin.",
    procedureSteps: [
      "Mapping of treatment lines and depths",
      "Coupling gel and transducer application",
      "Sequential focused-ultrasound passes",
      "No downtime; results build over 2–3 months",
    ],
    benefits: [
      "Gradual, natural tightening and lift",
      "Reaches deep support layers non-invasively",
      "No incisions and minimal downtime",
      "Stimulates the patient's own collagen",
    ],
    idealFor: [
      "Mild-to-moderate laxity",
      "Jawline, neck and brow firming",
      "Patients avoiding surgery",
    ],
    facts: {
      sessions: "Usually 1, repeat 12–18 months",
      downtime: "None to minimal",
      results: "Build over 8–12 weeks",
      duration: "12–18 months",
    },
    clinicalNote:
      "Best in patients with mild laxity and good skin quality; heavy or very lax tissue responds better to surgical or combined approaches.",
    product: {
      name: "BluDerma Focus Ultrasound Cartridges",
      descriptor: "Multi-depth transducer cartridges and coupling gel",
    },
  },
  {
    slug: "scar-revision",
    name: "Scar Revision",
    category: "Peels & Resurfacing",
    tagline: "Soften, flatten and blend scars of all kinds",
    image: IMG.pairScarA,
    summary:
      "A tailored combination of laser, microneedling, injectables and topicals to improve the colour, texture and contour of acne, surgical and injury scars.",
    concern:
      "Scars that are raised, depressed, red or discoloured draw attention and can affect confidence. No single treatment suits every scar, so a targeted, layered plan is needed.",
    concernPoints: [
      "Depressed (atrophic) acne or chickenpox scars",
      "Raised hypertrophic or keloid scars",
      "Red, dark or discoloured scars",
      "Surgical and injury scars",
    ],
    howItWorks:
      "The scar is first classified, then matched to the right tools: resurfacing laser and microneedling remodel atrophic scars, intralesional injections flatten raised scars, vascular laser fades redness, and subcision releases tethered scars. Treatments are staged for cumulative improvement.",
    procedureSteps: [
      "Scar classification and photographic mapping",
      "Modality selection matched to scar type",
      "Staged in-clinic sessions",
      "Silicone/topical support and sun protection",
    ],
    benefits: [
      "Flatter, smoother, better-blended scars",
      "Reduced redness or discolouration",
      "Improved skin texture around the scar",
      "Personalised, scar-specific plan",
    ],
    idealFor: [
      "Atrophic acne scarring",
      "Raised or discoloured scars",
      "Surgical and traumatic scars",
    ],
    facts: {
      sessions: "Multiple, staged over months",
      downtime: "Varies by modality",
      results: "Progressive; scars improve, not vanish",
      duration: "Long-lasting improvement",
    },
    clinicalNote:
      "Counsel that revision improves rather than erases scars. Screen keloid-prone patients carefully before ablative approaches.",
    product: {
      name: "BluDerma Scar Care Set",
      descriptor: "Silicone gel, subcision tools and resurfacing consumables",
    },
  },
  {
    slug: "melasma-treatment",
    name: "Melasma Treatment",
    category: "Skin Health",
    tagline: "Gentle, sustained control of stubborn facial pigment",
    image: IMG.pairPigmentA,
    summary:
      "A conservative, maintenance-focused programme to lighten melasma patches while avoiding the aggressive treatment that can make this condition worse.",
    concern:
      "Melasma produces symmetrical brown patches on the cheeks, forehead and upper lip, often driven by hormones and sun. It is notoriously relapse-prone and can flare with heat and over-aggressive lasers.",
    concernPoints: [
      "Symmetrical brown/grey facial patches",
      "Worsening with sun and heat exposure",
      "Relapse after previous treatments",
      "Hormonal aggravation (pregnancy, contraception)",
    ],
    howItWorks:
      "The cornerstone is strict photoprotection combined with tyrosinase-inhibiting topicals. Gentle peels and carefully-dosed low-fluence laser may be layered in, always favouring under-treatment to avoid rebound. Long-term maintenance keeps pigment suppressed.",
    procedureSteps: [
      "Confirm melasma vs other pigment; assess depth",
      "Rigorous daily photoprotection plan",
      "Topical brightening regimen",
      "Cautious peels/laser and long-term maintenance",
    ],
    benefits: [
      "Lighter, less noticeable patches",
      "A safe, relapse-aware strategy",
      "Reduced flares with trigger control",
      "Maintainable long-term routine",
    ],
    idealFor: [
      "Hormone- and sun-driven melasma",
      "Patients who relapsed after aggressive treatment",
      "Those committed to daily sun protection",
    ],
    facts: {
      sessions: "Ongoing; gentle in-clinic add-ons",
      downtime: "Minimal by design",
      results: "Gradual; measured in months",
      duration: "Requires ongoing maintenance",
    },
    clinicalNote:
      "Avoid high-energy lasers and aggressive heat. Tinted mineral SPF (with iron oxides) meaningfully outperforms untinted for visible-light-driven melasma.",
    product: {
      name: "BluDerma Melasma Protocol",
      descriptor: "Tinted mineral SPF, brightening actives and gentle peel",
    },
  },
  {
    slug: "anti-aging-program",
    name: "Anti-Ageing Program",
    category: "Skin Health",
    tagline: "A structured, whole-face rejuvenation roadmap",
    image: IMG.portraitSmile,
    summary:
      "A physician-designed programme that sequences prevention, correction and maintenance — combining skincare, injectables and energy devices into one plan.",
    concern:
      "Ageing shows across multiple layers at once — lines, volume loss, laxity, tone and texture. Treating one concern in isolation gives incomplete, sometimes unbalanced, results.",
    concernPoints: [
      "Combined lines, volume loss and laxity",
      "Dull tone and rough texture",
      "Wanting a coordinated rather than piecemeal plan",
      "Prevention as well as correction",
    ],
    howItWorks:
      "After a full-face assessment, a phased roadmap is built: medical-grade skincare and photoprotection as the foundation, injectables for lines and volume, energy devices for tone and tightening, and scheduled maintenance. Each element is sequenced to complement the others.",
    procedureSteps: [
      "Comprehensive skin and facial assessment",
      "Personalised phased treatment roadmap",
      "Staged procedures across visits",
      "Scheduled maintenance and annual review",
    ],
    benefits: [
      "Balanced, natural, whole-face results",
      "Prevention plus correction in one plan",
      "Clear roadmap and budgeting over time",
      "Consistency through scheduled maintenance",
    ],
    idealFor: [
      "Patients wanting a long-term relationship, not a one-off",
      "Multiple simultaneous ageing concerns",
      "Those seeking natural, gradual change",
    ],
    facts: {
      sessions: "Phased across the year",
      downtime: "Varies by component",
      results: "Cumulative and maintained",
      duration: "Ongoing with maintenance",
    },
    clinicalNote:
      "Anchor the plan in daily actives and SPF; procedures amplify but never replace the home foundation. Re-assess and re-photograph at each phase.",
    product: {
      name: "BluDerma Age-Well System",
      descriptor: "Retinoid + antioxidant + SPF core regimen and plan template",
    },
  },
];

export const categoryOrder: TreatmentCategory[] = [
  "Injectables",
  "Laser & Energy",
  "Lifting & Contouring",
  "Peels & Resurfacing",
  "Skin Health",
  "Hair Restoration",
];

export function getTreatment(slug: string): Treatment | undefined {
  return treatments.find((t) => t.slug === slug);
}

export function getAllSlugs(): string[] {
  return treatments.map((t) => t.slug);
}

export function getRelated(slug: string, count = 3): Treatment[] {
  const current = getTreatment(slug);
  if (!current) return treatments.slice(0, count);
  const sameCat = treatments.filter(
    (t) => t.category === current.category && t.slug !== slug
  );
  const others = treatments.filter(
    (t) => t.category !== current.category && t.slug !== slug
  );
  return [...sameCat, ...others].slice(0, count);
}
