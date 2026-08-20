/**
 * RX SKIN (C-31 … C-33) — the condition vocabulary, as opposed to the
 * treatment vocabulary in hub.ts. Clients rarely search for "microneedling";
 * they search for "the marks acne left behind".
 *
 * Sourced from the skin-condition language on curology.com and widened to the
 * conditions an Indian aesthetic practice actually sees. Each condition
 * carries the one-line description that appears on hover, and points at the
 * hub category that treats it.
 */

export interface SkinCondition {
  slug: string;
  name: string;
  /** The one-liner revealed on hover (C-33). Keep to a single sentence. */
  line: string;
  /** Longer copy for the condition page. */
  detail: string;
  /** Hub category slug this routes to. */
  category: string;
  group: ConditionGroup;
  /** Signs a client would recognise in the mirror. */
  signs: string[];
}

export type ConditionGroup =
  | "Breakouts"
  | "Pigment"
  | "Ageing"
  | "Barrier"
  | "Hair"
  | "Texture"
  | "Body";

export const CONDITION_GROUPS: ConditionGroup[] = [
  "Breakouts",
  "Pigment",
  "Ageing",
  "Barrier",
  "Texture",
  "Body",
  "Hair",
];

/** Which of the two Rx tracks a condition belongs to. */
export function trackFor(c: SkinCondition): "skin" | "hair" {
  return c.group === "Hair" ? "hair" : "skin";
}

export const SKIN_CONDITIONS: SkinCondition[] = [
  // ── Breakouts ────────────────────────────────────────────────────────
  {
    slug: "acne",
    name: "Acne",
    line: "Blocked, inflamed pores that surface as papules, pustules and cysts.",
    detail:
      "Acne starts when oil and dead skin plug a follicle and bacteria multiply inside it. It is treated by controlling oil, clearing the plug and calming the inflammation, usually together, rarely with one product.",
    category: "acne-scars",
    group: "Breakouts",
    signs: ["Red, tender spots", "Whiteheads", "Flares before periods"],
  },
  {
    slug: "hormonal-acne",
    name: "Hormonal acne",
    line: "Deep, cyclical breakouts along the jaw and chin that track your cycle.",
    detail:
      "Driven by androgen sensitivity rather than hygiene. It responds to hormonal or systemic treatment far better than to stronger face washes, so bloodwork often comes before any procedure.",
    category: "acne-scars",
    group: "Breakouts",
    signs: ["Jawline spots", "Monthly pattern", "Slow to surface"],
  },
  {
    slug: "blackheads",
    name: "Blackheads & congestion",
    line: "Open plugs that oxidise dark, most often across the nose and chin.",
    detail:
      "Congestion is oil that has sat in the pore long enough to harden. Extraction clears what is there; only a routine change keeps it from refilling.",
    category: "glass-skin",
    group: "Breakouts",
    signs: ["Rough nose", "Grey cast up close", "Refills within weeks"],
  },
  {
    slug: "acne-scars",
    name: "Acne scars",
    line: "The pits, rolling dips and raised marks acne leaves once it clears.",
    detail:
      "Scarring is a collagen problem, not a pigment one, so it needs remodelling, microneedling, fractional laser or subcision, rather than brightening.",
    category: "acne-scars",
    group: "Texture",
    signs: ["Shadows in side light", "Uneven surface", "Ice-pick marks"],
  },
  {
    slug: "post-acne-marks",
    name: "Post-acne marks",
    line: "Flat brown or red patches left where a spot used to be.",
    detail:
      "Unlike scars these sit at skin level and fade on their own, but months faster with pigment-directed treatment and daily sun protection.",
    category: "pigmentation",
    group: "Pigment",
    signs: ["Flat to touch", "Brown or pink", "Darker after sun"],
  },

  // ── Pigment ──────────────────────────────────────────────────────────
  {
    slug: "melasma",
    name: "Melasma",
    line: "Symmetrical brown patches on the cheeks, forehead and upper lip.",
    detail:
      "Hormone and heat driven, and famously prone to rebound. Treated slowly and conservatively. Aggressive lasers frequently make it worse.",
    category: "pigmentation",
    group: "Pigment",
    signs: ["Both cheeks alike", "Worse in summer", "Returns after sun"],
  },
  {
    slug: "dark-spots",
    name: "Dark spots & sun damage",
    line: "Scattered patches where years of UV have switched pigment cells on.",
    detail:
      "Cumulative sun exposure surfacing as freckling and uneven tone. It clears well with pigment lasers and peels, provided sunscreen becomes non-negotiable.",
    category: "pigmentation",
    group: "Pigment",
    signs: ["Sun-exposed areas", "Sharp edges", "Slowly multiplying"],
  },
  {
    slug: "uneven-tone",
    name: "Uneven skin tone",
    line: "Patchy colour and lost clarity, with no single spot to point at.",
    detail:
      "Usually a mix of low-grade pigment, dehydration and dead-cell buildup. Responds to a course rather than a single sitting.",
    category: "glass-skin",
    group: "Pigment",
    signs: ["Looks tired in photos", "Makeup sits unevenly", "Grey cast"],
  },
  {
    slug: "dark-circles",
    name: "Dark circles",
    line: "Under-eye shadowing from pigment, thin skin, or the hollow beneath.",
    detail:
      "Three different causes that look alike and are treated completely differently, which is why an in-person look decides the plan.",
    category: "eyes",
    group: "Pigment",
    signs: ["Worse when tired", "Blue or brown tint", "Hollow rim"],
  },

  // ── Ageing ───────────────────────────────────────────────────────────
  {
    slug: "fine-lines",
    name: "Fine lines & wrinkles",
    line: "Creases that first appear on movement, then stay when you relax.",
    detail:
      "Early lines are muscle-driven and answer to relaxants; settled ones need volume or resurfacing. Catching them at the first stage is far cheaper than the second.",
    category: "botox",
    group: "Ageing",
    signs: ["Crow's feet", "Forehead lines", "Etched at rest"],
  },
  {
    slug: "sagging",
    name: "Sagging & laxity",
    line: "Loss of jawline definition as collagen and fat pads shift downward.",
    detail:
      "Tightening devices stimulate collagen without surgery; how much they can achieve depends on how much laxity there already is.",
    category: "lifting",
    group: "Ageing",
    signs: ["Softer jawline", "Nasolabial deepening", "Jowling"],
  },
  {
    slug: "volume-loss",
    name: "Volume loss",
    line: "Flattened cheeks and temples that read as tiredness, not age.",
    detail:
      "The face deflates before it descends. Replacing structural volume at the right depth often does more than any surface treatment.",
    category: "fillers",
    group: "Ageing",
    signs: ["Hollow temples", "Flat cheeks", "Shadowed midface"],
  },
  {
    slug: "eye-bags",
    name: "Under-eye bags",
    line: "Puffiness from fat pads or fluid that makeup can't quite cover.",
    detail:
      "Fluid-driven puffiness settles with lifestyle and light treatment; true fat herniation is surgical. Telling them apart is the first consultation.",
    category: "eyes",
    group: "Ageing",
    signs: ["Worse mornings", "Casts a shadow", "Unchanged by sleep"],
  },

  // ── Barrier ──────────────────────────────────────────────────────────
  {
    slug: "rosacea",
    name: "Rosacea & redness",
    line: "Persistent flushing across the central face, with visible vessels.",
    detail:
      "A vascular and inflammatory condition, not sensitivity. Trigger control comes first; vascular laser handles what stays behind.",
    category: "skin-health",
    group: "Barrier",
    signs: ["Flushes with heat", "Visible capillaries", "Stings easily"],
  },
  {
    slug: "sensitive-skin",
    name: "Sensitive & compromised barrier",
    line: "Skin that stings, tightens or flakes with almost any new product.",
    detail:
      "Often over-treated rather than under-treated. The plan usually starts by removing actives and rebuilding the barrier for a few weeks.",
    category: "skin-health",
    group: "Barrier",
    signs: ["Burns on application", "Flaking", "Tight after washing"],
  },
  {
    slug: "dryness",
    name: "Dryness & dehydration",
    line: "Tight, dull skin that drinks in moisturiser and asks for more.",
    detail:
      "Dry skin lacks oil; dehydrated skin lacks water, and oily skin can be dehydrated too. The distinction changes the entire routine.",
    category: "glass-skin",
    group: "Barrier",
    signs: ["Tight after cleansing", "Fine crepe lines", "Flaky patches"],
  },
  {
    slug: "eczema",
    name: "Eczema & dermatitis",
    line: "Itchy, inflamed patches that come and go in the same places.",
    detail:
      "Medical dermatology, not aesthetics. It is settled first, no elective procedure runs on inflamed skin.",
    category: "skin-health",
    group: "Barrier",
    signs: ["Itch first", "Cracked skin", "Flares in seasons"],
  },

  // ── Texture ──────────────────────────────────────────────────────────
  {
    slug: "large-pores",
    name: "Enlarged pores",
    line: "Pores stretched by oil flow and lost elasticity around the nose and cheeks.",
    detail:
      "Pore size can be reduced in appearance but not erased. Consistent oil control plus collagen stimulation is what actually moves it.",
    category: "glass-skin",
    group: "Texture",
    signs: ["Visible at arm's length", "Worse by evening", "Makeup settles in"],
  },
  {
    slug: "dullness",
    name: "Dullness",
    line: "Skin that has stopped reflecting light the way it used to.",
    detail:
      "Dead-cell buildup, dehydration and low microcirculation together. The quickest visible win of any concern on this list.",
    category: "glass-skin",
    group: "Texture",
    signs: ["Flat in photos", "Rough to touch", "Grey undertone"],
  },
  {
    slug: "stretch-marks",
    name: "Stretch marks",
    line: "Bands where the skin grew faster than its collagen could follow.",
    detail:
      "Red marks respond much better than white ones, so early treatment matters more here than almost anywhere else.",
    category: "body-fat",
    group: "Texture",
    signs: ["Red or silver bands", "Slightly sunken", "After growth or weight change"],
  },
  {
    slug: "unwanted-hair",
    name: "Unwanted hair",
    line: "Regrowth that shaving and waxing only ever postpone.",
    detail:
      "Laser targets pigment in the follicle, so it works in cycles, a course, not a session. Hormonal causes are checked first.",
    category: "hair-removal",
    group: "Hair",
    signs: ["Coarse regrowth", "Ingrowns", "Shadow after shaving"],
  },

  // ── Hair ─────────────────────────────────────────────────────────────
  {
    slug: "hair-fall",
    name: "Hair fall",
    line: "Shedding beyond the normal hundred strands a day.",
    detail:
      "Diffuse shedding usually has a cause you can find, iron, thyroid, illness, stress. Bloodwork before any treatment plan.",
    category: "hair-restoration",
    group: "Hair",
    signs: ["Strands on the pillow", "Thinner ponytail", "Started suddenly"],
  },
  {
    slug: "pattern-baldness",
    name: "Pattern thinning",
    line: "Receding temples or a widening part driven by genetics.",
    detail:
      "Androgenic thinning is progressive, so the goal is to hold what is there while regrowing what recently went.",
    category: "hair-restoration",
    group: "Hair",
    signs: ["Widening parting", "Receding hairline", "Scalp showing"],
  },
  {
    slug: "dandruff",
    name: "Dandruff & scalp irritation",
    line: "Flaking and itch that keeps returning once the shampoo stops.",
    detail:
      "A yeast-driven scalp condition, and a common reason hair treatments underperform. It is cleared before anything else starts.",
    category: "hair-restoration",
    group: "Hair",
    signs: ["Visible flakes", "Itchy scalp", "Returns in weeks"],
  },
  {
    slug: "thinning-ponytail",
    name: "Thinning ponytail",
    line: "The same hair tie going round one more time than it used to.",
    detail:
      "A density change you feel before you see it. Measuring it early, with a scalp scope rather than a mirror, is what makes regrowth realistic.",
    category: "hair-restoration",
    group: "Hair",
    signs: ["Extra loop on the tie", "Flatter volume", "Gradual over a year"],
  },
  {
    slug: "wide-part",
    name: "Widening part",
    line: "A parting that reads wider in photographs than it feels.",
    detail:
      "Usually the first visible sign of androgenic thinning in women. It responds well while the follicle is only miniaturised, not gone.",
    category: "hair-restoration",
    group: "Hair",
    signs: ["Scalp shows in light", "Wider at the crown", "Worse when wet"],
  },
  {
    slug: "bald-spots",
    name: "Bald patches",
    line: "Sharply defined smooth circles that appeared without warning.",
    detail:
      "Alopecia areata is autoimmune, not cosmetic. It is treated medically and often regrows, a hair transplant into an active patch is the wrong answer.",
    category: "hair-restoration",
    group: "Hair",
    signs: ["Round and smooth", "Appeared suddenly", "No itch or scaling"],
  },
  {
    slug: "hair-breakage",
    name: "Breakage & damage",
    line: "Hair snapping mid-length from heat, bleach or tight styling.",
    detail:
      "Breakage is a shaft problem, not a follicle one, so it looks like hair loss and is treated nothing like it. The fix starts with what you stop doing.",
    category: "hair-restoration",
    group: "Hair",
    signs: ["Short broken strands", "Rough ends", "Never reaches length"],
  },
  {
    slug: "receding-hairline",
    name: "Receding hairline",
    line: "Temples moving back and the front line losing its shape.",
    detail:
      "Progressive and hormone-driven. Medical therapy holds the line; restoration surgery is considered only once the loss has stabilised.",
    category: "hair-restoration",
    group: "Hair",
    signs: ["Deeper temples", "M-shaped line", "Finer front hair"],
  },
  {
    slug: "oily-scalp",
    name: "Oily scalp",
    line: "Roots that look unwashed by the evening of the day you washed them.",
    detail:
      "Overactive sebaceous glands, often made worse by washing harder. Treatment calms the gland rather than stripping the scalp.",
    category: "hair-restoration",
    group: "Hair",
    signs: ["Flat by evening", "Itchy roots", "Product build-up"],
  },
  {
    slug: "postpartum-shedding",
    name: "Postpartum shedding",
    line: "Heavy loss two to four months after giving birth.",
    detail:
      "Hormonal, expected, and self-limiting in most cases, the hair held through pregnancy sheds at once. Support and reassurance beat aggressive treatment.",
    category: "hair-restoration",
    group: "Hair",
    signs: ["Handfuls when washing", "Starts around month 3", "Regrows in a fringe"],
  },

  // ── Body ─────────────────────────────────────────────────────────────
  {
    slug: "back-acne",
    name: "Body & back acne",
    line: "Breakouts across the back, chest and shoulders that clothes aggravate.",
    detail:
      "Same disease, different skin, thicker, with a higher risk of scarring. Sweat, friction and fabric matter as much as the topical does.",
    category: "acne-scars",
    group: "Body",
    signs: ["Worse after workouts", "Under straps", "Leaves dark marks"],
  },
  {
    slug: "underarm-pigmentation",
    name: "Underarm & body pigmentation",
    line: "Darkening at the underarms, inner thighs or neck folds.",
    detail:
      "Friction, shaving and hormones together. Laser hair removal often does more for it than any brightening cream, because it removes the cause.",
    category: "pigmentation",
    group: "Body",
    signs: ["Dark folds", "Worse after shaving", "Velvety texture"],
  },
  {
    slug: "ingrown-hair",
    name: "Ingrown hair & razor bumps",
    line: "Trapped hairs that turn into painful bumps and leave dark marks.",
    detail:
      "Common in coarse, curly hair and the main reason people abandon shaving. Laser is the definitive answer because it takes the hair out of the cycle.",
    category: "hair-removal",
    group: "Body",
    signs: ["Bumps after shaving", "Visible trapped hair", "Post-inflammatory marks"],
  },
  {
    slug: "excess-sweating",
    name: "Excess sweating",
    line: "Underarm or palm sweating that soaks through a shirt in normal weather.",
    detail:
      "Hyperhidrosis is a medical condition, not poor hygiene, and it responds very well to targeted treatment lasting several months per session.",
    category: "skin-health",
    group: "Body",
    signs: ["Sweat marks daily", "Not heat-related", "Affects clothing choices"],
  },
  {
    slug: "cellulite",
    name: "Cellulite & skin dimpling",
    line: "Dimpling over the thighs and hips from fibrous bands under the skin.",
    detail:
      "Structural, extremely common, and unrelated to weight. Honest treatment softens the appearance rather than promising to erase it.",
    category: "body-fat",
    group: "Body",
    signs: ["Dimpling when seated", "Unchanged by weight loss", "Worse with age"],
  },
  {
    slug: "double-chin",
    name: "Double chin",
    line: "Fullness under the jaw that stays whatever the scale says.",
    detail:
      "Submental fat is a stubborn, genetically-placed pocket. It responds to targeted reduction far better than to overall weight loss.",
    category: "face-contour",
    group: "Body",
    signs: ["Soft under the jaw", "Blurred jawline", "Runs in the family"],
  },

  // ── More skin ────────────────────────────────────────────────────────
  {
    slug: "milia",
    name: "Milia",
    line: "Tiny hard white bumps under the eyes that never come to a head.",
    detail:
      "Keratin trapped just below the surface. They cannot be squeezed out. Extraction with a sterile lance takes a few seconds and is done in clinic.",
    category: "skin-health",
    group: "Texture",
    signs: ["Firm white dots", "Around the eyes", "Never inflamed"],
  },
  {
    slug: "keratosis-pilaris",
    name: "Keratosis pilaris",
    line: "Rough, goosebump-like texture on the upper arms and thighs.",
    detail:
      "Harmless and very common. It is managed rather than cured, and the redness responds better to treatment than the bumps do.",
    category: "skin-health",
    group: "Texture",
    signs: ["Sandpaper texture", "Upper arms", "Worse in winter"],
  },
  {
    slug: "skin-tags",
    name: "Skin tags & moles",
    line: "Small growths on the neck, lids or underarms that catch on things.",
    detail:
      "Removal is quick, but the examination comes first, anything changing in size, colour or border is checked before it is touched.",
    category: "skin-health",
    group: "Texture",
    signs: ["Soft and hanging", "In skin folds", "Catch on jewellery"],
  },
  {
    slug: "tanning",
    name: "Tanning & sun damage",
    line: "A stubborn shade change on exposed skin that doesn't fade back.",
    detail:
      "Repeated UV drives pigment cells to stay switched on. Detan work is straightforward; keeping it off is the part that needs a routine.",
    category: "pigmentation",
    group: "Pigment",
    signs: ["Sharp tan lines", "Face darker than body", "Worse after travel"],
  },
  {
    slug: "neck-lines",
    name: "Neck lines & tech neck",
    line: "Horizontal creases across the neck from years of looking down.",
    detail:
      "Neck skin is thin and moves constantly, so it ages ahead of the face and is often left out of a routine entirely.",
    category: "lifting",
    group: "Ageing",
    signs: ["Horizontal bands", "Crepey texture", "Visible in photos"],
  },
  {
    slug: "lip-lines",
    name: "Lip lines & volume loss",
    line: "Vertical lines around the mouth and lips that have thinned out.",
    detail:
      "Both a volume and a surface problem, which is why one treatment alone usually disappoints. Sequence matters more than product choice.",
    category: "fillers",
    group: "Ageing",
    signs: ["Lipstick bleeds", "Thinner lip line", "Lines at rest"],
  },
];

export const CONDITION_BY_SLUG = new Map(
  SKIN_CONDITIONS.map((c) => [c.slug, c])
);

export function conditionsInGroup(group: ConditionGroup) {
  return SKIN_CONDITIONS.filter((c) => c.group === group);
}
