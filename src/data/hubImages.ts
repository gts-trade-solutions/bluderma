/**
 * Local, project-owned photography for the client experience.
 *
 * The `-v2` assets are intentionally additive: the previous stock image
 * references remain recoverable in source history, while every live client
 * slot now resolves to a reviewed, project-owned image under `/public`.
 * Shared keys map to the closest semantic visual family so cards never fall
 * back to unrelated beauty stock.
 */

const K = (file: string) => `/images/korean/${file}`;
const G = (file: string) => `/images/global/${file}`;
const R = (file: string) => `/images/home-responsive/${file}`;

const ASSET = {
  hero: K("hero-banner-v2.png"),
  homeHeroSkinAnalysis: G("home-hero-global-skin-analysis-v6.png"),
  homeHeroTeleconsult: G("home-hero-global-teleconsult-v6.png"),
  homeHeroConcernCare: G("home-hero-global-concern-care-v6.png"),
  homeHeroFinancing: G("home-hero-global-financing-v6.png"),
  homeHeroSkinAnalysisTablet: R("hero-skin-tablet-v1.png"),
  homeHeroSkinAnalysisMobile: R("hero-skin-mobile-v2.png"),
  homeHeroTeleconsultTablet: R("hero-consult-tablet-v1.png"),
  homeHeroTeleconsultMobile: R("hero-consult-mobile-v2.png"),
  homeHeroConcernCareTablet: R("hero-concern-tablet-v1.png"),
  homeHeroConcernCareMobile: R("hero-concern-mobile-v2.png"),
  homeHeroFinancingTablet: R("hero-financing-tablet-v1.png"),
  homeHeroFinancingMobile: R("hero-financing-mobile-v2.png"),
  topGlassDesktop: R("top-glass-desktop-v1.png"),
  topGlassTablet: R("top-glass-tablet-v2.png"),
  topGlassMobile: R("top-glass-mobile-v2.png"),
  topBotoxDesktop: R("top-botox-desktop-v1.png"),
  topBotoxTablet: R("top-botox-tablet-v2.png"),
  topBotoxMobile: R("top-botox-mobile-v2.png"),
  topAcneDesktop: R("top-acne-desktop-v1.png"),
  topAcneTablet: R("top-acne-tablet-v2.png"),
  topAcneMobile: R("top-acne-mobile-v2.png"),
  topHairDesktop: R("top-hair-desktop-v1.png"),
  topHairTablet: R("top-hair-tablet-v2.png"),
  topHairMobile: R("top-hair-mobile-v2.png"),
  homeHeroEditorial: K("home-hero-editorial-v3.png"),
  homeHeroKnowYou: K("home-hero-know-you-v3.png"),
  routeScan: K("route-scan-v3.png"),
  routeConcern: K("route-concern-v3.png"),
  routeDoctor: K("route-doctor-v3.png"),
  teleconsult: K("teleconsult-v2.png"),
  analyzer: K("analyzer-v2.png"),
  glow: K("portrait-glow-v2.png"),
  cream: K("portrait-cream-v2.png"),
  serum: K("portrait-serum-v2.png"),
  mask: K("portrait-mask-v2.png"),
  smile: K("portrait-smile-v2.png"),
  smileMan: K("portrait-smile-man-v2.png"),
  men: K("portrait-men-v2.png"),
  menHairline: K("men-hairline-v2.png"),
  eyes: K("concern-eyes-v2.png"),
  redness: K("concern-redness-v2.png"),
  injectable: K("procedure-injectable-v2.png"),
  fillerConsult: K("procedure-filler-consult-v2.png"),
  laser: K("procedure-laser-v2.png"),
  microneedling: K("procedure-microneedling-v2.png"),
  peel: K("procedure-peel-v2.png"),
  iv: K("procedure-iv-v2.png"),
  ivAntioxidant: K("procedure-iv-antioxidant-v2.png"),
  ivHydration: K("procedure-iv-hydration-v2.png"),
  prpHair: K("procedure-prp-hair-v2.png"),
  gfcHair: K("procedure-gfc-hair-v2.png"),
  fueHair: K("procedure-fue-hair-v2.png"),
  facial: K("facial-barrier-v2.png"),
  acne: K("concern-acne-v2.png"),
  hair: K("hair-restoration-v2.png"),
  bodyLaser: K("body-laser-v2.png"),
  bodyLaserMan: K("body-laser-man-v2.png"),
  bodyLaserUnderarm: K("body-laser-underarm-v2.png"),
  bodyLaserLegs: K("body-laser-legs-v2.png"),
  bodyContour: K("body-contour-v2.png"),
  bridal: K("bridal-v2.png"),
  bridalGroom: K("bridal-groom-v2.png"),
  products: K("products-v2.png"),
  clinic: K("clinic-v2.png"),
  clinicTreatment: K("clinic-treatment-v2.png"),
  clinicConsult: K("clinic-consult-v2.png"),
  clinicIvLounge: K("clinic-iv-lounge-v2.png"),
  clinicHair: K("clinic-hair-v2.png"),
} as const;

export const IMG = {
  // Wide and analyzer heroes
  homeHeroSkinAnalysis: ASSET.homeHeroSkinAnalysis,
  homeHeroTeleconsult: ASSET.homeHeroTeleconsult,
  homeHeroConcernCare: ASSET.homeHeroConcernCare,
  homeHeroFinancing: ASSET.homeHeroFinancing,
  homeHeroSkinAnalysisTablet: ASSET.homeHeroSkinAnalysisTablet,
  homeHeroSkinAnalysisMobile: ASSET.homeHeroSkinAnalysisMobile,
  homeHeroTeleconsultTablet: ASSET.homeHeroTeleconsultTablet,
  homeHeroTeleconsultMobile: ASSET.homeHeroTeleconsultMobile,
  homeHeroConcernCareTablet: ASSET.homeHeroConcernCareTablet,
  homeHeroConcernCareMobile: ASSET.homeHeroConcernCareMobile,
  homeHeroFinancingTablet: ASSET.homeHeroFinancingTablet,
  homeHeroFinancingMobile: ASSET.homeHeroFinancingMobile,
  topGlassDesktop: ASSET.topGlassDesktop,
  topGlassTablet: ASSET.topGlassTablet,
  topGlassMobile: ASSET.topGlassMobile,
  topBotoxDesktop: ASSET.topBotoxDesktop,
  topBotoxTablet: ASSET.topBotoxTablet,
  topBotoxMobile: ASSET.topBotoxMobile,
  topAcneDesktop: ASSET.topAcneDesktop,
  topAcneTablet: ASSET.topAcneTablet,
  topAcneMobile: ASSET.topAcneMobile,
  topHairDesktop: ASSET.topHairDesktop,
  topHairTablet: ASSET.topHairTablet,
  topHairMobile: ASSET.topHairMobile,
  homeHeroEditorial: ASSET.homeHeroEditorial,
  homeHeroKnowYou: ASSET.homeHeroKnowYou,
  routeScan: ASSET.routeScan,
  routeConcern: ASSET.routeConcern,
  routeDoctor: ASSET.routeDoctor,
  heroBanner: ASSET.hero,
  heroBannerAlt: ASSET.hero,
  analyzerHero: ASSET.analyzer,
  analyzerHeroAlt: ASSET.analyzer,
  teleBanner: ASSET.teleconsult,

  // Editorial portraits
  portraitHero: ASSET.glow,
  portraitDuo: ASSET.hero,
  portraitGlow: ASSET.glow,
  portraitCream: ASSET.cream,
  portraitMacro: ASSET.analyzer,
  portraitSerum: ASSET.serum,
  portraitCalm: ASSET.redness,
  portraitTexture: ASSET.acne,
  portraitSmile: ASSET.smile,
  portraitDeep: ASSET.men,
  portraitMask: ASSET.mask,
  portraitSoft: ASSET.eyes,
  portraitBeige: ASSET.cream,
  portraitStudio: ASSET.hero,
  portraitClean: ASSET.analyzer,
  portraitDewy: ASSET.glow,
  portraitFresh: ASSET.smileMan,

  // Procedures
  procInject: ASSET.injectable,
  procInject2: ASSET.fillerConsult,
  procInject3: ASSET.fillerConsult,
  procFiller: ASSET.fillerConsult,
  procFacial: ASSET.facial,
  procDerma: ASSET.laser,
  procDerma2: ASSET.microneedling,
  procLaserFace: ASSET.laser,
  procMicro: ASSET.microneedling,
  procPeel: ASSET.peel,
  procPrep: ASSET.mask,
  procDevice: ASSET.laser,

  // Laser hair removal and body care
  lhr1: ASSET.bodyLaserUnderarm,
  lhr2: ASSET.bodyLaserMan,
  lhr3: ASSET.laser,
  lhr4: ASSET.bodyLaserLegs,
  lhr5: ASSET.clinicTreatment,
  lhr6: ASSET.bodyLaser,

  // Hair and scalp
  hair1: ASSET.hair,
  hair2: ASSET.fueHair,
  hair3: ASSET.prpHair,
  hair4: ASSET.gfcHair,
  hair5: ASSET.menHairline,
  hair6: ASSET.hair,

  // Acne and scarring
  acne1: ASSET.acne,
  acne2: K("ba-acne-before-v2.png"),
  acne3: ASSET.redness,
  acne4: ASSET.microneedling,
  acne5: ASSET.peel,
  acne6: ASSET.redness,

  // IV and wellness remain explicitly clinical, never generic lifestyle art
  iv1: ASSET.iv,
  iv2: ASSET.clinic,
  iv3: ASSET.ivAntioxidant,
  iv4: ASSET.ivHydration,
  iv5: ASSET.products,

  // Skincare products
  prod1: ASSET.products,
  prod2: ASSET.serum,
  prod3: ASSET.cream,
  prod4: ASSET.mask,
  prod5: ASSET.facial,
  prod6: ASSET.glow,

  /* Men's skin and hair.
   *
   * Three of these pointed at fillerConsult, redness and injectable — all
   * three of which are photographs of women. A category called Men's
   * Aesthetics whose cards show women is not a near-miss, it is the section
   * telling half its audience it was not built for them.
   *
   * There are five male assets and six slots, so bodyLaserMan carries both
   * device-on-a-male-body cards (sweat and back hair) and `men` carries the
   * hero and the portrait card. Two honest repeats beat one wrong subject. */
  men1: ASSET.men,
  men2: ASSET.bridalGroom,
  men3: ASSET.smileMan,
  men4: ASSET.bodyLaserMan,
  men5: ASSET.men,
  men6: ASSET.bodyLaserMan,
  /** Male pattern hair loss. A man checking his own hairline in a mirror. */
  menHairLoss: ASSET.menHairline,

  // Smile and eye rejuvenation
  smile1: ASSET.smile,
  smile2: ASSET.smileMan,
  smile3: ASSET.glow,
  smile4: ASSET.men,
  smile5: ASSET.cream,
  smile6: ASSET.fillerConsult,
  eye1: ASSET.eyes,
  eye2: ASSET.smile,
  eye3: ASSET.redness,
  eye4: ASSET.serum,
  eye5: ASSET.glow,
  eye6: ASSET.fillerConsult,

  // Body, bridal, facials and clinics
  body1: ASSET.bodyContour,
  body2: ASSET.bodyContour,
  body3: ASSET.microneedling,
  body4: ASSET.laser,
  body5: ASSET.acne,
  body6: ASSET.bodyLaser,
  bridal1: ASSET.bridal,
  bridal2: ASSET.glow,
  bridal3: ASSET.facial,
  bridal4: ASSET.bodyContour,
  bridal5: ASSET.bridal,
  bridal6: ASSET.bridalGroom,
  facial1: ASSET.facial,
  facial2: ASSET.mask,
  facial3: ASSET.peel,
  facial4: ASSET.cream,
  facial5: ASSET.serum,
  facial6: ASSET.microneedling,
  clinic1: ASSET.clinic,
  clinic2: ASSET.clinicConsult,
  clinic3: ASSET.clinicHair,
  clinic4: ASSET.clinicIvLounge,
  clinic5: ASSET.clinicTreatment,
  clinic6: ASSET.teleconsult,

  // Matched comparison pairs with an opaque privacy band over the eye line.
  // Treatment areas, framing and lighting remain consistent within each pair.
  pairAcneA: K("ba-acne-before-v4-covered.png"),
  pairAcneB: K("ba-acne-after-v4-covered.png"),
  pairPigmentA: K("ba-pigment-before-v4-covered.png"),
  pairPigmentB: K("ba-pigment-after-v4-covered.png"),
  pairScarA: K("ba-scars-before-v4-covered.png"),
  pairScarB: K("ba-scars-after-v4-covered.png"),
  pairGlowA: K("ba-glow-before-v4-covered.png"),
  pairGlowB: K("ba-glow-after-v4-covered.png"),
  pairLiftA: K("ba-lift-before-v4-covered.png"),
  pairLiftB: K("ba-lift-after-v4-covered.png"),
  pairHairA: K("ba-hair-before-v4-covered.png"),
  pairHairB: K("ba-hair-after-v4-covered.png"),
} as const;

export type ImageKey = keyof typeof IMG;
