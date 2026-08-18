/**
 * Curated stock photography for the treatment catalogue.
 *
 * Every id here was taken from a real Unsplash search result page, not
 * invented — a fabricated id returns a broken image, which is worse than a
 * repeated one. The download script verifies each URL responds before it
 * writes anything, and anything that fails is reported rather than shipped.
 *
 * `theme` is what the photograph actually depicts, so treatments are matched
 * to imagery that belongs to them rather than to whatever came next in a list.
 * Unsplash photos are free to use commercially under the Unsplash Licence.
 */

export type StockTheme =
  | "facial"
  | "product"
  | "portrait"
  | "injectable"
  | "device"
  | "hair"
  | "body"
  | "dental"
  | "clinical";

export interface StockPhoto {
  /** The `photo-...` segment of an images.unsplash.com URL. */
  id: string;
  theme: StockTheme;
  /** The photographer's own description — becomes the alt text. */
  alt: string;
}

export const STOCK: StockPhoto[] = [
  // ── Facial treatments ───────────────────────────────────────────────
  { id: "photo-1616394584738-fc6e612e71b9", theme: "facial", alt: "Treatment cream applied during a facial" },
  { id: "photo-1643684391140-c5056cfd3436", theme: "facial", alt: "A facial massage in progress" },
  { id: "photo-1570172619644-dfd03ed5d881", theme: "facial", alt: "A facial mask treatment at a clinic" },
  { id: "photo-1731514771613-991a02407132", theme: "facial", alt: "A treatment mask being applied to the face" },
  { id: "photo-1544717304-a2db4a7b16ee", theme: "facial", alt: "Preparing for a facial treatment" },
  { id: "photo-1643684460412-76908d8e5a25", theme: "facial", alt: "A steam treatment before extraction" },
  { id: "photo-1552693673-1bf958298935", theme: "facial", alt: "A clinician performing a facial skincare treatment" },
  { id: "photo-1713085085470-fba013d67e65", theme: "facial", alt: "A chemical peel applied by a doctor" },
  { id: "photo-1761718209835-c8586b7dcac0", theme: "facial", alt: "Treatment solution brushed onto the face" },
  { id: "photo-1761718209708-9ab9ba1c7252", theme: "facial", alt: "Cleansing during a facial treatment" },
  { id: "photo-1761718209694-70031ee64f82", theme: "facial", alt: "A facial treatment with clinical products" },
  { id: "photo-1761718209852-54ca4210183e", theme: "facial", alt: "A facial treatment using clinical tools" },
  { id: "photo-1706795033728-9232ef548a16", theme: "facial", alt: "A facial massage at a clinic" },
  { id: "photo-1512290923902-8a9f81dc236c", theme: "facial", alt: "A clinician assessing the nose and mid-face" },
  { id: "photo-1713824096348-c1956e6da321", theme: "facial", alt: "Resting during a skin treatment" },

  // ── Product / formulation ───────────────────────────────────────────
  { id: "photo-1573461160327-b450ce3d8e7f", theme: "product", alt: "A serum dropper" },
  { id: "photo-1585945037805-5fd82c2e60b1", theme: "product", alt: "A cream texture swatch" },
  { id: "photo-1580870069867-74c57ee1bb07", theme: "product", alt: "Clinical skincare bottles" },
  { id: "photo-1552046122-03184de85e08", theme: "product", alt: "A treatment bottle held in hand" },
  { id: "photo-1608571423902-eed4a5ad8108", theme: "product", alt: "A glass treatment bottle" },
  { id: "photo-1619451427882-6aaaded0cc61", theme: "product", alt: "Applying a treatment lotion" },
  { id: "photo-1620916297397-a4a5402a3c6c", theme: "product", alt: "A dark glass serum bottle" },
  { id: "photo-1540555700478-4be289fbecef", theme: "product", alt: "A pump bottle of treatment lotion" },
  { id: "photo-1624454002302-36b824d7bd0a", theme: "product", alt: "An amber treatment bottle" },
  { id: "photo-1631730486572-226d1f595b68", theme: "product", alt: "Cosmetic preparations laid out" },

  // ── Portraits ───────────────────────────────────────────────────────
  { id: "photo-1581182800629-7d90925ad072", theme: "portrait", alt: "Clear skin in natural light" },
  { id: "photo-1555820585-c5ae44394b79", theme: "portrait", alt: "A calm portrait with closed eyes" },
  { id: "photo-1581182815808-b6eb627a8798", theme: "portrait", alt: "A close portrait showing skin texture" },
  { id: "photo-1609357912334-e96886c0212b", theme: "portrait", alt: "A portrait after treatment" },
  { id: "photo-1599847987657-881f11b92a75", theme: "portrait", alt: "Relaxing after a clinic visit" },
  { id: "photo-1541752857837-f8a0154fd092", theme: "portrait", alt: "A portrait in soft daylight" },
  { id: "photo-1598300188904-6287d52746ad", theme: "portrait", alt: "A clinical consultation portrait" },
  { id: "photo-1598300188480-626f2f79ab8d", theme: "portrait", alt: "A portrait during assessment" },
  { id: "photo-1606501190025-f3ad6d3ea6ae", theme: "portrait", alt: "A studio portrait of clear skin" },
  { id: "photo-1676312754401-d97fe43c2c4b", theme: "portrait", alt: "A close portrait of treated skin" },

  // ── Injectables ─────────────────────────────────────────────────────
  { id: "photo-1746017062285-13c77e29fc25", theme: "injectable", alt: "Dermal filler injected into the lip" },
  { id: "photo-1666446224369-2783384adf02", theme: "injectable", alt: "A prepared syringe" },
  { id: "photo-1761819922656-d1b77eef49c0", theme: "injectable", alt: "A thread lift procedure" },
  { id: "photo-1785861485926-93a13556d656", theme: "injectable", alt: "An aesthetic injection to the forehead" },
  { id: "photo-1761819921052-2c34973e012c", theme: "injectable", alt: "A cosmetic injection to the forehead" },
  { id: "photo-1785861378703-1c991c4548ef", theme: "injectable", alt: "A cosmetic injection near the eye" },
  { id: "photo-1785861084191-3600dfc2a6d6", theme: "injectable", alt: "A cosmetic injection to the chin" },
  { id: "photo-1785860945533-918a531bcdeb", theme: "injectable", alt: "A brow treatment being applied" },
  { id: "photo-1650118791598-1c24d98d400b", theme: "injectable", alt: "Clinical injectable vials" },
  { id: "photo-1745336670683-3b5586cb5f19", theme: "injectable", alt: "Prepared treatment vials" },
  { id: "photo-1576157401730-e73772de4796", theme: "injectable", alt: "A non-surgical nose treatment" },
  { id: "photo-1670098073774-440ea94549d0", theme: "injectable", alt: "A fine-gauge treatment syringe" },

  // ── Devices / energy ────────────────────────────────────────────────
  { id: "photo-1785861433534-8cd4c7b994fa", theme: "device", alt: "Laser treatment of the arm" },
  { id: "photo-1785861775561-c6db7da314a0", theme: "device", alt: "Laser hair removal of the chin" },
  { id: "photo-1754941622138-b3c3671f2fa8", theme: "device", alt: "An energy device applied to the arm" },
  { id: "photo-1754941622117-97957c5d669b", theme: "device", alt: "Red light therapy in progress" },
  { id: "photo-1754941622136-6664a3f50b2e", theme: "device", alt: "A therapy device on the knee" },
  { id: "photo-1598300195998-364bf445842c", theme: "device", alt: "A handheld treatment device" },
  { id: "photo-1761819922058-d15028ed9817", theme: "device", alt: "A body device treatment of the abdomen" },
  { id: "photo-1723540634462-528708cc17aa", theme: "device", alt: "A clinical device treatment" },
  { id: "photo-1730288951113-9cc087c14b83", theme: "device", alt: "A skin device in use" },
  { id: "photo-1732993486279-9d0f3b91adb2", theme: "device", alt: "A dermatological device treatment" },

  // ── Hair ────────────────────────────────────────────────────────────
  { id: "photo-1633179963355-44f57f194d54", theme: "hair", alt: "Assessing hair density" },
  { id: "photo-1590540179852-2110a54f813a", theme: "hair", alt: "Brushing through thinning hair" },
  { id: "photo-1773078280516-df823e1c9d78", theme: "hair", alt: "Shed hair on a comb" },
  { id: "photo-1512663150964-d8f43c899f76", theme: "hair", alt: "Examining the hairline" },
  { id: "photo-1670347850299-dfd2821b5a1f", theme: "hair", alt: "Close detail of hair" },
  { id: "photo-1557508103-5a4308dc24bb", theme: "hair", alt: "Healthy hair after treatment" },
  { id: "photo-1761819921384-819b969a6dfc", theme: "hair", alt: "A scalp condition being examined" },
  { id: "photo-1785860420936-b4f8bb4de5e1", theme: "hair", alt: "A scalp treatment being performed" },
  { id: "photo-1785860458107-5be1a99d4188", theme: "hair", alt: "A scalp injection treatment" },
  { id: "photo-1785860333038-5c6dce348544", theme: "hair", alt: "Applying a hair treatment" },
  { id: "photo-1733685373279-a10ac3f255e7", theme: "hair", alt: "Hair styling after treatment" },
  { id: "photo-1643837833100-8b2ebd7127bc", theme: "hair", alt: "Detailed hair work" },
  { id: "photo-1773078280398-18fa2291eef1", theme: "hair", alt: "Hair shedding on a comb" },

  // ── Body ────────────────────────────────────────────────────────────
  { id: "photo-1741522509438-a120c0bb5e88", theme: "body", alt: "A back treatment in progress" },
  { id: "photo-1519823551278-64ac92734fb1", theme: "body", alt: "A body treatment session" },
  { id: "photo-1745327883508-b6cd32e5dde5", theme: "body", alt: "A therapeutic back treatment" },
  { id: "photo-1639162906614-0603b0ae95fd", theme: "body", alt: "A back treatment at a clinic" },
  { id: "photo-1544161515-4ab6ce6db874", theme: "body", alt: "Resting during a body treatment" },
  { id: "photo-1696841212541-449ca29397cc", theme: "body", alt: "A warm stone body treatment" },
  { id: "photo-1519824145371-296894a0daa9", theme: "body", alt: "A back and shoulder treatment" },
  { id: "photo-1712638932314-e2b185ca0930", theme: "body", alt: "Prepared for a body treatment" },
  { id: "photo-1741522509407-41cfe73b0b75", theme: "body", alt: "A body therapy session" },
  { id: "photo-1617952986600-802f965dcdbc", theme: "body", alt: "A lower-limb treatment" },
  { id: "photo-1611073615830-9f76902c10fe", theme: "body", alt: "Hand and arm treatment" },

  // ── Dental ──────────────────────────────────────────────────────────
  { id: "photo-1489278353717-f64c6ee8a4d2", theme: "dental", alt: "A confident smile" },
  { id: "photo-1606811971618-4486d14f3f99", theme: "dental", alt: "A dental examination" },
  { id: "photo-1677026010083-78ec7f1b84ed", theme: "dental", alt: "Close detail of whitened teeth" },
  { id: "photo-1667133295315-820bb6481730", theme: "dental", alt: "A digital dental scan" },
  { id: "photo-1548382131-e0ebb1f0cdea", theme: "dental", alt: "A smile after treatment" },
  { id: "photo-1667133295308-9ef24f71952e", theme: "dental", alt: "A smile after dental work" },
  { id: "photo-1654373535457-383a0a4d00f9", theme: "dental", alt: "Detail of an even smile" },
  { id: "photo-1562337404-3044c84ac061", theme: "dental", alt: "A natural smile" },
  { id: "photo-1567516364473-233c4b6fcfbe", theme: "dental", alt: "A relaxed smile" },
  { id: "photo-1611695434369-a8f5d76ceb7b", theme: "dental", alt: "Smiling after treatment" },
  { id: "photo-1663755489920-5e09f66d011a", theme: "dental", alt: "Dental hygiene care" },
  { id: "photo-1674775372058-c4c8813c6611", theme: "dental", alt: "A dental clinic room" },
  { id: "photo-1698749778813-ad5f2814e50f", theme: "dental", alt: "Daily dental care" },

  // ── Clinical setting / wellness ─────────────────────────────────────
  { id: "photo-1763310225009-50214e3c99d9", theme: "clinical", alt: "An intravenous infusion line" },
  { id: "photo-1771946259544-f021c0fff49a", theme: "clinical", alt: "A clinician preparing equipment" },
  { id: "photo-1552256031-811fa8f0a7b1", theme: "clinical", alt: "A clinician preparing a treatment" },
  { id: "photo-1784798340504-a0893a7743da", theme: "clinical", alt: "A blood draw for diagnostics" },
  { id: "photo-1785861001619-b263ebd4e615", theme: "clinical", alt: "A consultation with a clinician" },
  { id: "photo-1781513144825-aa1e284c5950", theme: "clinical", alt: "A clinic reception area" },
  { id: "photo-1763310225108-9e16920156f3", theme: "clinical", alt: "A clinician between appointments" },
  { id: "photo-1654781350550-0dc72ecb6fae", theme: "clinical", alt: "A dermatology consultation" },
  { id: "photo-1669998966162-9837617177cd", theme: "clinical", alt: "Assessing a skin concern" },
  { id: "photo-1742280159636-3a06652ac9d9", theme: "clinical", alt: "A dermatological assessment" },
  { id: "photo-1700760933574-9f0f4ea9aa3b", theme: "clinical", alt: "A treatment session in progress" },
  { id: "photo-1700760933941-3a06a28fbf47", theme: "clinical", alt: "A clinic treatment underway" },
  { id: "photo-1700760934166-4c766d708139", theme: "clinical", alt: "Detailed treatment work" },

  // ── Second gathering: portraits, clinic settings, wellness ──────────
  { id: "photo-1551184451-76b762941ad6", theme: "portrait", alt: "A portrait in clinic lighting" },
  { id: "photo-1501644898242-cfea317d7faf", theme: "portrait", alt: "Clear skin in daylight" },
  { id: "photo-1526413232644-8a40f03cc03b", theme: "portrait", alt: "Waiting for a consultation" },
  { id: "photo-1630595271375-5073a6c0638b", theme: "portrait", alt: "In a robe between treatments" },
  { id: "photo-1596178060671-7a80dc8059ea", theme: "portrait", alt: "Seated before a treatment" },
  { id: "photo-1630595633877-9918ee257288", theme: "portrait", alt: "A client at a consultation" },
  { id: "photo-1630168258841-ea0ae143ee1f", theme: "portrait", alt: "Reading aftercare notes" },
  { id: "photo-1541715301255-12a4839b424a", theme: "portrait", alt: "Close detail of facial skin" },
  { id: "photo-1557296387-5358ad7997bb", theme: "portrait", alt: "A study of skin texture" },
  { id: "photo-1520529277867-dbf8c5e0b340", theme: "portrait", alt: "Detail of the lips and lower face" },
  { id: "photo-1636406269177-4827c00bb263", theme: "portrait", alt: "A portrait showing skin clarity" },
  { id: "photo-1542131597-a4390333d136", theme: "portrait", alt: "Close detail of the eye area" },
  { id: "photo-1602033350291-a9ab8d800269", theme: "portrait", alt: "A monochrome study of the face" },
  { id: "photo-1515027037286-7da2d06130cf", theme: "portrait", alt: "A considered portrait" },
  { id: "photo-1578489758854-f134a358f08b", theme: "portrait", alt: "A portrait in even light" },
  { id: "photo-1627295336594-fb96e56ea5f3", theme: "portrait", alt: "Skin in natural daylight" },
  { id: "photo-1535485156230-020016c5b156", theme: "portrait", alt: "A portrait after a course of treatment" },
  { id: "photo-1594715271011-63c18acf1489", theme: "portrait", alt: "Detail of the eyes and brow" },
  { id: "photo-1628501023521-48cece9a6909", theme: "portrait", alt: "Detail of the eye and lash line" },
  { id: "photo-1675773051474-55c4b7d2cf53", theme: "portrait", alt: "A soft-focus facial portrait" },
  { id: "photo-1584531910632-0c55032af6d8", theme: "portrait", alt: "A portrait showing even tone" },
  { id: "photo-1761819920857-7edc5e808fd3", theme: "device", alt: "A microneedling treatment in progress" },
  { id: "photo-1616391182219-e080b4d1043a", theme: "clinical", alt: "A clinic treatment chair" },
  { id: "photo-1589279003513-467d320f47eb", theme: "clinical", alt: "A consultation at a desk" },
  { id: "photo-1706795033849-7ca391f007c5", theme: "clinical", alt: "A prepared treatment room" },
  { id: "photo-1544843776-7c98a52e08a4", theme: "body", alt: "Hydrotherapy as part of recovery" },
  { id: "photo-1488345979593-09db0f85545f", theme: "body", alt: "Water therapy for recovery" },
  { id: "photo-1554424518-336ec861b705", theme: "body", alt: "Floating therapy for recovery" },
  { id: "photo-1583416750470-965b2707b355", theme: "product", alt: "Treatment preparations laid out" },
  { id: "photo-1600334089648-b0d9d3028eb2", theme: "product", alt: "Clinic treatment accessories" },
  { id: "photo-1583417267826-aebc4d1542e1", theme: "product", alt: "Prepared treatment materials" },
];
