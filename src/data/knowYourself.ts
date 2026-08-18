import { IMG } from "./hubImages";

/**
 * KNOW YOURSELF (C-20 … C-22) — the editorial column, presented as a
 * magazine rather than a blog feed: an issue, a cover feature, then the rest
 * of the stories. Every article is tied to a service, so reading one always
 * has somewhere to go.
 *
 * Written as direct answers to the question in the title — that is also what
 * makes them quotable by AI search (A-1/A-2), not just readable.
 */

export interface Article {
  slug: string;
  /** Question-shaped, so the answer below is citable. */
  title: string;
  dek: string;
  issue: string;
  section: "Skin school" | "Treatment file" | "Ask a doctor" | "Routines";
  readMins: number;
  image: string;
  /** The service this article is tied to — a hub category slug. */
  category: string;
  categoryLabel: string;
  /** Opening answer, one paragraph. Kept short on purpose. */
  answer: string;
  body: { heading: string; text: string }[];
  cover?: boolean;
}

export const CURRENT_ISSUE = "Issue 04 · Monsoon";

export const ARTICLES: Article[] = [
  {
    slug: "why-acne-comes-back",
    title: "Why does acne come back the moment treatment stops?",
    dek: "The uncomfortable truth about maintenance, and how long you actually need to stay on a plan.",
    issue: CURRENT_ISSUE,
    section: "Skin school",
    readMins: 6,
    image: IMG.acne1,
    category: "acne-scars",
    categoryLabel: "Acne & Scars",
    cover: true,
    answer:
      "Because almost every acne treatment suppresses the cause rather than removing it. Oil production, follicle stickiness and bacterial load all return to baseline within weeks of stopping — so clearance is the halfway mark of a plan, not the end of it. Most protocols step down to a maintenance dose instead of stopping outright.",
    body: [
      {
        heading: "Clearance is not a cure",
        text: "A course that clears active lesions has changed the skin's behaviour only for as long as it is running. Retinoids keep follicles shedding normally; oil control keeps the environment inhospitable. Withdraw both and the follicle reverts to what it was doing before — usually within six to ten weeks, which is why relapse feels sudden.",
      },
      {
        heading: "What maintenance actually looks like",
        text: "Not the full protocol forever. A typical step-down keeps the retinoid at a lower frequency, drops the antibacterial entirely, and holds sunscreen daily because post-acne marks darken with UV faster than they fade. Most people run maintenance for six to twelve months after clearance.",
      },
      {
        heading: "When relapse means something else",
        text: "Breakouts that return along the jaw on a monthly rhythm, in an adult woman, are usually hormonal rather than a failure of the topical plan. That is a bloodwork conversation, not a stronger-cream conversation.",
      },
    ],
  },
  {
    slug: "melasma-laser-truth",
    title: "Can laser get rid of melasma for good?",
    dek: "The single most over-promised treatment in aesthetics, and what a careful doctor does instead.",
    issue: CURRENT_ISSUE,
    section: "Treatment file",
    readMins: 5,
    image: IMG.portraitMacro,
    category: "pigmentation",
    categoryLabel: "Pigmentation & Melasma",
    answer:
      "No — and any clinic promising permanence is selling you a rebound. Melasma is a chronic, hormone- and heat-driven condition. Laser can clear a great deal of visible pigment, but the pigment cells stay primed; without sun discipline and a maintenance topical, it returns, often darker than before treatment.",
    body: [
      {
        heading: "Why aggressive settings backfire",
        text: "Heat is itself a melasma trigger. High-energy passes clear pigment in the short term and provoke the exact inflammatory response that drives it, which is how a patient ends up worse eight weeks after a good-looking result at two.",
      },
      {
        heading: "The conservative protocol",
        text: "Low-fluence, high-frequency sessions alongside a topical that suppresses pigment production, and sun protection treated as part of the treatment rather than advice. Slower, less dramatic between sessions, and far more likely to still look good next summer.",
      },
    ],
  },
  {
    slug: "botox-too-young",
    title: "Am I too young for Botox?",
    dek: "Preventative versus corrective, and the only question worth asking before you book.",
    issue: CURRENT_ISSUE,
    section: "Ask a doctor",
    readMins: 4,
    image: IMG.procInject,
    category: "botox",
    categoryLabel: "Botox & Anti-Wrinkle",
    answer:
      "Age is the wrong test. The question is whether a line is still dynamic — visible only when you move — or already etched at rest. Relaxing a dynamic line stops it becoming a static one, which is cheaper and more effective than resurfacing later. If you have no lines at rest and none on movement, there is nothing to prevent yet.",
    body: [
      {
        heading: "The mirror test",
        text: "Raise your brows, then relax completely. If the forehead is smooth at rest, any line you saw was dynamic. If a crease remains, collagen has already been folded and a relaxant alone will soften but not erase it.",
      },
      {
        heading: "What over-treatment looks like",
        text: "A frozen upper face is not a dosing accident, it is a briefing failure. Movement is retained by treating fewer units across more points, and by leaving the frontalis partly active — worth saying out loud at the consultation.",
      },
    ],
  },
  {
    slug: "sunscreen-indoors",
    title: "Do I need sunscreen if I'm indoors all day?",
    dek: "Glass, screens, and the part of the spectrum that reaches your desk.",
    issue: "Issue 03 · Summer",
    section: "Routines",
    readMins: 3,
    image: IMG.prod2,
    category: "glass-skin",
    categoryLabel: "Glass Skin & Glow",
    answer:
      "Yes, if you sit near a window. Standard glass blocks UVB but lets most UVA through, and UVA is the wavelength that drives pigment and collagen loss. Screens are irrelevant by comparison — the visible light they emit is a rounding error next to a window at midday.",
    body: [
      {
        heading: "The window problem",
        text: "A desk beside glass can deliver meaningful UVA over an eight-hour day. If your pigmentation is worse on one side of the face, look at where you sit in the car and at work before blaming your routine.",
      },
      {
        heading: "What to use when nobody sees you",
        text: "The best indoor sunscreen is the one you will reapply without resentment. A light fluid at 8am and again after lunch beats a heavy cream applied once and abandoned by Wednesday.",
      },
    ],
  },
  {
    slug: "hair-fall-tests",
    title: "Which tests should I do before treating hair fall?",
    dek: "Four blood markers that change the entire plan, and why clinics skip them.",
    issue: "Issue 03 · Summer",
    section: "Skin school",
    readMins: 5,
    image: IMG.hair2,
    category: "hair-restoration",
    categoryLabel: "Hair Restoration",
    answer:
      "Ferritin, thyroid function, vitamin D and a haemogram, at minimum. Diffuse shedding in an otherwise healthy scalp is far more often a systemic signal than a scalp problem, and treating the scalp while ferritin sits at 12 wastes both the money and the months.",
    body: [
      {
        heading: "Shedding versus thinning",
        text: "Shedding is a volume of loss; thinning is a change in the hair itself. Strands on the pillow with normal calibre suggests a systemic trigger; strands getting finer at the parting suggests androgenic miniaturisation. They are different treatment paths.",
      },
      {
        heading: "The three-month lag",
        text: "Hair responds to an insult roughly three months after it happens. The illness, crash diet or surgery that caused today's shedding is usually a season back — worth reconstructing before assuming it is genetic.",
      },
    ],
  },
  {
    slug: "peel-vs-laser",
    title: "Chemical peel or laser — which one do I actually need?",
    dek: "A decision made on depth and downtime, not on which sounds more advanced.",
    issue: "Issue 02 · Spring",
    section: "Treatment file",
    readMins: 6,
    image: IMG.procPeel,
    category: "laser",
    categoryLabel: "Laser & Energy",
    answer:
      "Peels work chemically from the surface down and suit pigment, congestion and dullness in darker skin types with minimal downtime. Lasers work by targeting a specific chromophore at a chosen depth and suit texture, scarring and vascular concerns. Depth of the problem decides, not the technology.",
    body: [
      {
        heading: "Skin type matters more than you think",
        text: "In Fitzpatrick IV–VI, post-inflammatory hyperpigmentation is the main risk of any resurfacing. That pushes the plan toward superficial peels and conservative laser settings, and makes test patches routine rather than optional.",
      },
      {
        heading: "Ask about the number of sessions",
        text: "Anything worth doing on Indian skin runs as a course. A single-session promise for scarring or pigment is a marketing claim rather than a clinical plan.",
      },
    ],
  },
  {
    slug: "bridal-timeline",
    title: "How far ahead of the wedding should I start?",
    dek: "A month-by-month plan, and the treatments to stop before the date.",
    issue: "Issue 02 · Spring",
    section: "Routines",
    readMins: 5,
    image: IMG.bridal2,
    category: "bridal",
    categoryLabel: "Bridal & Pre-Event",
    answer:
      "Six months for anything involving collagen or pigment, six weeks for polish, and nothing new inside the final fortnight. The order matters as much as the runway: treat the medical problem first, resurface second, hydrate last.",
    body: [
      {
        heading: "Six to three months out",
        text: "Acne control, pigment correction and any scar work. These need multiple sessions and carry a small risk of a reaction that wants time to settle.",
      },
      {
        heading: "The final two weeks",
        text: "Hydration and rest only. No first-time facials, no new actives, no threading you have not done before. Every bad wedding-week story starts with something tried for the first time.",
      },
    ],
  },
  {
    slug: "under-eye-cause",
    title: "What's actually causing my dark circles?",
    dek: "Three different problems that look identical in the mirror.",
    issue: "Issue 01 · Winter",
    section: "Ask a doctor",
    readMins: 4,
    image: IMG.eye2,
    category: "eyes",
    categoryLabel: "Eye Rejuvenation",
    answer:
      "Pigment, vascularity or structure. Pigmented circles stay the same colour when you stretch the skin; vascular ones lighten; structural shadow changes with the angle of the light because it is a hollow, not a colour. Each has a different treatment and the wrong one does nothing.",
    body: [
      {
        heading: "The stretch test",
        text: "Gently pull the skin outward at the outer corner. If the darkness persists it is pigment in the skin itself. If it fades, you are looking at vessels showing through thin skin.",
      },
      {
        heading: "Why creams disappoint",
        text: "Most under-eye creams address pigment. If your shadow is structural, no cream reaches the problem — volume does, and only after an examination confirms it is the hollow you are seeing.",
      },
    ],
  },
];

export const ARTICLE_BY_SLUG = new Map(ARTICLES.map((a) => [a.slug, a]));

export const COVER_ARTICLE = ARTICLES.find((a) => a.cover) ?? ARTICLES[0];

export const ARTICLE_SECTIONS = Array.from(
  new Set(ARTICLES.map((a) => a.section))
);
