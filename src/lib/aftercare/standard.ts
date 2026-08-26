/**
 * The standard post-procedure aftercare content.
 *
 * Transcribed from the clinic's own "Post-Procedure Aftercare Instructions"
 * sheet for invasive and barrier-disrupting dermatological procedures, and
 * kept as the wording that document uses rather than reworded. This is
 * clinical instruction: paraphrasing it to sound better is how "for 7 days"
 * becomes "for about a week" and a patient applies retinol on day five.
 *
 * ── Why this is code and not a database row ──────────────────────────────
 * It is the same for every clinic on the platform, it changes when the
 * clinical guidance changes rather than when somebody edits a page, and a
 * sheet that has been issued must not change underneath the patient holding
 * it. Issued sheets therefore SNAPSHOT this content (see AftercareSheet), so
 * a later revision here never rewrites a document somebody was already given.
 *
 * A doctor's own additions are separate, per patient and per treatment, and
 * they OVERRIDE anything here. That is what the sheet itself says.
 */

export interface AftercareContent {
  title: string;
  subtitle: string;
  intro: string;
  dos: string[];
  donts: string[];
  warnings: string[];
  warningsLead: string;
  additionsLead: string;
  consent: string;
}

export const STANDARD_AFTERCARE: AftercareContent = {
  title: "Post-procedure aftercare instructions",
  subtitle: "Invasive and barrier-disrupting dermatological procedures",

  intro:
    "Your procedure has temporarily broken the protective barrier of your skin. For the next 7 to 14 days the treated area is more vulnerable to infection, irritation and pigmentation change than usual. Please follow the instructions below carefully. Healing quality depends far more on aftercare than on the procedure itself.",

  dos: [
    "Keep the treated area clean. Wash gently with lukewarm water and the mild, non-foaming cleanser prescribed to you. Pat dry with a clean, soft towel, never rub.",
    "Wash your hands thoroughly before touching your face or applying anything to the treated area.",
    "Apply the prescribed topical ointment or barrier repair cream exactly as directed, in a thin, even layer.",
    "Apply broad-spectrum sunscreen SPF 50+ every morning once you are cleared to do so, and reapply every 2 to 3 hours during daylight. Continue for a minimum of 4 weeks.",
    "Use physical protection outdoors, such as a wide-brimmed hat, scarf or umbrella, in addition to sunscreen.",
    "Keep the skin well hydrated. Drink adequate water and use a bland moisturiser containing ceramides, panthenol or hyaluronic acid.",
    "Sleep with your head slightly elevated for the first 2 to 3 nights if swelling is expected.",
    "Use a clean pillowcase every night for the first week.",
    "Take all prescribed oral medication (antibiotics, antivirals, analgesics) for the full course, even if the skin looks settled.",
    "Expect mild redness, warmth, tightness, swelling or light flaking for 24 to 72 hours. This is a normal part of healing.",
    "Attend your scheduled review appointment even if the skin appears fully healed.",
  ],

  donts: [
    "Do not pick, scratch, rub or peel any crust, scab or flaking skin. Allow it to shed on its own. Picking is the leading cause of scarring and pigmentation.",
    "Do not apply active skincare ingredients for 7 days or until advised: retinol or tretinoin, AHA, BHA, benzoyl peroxide, vitamin C, hydroquinone or any exfoliant.",
    "Do not use facial scrubs, cleansing brushes, loofahs, dermaplaning or any mechanical exfoliation.",
    "Do not apply makeup, sunscreen or any unprescribed product until your doctor clears you, usually 24 to 72 hours, and longer after ablative procedures.",
    "Avoid direct sun exposure and tanning beds completely.",
    "Avoid steam, sauna, hot showers, hot yoga, swimming pools and the sea for 7 days.",
    "Avoid strenuous exercise and heavy sweating for 48 to 72 hours.",
    "Do not undergo any other facial treatment, including waxing, threading, laser, peel, facial or massage, on the treated area for 2 to 4 weeks.",
    "Avoid alcohol for 48 hours and smoking for as long as possible. Both delay wound healing.",
    "Do not self-medicate with over-the-counter steroid creams, home remedies or natural applications.",
    "Do not shave over the treated area until fully healed.",
  ],

  warningsLead: "Contact the clinic immediately if you notice",
  warnings: [
    "Increasing pain, spreading redness, or warmth after the third day",
    "Yellow or green discharge, pus, or a foul odour",
    "Fever above 38°C (100.4°F), chills, or feeling unwell",
    "Blistering, open sores, or clustered painful vesicles",
    "Bleeding that does not stop with gentle pressure",
    "Darkening, greyish or white discolouration of the treated skin",
  ],

  additionsLead:
    "Written by the treating doctor for this patient. Anything below is specific to you and overrides the standard list above.",

  consent:
    "I confirm that the above instructions have been explained to me and I have had the opportunity to ask questions.",
};

/**
 * The standard PRE-procedure content.
 *
 * ── The half that was missing ────────────────────────────────────────────
 * The platform issued aftercare and nothing before. That is the wrong way
 * round for the things that actually go wrong: a patient who took ibuprofen
 * that morning bruises, one who came with a fresh tan cannot be lasered at
 * all, one who did not stop their retinoid gets a chemical burn, and one who
 * ate nothing before a long session faints in the chair. Every one of those
 * is a wasted appointment or a complication, and every one is prevented by a
 * message sent two days earlier rather than a leaflet handed over afterwards.
 *
 * Written in the same register as the aftercare content and kept as clinical
 * wording rather than reworded to sound better — "for 7 days" becoming "for
 * about a week" is how a patient takes aspirin on day five.
 *
 * The doctor's own additions override anything here, and the sheet says so.
 */
export const STANDARD_PRETREATMENT: AftercareContent = {
  title: "Before your procedure",
  subtitle: "How to prepare, and what to stop",

  intro:
    "How well this goes depends partly on what you do in the days before it. The list below is what most patients are asked to do; anything your doctor has added at the bottom is specific to you and takes precedence. If you are unsure about any of it, ring the clinic rather than guessing — a question the day before costs nothing, and a postponed appointment costs you a slot.",

  dos: [
    "Tell us about every medicine and supplement you take, including anything bought without a prescription, and anything herbal or ayurvedic.",
    "Tell us if you have ever had a cold sore. Procedures on or around the lips can bring one on, and it is prevented with a tablet started beforehand rather than treated afterwards.",
    "Tell us if you are pregnant, breastfeeding, or trying to conceive.",
    "Tell us if you have taken isotretinoin in the last six months.",
    "Come with the treated area clean and bare — no make-up, no moisturiser, no sunscreen, no deodorant if the area is underarm.",
    "Shave the area the night before if you have been asked to, not on the day.",
    "Eat a proper meal beforehand and drink water. Long sessions on an empty stomach are the commonest reason somebody feels faint.",
    "Arrive at the time you were given rather than the appointment time if numbing cream is needed — it takes 45 to 60 minutes to work.",
    "Bring a hat, scarf or umbrella for the journey home, and sunglasses if the area is near the eyes.",
    "Arrange a lift home if you have been told you will be sedated or have had anything for anxiety.",
    "Wear loose clothing that does not have to be pulled over the treated area afterwards.",
  ],

  donts: [
    "Do not take aspirin, ibuprofen or other anti-inflammatory painkillers for 7 days beforehand unless a doctor has told you to keep taking them. Never stop a prescribed blood thinner on your own — tell us instead.",
    "Do not take fish oil, vitamin E, ginkgo, garlic or ginseng supplements for 7 days beforehand. All of them increase bruising.",
    "Do not use retinol, tretinoin, AHA, BHA, benzoyl peroxide or any exfoliant on the area for 5 to 7 days beforehand.",
    "Do not sunbathe, use a tanning bed or apply fake tan for 4 weeks beforehand. A tan is the single commonest reason a laser appointment has to be sent away.",
    "Do not wax, thread, pluck or use hair-removal cream on the area for 4 weeks beforehand. Shaving is fine.",
    "Do not drink alcohol for 24 hours beforehand.",
    "Do not have any other facial treatment — peel, facial, laser, injectable — on the area for 2 weeks beforehand.",
    "Do not come with an active infection, open sore or cold sore on the area. Ring us and we will move the appointment.",
  ],

  warningsLead: "Ring the clinic before you come if",
  warnings: [
    "You have developed a cold sore, rash, sunburn or any skin infection on the area",
    "You have started a new medicine since you were booked, particularly an antibiotic or a steroid",
    "You are unwell, feverish, or have an infection anywhere",
    "You think you may be pregnant",
    "You have had a vaccination in the last two weeks",
    "You cannot stop a blood thinner, or nobody has told you whether to",
  ],

  additionsLead:
    "Written by the treating doctor for this patient. Anything below is specific to you and overrides the standard list above.",

  consent:
    "I confirm that these instructions have been explained to me and I have had the opportunity to ask questions.",
};

/** The standard content for either side of the treatment. */
export function standardFor(kind: "PRE" | "POST"): AftercareContent {
  return kind === "PRE" ? STANDARD_PRETREATMENT : STANDARD_AFTERCARE;
}

/**
 * A stable key for "the same treatment", used to remember a doctor's standing
 * additions between patients.
 *
 * Treatments arrive as free text from several places (the booking reason, a
 * catalogue name, something the doctor typed), so matching on the raw string
 * would give a doctor one set of saved notes for "CO2 Laser" and another for
 * "co2 laser ". Folded to lower case with punctuation and runs of whitespace
 * collapsed, which is enough to make those the same drawer without pretending
 * to understand clinical synonyms.
 */
export function treatmentKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 120);
}
