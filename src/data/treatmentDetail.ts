import {
  CATEGORY_BY_SLUG,
  type HubCategory,
  type HubTreatment,
} from "./hub";

/**
 * What a treatment page carries, modelled on the procedure pages the Korean
 * marketplaces publish (unni.app and friends): options, what's included, how
 * long it takes, what the anaesthesia is, recovery, precautions, side effects
 * and an FAQ.
 *
 * One thing is deliberately missing everywhere in here: **price**. The
 * reference pages lead with tiered package pricing; this platform is
 * enquiry-first (G-1), so the same tiers appear as options described by shot
 * count, areas and sessions, and the cost comes from a doctor after an
 * assessment.
 *
 * Detail is written per CATEGORY, not per treatment. Eighteen honest category
 * protocols beat a hundred and eight invented ones, and anything genuinely
 * specific to a single treatment goes in OVERRIDES below. Everything here is
 * general information — the page says so, and says the specifics are settled
 * at consultation.
 */

export interface TreatmentOption {
  /** What distinguishes this option — shots, areas, depth. Never a price. */
  name: string;
  detail: string;
  popular?: boolean;
}

export interface TreatmentFaq {
  q: string;
  a: string;
}

export interface StoryBlock {
  /** Numbered on the page, the way the reference numbers its panels. */
  heading: string;
  body: string;
  image: string;
}

export interface TreatmentDetail {
  /** Three plain statements: who this is actually for. */
  recommendedFor: string[];
  summary: string;
  howItWorks: string;
  options: TreatmentOption[];
  areas: string[];
  duration: string;
  anaesthesia: string;
  sessions: string;
  downtime: string;
  results: string;
  includes: string[];
  excludes: string[];
  precautions: string[];
  sideEffects: string[];
  notSuitable: string[];
  aftercare: string[];
  faqs: TreatmentFaq[];
}

type Detail = TreatmentDetail;

/**
 * "Recommended for" — the section the reference puts directly under the
 * options. Written as the three situations that genuinely point at this
 * category, not as three ways of saying "great skin".
 */
const RECOMMENDED: Record<string, string[]> = {
  "glass-skin": [
    "Your skin looks tired and flat in photographs even when it feels fine",
    "Makeup sits unevenly or clings to dry patches by the afternoon",
    "You want a finish for an event without changing your face",
  ],
  lifting: [
    "The jawline is softer than it was and you can date the change",
    "You have been told you need a surgical lift but want to try what is short of one",
    "Skin feels loose along the cheeks and neck rather than lined",
  ],
  botox: [
    "Lines appear when you move and are starting to stay when you don't",
    "You want the movement softened rather than removed",
    "A heavy jaw, a gummy smile or underarm sweating you want addressed",
  ],
  fillers: [
    "Your face reads as tired rather than lined — flat cheeks, hollow temples",
    "You want a contour refined, not a face changed",
    "Creams have plateaued because the problem is volume, not surface",
  ],
  laser: [
    "Pigment, texture or vessels that topicals have not shifted",
    "You want resurfacing planned for a deeper skin tone, cautiously",
    "You accept a course rather than expecting one session to do it",
  ],
  "hair-removal": [
    "Shaving or waxing has become a weekly tax on your time",
    "Ingrown hairs and dark marks follow every session",
    "You want the hair reduced permanently rather than managed",
  ],
  "hair-restoration": [
    "You are shedding more than usual and want the cause found first",
    "The parting is widening or the temples are moving back",
    "You want to hold what you have while regrowing what recently went",
  ],
  "acne-scars": [
    "Active breakouts, or the marks and pits they left behind",
    "You have tried strong products and the skin is now sensitive too",
    "You want the medical problem settled before anything cosmetic runs",
  ],
  pigmentation: [
    "Patches that darken every summer and never fully clear",
    "Melasma that has come back after aggressive treatment elsewhere",
    "You want a conservative plan you can maintain rather than a quick strip",
  ],
  eyes: [
    "You look tired in photographs regardless of how you slept",
    "Shadowing, hollowing or crepey skin under the eye",
    "You want to know which of the three you actually have",
  ],
  nose: [
    "A dorsal hump or a drooping tip you want softened without surgery",
    "You want to see the change before committing to anything permanent",
    "Small asymmetries that bother you in photographs",
  ],
  "face-contour": [
    "A heavy lower face from muscle rather than weight",
    "Fullness under the chin that diet has not touched",
    "You want definition along the jaw without surgery",
  ],
  "body-fat": [
    "Pockets that stay put whatever the scale says",
    "You are at a steady weight and want shaping, not loss",
    "Skin laxity you would rather address alongside the fat",
  ],
  wellness: [
    "Bloodwork has shown a deficiency that shows in your skin and hair",
    "You are running a treatment course and want to support it properly",
    "You want the nutrition side handled by the same team",
  ],
  bridal: [
    "You have a date and want the sequence planned backwards from it",
    "Acne, pigment or scarring to settle before the polish starts",
    "You would rather not try anything new in the final fortnight",
  ],
  mens: [
    "Thicker skin and stronger muscles that need dosing adjusted",
    "You want definition rather than softening",
    "Beard-area irritation, scarring or hair loss handled together",
  ],
  dental: [
    "Discolouration that whitening toothpaste has not moved",
    "You want the smile assessed as part of the face, not separately",
    "Alignment or gum line bothering you in photographs",
  ],
  "skin-health": [
    "Something that itches, spreads or will not settle",
    "A mole or patch you want looked at properly",
    "A chronic condition to bring under control before any elective work",
  ],
};

/** Applied to every treatment unless its category or slug says otherwise. */
const BASE: Pick<Detail, "includes" | "excludes" | "precautions" | "faqs"> = {
  includes: [
    "Consultation and skin assessment with the treating doctor",
    "The procedure itself, performed by a qualified clinician",
    "Post-treatment review and aftercare instructions",
  ],
  excludes: [
    "Prescription medicines, where the doctor prescribes them",
    "Home-care products recommended alongside the course",
    "Any additional area or session added on the day",
  ],
  precautions: [
    "Tell the doctor about every medicine and supplement you take, including blood thinners and isotretinoin.",
    "Avoid alcohol and blood-thinning painkillers for 24 hours before and after, unless prescribed.",
    "Sun exposure before or after the treatment increases the risk of pigmentation — use SPF 50 daily.",
    "Reschedule if the treatment area has an active infection, cold sore or open wound.",
  ],
  faqs: [
    {
      q: "How do I know this is the right treatment for me?",
      a: "You don't yet, and neither do we from a page. The assessment decides it — quite often the answer is a different treatment, or the same one at a different depth or interval.",
    },
    {
      q: "What does it cost?",
      a: "It isn't listed anywhere on this site, on purpose. What a course costs depends on your skin, the number of sessions and what else is going on. You get the full plan and the final cost in consultation, before anything is booked.",
    },
    {
      q: "Can I have it done before an event?",
      a: "Yes, with the right runway. Anything involving collagen or pigment wants months, not days, and nothing new should be tried inside the final two weeks before an event.",
    },
  ],
};

const CATEGORY_DETAIL: Record<string, Omit<Detail, "recommendedFor">> = {
  // ── Glass skin ────────────────────────────────────────────────────────
  "glass-skin": {
    ...BASE,
    summary:
      "Hydration-led treatments that improve how light reflects off the skin — the finish Korean dermatology calls glass skin. It is a barrier and water-content result, not a bleaching one.",
    howItWorks:
      "Micro-injected or infused hyaluronic acid holds water in the dermis while the barrier is repaired on the surface. Better-hydrated skin scatters less light, which is what reads as glow.",
    options: [
      { name: "Single session", detail: "Full face · a first look at how your skin responds" },
      { name: "Course of three", detail: "Full face · spaced 3–4 weeks apart", popular: true },
      { name: "Face and neck", detail: "Extended course including the neck and décolleté" },
    ],
    areas: ["Full face", "Neck", "Décolleté", "Back of hands"],
    duration: "30–45 minutes",
    anaesthesia: "Topical numbing cream where injectables are used; none for infusion facials",
    sessions: "3–4 sessions, 3–4 weeks apart, then maintenance every 4–6 months",
    downtime: "None to minimal. Small bumps or redness settle within a few hours to a day.",
    results: "Visible from the first week, building over the course",
    sideEffects: [
      "Temporary redness and small injection bumps",
      "Mild bruising at injection points",
      "Short-lived tenderness",
    ],
    notSuitable: [
      "Active skin infection in the treatment area",
      "Known allergy to hyaluronic acid or lidocaine",
      "Pregnancy and breastfeeding, for injectable options",
    ],
    aftercare: [
      "Leave the skin bare for 12 hours — no makeup over injection points",
      "No sauna, steam or heavy exercise for 24 hours",
      "Daily SPF 50, reapplied",
    ],
  },

  // ── Lifting ───────────────────────────────────────────────────────────
  lifting: {
    ...BASE,
    summary:
      "Non-surgical tightening for laxity along the jawline, cheeks and neck, using focused energy or absorbable threads to trigger new collagen.",
    howItWorks:
      "Energy is delivered below the surface at a set depth, heating the tissue enough to contract it immediately and to provoke collagen remodelling over the following months. Threads add mechanical lift while they dissolve.",
    options: [
      { name: "300 shots", detail: "Lower face and jawline · 1 session" },
      { name: "600 shots", detail: "Full face · 1 session", popular: true },
      { name: "900 shots", detail: "Full face and neck · 1 session" },
    ],
    areas: ["Jawline", "Cheeks", "Brow", "Neck", "Under the chin"],
    duration: "45–90 minutes depending on the area",
    anaesthesia: "Topical numbing cream; local anaesthetic for threads",
    sessions: "Usually one, repeated at 12–18 months",
    downtime: "None for energy devices. Threads: 3–7 days of swelling and tightness.",
    results: "From 6–8 weeks, peaking around 3 months as collagen rebuilds",
    sideEffects: [
      "Redness, swelling and tenderness for a few days",
      "Bruising, particularly with threads",
      "Temporary numbness or tingling over treated areas",
      "Rarely, a palpable thread end or dimpling that settles",
    ],
    notSuitable: [
      "Severe skin laxity that needs a surgical lift",
      "Active infection or inflammatory disease in the area",
      "Pregnancy and breastfeeding",
      "Keloid tendency, for thread options",
    ],
    aftercare: [
      "Sleep face-up for the first few nights after threads",
      "No dental work, sauna or facial massage for two weeks after threads",
      "Avoid strenuous exercise for 48 hours",
    ],
  },

  // ── Botox ─────────────────────────────────────────────────────────────
  botox: {
    ...BASE,
    summary:
      "A muscle relaxant placed in specific facial muscles to soften the lines their movement creates, and to slow the point at which those lines become permanent.",
    howItWorks:
      "The injected protein blocks the signal between nerve and muscle at the treated points. The muscle relaxes, the skin above it stops folding, and the line softens. It wears off as the signal returns.",
    options: [
      { name: "One area", detail: "Forehead, frown lines or crow's feet" },
      { name: "Three areas", detail: "Upper face — the usual first course", popular: true },
      { name: "Advanced", detail: "Jawline slimming, gummy smile, neck bands or underarms" },
    ],
    areas: ["Forehead", "Frown lines", "Crow's feet", "Jawline", "Neck bands", "Underarms"],
    duration: "15–30 minutes",
    anaesthesia: "None usually needed; numbing cream on request",
    sessions: "One, repeated every 3–4 months at first, then less often",
    downtime: "None. Small raised points settle within 30 minutes.",
    results: "Starts at 3–5 days, full effect by 2 weeks",
    sideEffects: [
      "Small bruises at injection points",
      "Mild headache for a day or two",
      "Temporary heaviness or asymmetry, which settles as it wears off",
    ],
    notSuitable: [
      "Pregnancy and breastfeeding",
      "Neuromuscular disorders such as myasthenia gravis",
      "Active infection at the injection site",
      "Known allergy to the toxin or its carrier",
    ],
    aftercare: [
      "Stay upright for four hours",
      "No rubbing, massaging or facials over the area for 24 hours",
      "No sauna, steam or heavy exercise for 24 hours",
    ],
  },

  // ── Fillers ───────────────────────────────────────────────────────────
  fillers: {
    ...BASE,
    summary:
      "Injectable gel used to replace structural volume the face has lost, or to refine a contour. It restores what has deflated rather than pulling what has descended.",
    howItWorks:
      "Hyaluronic acid gel is placed at a chosen depth — deep on bone for structure, superficially for fine lines. It holds water and gives physical support, and dissolves gradually over months.",
    options: [
      { name: "Single syringe", detail: "One area — lips, tear trough or chin" },
      { name: "Two syringes", detail: "Midface restoration or full contouring", popular: true },
      { name: "Full assessment", detail: "Staged plan across several areas and visits" },
    ],
    areas: ["Cheeks", "Lips", "Tear trough", "Chin", "Jawline", "Nasolabial folds", "Temples"],
    duration: "30–45 minutes",
    anaesthesia: "Topical numbing cream; most fillers also contain lidocaine",
    sessions: "One, with a review at 2 weeks. Repeat at 9–18 months depending on the area.",
    downtime: "24–72 hours of swelling; bruising can last up to a week",
    results: "Immediate, settling into the final shape over 2–4 weeks",
    sideEffects: [
      "Swelling, bruising and tenderness",
      "Lumps or asymmetry that usually settle or can be adjusted",
      "Rarely, vascular occlusion — which is why it is a doctor-only procedure",
    ],
    notSuitable: [
      "Pregnancy and breastfeeding",
      "Active infection, or a cold sore near the lips",
      "Autoimmune disease affecting healing, without specialist clearance",
      "Unrealistic expectations of what volume can achieve",
    ],
    aftercare: [
      "No pressure, massage or sleeping face-down for 48 hours",
      "No dental work for two weeks",
      "Report any blanching, severe pain or vision change immediately",
    ],
  },

  // ── Laser & energy ────────────────────────────────────────────────────
  laser: {
    ...BASE,
    summary:
      "Light and energy devices tuned to a specific target in the skin — pigment, vessels, water or collagen — to resurface, clear or tighten without a scalpel.",
    howItWorks:
      "Each wavelength is absorbed preferentially by one chromophore. Choosing the wavelength, the energy and the pulse duration is what makes it selective, and what makes settings matter more than the machine's brand name.",
    options: [
      { name: "Single session", detail: "A test-and-treat first pass at conservative settings" },
      { name: "Course of four", detail: "Spaced 3–4 weeks apart — the usual protocol", popular: true },
      { name: "Combination", detail: "Two wavelengths in one visit, where the assessment supports it" },
    ],
    areas: ["Full face", "Neck", "Chest", "Hands", "Localised patches"],
    duration: "20–45 minutes",
    anaesthesia: "Topical numbing cream for ablative and fractional settings",
    sessions: "3–6 sessions, 3–4 weeks apart",
    downtime: "A few hours of redness for gentle settings; 3–7 days of peeling for fractional",
    results: "Progressive across the course, with remodelling continuing for 3 months",
    sideEffects: [
      "Redness, warmth and swelling for hours to days",
      "Temporary darkening of pigment before it clears",
      "Post-inflammatory hyperpigmentation, the main risk in deeper skin tones",
      "Rarely, blistering or a burn at incorrect settings",
    ],
    notSuitable: [
      "Recent sun exposure or a fresh tan",
      "Isotretinoin within the last 6 months, for ablative settings",
      "Active infection, eczema or psoriasis in the area",
      "Pregnancy, for most protocols",
    ],
    aftercare: [
      "No sun, and SPF 50 reapplied through the day",
      "No actives — retinoids, acids, vitamin C — for 5 days",
      "Do not pick or scrub flaking skin",
    ],
  },

  // ── Laser hair removal ────────────────────────────────────────────────
  "hair-removal": {
    ...BASE,
    summary:
      "Permanent hair reduction using a laser tuned to the pigment in the follicle. It works in cycles, which is why it is always a course and never a single appointment.",
    howItWorks:
      "The laser heats melanin inside the follicle and disables it — but only follicles currently in their growth phase respond, and at any moment that is a fraction of them. Sessions are spaced to catch the rest as they cycle in.",
    options: [
      { name: "Small area", detail: "Upper lip, chin, underarms or bikini line" },
      { name: "Medium area", detail: "Half arms, half legs or back", popular: true },
      { name: "Full body", detail: "All areas as one course" },
    ],
    areas: ["Face", "Underarms", "Arms", "Legs", "Bikini", "Back and chest"],
    duration: "10 minutes for a small area, up to 90 for full body",
    anaesthesia: "None. Contact cooling handles the sting.",
    sessions: "6–8 sessions, 4–6 weeks apart, then occasional top-ups",
    downtime: "None. Redness around the follicles settles within hours.",
    results: "Noticeable reduction from the third session, near-permanent by the end of the course",
    sideEffects: [
      "Redness and bumps around follicles for a few hours",
      "Temporary darkening or lightening of the skin",
      "Paradoxical hair growth, rarely, on fine facial hair",
    ],
    notSuitable: [
      "Recent tanning, including self-tan",
      "Light, grey or red hair, which lacks the pigment the laser targets",
      "Active infection or open skin in the area",
      "Pregnancy, by convention rather than evidence of harm",
    ],
    aftercare: [
      "Shave between sessions — never wax, thread or pluck",
      "No sauna, steam or hot showers for 24 hours",
      "Daily SPF on exposed areas throughout the course",
    ],
  },

  // ── Hair restoration ──────────────────────────────────────────────────
  "hair-restoration": {
    ...BASE,
    summary:
      "Medical and regenerative treatment for shedding and thinning, aimed at holding the hair you still have while regrowing what recently went.",
    howItWorks:
      "Growth factors, micro-injections and medical therapy work on the follicle's cycle — prolonging the growth phase and reversing miniaturisation. Follicles that have been dormant for years do not come back, which is why timing matters.",
    options: [
      { name: "Single session", detail: "Scalp assessment with a first treatment" },
      { name: "Course of four", detail: "Monthly, then quarterly maintenance", popular: true },
      { name: "Combination protocol", detail: "In-clinic treatment plus medical therapy at home" },
    ],
    areas: ["Crown", "Hairline", "Mid-scalp", "Parting", "Eyebrows and beard"],
    duration: "45–60 minutes",
    anaesthesia: "Topical numbing; a scalp block for more sensitive protocols",
    sessions: "4 monthly sessions, then maintenance every 3–4 months",
    downtime: "None. Scalp tenderness for a day.",
    results: "Reduced shedding by 6–8 weeks, visible density from 3–4 months",
    sideEffects: [
      "Scalp tenderness, redness and mild swelling",
      "Pinpoint bleeding at injection sites",
      "Temporary increased shedding in the first weeks",
    ],
    notSuitable: [
      "Active scalp infection or inflammatory scalp disease",
      "Untreated iron, thyroid or vitamin D deficiency — those are corrected first",
      "Bleeding disorders or anticoagulant therapy, without clearance",
    ],
    aftercare: [
      "No hair wash for 24 hours",
      "No colouring or chemical treatments for a week",
      "Blood tests before starting — shedding usually has a cause worth finding",
    ],
  },

  // ── Acne & scars ──────────────────────────────────────────────────────
  "acne-scars": {
    ...BASE,
    summary:
      "Treatment for active acne and for what it leaves behind. The two are different problems: the first is inflammatory, the second is a collagen defect, and they are treated in that order.",
    howItWorks:
      "Active acne is settled first with medical therapy and gentle procedures. Scarring is then remodelled — microneedling, fractional laser or subcision break the tethering and drive new collagen into the depression.",
    options: [
      { name: "Active acne protocol", detail: "Medical management with supporting procedures" },
      { name: "Scar revision course", detail: "6 sessions, 4 weeks apart", popular: true },
      { name: "Combination", detail: "Subcision for tethered scars plus resurfacing" },
    ],
    areas: ["Cheeks", "Temples", "Jawline", "Forehead", "Back and chest"],
    duration: "45–60 minutes",
    anaesthesia: "Topical numbing cream; local anaesthetic for subcision",
    sessions: "4–6 sessions, 4 weeks apart, reviewed at the end",
    downtime: "2–5 days of redness and roughness; bruising after subcision",
    results: "Gradual across the course; scar remodelling continues for 6 months after the last session",
    sideEffects: [
      "Redness, swelling and pinpoint bleeding on the day",
      "Temporary worsening of pigmentation in deeper skin tones",
      "Bruising, particularly after subcision",
      "A short flare of breakouts in the first weeks",
    ],
    notSuitable: [
      "Isotretinoin within the last 6 months, for resurfacing",
      "Active infection or cold sores in the area",
      "Keloid scarring tendency, without a test patch",
    ],
    aftercare: [
      "Barrier repair only for 5 days — no actives",
      "SPF 50 daily, reapplied, throughout the course",
      "Do not pick; scarring is what you are here to fix",
    ],
  },

  // ── Pigmentation ──────────────────────────────────────────────────────
  pigmentation: {
    ...BASE,
    summary:
      "Treatment for melasma, sun damage, post-inflammatory marks and uneven tone — deliberately conservative, because pigment punished aggressively tends to come back worse.",
    howItWorks:
      "Pigment production is suppressed with topical and oral therapy while existing pigment is broken up with low-fluence laser or peels. Sun protection is part of the treatment, not advice bolted on afterwards.",
    options: [
      { name: "Peel course", detail: "6 superficial peels, 2–3 weeks apart" },
      { name: "Laser toning", detail: "Low-fluence sessions plus topical therapy", popular: true },
      { name: "Melasma protocol", detail: "Long-term combination plan with maintenance" },
    ],
    areas: ["Cheeks", "Upper lip", "Forehead", "Neck", "Hands"],
    duration: "20–40 minutes",
    anaesthesia: "None usually needed",
    sessions: "6–10 sessions, 2–4 weeks apart, then maintenance",
    downtime: "None to 3 days of light flaking, depending on depth",
    results: "Gradual — expect months, not weeks, and expect to maintain it",
    sideEffects: [
      "Stinging and redness during and after treatment",
      "Light flaking for a few days",
      "Rebound darkening if sun protection lapses",
    ],
    notSuitable: [
      "Recent sun exposure or an active tan",
      "Pregnancy, for most topical and oral agents",
      "Isotretinoin within 6 months, for deeper peels",
    ],
    aftercare: [
      "SPF 50 every day, reapplied — this is the treatment, not an add-on",
      "No scrubs, acids or retinoids for 5 days after each session",
      "Expect maintenance; melasma is controlled rather than cured",
    ],
  },

  // ── Eyes ──────────────────────────────────────────────────────────────
  eyes: {
    ...BASE,
    summary:
      "Treatment for the under-eye — shadowing, hollowing, crepey skin and puffiness. Which one you have decides the treatment entirely, and they look alike in a mirror.",
    howItWorks:
      "Pigment is treated topically and with gentle laser; hollowing is filled at a deep, conservative level; crepey skin is thickened with boosters or energy; true fat herniation is surgical and is referred, not treated.",
    options: [
      { name: "Assessment and topical plan", detail: "For pigment-led circles" },
      { name: "Tear-trough correction", detail: "Volume replacement, reviewed at 2 weeks", popular: true },
      { name: "Skin quality course", detail: "Boosters or energy for crepey texture" },
    ],
    areas: ["Under-eye", "Tear trough", "Crow's feet", "Upper lid", "Brow"],
    duration: "20–40 minutes",
    anaesthesia: "Topical numbing cream",
    sessions: "One for volume, with review; 3–4 for skin quality",
    downtime: "Swelling and bruising for 3–7 days after injectables",
    results: "Immediate for volume, settling at 2–4 weeks. Pigment work takes months.",
    sideEffects: [
      "Bruising — the under-eye bruises more readily than anywhere else",
      "Swelling, sometimes lasting a week",
      "Lumps or a bluish tinge if placed too superficially",
    ],
    notSuitable: [
      "Significant fat herniation, which needs surgery",
      "Fluid retention or thyroid eye disease, until managed",
      "Pregnancy and breastfeeding",
    ],
    aftercare: [
      "Sleep propped up for two nights",
      "Cold compresses on the first day, gently",
      "No rubbing the area for a week",
    ],
  },

  // ── Nose ──────────────────────────────────────────────────────────────
  nose: {
    ...BASE,
    summary:
      "Non-surgical reshaping of the nasal profile with filler — straightening a dorsal hump in appearance, lifting the tip, improving symmetry. It adds; it cannot reduce.",
    howItWorks:
      "Small, precise amounts of firm filler are placed along the dorsum and at the tip to change the profile line. It is one of the highest-risk injectable sites, and is doctor-only for that reason.",
    options: [
      { name: "Profile refinement", detail: "Dorsum and tip, one session", popular: true },
      { name: "Tip lift", detail: "Focused correction of a drooping tip" },
      { name: "Review and top-up", detail: "Adjustment at two weeks where needed" },
    ],
    areas: ["Nasal bridge", "Tip", "Columella", "Nasal base"],
    duration: "20–30 minutes",
    anaesthesia: "Topical numbing cream",
    sessions: "One, with a two-week review. Repeat at 12–18 months.",
    downtime: "Minimal swelling for 2–3 days; occasional bruising",
    results: "Immediate, settling at 2 weeks",
    sideEffects: [
      "Swelling and tenderness",
      "Bruising around the bridge and under the eyes",
      "Rarely, vascular occlusion — the reason this is never a salon procedure",
    ],
    notSuitable: [
      "Previous surgical rhinoplasty, without specialist assessment",
      "Wanting the nose made smaller — filler cannot reduce",
      "Active skin infection over the nose",
      "Pregnancy and breastfeeding",
    ],
    aftercare: [
      "No glasses resting on the bridge for two weeks",
      "No pressure or massage on the area",
      "Report blanching, severe pain or vision change immediately",
    ],
  },

  // ── Face contour ──────────────────────────────────────────────────────
  "face-contour": {
    ...BASE,
    summary:
      "Reshaping the lower face and jawline — slimming a heavy masseter, defining a jaw, reducing submental fullness — without surgery.",
    howItWorks:
      "Muscle bulk is reduced with a relaxant, fat pockets with injectable lipolysis or cooling, and definition added with structural filler along the jaw. Most plans use two of the three.",
    options: [
      { name: "Jaw slimming", detail: "Masseter reduction, reviewed at 4 weeks" },
      { name: "Jawline definition", detail: "Structural contouring along the jaw", popular: true },
      { name: "Double chin reduction", detail: "A course targeting submental fullness" },
    ],
    areas: ["Masseter", "Jawline", "Chin", "Under the chin", "Cheeks"],
    duration: "20–45 minutes",
    anaesthesia: "Topical numbing cream",
    sessions: "One for slimming, repeated at 4–6 months; 2–4 for fat reduction",
    downtime: "None to 3 days of swelling depending on the approach",
    results: "Slimming visible at 4–6 weeks; contouring immediate; fat reduction over 8–12 weeks",
    sideEffects: [
      "Swelling and tenderness, sometimes marked after fat reduction",
      "Bruising",
      "Temporary chewing fatigue after masseter treatment",
    ],
    notSuitable: [
      "Bone-driven facial width, which no injectable will change",
      "Pregnancy and breastfeeding",
      "Bleeding disorders, without clearance",
    ],
    aftercare: [
      "Soft food for a day after masseter treatment",
      "No massage over treated fat pockets",
      "Expect swelling to peak on day two",
    ],
  },

  // ── Body & fat ────────────────────────────────────────────────────────
  "body-fat": {
    ...BASE,
    summary:
      "Non-surgical body contouring for stubborn, diet-resistant fat pockets and skin laxity. It is a shaping treatment, not a weight-loss one.",
    howItWorks:
      "Fat cells are targeted by cooling, heat or an injectable that disrupts the membrane, and are cleared gradually by the body over weeks. Skin tightening runs alongside where laxity would otherwise be revealed.",
    options: [
      { name: "Single area", detail: "Abdomen, flanks or inner thighs" },
      { name: "Two areas", detail: "Paired areas treated in one visit", popular: true },
      { name: "Contour course", detail: "Staged plan with tightening between sessions" },
    ],
    areas: ["Abdomen", "Flanks", "Thighs", "Arms", "Back", "Under the chin"],
    duration: "45–75 minutes per area",
    anaesthesia: "None for cooling; topical for injectable protocols",
    sessions: "2–4 per area, 6–8 weeks apart",
    downtime: "None to a few days of tenderness and swelling",
    results: "From 6 weeks, final at 12 weeks per session",
    sideEffects: [
      "Numbness, tingling and tenderness for days to weeks",
      "Swelling and bruising",
      "Uneven contour, which is why placement and staging matter",
    ],
    notSuitable: [
      "Treating obesity — this is a contouring tool, not a weight-loss one",
      "Hernia in the treatment area",
      "Pregnancy and breastfeeding",
      "Cold-related disorders, for cooling protocols",
    ],
    aftercare: [
      "Massage the area as instructed after cooling",
      "Stay hydrated and keep moving",
      "Hold your weight steady — results are undone by regain",
    ],
  },

  // ── Wellness ──────────────────────────────────────────────────────────
  wellness: {
    ...BASE,
    summary:
      "Intravenous and nutritional support used alongside skin treatment — hydration, antioxidants and correction of deficiencies that show up in skin and hair.",
    howItWorks:
      "Nutrients are delivered intravenously, bypassing gut absorption. It is worth doing where a deficiency is documented; it is not a substitute for treating the skin itself.",
    options: [
      { name: "Hydration drip", detail: "Fluids and electrolytes, 45 minutes" },
      { name: "Antioxidant drip", detail: "Glutathione and vitamin C protocol", popular: true },
      { name: "Course of six", detail: "Weekly, with bloods before and after" },
    ],
    areas: ["Systemic"],
    duration: "45–60 minutes",
    anaesthesia: "None — a cannula is placed",
    sessions: "Weekly for 4–6 weeks, then monthly",
    downtime: "None",
    results: "Immediate for hydration; weeks for anything correcting a deficiency",
    sideEffects: [
      "Bruising or irritation at the cannula site",
      "A cool sensation or metallic taste during infusion",
      "Rarely, an allergic reaction — which is why it is supervised",
    ],
    notSuitable: [
      "Kidney or heart disease, without physician clearance",
      "G6PD deficiency, for high-dose vitamin C",
      "Pregnancy and breastfeeding",
    ],
    aftercare: [
      "Eat before the appointment",
      "Bloodwork before starting a course — treating an undocumented deficiency is guesswork",
      "Keep the cannula site clean and dry for a few hours",
    ],
  },

  // ── Bridal ────────────────────────────────────────────────────────────
  bridal: {
    ...BASE,
    summary:
      "A staged plan built backwards from a date. The sequence matters as much as the treatments: medical problems first, resurfacing second, hydration last.",
    howItWorks:
      "Six months out, acne, pigment and scarring are treated, because they need multiple sessions and time to settle. The final weeks are polish only — nothing new is introduced inside the last fortnight.",
    options: [
      { name: "Six-month plan", detail: "Full correction with monthly reviews", popular: true },
      { name: "Three-month plan", detail: "Focused correction and glow" },
      { name: "Final-month glow", detail: "Hydration and polish only" },
    ],
    areas: ["Face", "Neck", "Back and shoulders", "Hands"],
    duration: "Varies by session",
    anaesthesia: "Depends on the treatments in the plan",
    sessions: "A plan across 3–6 months, reviewed monthly",
    downtime: "Scheduled deliberately so nothing lands near the date",
    results: "Timed to peak in the week of the event",
    sideEffects: [
      "As per each treatment in the plan",
      "The main risk is scheduling, not the procedures themselves",
    ],
    notSuitable: [
      "Starting inside two weeks of the date with anything new",
      "Trying a treatment for the first time close to the event",
    ],
    aftercare: [
      "No first-time treatments in the final fortnight",
      "Hydration and rest in the last two weeks",
      "Keep a written schedule — the sequence is the plan",
    ],
  },

  // ── Men ───────────────────────────────────────────────────────────────
  mens: {
    ...BASE,
    summary:
      "The same treatments, adjusted for male skin: thicker dermis, denser beard growth, higher sebum, and usually a brief for definition rather than softening.",
    howItWorks:
      "Dosing and depth are adjusted upward for thicker tissue and stronger muscles, and the aesthetic brief is different — a jaw is defined rather than slimmed, a brow is kept flat rather than lifted.",
    options: [
      { name: "Line softening", detail: "Upper face, dosed for male musculature" },
      { name: "Jaw and chin definition", detail: "Structural contouring", popular: true },
      { name: "Skin and scarring course", detail: "Resurfacing for texture and acne scars" },
    ],
    areas: ["Forehead", "Jawline", "Chin", "Cheeks", "Beard area", "Scalp"],
    duration: "20–60 minutes",
    anaesthesia: "Topical numbing cream where needed",
    sessions: "Depends on the treatment; usually 1–4",
    downtime: "None to a few days",
    results: "As per the treatment chosen",
    sideEffects: [
      "Bruising and swelling",
      "Ingrown hairs or folliculitis in the beard area after resurfacing",
    ],
    notSuitable: [
      "Active folliculitis or infection in the beard area",
      "Recent sun exposure, for resurfacing",
    ],
    aftercare: [
      "No shaving over treated skin for 48 hours",
      "SPF daily — male facial skin is usually under-protected",
    ],
  },

  // ── Dental / smile ────────────────────────────────────────────────────
  dental: {
    ...BASE,
    summary:
      "Smile aesthetics assessed alongside the face — whitening, alignment and the framing of the lips and gums that a purely dental view misses.",
    howItWorks:
      "Discolouration is lifted with professional-strength agents under supervision; shape and alignment are handled restoratively; the gum line and lip position are treated as part of the face, not separately.",
    options: [
      { name: "Whitening session", detail: "In-clinic, with a shade record" },
      { name: "Whitening plus home kit", detail: "In-clinic session with custom trays", popular: true },
      { name: "Smile assessment", detail: "Full plan across alignment and framing" },
    ],
    areas: ["Teeth", "Gum line", "Lip position"],
    duration: "60–90 minutes",
    anaesthesia: "None; desensitising gel where needed",
    sessions: "One, with top-ups every 6–12 months",
    downtime: "None. Sensitivity for 24–48 hours.",
    results: "Immediate, stabilising over a week",
    sideEffects: [
      "Tooth sensitivity for a day or two",
      "Temporary gum irritation",
      "Uneven result on restorations, which do not whiten",
    ],
    notSuitable: [
      "Untreated decay or gum disease — those are treated first",
      "Pregnancy and breastfeeding",
      "Expecting crowns or veneers to change shade",
    ],
    aftercare: [
      "Avoid staining food and drink for 48 hours",
      "Use a desensitising toothpaste for a week",
      "No smoking during the whitening period",
    ],
  },

  // ── Medical dermatology ───────────────────────────────────────────────
  "skin-health": {
    ...BASE,
    summary:
      "Medical dermatology — the conditions that are treated because they are a problem, not because of how they look. These are settled before any elective work begins.",
    howItWorks:
      "Diagnosis first, with a physical examination and, where needed, dermoscopy, patch testing or biopsy. Treatment is medical and evidence-led, and inflamed skin is calmed before any procedure runs on it.",
    options: [
      { name: "Consultation and diagnosis", detail: "Examination with a treatment plan", popular: true },
      { name: "Ongoing management", detail: "Scheduled review of a chronic condition" },
      { name: "Procedure under medical care", detail: "Where the plan calls for one" },
    ],
    areas: ["Anywhere on the skin, scalp or nails"],
    duration: "20–40 minutes for consultation",
    anaesthesia: "Local anaesthetic for minor procedures only",
    sessions: "As the condition requires",
    downtime: "None for consultation",
    results: "Depends entirely on the diagnosis",
    sideEffects: [
      "As per the medicine or procedure prescribed",
      "Discussed individually, because they are specific to the treatment",
    ],
    notSuitable: [
      "Nothing is ruled out in advance — that is what the consultation is for",
    ],
    aftercare: [
      "Complete the course as prescribed, including when it looks better",
      "Bring a list of everything you have already tried",
    ],
  },
};

/** Where one treatment genuinely differs from its category's protocol. */
const OVERRIDES: Record<string, Partial<Detail>> = {
  hydrafacial: {
    duration: "45 minutes",
    anaesthesia: "None",
    downtime: "None at all — it is designed to be done before an event",
    sessions: "Monthly",
    options: [
      { name: "Signature", detail: "Cleanse, extract and hydrate · 45 minutes" },
      { name: "With boosters", detail: "Targeted serum for pigment, acne or fine lines", popular: true },
      { name: "Face, neck and back", detail: "Extended session" },
    ],
  },
  "laser-hair-removal-full-body": {
    duration: "75–90 minutes",
  },
};

/**
 * Build the detail for a treatment. Category protocol, plus any override, and
 * the treatment's own `meta` line surfaced as the headline fact.
 */
export function getTreatmentDetail(
  categorySlug: string,
  treatment: HubTreatment
): TreatmentDetail {
  const base = CATEGORY_DETAIL[categorySlug] ?? CATEGORY_DETAIL["skin-health"];
  return {
    ...base,
    recommendedFor:
      RECOMMENDED[categorySlug] ?? RECOMMENDED["skin-health"],
    ...(OVERRIDES[treatment.slug] ?? {}),
  };
}

/**
 * The stacked visual section — the long scrolling strip the Korean procedure
 * pages run down the page as one enormous image. Ours is built from the copy
 * that already exists plus the category's own photography, so it stays
 * accurate and stays translatable, and it reads as four numbered panels
 * rather than a picture of text.
 */
export function storyFor(
  /** The category the treatment belongs to — passed in rather than looked up
      in the static map, so this works for database-backed categories too. */
  category: HubCategory | undefined,
  treatment: HubTreatment,
  detail: TreatmentDetail
): StoryBlock[] {
  const pool = [
    treatment.image,
    ...(category?.treatments ?? [])
      .filter((t) => t.slug !== treatment.slug)
      .map((t) => t.image),
    category?.image ?? treatment.image,
  ];

  return [
    {
      heading: "What it does",
      body: detail.summary,
      image: pool[0],
    },
    {
      heading: "How it works",
      body: detail.howItWorks,
      image: pool[1] ?? pool[0],
    },
    {
      heading: "What to expect",
      body: `${detail.results}. ${detail.downtime === "None" ? "No downtime." : `Downtime: ${detail.downtime.toLowerCase()}.`} Typically ${detail.sessions.toLowerCase()}.`,
      image: pool[2] ?? pool[0],
    },
    {
      heading: "Looking after it",
      body: detail.aftercare.join(". ") + ".",
      image: pool[3] ?? pool[0],
    },
  ];
}

/** Sibling treatments in the same category, for the "related" rail. */
export function relatedTreatments(
  categorySlug: string,
  slug: string,
  limit = 4
): HubTreatment[] {
  const category = CATEGORY_BY_SLUG.get(categorySlug);
  if (!category) return [];
  return category.treatments.filter((t) => t.slug !== slug).slice(0, limit);
}
