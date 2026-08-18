/**
 * The catalogue expansion: real aesthetic and dermatological procedures, on
 * top of the 108 already shipped, to take the hub past 300.
 *
 * Everything here is a procedure that is genuinely offered in Korean and
 * Indian aesthetic practice. Names are the ones clinics and patients actually
 * use, and the `meta` line reflects realistic session counts and downtime for
 * that procedure — not invented numbers. Where a treatment is known by a
 * brand name (Ultherapy, Profhilo, Fraxel) the generic is used or the brand is
 * named honestly, because a catalogue that invents device names is worse than
 * useless to a clinician.
 *
 * No prices anywhere: the catalogue is price-free by design (G-1), and the
 * cost of a course is set by a doctor after an assessment.
 *
 * `theme` picks which family of photography a treatment draws from, so a
 * scalp procedure never illustrates itself with a lip filler photograph.
 */

import type { StockTheme } from "./stock-manifest";

export interface SeedTreatment {
  slug: string;
  name: string;
  blurb: string;
  /** Sessions / downtime. Never a price. */
  meta: string;
  theme: StockTheme;
}

export interface SeedCategory {
  slug: string;
  name: string;
  icon: string;
  blurb: string;
  intro: string;
  tint: string;
  theme: StockTheme;
  treatments: SeedTreatment[];
}

/* ── Additions to categories that already exist ────────────────────────── */

export const EXPANSION: SeedCategory[] = [
  {
    slug: "glass-skin",
    name: "Glass Skin",
    icon: "sparkles",
    blurb: "Hydration, clarity and the finish Korean clinics are known for.",
    intro:
      "Treatments aimed at the quality of the skin itself — how it holds water, how evenly it reflects light, how smooth it feels — rather than at any single line or mark.",
    tint: "from-brand-500 to-teal-400",
    theme: "facial",
    treatments: [
      { slug: "aqua-peel", name: "Aqua Peel", blurb: "Vortex cleansing that lifts debris from the pore while infusing serum.", meta: "Monthly · no downtime", theme: "facial" },
      { slug: "milk-peel", name: "Milk Peel", blurb: "A lactic-acid peel that resurfaces gently enough for sensitive skin.", meta: "4–6 sessions · minimal flaking", theme: "facial" },
      { slug: "oxygen-facial", name: "Oxygen Infusion Facial", blurb: "Pressurised oxygen drives a hydrating serum into the upper layers.", meta: "Single or monthly · no downtime", theme: "facial" },
      { slug: "cryo-facial", name: "Cryo Facial", blurb: "Controlled cold to calm redness and tighten the look of pores.", meta: "Weekly or monthly · no downtime", theme: "facial" },
      { slug: "led-phototherapy", name: "LED Phototherapy", blurb: "Red and blue wavelengths to settle inflammation and support repair.", meta: "6–10 sessions · no downtime", theme: "device" },
      { slug: "carbon-laser-peel", name: "Carbon Laser Peel", blurb: "A carbon layer targeted with laser to clear oil and refine texture.", meta: "4–6 sessions · no downtime", theme: "device" },
      { slug: "polynucleotide-therapy", name: "Polynucleotide Therapy", blurb: "Salmon-DNA fragments injected to improve hydration and skin quality.", meta: "3 sessions, 3 weeks apart", theme: "injectable" },
      { slug: "nctf-mesotherapy", name: "NCTF Mesotherapy", blurb: "A multi-vitamin and hyaluronic cocktail delivered by micro-injection.", meta: "4 sessions · 1–2 days redness", theme: "injectable" },
      { slug: "glass-skin-programme", name: "Glass Skin Programme", blurb: "A staged course combining peel, booster and barrier repair.", meta: "8–12 weeks", theme: "facial" },
      { slug: "barrier-repair-facial", name: "Barrier Repair Facial", blurb: "For skin left sensitised by over-exfoliation or active ingredients.", meta: "3–4 sessions · no downtime", theme: "product" },
      { slug: "enzyme-peel", name: "Enzyme Peel", blurb: "Fruit enzymes that loosen dead cells without acid stinging.", meta: "Monthly · no downtime", theme: "product" },
      { slug: "ultrasonic-scrubbing", name: "Ultrasonic Deep Cleanse", blurb: "High-frequency vibration to clear congestion from the pore lining.", meta: "Monthly · no downtime", theme: "facial" },
    ],
  },
  {
    slug: "lifting",
    name: "Lifting & Tightening",
    icon: "lift",
    blurb: "Non-surgical answers to laxity along the jaw, cheek and neck.",
    intro:
      "Energy devices and absorbable threads that tighten existing collagen and provoke new collagen, for skin that has loosened rather than lined.",
    tint: "from-violet-500 to-brand-400",
    theme: "device",
    treatments: [
      { slug: "ultherapy", name: "Ultherapy", blurb: "Micro-focused ultrasound with imaging, reaching the SMAS layer.", meta: "Usually one · no downtime", theme: "device" },
      { slug: "shurink-universe", name: "Shurink Lifting", blurb: "A Korean HIFU platform with cartridges for several skin depths.", meta: "1–2 sessions · no downtime", theme: "device" },
      { slug: "oligio-rf", name: "Monopolar RF Lifting", blurb: "Bulk-heats the dermis to contract collagen across the whole face.", meta: "1–2 sessions · no downtime", theme: "device" },
      { slug: "density-lifting", name: "Density HIFU", blurb: "High-density ultrasound shots for a firmer lower face.", meta: "1–2 sessions · mild swelling", theme: "device" },
      { slug: "pdo-mono-threads", name: "PDO Mono Threads", blurb: "Fine absorbable threads placed in a mesh to firm the skin.", meta: "1 session · 3–7 days swelling", theme: "injectable" },
      { slug: "cog-thread-lift", name: "Cog Thread Lift", blurb: "Barbed threads that reposition tissue as well as stimulating collagen.", meta: "1 session · 7–14 days recovery", theme: "injectable" },
      { slug: "silhouette-soft", name: "Suspension Thread Lift", blurb: "Cone-anchored threads for a defined lift along the cheek and jaw.", meta: "1 session · 1–2 weeks", theme: "injectable" },
      { slug: "neck-tightening-rf", name: "Neck Tightening RF", blurb: "Radiofrequency focused on crepey skin below the jawline.", meta: "3–4 sessions · no downtime", theme: "device" },
      { slug: "brow-lift-nonsurgical", name: "Non-Surgical Brow Lift", blurb: "Targeted relaxation and energy to open a heavy upper eyelid.", meta: "Every 4–6 months", theme: "injectable" },
      { slug: "eight-point-lift", name: "Eight-Point Lift", blurb: "Filler placed at eight structural points to restore facial support.", meta: "1 session · lasts 12–18 months", theme: "injectable" },
      { slug: "ballerina-lift", name: "Ballerina Lift", blurb: "Threads combined with volume to lift the mid-face and jaw together.", meta: "1 session · 1–2 weeks", theme: "injectable" },
      { slug: "microfocused-neck", name: "Décolleté Firming", blurb: "Energy treatment for sun-loosened skin across the chest.", meta: "2–3 sessions · no downtime", theme: "device" },
    ],
  },
  {
    slug: "botox",
    name: "Anti-Wrinkle Injections",
    icon: "syringe",
    blurb: "Softening the lines that movement creates, without freezing the face.",
    intro:
      "Botulinum toxin relaxes specific muscles so the skin above them creases less. Dose and placement decide whether the result reads natural or done.",
    tint: "from-sky-400 to-brand-500",
    theme: "injectable",
    treatments: [
      { slug: "forehead-lines", name: "Forehead Lines", blurb: "Softens the horizontal lines that show when you raise your brows.", meta: "Every 4–6 months", theme: "injectable" },
      { slug: "frown-lines", name: "Frown Lines", blurb: "Treats the vertical elevens between the brows.", meta: "Every 4–6 months", theme: "injectable" },
      { slug: "crows-feet", name: "Crow's Feet", blurb: "Relaxes the fan of lines at the outer corner of the eye.", meta: "Every 4–6 months", theme: "injectable" },
      { slug: "bunny-lines", name: "Bunny Lines", blurb: "The creases across the bridge of the nose when you scrunch.", meta: "Every 4–6 months", theme: "injectable" },
      { slug: "gummy-smile", name: "Gummy Smile Correction", blurb: "Lowers an over-lifting upper lip so less gum shows.", meta: "Every 4–5 months", theme: "injectable" },
      { slug: "lip-flip", name: "Lip Flip", blurb: "A small dose that everts the upper lip without adding volume.", meta: "Every 3–4 months", theme: "injectable" },
      { slug: "masseter-slimming", name: "Masseter Slimming", blurb: "Reduces a bulky jaw muscle, easing clenching as it narrows the face.", meta: "Every 6 months", theme: "injectable" },
      { slug: "neck-bands", name: "Platysmal Band Softening", blurb: "Relaxes the vertical cords that stand out on the neck.", meta: "Every 4–6 months", theme: "injectable" },
      { slug: "chin-dimpling", name: "Chin Dimpling", blurb: "Smooths the pebbled texture of an overactive chin muscle.", meta: "Every 4–6 months", theme: "injectable" },
      { slug: "brow-shaping-toxin", name: "Brow Shaping", blurb: "Selective placement to raise the tail of the brow a few millimetres.", meta: "Every 4–6 months", theme: "injectable" },
      { slug: "microtox", name: "Microtox / Skin Botox", blurb: "Very dilute toxin in the dermis to refine pores and oil, not movement.", meta: "Every 3–4 months", theme: "injectable" },
      { slug: "hyperhidrosis-underarm", name: "Underarm Sweat Treatment", blurb: "Blocks the nerve signal to overactive sweat glands.", meta: "Every 6–9 months", theme: "injectable" },
      { slug: "hyperhidrosis-palms", name: "Palm Sweat Treatment", blurb: "For hands that stay damp regardless of temperature or nerves.", meta: "Every 6 months", theme: "injectable" },
      { slug: "trapezius-toxin", name: "Trapezius Slimming", blurb: "Softens a bulky shoulder line and eases tension with it.", meta: "Every 6 months", theme: "injectable" },
    ],
  },
  {
    slug: "fillers",
    name: "Dermal Fillers",
    icon: "droplet",
    blurb: "Restoring volume and definition where the face has lost support.",
    intro:
      "Hyaluronic acid gels of differing firmness, placed at differing depths. The skill is in reading which structure has gone, not in filling what looks hollow.",
    tint: "from-rose-400 to-orange-300",
    theme: "injectable",
    treatments: [
      { slug: "lip-filler", name: "Lip Enhancement", blurb: "Volume, border definition or symmetry, depending on what is asked for.", meta: "Lasts 9–12 months", theme: "injectable" },
      { slug: "cheek-filler", name: "Cheek Augmentation", blurb: "Rebuilds mid-face support, which lifts everything below it.", meta: "Lasts 12–18 months", theme: "injectable" },
      { slug: "tear-trough", name: "Tear Trough Filler", blurb: "Softens the hollow that makes the under-eye read tired.", meta: "Lasts 9–12 months", theme: "injectable" },
      { slug: "chin-filler", name: "Chin Projection", blurb: "Balances a recessive chin, which often improves the jaw and neck line.", meta: "Lasts 12–18 months", theme: "injectable" },
      { slug: "jawline-filler", name: "Jawline Contouring", blurb: "Sharpens the angle and the border between face and neck.", meta: "Lasts 12–18 months", theme: "injectable" },
      { slug: "nasolabial-filler", name: "Nasolabial Fold Softening", blurb: "Eases the crease from nose to mouth corner.", meta: "Lasts 9–12 months", theme: "injectable" },
      { slug: "marionette-filler", name: "Marionette Line Correction", blurb: "Lifts the downturn at the corners of the mouth.", meta: "Lasts 9–12 months", theme: "injectable" },
      { slug: "temple-filler", name: "Temple Restoration", blurb: "Fills the hollowing above the cheekbone that ages the upper face.", meta: "Lasts 12–18 months", theme: "injectable" },
      { slug: "hand-rejuvenation", name: "Hand Rejuvenation", blurb: "Restores the padding that makes tendons and veins stand out.", meta: "Lasts 9–12 months", theme: "body" },
      { slug: "earlobe-filler", name: "Earlobe Restoration", blurb: "Refills a stretched or thinned lobe so studs sit properly again.", meta: "Lasts 9–12 months", theme: "injectable" },
      { slug: "profhilo", name: "Bio-Remodelling", blurb: "Highly concentrated hyaluronic acid that spreads to hydrate, not to fill.", meta: "2 sessions, 4 weeks apart", theme: "injectable" },
      { slug: "sculptra", name: "Collagen Stimulator", blurb: "Poly-L-lactic acid that prompts your own collagen over months.", meta: "2–3 sessions · gradual result", theme: "injectable" },
      { slug: "radiesse", name: "Calcium Hydroxylapatite Filler", blurb: "A firmer filler for structural support along the jaw and cheek.", meta: "Lasts 12–15 months", theme: "injectable" },
      { slug: "filler-dissolving", name: "Filler Dissolving", blurb: "Hyaluronidase to reverse or reshape hyaluronic acid already placed.", meta: "1–2 sessions", theme: "injectable" },
    ],
  },
  {
    slug: "laser",
    name: "Laser & Energy",
    icon: "zap",
    blurb: "Light and radiofrequency for tone, texture, vessels and marks.",
    intro:
      "Different wavelengths are absorbed by different targets — pigment, blood, water. Choosing the right one matters more than choosing the strongest.",
    tint: "from-amber-400 to-rose-400",
    theme: "device",
    treatments: [
      { slug: "fractional-co2", name: "Fractional CO2 Laser", blurb: "Ablative resurfacing for texture, scarring and deeper lines.", meta: "1–3 sessions · 5–7 days downtime", theme: "device" },
      { slug: "erbium-glass", name: "Non-Ablative Fractional Laser", blurb: "Resurfacing beneath an intact surface, so recovery is short.", meta: "3–5 sessions · 2–3 days redness", theme: "device" },
      { slug: "picosecond-laser", name: "Picosecond Laser", blurb: "Ultra-short pulses that shatter pigment with little heat.", meta: "4–6 sessions · minimal downtime", theme: "device" },
      { slug: "q-switched-ndyag", name: "Q-Switched Nd:YAG", blurb: "The workhorse for pigment, tattoo ink and dermal melanin.", meta: "4–8 sessions", theme: "device" },
      { slug: "ipl-photofacial", name: "IPL Photofacial", blurb: "Broad-spectrum light for sun damage, redness and uneven tone.", meta: "3–5 sessions · no real downtime", theme: "device" },
      { slug: "vbeam-vascular", name: "Vascular Laser", blurb: "Targets visible vessels, flushing and persistent redness.", meta: "3–4 sessions · possible bruising", theme: "device" },
      { slug: "laser-genesis", name: "Laser Genesis", blurb: "Gentle dermal heating for tone, pore size and early redness.", meta: "5–6 sessions · no downtime", theme: "device" },
      { slug: "clear-brilliant", name: "Light Fractional Resurfacing", blurb: "A mild fractional treatment often called the lunchtime laser.", meta: "4–6 sessions · 1 day pinkness", theme: "device" },
      { slug: "rf-microneedling-face", name: "RF Microneedling", blurb: "Needles deliver radiofrequency into the dermis for remodelling.", meta: "3–4 sessions · 2–3 days", theme: "device" },
      { slug: "potenza", name: "Insulated RF Microneedling", blurb: "Insulated needles that spare the surface while heating deeper.", meta: "3–4 sessions · 2 days", theme: "device" },
      { slug: "thulium-laser", name: "Thulium Laser", blurb: "Superficial resurfacing well suited to pigment and dullness.", meta: "3–4 sessions · 2–3 days", theme: "device" },
      { slug: "long-pulsed-ndyag", name: "Long-Pulsed Nd:YAG", blurb: "Deeper vessels and darker skin types, where other lasers are unsafe.", meta: "3–5 sessions", theme: "device" },
      { slug: "excimer-laser", name: "Excimer Laser", blurb: "Targeted UVB for stubborn patches of vitiligo or psoriasis.", meta: "Twice weekly · ongoing", theme: "device" },
      { slug: "laser-toning", name: "Laser Toning", blurb: "Low-fluence sessions that lighten melasma without provoking it.", meta: "6–10 sessions", theme: "device" },
    ],
  },
  {
    slug: "hair-removal",
    name: "Hair Removal",
    icon: "scissors",
    blurb: "Permanent reduction, sized to skin tone and hair colour.",
    intro:
      "Laser targets the pigment in the follicle, so the right wavelength depends on your skin as much as your hair. Only hair in its growth phase responds, which is why courses are spaced.",
    tint: "from-teal-400 to-emerald-400",
    theme: "device",
    treatments: [
      { slug: "full-face-laser", name: "Full Face", blurb: "Complete facial hair reduction, including the sides and jaw.", meta: "6–8 sessions, 4 weeks apart", theme: "device" },
      { slug: "upper-lip-chin", name: "Upper Lip & Chin", blurb: "The most requested facial area, often hormone-driven.", meta: "6–8 sessions", theme: "device" },
      { slug: "underarm-laser", name: "Underarms", blurb: "Quick, well tolerated, and among the fastest to clear.", meta: "6 sessions, 4–6 weeks apart", theme: "device" },
      { slug: "full-arms-laser", name: "Full Arms", blurb: "Shoulder to wrist, including the hands if asked.", meta: "6–8 sessions", theme: "device" },
      { slug: "full-legs-laser", name: "Full Legs", blurb: "Hip to ankle, the largest single area treated.", meta: "6–8 sessions, 6 weeks apart", theme: "device" },
      { slug: "bikini-laser", name: "Bikini Line", blurb: "The margins only, kept to what a swimsuit would show.", meta: "6–8 sessions", theme: "device" },
      { slug: "back-shoulders-laser", name: "Back & Shoulders", blurb: "Commonly requested by men, usually over several sittings.", meta: "6–8 sessions", theme: "device" },
      { slug: "chest-abdomen-laser", name: "Chest & Abdomen", blurb: "Reduction rather than clearance, if a natural look is wanted.", meta: "6–8 sessions", theme: "device" },
      { slug: "beard-shaping-laser", name: "Beard Line Shaping", blurb: "Defines a neckline or cheek line permanently.", meta: "5–7 sessions", theme: "device" },
      { slug: "diode-laser-hair", name: "Diode Laser", blurb: "The standard for coarse dark hair on lighter skin.", meta: "6–8 sessions", theme: "device" },
      { slug: "ndyag-hair-dark-skin", name: "Nd:YAG for Deeper Skin", blurb: "The wavelength that treats brown and dark skin safely.", meta: "6–8 sessions", theme: "device" },
      { slug: "pcos-facial-hair", name: "PCOS Facial Hair Programme", blurb: "Longer course acknowledging the hormonal driver behind regrowth.", meta: "10–12 sessions · maintenance", theme: "device" },
    ],
  },
  {
    slug: "hair-restoration",
    name: "Hair Restoration",
    icon: "sprout",
    blurb: "Slowing loss, thickening what remains, replacing what has gone.",
    intro:
      "Hair loss has causes — hormonal, nutritional, inflammatory, structural. Treatment works when it matches the cause, which is why assessment comes before any procedure.",
    tint: "from-emerald-400 to-teal-500",
    theme: "hair",
    treatments: [
      { slug: "prp-scalp", name: "PRP Scalp Therapy", blurb: "Your own platelet concentrate injected to prolong the growth phase.", meta: "4–6 sessions monthly", theme: "hair" },
      { slug: "gfc-therapy", name: "Growth Factor Concentrate", blurb: "A refined preparation delivering a higher growth-factor yield than PRP.", meta: "3–4 sessions", theme: "hair" },
      { slug: "hair-mesotherapy", name: "Hair Mesotherapy", blurb: "Vitamins and peptides micro-injected across the thinning zone.", meta: "6–8 sessions", theme: "hair" },
      { slug: "exosome-scalp", name: "Exosome Scalp Therapy", blurb: "Signalling vesicles applied after micro-channelling the scalp.", meta: "3–4 sessions", theme: "hair" },
      { slug: "fue-transplant", name: "FUE Hair Transplant", blurb: "Follicles moved one at a time, leaving no linear scar.", meta: "1 session · 10–14 days recovery", theme: "hair" },
      { slug: "dhi-transplant", name: "DHI Hair Transplant", blurb: "Implanter-pen placement for dense, angled work at the hairline.", meta: "1 session · 10–14 days", theme: "hair" },
      { slug: "beard-transplant", name: "Beard Transplant", blurb: "Fills patchy growth or builds a fuller beard line.", meta: "1 session · 7–10 days", theme: "hair" },
      { slug: "eyebrow-transplant", name: "Eyebrow Transplant", blurb: "For brows thinned by over-plucking, scarring or alopecia.", meta: "1 session · 7 days", theme: "hair" },
      { slug: "scalp-micropigmentation", name: "Scalp Micropigmentation", blurb: "Pigment dots that read as closely shaved density.", meta: "2–3 sessions", theme: "hair" },
      { slug: "low-level-laser-hair", name: "Low-Level Laser Therapy", blurb: "Light therapy used at home or in clinic to support density.", meta: "Ongoing · 3 times weekly", theme: "device" },
      { slug: "female-pattern-programme", name: "Female Pattern Hair Loss Programme", blurb: "Combined medical and procedural plan for diffuse thinning.", meta: "6–12 months", theme: "hair" },
      { slug: "alopecia-areata-treatment", name: "Alopecia Areata Treatment", blurb: "Intralesional steroid and immune-directed care for patchy loss.", meta: "Every 4–6 weeks", theme: "hair" },
      { slug: "dandruff-seborrheic", name: "Seborrhoeic Dermatitis Care", blurb: "Treats the scaling and itch that undermines hair health.", meta: "4–6 weeks", theme: "hair" },
      { slug: "scalp-detox", name: "Clinical Scalp Detox", blurb: "Clears build-up and calms the follicle before a growth programme.", meta: "Monthly", theme: "hair" },
    ],
  },
  {
    slug: "acne-scars",
    name: "Acne & Scars",
    icon: "scan",
    blurb: "Active breakouts first, then the marks they leave behind.",
    intro:
      "Scarring is treated only once the acne itself is quiet — resurfacing inflamed skin makes both worse. The type of scar decides the technique.",
    tint: "from-rose-400 to-violet-400",
    theme: "clinical",
    treatments: [
      { slug: "subcision", name: "Subcision", blurb: "Releases the tethers that pull rolling scars down from beneath.", meta: "2–3 sessions · bruising 1 week", theme: "clinical" },
      { slug: "trca-cross", name: "TCA CROSS", blurb: "Focused acid into ice-pick scars to rebuild them from the base.", meta: "3–5 sessions", theme: "clinical" },
      { slug: "punch-excision", name: "Punch Excision", blurb: "Removes a deep narrow scar and closes it as a fine line.", meta: "1 session · sutures 7 days", theme: "clinical" },
      { slug: "scar-filler", name: "Scar Filling", blurb: "Volume beneath a depressed scar while collagen work continues.", meta: "Lasts 9–12 months", theme: "injectable" },
      { slug: "microneedling-scars", name: "Microneedling for Scars", blurb: "Controlled injury to drive collagen into atrophic scarring.", meta: "4–6 sessions", theme: "device" },
      { slug: "acne-extraction", name: "Medical Extraction Facial", blurb: "Sterile clearing of comedones that topical treatment cannot shift.", meta: "Every 4–6 weeks", theme: "facial" },
      { slug: "intralesional-steroid", name: "Intralesional Injection", blurb: "Settles a large painful cyst within days rather than weeks.", meta: "As needed", theme: "injectable" },
      { slug: "isotretinoin-monitoring", name: "Oral Retinoid Programme", blurb: "Doctor-supervised course with the bloodwork it requires.", meta: "6–8 months · monitored", theme: "clinical" },
      { slug: "salicylic-peel", name: "Salicylic Acid Peel", blurb: "An oil-soluble peel that works inside the pore.", meta: "4–6 sessions", theme: "facial" },
      { slug: "keloid-treatment", name: "Keloid Management", blurb: "Steroid, pressure and laser to flatten raised overgrown scars.", meta: "Every 4 weeks · ongoing", theme: "clinical" },
      { slug: "hypertrophic-scar", name: "Hypertrophic Scar Treatment", blurb: "For raised scars still within the original wound border.", meta: "3–6 sessions", theme: "clinical" },
      { slug: "post-acne-pigmentation", name: "Post-Acne Mark Treatment", blurb: "Clears the brown and red marks left after a spot settles.", meta: "4–6 sessions", theme: "device" },
      { slug: "hormonal-acne-workup", name: "Hormonal Acne Assessment", blurb: "Investigates the endocrine driver behind jawline breakouts.", meta: "Assessment + plan", theme: "clinical" },
      { slug: "back-acne-treatment", name: "Back & Chest Acne", blurb: "Body acne treated with the strength truncal skin tolerates.", meta: "6–8 sessions", theme: "body" },
    ],
  },
  {
    slug: "pigmentation",
    name: "Pigmentation",
    icon: "sun",
    blurb: "Melasma, sun damage and the marks that follow inflammation.",
    intro:
      "Pigment sits at different depths and answers to different treatment. Melasma in particular punishes aggressive lasering, so restraint is the technique.",
    tint: "from-amber-400 to-orange-300",
    theme: "device",
    treatments: [
      { slug: "melasma-programme", name: "Melasma Programme", blurb: "Combined topical, oral and gentle laser care over months.", meta: "3–6 months · maintenance", theme: "clinical" },
      { slug: "tranexamic-therapy", name: "Tranexamic Acid Therapy", blurb: "Oral or injected, it interrupts the pigment pathway itself.", meta: "3–6 months", theme: "clinical" },
      { slug: "cosmelan-peel", name: "Depigmenting Mask Peel", blurb: "An in-clinic mask followed by a strict home protocol.", meta: "1 application + home care", theme: "facial" },
      { slug: "glutathione-iv", name: "Glutathione Infusion", blurb: "Antioxidant infusion used as part of a brightening plan.", meta: "Weekly course", theme: "clinical" },
      { slug: "kojic-peel", name: "Brightening Peel", blurb: "Kojic and arbutin blends for uneven surface tone.", meta: "4–6 sessions", theme: "facial" },
      { slug: "freckle-removal", name: "Freckle & Sunspot Clearing", blurb: "Individual lesions targeted rather than the whole face.", meta: "1–3 sessions", theme: "device" },
      { slug: "hori-nevus", name: "Hori's Nevus Treatment", blurb: "Dermal pigment that needs laser reaching below the epidermis.", meta: "5–8 sessions", theme: "device" },
      { slug: "underarm-brightening", name: "Underarm Brightening", blurb: "For darkening from friction, shaving or deodorant irritation.", meta: "4–6 sessions", theme: "body" },
      { slug: "intimate-brightening", name: "Body Fold Brightening", blurb: "Gentle protocols for the neck, groin and inner-thigh folds.", meta: "4–6 sessions", theme: "body" },
      { slug: "sun-damage-repair", name: "Sun Damage Repair", blurb: "Resurfacing plus prevention for years of accumulated exposure.", meta: "3–5 sessions", theme: "device" },
      { slug: "vitiligo-management", name: "Vitiligo Management", blurb: "Phototherapy and medical care to stabilise and repigment.", meta: "Ongoing", theme: "clinical" },
      { slug: "dark-knuckles", name: "Knuckle & Elbow Lightening", blurb: "Thickened, darkened skin over joints, treated gently.", meta: "6 sessions", theme: "body" },
    ],
  },
  {
    slug: "eyes",
    name: "Eye Rejuvenation",
    icon: "eye",
    blurb: "Circles, hollows, crepe and heaviness around the eye.",
    intro:
      "The thinnest skin on the body, over the most mobile muscle. Dark circles can be pigment, shadow, vessel or hollow — and each answers to something different.",
    tint: "from-violet-500 to-sky-400",
    theme: "injectable",
    treatments: [
      { slug: "dark-circle-assessment", name: "Dark Circle Assessment", blurb: "Establishes whether the cause is pigment, shadow or vessel.", meta: "Assessment + plan", theme: "clinical" },
      { slug: "under-eye-mesotherapy", name: "Under-Eye Mesotherapy", blurb: "Micro-injections of brightening and hydrating actives.", meta: "4 sessions", theme: "injectable" },
      { slug: "under-eye-prp", name: "Under-Eye PRP", blurb: "Platelet-rich plasma to thicken and brighten thin lower-lid skin.", meta: "3 sessions", theme: "injectable" },
      { slug: "eye-rf-tightening", name: "Periorbital Tightening", blurb: "Radiofrequency for crepey texture around the orbit.", meta: "3–4 sessions", theme: "device" },
      { slug: "eyelid-laser", name: "Eyelid Resurfacing", blurb: "Fractional laser for fine crepe on the upper and lower lid.", meta: "2–3 sessions · 3 days", theme: "device" },
      { slug: "eye-bag-assessment", name: "Eye Bag Evaluation", blurb: "Distinguishes fat prolapse from fluid and from laxity.", meta: "Assessment", theme: "clinical" },
      { slug: "milia-removal", name: "Milia Removal", blurb: "Clears the small firm white bumps around the eye.", meta: "1 session", theme: "clinical" },
      { slug: "eyelash-growth", name: "Lash Growth Therapy", blurb: "Prescription treatment for sparse or short lashes.", meta: "12–16 weeks", theme: "portrait" },
      { slug: "eyebrow-restoration", name: "Brow Density Treatment", blurb: "Growth support for brows thinned by plucking or age.", meta: "3–4 months", theme: "portrait" },
      { slug: "xanthelasma-removal", name: "Xanthelasma Removal", blurb: "Removes the yellow cholesterol plaques near the inner lid.", meta: "1–2 sessions", theme: "clinical" },
    ],
  },
  {
    slug: "face-contour",
    name: "Face Contouring",
    icon: "hexagon",
    blurb: "Shaping the outline — jaw, cheek, chin and the line between face and neck.",
    intro:
      "Contour is structure, fat and muscle in combination. Reading which of the three is responsible is what separates a natural result from an odd one.",
    tint: "from-fuchsia-500 to-violet-400",
    theme: "injectable",
    treatments: [
      { slug: "double-chin-injection", name: "Submental Fat Dissolving", blurb: "Injectable deoxycholic acid to reduce fat under the chin.", meta: "2–4 sessions · swelling 1 week", theme: "injectable" },
      { slug: "buccal-fat-assessment", name: "Buccal Fat Evaluation", blurb: "Assesses whether cheek fullness is fat, and whether it should go.", meta: "Assessment", theme: "clinical" },
      { slug: "jaw-slimming-programme", name: "Jaw Slimming Programme", blurb: "Muscle relaxation and skin tightening together over months.", meta: "6 months", theme: "injectable" },
      { slug: "cheekbone-definition", name: "Cheekbone Definition", blurb: "Structural filler placed on bone for a defined upper cheek.", meta: "Lasts 12–18 months", theme: "injectable" },
      { slug: "facial-slimming-hifu", name: "Facial Slimming HIFU", blurb: "Focused ultrasound to reduce and tighten the lower face.", meta: "1–2 sessions", theme: "device" },
      { slug: "neck-contour", name: "Neck Contouring", blurb: "Addresses the fat and laxity that blur the jaw–neck border.", meta: "3–4 sessions", theme: "device" },
      { slug: "facial-fat-grafting", name: "Facial Fat Transfer", blurb: "Your own fat harvested and placed for lasting volume.", meta: "1 session · 2 weeks recovery", theme: "clinical" },
      { slug: "asymmetry-correction", name: "Facial Asymmetry Correction", blurb: "Balances a noticeably uneven jaw, brow or smile.", meta: "Staged over months", theme: "injectable" },
      { slug: "smile-line-design", name: "Smile Design Consultation", blurb: "Plans lip, gum and tooth proportion as one result.", meta: "Assessment + plan", theme: "dental" },
      { slug: "chin-neck-lift", name: "Chin & Neck Lift", blurb: "Combined thread and energy work for the lower third.", meta: "1–2 sessions", theme: "device" },
    ],
  },
  {
    slug: "body-fat",
    name: "Body Contouring",
    icon: "activity",
    blurb: "Fat reduction, skin tightening and muscle definition, non-surgically.",
    intro:
      "These treat shape, not weight — they work on localised fat that diet has not moved, and on skin that has lost its snap.",
    tint: "from-sky-400 to-teal-400",
    theme: "body",
    treatments: [
      { slug: "cryolipolysis", name: "Fat Freezing", blurb: "Controlled cooling that destroys fat cells in a defined pocket.", meta: "1–3 cycles per area", theme: "body" },
      { slug: "ems-muscle-sculpting", name: "Electromagnetic Muscle Sculpting", blurb: "Supramaximal contractions to build muscle and reduce fat together.", meta: "4–6 sessions", theme: "body" },
      { slug: "cavitation", name: "Ultrasonic Cavitation", blurb: "Ultrasound to disrupt fat cells across a broader area.", meta: "6–8 sessions", theme: "body" },
      { slug: "body-rf-tightening", name: "Body Skin Tightening", blurb: "Radiofrequency for loose skin after weight loss or pregnancy.", meta: "6–8 sessions", theme: "body" },
      { slug: "lipolytic-injection", name: "Injection Lipolysis", blurb: "Injectable solution for small stubborn pockets.", meta: "3–4 sessions", theme: "injectable" },
      { slug: "cellulite-treatment", name: "Cellulite Treatment", blurb: "Targets the fibrous bands that create dimpling, not the fat.", meta: "4–6 sessions", theme: "body" },
      { slug: "stretch-mark-laser", name: "Stretch Mark Resurfacing", blurb: "Fractional laser to improve texture and colour of striae.", meta: "4–6 sessions", theme: "body" },
      { slug: "post-pregnancy-programme", name: "Post-Pregnancy Programme", blurb: "Staged abdominal skin and muscle work, once cleared to start.", meta: "3–6 months", theme: "body" },
      { slug: "arm-contouring", name: "Arm Contouring", blurb: "Upper-arm fat and laxity, treated together.", meta: "4–6 sessions", theme: "body" },
      { slug: "thigh-contouring", name: "Thigh Contouring", blurb: "Inner and outer thigh shaping without surgery.", meta: "4–6 sessions", theme: "body" },
      { slug: "back-bra-line", name: "Back & Bra Line", blurb: "The rolls that clothing makes obvious.", meta: "2–3 cycles", theme: "body" },
      { slug: "body-composition-review", name: "Body Composition Review", blurb: "Measurement and planning before any contouring is booked.", meta: "Assessment", theme: "clinical" },
    ],
  },
  {
    slug: "wellness",
    name: "Wellness & IV",
    icon: "flask",
    blurb: "Infusions, diagnostics and the internal side of skin health.",
    intro:
      "Skin reflects what is happening inside it. These are the tests and infusions that make sense as part of a treatment plan — prescribed, not sold as a menu.",
    tint: "from-emerald-400 to-sky-400",
    theme: "clinical",
    treatments: [
      { slug: "iv-hydration", name: "IV Hydration", blurb: "Fluid and electrolytes where oral intake has not been enough.", meta: "As advised", theme: "clinical" },
      { slug: "vitamin-c-infusion", name: "Vitamin C Infusion", blurb: "High-dose ascorbic acid as part of a brightening protocol.", meta: "Weekly course", theme: "clinical" },
      { slug: "nad-infusion", name: "NAD+ Infusion", blurb: "Cellular energy support, given slowly and under supervision.", meta: "Course of 4–6", theme: "clinical" },
      { slug: "iron-infusion", name: "Iron Infusion", blurb: "For deficiency confirmed on bloods — a common cause of hair fall.", meta: "1–2 sessions", theme: "clinical" },
      { slug: "skin-blood-panel", name: "Skin Health Blood Panel", blurb: "Thyroid, iron, vitamin D and hormones behind skin and hair change.", meta: "One draw · report in 48h", theme: "clinical" },
      { slug: "hormone-panel", name: "Hormone Assessment", blurb: "Investigates the endocrine picture behind acne or hair loss.", meta: "One draw + consult", theme: "clinical" },
      { slug: "food-sensitivity", name: "Food Sensitivity Review", blurb: "Dietary review where flares track with eating patterns.", meta: "Assessment", theme: "clinical" },
      { slug: "gut-skin-programme", name: "Gut–Skin Programme", blurb: "Addresses digestion where it is driving inflammatory skin disease.", meta: "8–12 weeks", theme: "clinical" },
      { slug: "sleep-stress-review", name: "Sleep & Stress Review", blurb: "The two most under-treated causes of skin and hair complaints.", meta: "Assessment", theme: "clinical" },
      { slug: "nutrition-consult", name: "Clinical Nutrition Consult", blurb: "Diet planning built around a dermatological diagnosis.", meta: "45 minutes", theme: "clinical" },
      { slug: "antioxidant-drip", name: "Antioxidant Infusion", blurb: "A blended infusion used alongside pigment treatment.", meta: "Weekly course", theme: "clinical" },
      { slug: "immunity-support", name: "Immunity Support Infusion", blurb: "Zinc, vitamin C and B-complex where deficiency is documented.", meta: "As advised", theme: "clinical" },
    ],
  },
  {
    slug: "bridal",
    name: "Bridal & Events",
    icon: "crown",
    blurb: "Timed programmes that peak on the day, not after it.",
    intro:
      "Every treatment here is scheduled backwards from the date. Nothing that can flare, peel or bruise goes near the last fortnight.",
    tint: "from-rose-400 to-fuchsia-400",
    theme: "portrait",
    treatments: [
      { slug: "six-month-bridal", name: "Six-Month Bridal Plan", blurb: "The full runway — resurfacing, pigment and body work in sequence.", meta: "6 months", theme: "portrait" },
      { slug: "three-month-bridal", name: "Three-Month Bridal Plan", blurb: "A condensed programme when the date is closer.", meta: "3 months", theme: "portrait" },
      { slug: "one-month-bridal", name: "Four-Week Polish", blurb: "Safe, non-reactive treatments only — glow without risk.", meta: "4 weeks", theme: "facial" },
      { slug: "week-of-facial", name: "Week-Of Facial", blurb: "Hydration and calm, deliberately gentle this close to the day.", meta: "7–10 days before", theme: "facial" },
      { slug: "groom-programme", name: "Groom's Programme", blurb: "Shaving irritation, tone and grooming, planned to the date.", meta: "3 months", theme: "portrait" },
      { slug: "bridal-body-polish", name: "Bridal Body Polish", blurb: "Back, shoulders and arms for an open-backed outfit.", meta: "4–6 sessions", theme: "body" },
      { slug: "bridal-hair-programme", name: "Bridal Hair Programme", blurb: "Density and scalp health in the months before styling.", meta: "3–6 months", theme: "hair" },
      { slug: "engagement-glow", name: "Engagement Glow", blurb: "A single-session lift before photographs.", meta: "1 session", theme: "facial" },
      { slug: "bridal-trial-consult", name: "Bridal Consultation", blurb: "Maps every treatment against the calendar before anything starts.", meta: "60 minutes", theme: "clinical" },
      { slug: "post-wedding-recovery", name: "Post-Event Recovery", blurb: "Repairs the toll of makeup, travel and no sleep.", meta: "2–3 sessions", theme: "facial" },
    ],
  },
  {
    slug: "mens",
    name: "Men's Aesthetics",
    icon: "user",
    blurb: "Treatments built around male skin, hair and expectations.",
    intro:
      "Thicker dermis, denser beard growth and different ageing patterns — male skin is not simply a larger version of the same problem.",
    tint: "from-slate-400 to-brand-500",
    theme: "portrait",
    treatments: [
      { slug: "mens-hairline", name: "Hairline Restoration", blurb: "The most common male request, medical or surgical.", meta: "Assessment first", theme: "hair" },
      { slug: "mens-anti-wrinkle", name: "Men's Anti-Wrinkle", blurb: "Higher dosing for stronger muscle, kept deliberately conservative.", meta: "Every 4–5 months", theme: "injectable" },
      { slug: "razor-bumps", name: "Razor Bump Treatment", blurb: "Treats the ingrown hairs and inflammation shaving creates.", meta: "4–6 sessions", theme: "device" },
      { slug: "mens-jawline", name: "Men's Jawline Definition", blurb: "Structural work respecting a male facial proportion.", meta: "Lasts 12–18 months", theme: "injectable" },
      { slug: "mens-acne", name: "Men's Acne Programme", blurb: "Accounts for beard care and sweat as part of the picture.", meta: "3–6 months", theme: "clinical" },
      { slug: "mens-skin-basics", name: "Men's Skin Fundamentals", blurb: "A short, realistic routine most men will actually follow.", meta: "Consultation", theme: "product" },
      { slug: "gynecomastia-assessment", name: "Gynecomastia Assessment", blurb: "Establishes whether chest fullness is glandular or fat.", meta: "Assessment", theme: "clinical" },
      { slug: "mens-body-hair", name: "Men's Body Hair Reduction", blurb: "Chest, back and shoulders, reduced rather than cleared.", meta: "6–8 sessions", theme: "device" },
      { slug: "mens-dark-circles", name: "Men's Under-Eye Treatment", blurb: "Usually structural hollowing rather than pigment.", meta: "3 sessions", theme: "injectable" },
      { slug: "mens-tattoo-removal", name: "Tattoo Removal", blurb: "Staged laser clearing, ink colour deciding the session count.", meta: "6–12 sessions", theme: "device" },
      { slug: "mens-scalp-detox", name: "Men's Scalp Treatment", blurb: "Oil, flaking and follicle health under a cap or helmet.", meta: "Monthly", theme: "hair" },
      { slug: "mens-executive-package", name: "Executive Skin Review", blurb: "A single appointment covering skin, hair and screening.", meta: "90 minutes", theme: "clinical" },
    ],
  },
  {
    slug: "dental",
    name: "Dental Aesthetics",
    icon: "smile",
    blurb: "The part of a face people photograph most.",
    intro:
      "Smile work sits alongside facial aesthetics because proportion, lip position and tooth display are read together, not separately.",
    tint: "from-sky-400 to-emerald-400",
    theme: "dental",
    treatments: [
      { slug: "teeth-whitening", name: "Professional Whitening", blurb: "In-clinic whitening with the sensitivity managed properly.", meta: "1–2 sessions", theme: "dental" },
      { slug: "home-whitening-kit", name: "Supervised Home Whitening", blurb: "Custom trays and prescribed gel, checked at intervals.", meta: "2–3 weeks", theme: "dental" },
      { slug: "composite-bonding", name: "Composite Bonding", blurb: "Reshapes chipped or uneven teeth in a single visit.", meta: "1 session", theme: "dental" },
      { slug: "porcelain-veneers", name: "Porcelain Veneers", blurb: "Thin ceramic facings for shape, colour and alignment together.", meta: "2–3 visits", theme: "dental" },
      { slug: "clear-aligners", name: "Clear Aligners", blurb: "Removable trays that move teeth without visible braces.", meta: "6–18 months", theme: "dental" },
      { slug: "gum-contouring", name: "Gum Contouring", blurb: "Reshapes an uneven or low gum line.", meta: "1 session", theme: "dental" },
      { slug: "scaling-polishing", name: "Scaling & Polishing", blurb: "The hygiene appointment every whitening plan should start with.", meta: "Every 6 months", theme: "dental" },
      { slug: "dental-implant", name: "Dental Implant", blurb: "A titanium root and crown replacing a missing tooth.", meta: "3–6 months", theme: "dental" },
      { slug: "smile-makeover", name: "Full Smile Makeover", blurb: "Planned across whitening, alignment and restoration together.", meta: "Staged", theme: "dental" },
      { slug: "teeth-jewellery", name: "Tooth Gem Application", blurb: "A removable gem bonded without drilling.", meta: "1 session", theme: "dental" },
      { slug: "night-guard", name: "Night Guard", blurb: "Protects teeth from grinding — often paired with masseter treatment.", meta: "2 visits", theme: "dental" },
      { slug: "dental-consult", name: "Dental Aesthetic Consult", blurb: "Photographs, measurement and a plan before anything is booked.", meta: "45 minutes", theme: "dental" },
    ],
  },
  {
    slug: "skin-health",
    name: "Skin Health",
    icon: "aperture",
    blurb: "Diagnosis and medical dermatology, not only aesthetics.",
    intro:
      "The conditions that need a doctor rather than a facial — and the checks that catch something serious early.",
    tint: "from-brand-500 to-violet-400",
    theme: "clinical",
    treatments: [
      { slug: "full-skin-check", name: "Full Skin Examination", blurb: "A head-to-toe mole and lesion check by a dermatologist.", meta: "Annually", theme: "clinical" },
      { slug: "dermoscopy", name: "Digital Dermoscopy", blurb: "Magnified imaging that tracks a mole between visits.", meta: "Annually", theme: "clinical" },
      { slug: "mole-removal", name: "Mole Removal", blurb: "Excision or shave, with histology whenever it is warranted.", meta: "1 session", theme: "clinical" },
      { slug: "skin-tag-removal", name: "Skin Tag Removal", blurb: "Quick clearance of tags at the neck, lids and underarms.", meta: "1 session", theme: "clinical" },
      { slug: "wart-treatment", name: "Wart Treatment", blurb: "Cryotherapy, cautery or immune therapy depending on the site.", meta: "2–4 sessions", theme: "clinical" },
      { slug: "eczema-management", name: "Eczema Management", blurb: "Barrier repair, trigger identification and prescribed control.", meta: "Ongoing", theme: "clinical" },
      { slug: "psoriasis-management", name: "Psoriasis Management", blurb: "Topical, phototherapy or systemic care by severity.", meta: "Ongoing", theme: "clinical" },
      { slug: "rosacea-programme", name: "Rosacea Programme", blurb: "Settles flushing and papules, and identifies what sets them off.", meta: "3–6 months", theme: "device" },
      { slug: "fungal-infection", name: "Fungal Infection Treatment", blurb: "Confirmed by scraping before anything is prescribed.", meta: "2–6 weeks", theme: "clinical" },
      { slug: "urticaria-workup", name: "Chronic Hives Workup", blurb: "Investigates recurrent weals that antihistamines are not holding.", meta: "Assessment", theme: "clinical" },
      { slug: "patch-testing", name: "Allergy Patch Testing", blurb: "Identifies the contact allergen behind persistent dermatitis.", meta: "3 visits over a week", theme: "clinical" },
      { slug: "sun-protection-consult", name: "Photoprotection Consult", blurb: "The single highest-value appointment in dermatology.", meta: "30 minutes", theme: "product" },
      { slug: "skin-biopsy", name: "Skin Biopsy", blurb: "A small sample sent for histology when diagnosis is unclear.", meta: "1 session · results 7 days", theme: "clinical" },
      { slug: "teledermatology", name: "Teledermatology Review", blurb: "Photo-based review for rashes that cannot wait for a slot.", meta: "24–48h response", theme: "clinical" },
    ],
  },
];

/* ── Genuinely new categories ──────────────────────────────────────────── */

export const NEW_CATEGORIES: SeedCategory[] = [
  {
    slug: "tattoo-removal",
    name: "Tattoo Removal",
    icon: "zap",
    blurb: "Staged clearing of ink, colour by colour.",
    intro:
      "Ink is removed a layer at a time by lasers matched to its colour. Black clears most readily; green, sky blue and yellow are the stubborn ones, and honest session counts matter more than promises.",
    tint: "from-slate-500 to-violet-500",
    theme: "device",
    treatments: [
      { slug: "black-ink-removal", name: "Black Ink Removal", blurb: "The most responsive pigment, cleared over a staged course.", meta: "6–10 sessions, 6 weeks apart", theme: "device" },
      { slug: "colour-tattoo-removal", name: "Coloured Tattoo Removal", blurb: "Multiple wavelengths for reds, greens and blues.", meta: "8–15 sessions", theme: "device" },
      { slug: "cosmetic-tattoo-removal", name: "Cosmetic Tattoo Removal", blurb: "Microbladed brows and lip liner, treated with extra caution.", meta: "3–6 sessions", theme: "device" },
      { slug: "tattoo-fading", name: "Tattoo Fading for Cover-Up", blurb: "Partial clearing so an artist can work over it.", meta: "3–4 sessions", theme: "device" },
      { slug: "scar-after-tattoo", name: "Post-Tattoo Scar Treatment", blurb: "Texture left by amateur work or previous removal attempts.", meta: "3–5 sessions", theme: "device" },
      { slug: "tattoo-removal-consult", name: "Removal Assessment", blurb: "Ink depth, colour and skin type set a realistic session count.", meta: "Assessment + patch test", theme: "clinical" },
    ],
  },
  {
    slug: "regenerative",
    name: "Regenerative Aesthetics",
    icon: "sprout",
    blurb: "Treatments that ask the skin to rebuild rather than to fill.",
    intro:
      "Biostimulators, growth factors and cell-signalling therapies. Results arrive over months rather than days, which is precisely the point.",
    tint: "from-teal-400 to-brand-500",
    theme: "injectable",
    treatments: [
      { slug: "prp-face", name: "PRP Facial Therapy", blurb: "Your own platelets to improve texture, tone and fine lines.", meta: "3 sessions monthly", theme: "injectable" },
      { slug: "prf-therapy", name: "PRF Therapy", blurb: "A slower-release fibrin preparation with no anticoagulant.", meta: "3 sessions", theme: "injectable" },
      { slug: "exosome-facial", name: "Exosome Therapy", blurb: "Signalling vesicles applied after micro-channelling.", meta: "3 sessions", theme: "facial" },
      { slug: "stem-cell-conditioned", name: "Conditioned Media Therapy", blurb: "Growth-factor rich media used post-procedure to speed repair.", meta: "As part of a course", theme: "product" },
      { slug: "collagen-induction", name: "Collagen Induction Therapy", blurb: "Microneedling at depth to rebuild dermal collagen.", meta: "4–6 sessions", theme: "device" },
      { slug: "skin-booster-course", name: "Skin Booster Course", blurb: "Staged hyaluronic hydration read as skin quality, not volume.", meta: "3 sessions, 4 weeks apart", theme: "injectable" },
      { slug: "regenerative-consult", name: "Regenerative Consultation", blurb: "Sets expectations honestly — these work slowly or not at all.", meta: "45 minutes", theme: "clinical" },
    ],
  },
  {
    slug: "scars-marks",
    name: "Scars & Marks",
    icon: "scan",
    blurb: "Surgical scars, stretch marks, burns and birthmarks.",
    intro:
      "Scar treatment is about texture, colour and pliability. Early intervention outperforms anything attempted years later, so timing is part of the advice.",
    tint: "from-orange-300 to-rose-400",
    theme: "body",
    treatments: [
      { slug: "surgical-scar-revision", name: "Surgical Scar Revision", blurb: "Improves a wide, raised or badly placed surgical line.", meta: "2–4 sessions", theme: "clinical" },
      { slug: "c-section-scar", name: "C-Section Scar Treatment", blurb: "Flattens and softens the scar and the shelf above it.", meta: "3–5 sessions", theme: "body" },
      { slug: "burn-scar-treatment", name: "Burn Scar Treatment", blurb: "Laser and pressure to improve pliability and colour.", meta: "Ongoing course", theme: "body" },
      { slug: "stretch-mark-early", name: "Early Stretch Mark Treatment", blurb: "Red striae respond far better than white ones — treat them now.", meta: "4–6 sessions", theme: "body" },
      { slug: "stretch-mark-mature", name: "Mature Stretch Mark Treatment", blurb: "Texture improvement for older, silvery striae.", meta: "6–8 sessions", theme: "body" },
      { slug: "birthmark-assessment", name: "Birthmark Assessment", blurb: "Establishes type and whether laser is appropriate.", meta: "Assessment", theme: "clinical" },
      { slug: "port-wine-stain", name: "Port Wine Stain Treatment", blurb: "Vascular laser, started young where possible.", meta: "Multiple sessions", theme: "device" },
      { slug: "self-harm-scar", name: "Scar Camouflage", blurb: "Discreet treatment to soften the visibility of old scarring.", meta: "4–8 sessions", theme: "body" },
    ],
  },
  {
    slug: "hands-feet",
    name: "Hands & Feet",
    icon: "sparkles",
    blurb: "The areas that age visibly and get treated last.",
    intro:
      "Hands show sun damage and volume loss earlier than the face, and are almost never protected. Feet get attention only when they hurt.",
    tint: "from-amber-400 to-teal-400",
    theme: "body",
    treatments: [
      { slug: "hand-pigmentation", name: "Hand Pigmentation Treatment", blurb: "Clears the sunspots that give age away.", meta: "3–4 sessions", theme: "device" },
      { slug: "hand-volume", name: "Hand Volume Restoration", blurb: "Refills the back of the hand so tendons show less.", meta: "Lasts 9–12 months", theme: "body" },
      { slug: "nail-fungus-laser", name: "Nail Fungus Laser", blurb: "For nails that oral treatment has not cleared.", meta: "4–6 sessions", theme: "device" },
      { slug: "cracked-heels", name: "Cracked Heel Treatment", blurb: "Medical debridement and a barrier plan that holds.", meta: "2–3 sessions", theme: "body" },
      { slug: "callus-management", name: "Callus & Corn Management", blurb: "Removal plus the pressure cause, or it simply returns.", meta: "Every 6–8 weeks", theme: "body" },
      { slug: "sweaty-feet", name: "Plantar Sweat Treatment", blurb: "Reduces sweating that causes odour and skin breakdown.", meta: "Every 6 months", theme: "clinical" },
      { slug: "hand-rejuv-programme", name: "Complete Hand Programme", blurb: "Pigment, texture and volume addressed in sequence.", meta: "3–6 months", theme: "body" },
    ],
  },
];
