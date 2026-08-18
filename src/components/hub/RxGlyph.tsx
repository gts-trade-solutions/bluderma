/**
 * Abstract condition glyphs for the Rx Skin showcase.
 *
 * Deliberately not photographs and not lucide icons: a row of tiny marks
 * that read as "the thing on your skin" — dots for breakouts, rings for
 * pores, strokes for lines — the way consumer skin brands label a condition
 * row. Everything is currentColor so a card can recolour the whole row.
 */

type Props = { className?: string };

const S = ({ children, className }: Props & { children: React.ReactNode }) => (
  <svg
    viewBox="0 0 32 32"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {children}
  </svg>
);

export const GLYPHS = {
  /** Scattered breakouts. */
  spots: (p: Props) => (
    <S {...p}>
      <circle cx="11" cy="10" r="2.6" />
      <circle cx="21" cy="14" r="1.8" />
      <circle cx="13" cy="21" r="2.2" />
      <circle cx="22" cy="23" r="1.4" />
    </S>
  ),
  /** Open pores. */
  pores: (p: Props) => (
    <S {...p}>
      <circle cx="12" cy="12" r="3" />
      <circle cx="21" cy="11" r="2" />
      <circle cx="11" cy="21" r="2" />
      <circle cx="20" cy="20" r="3" />
    </S>
  ),
  /** Flat pigment patches. */
  pigment: (p: Props) => (
    <S {...p}>
      <path d="M8 14c2-4 7-5 9-2s6 2 7-1" />
      <circle cx="12" cy="21" r="2.4" fill="currentColor" stroke="none" opacity=".45" />
      <circle cx="20" cy="23" r="1.6" fill="currentColor" stroke="none" opacity=".3" />
      <circle cx="23" cy="10" r="1.4" fill="currentColor" stroke="none" opacity=".35" />
    </S>
  ),
  /** Fine lines. */
  lines: (p: Props) => (
    <S {...p}>
      <path d="M7 12h18M7 17h18M7 22h11" />
    </S>
  ),
  /** Wrinkle / crease. */
  crease: (p: Props) => (
    <S {...p}>
      <path d="M6 13c4-3 8 3 12 0s6-2 8 0" />
      <path d="M6 20c4-3 8 3 12 0s6-2 8 0" />
    </S>
  ),
  /** Redness / flushing. */
  redness: (p: Props) => (
    <S {...p}>
      <path d="M16 6c4 4 7 7 7 11a7 7 0 0 1-14 0c0-4 3-7 7-11Z" />
    </S>
  ),
  /** Dryness / flaking. */
  dry: (p: Props) => (
    <S {...p}>
      <path d="M9 9l4 4M23 9l-4 4M9 23l4-4M23 23l-4-4" />
      <circle cx="16" cy="16" r="3" />
    </S>
  ),
  /** Sagging / lifting. */
  lift: (p: Props) => (
    <S {...p}>
      <path d="M8 20c2-6 6-9 8-9s6 3 8 9" />
      <path d="M16 6v5M13.5 9L16 6.5 18.5 9" />
    </S>
  ),
  /** Under-eye. */
  eye: (p: Props) => (
    <S {...p}>
      <path d="M5 16c3-4 7-6 11-6s8 2 11 6c-3 4-7 6-11 6s-8-2-11-6Z" />
      <circle cx="16" cy="16" r="2.6" />
    </S>
  ),
  /** Texture / scarring. */
  texture: (p: Props) => (
    <S {...p}>
      <path d="M7 11c2 2 4 2 6 0s4-2 6 0 4 2 6 0" />
      <path d="M7 17c2 2 4 2 6 0s4-2 6 0 4 2 6 0" />
      <path d="M7 23c2 2 4 2 6 0s4-2 6 0 4 2 6 0" />
    </S>
  ),
  /** Body / silhouette. */
  body: (p: Props) => (
    <S {...p}>
      <circle cx="16" cy="8" r="3" />
      <path d="M10 26c0-5 2.5-8 6-8s6 3 6 8" />
    </S>
  ),
  /** Shedding hair. */
  shedding: (p: Props) => (
    <S {...p}>
      <path d="M10 6c-2 5-2 10 0 16M16 5c-2 6-2 11 0 17M22 6c-2 5-2 10 0 16" />
      <path d="M25 24l3 3" />
    </S>
  ),
  /** Thinning / part line. */
  parting: (p: Props) => (
    <S {...p}>
      <path d="M16 5v22" />
      <path d="M11 8c-2 5-2 12 0 18M21 8c2 5 2 12 0 18" />
    </S>
  ),
  /** Bald patch. */
  patch: (p: Props) => (
    <S {...p}>
      <circle cx="16" cy="16" r="5" strokeDasharray="2 3" />
      <path d="M7 9c-1 5-1 10 0 15M25 9c1 5 1 10 0 15" />
    </S>
  ),
  /** Scalp / flaking. */
  scalp: (p: Props) => (
    <S {...p}>
      <path d="M7 18a9 9 0 0 1 18 0" />
      <path d="M9 24h2M15 25h2M21 24h2" />
    </S>
  ),
  /** Unwanted hair. */
  strands: (p: Props) => (
    <S {...p}>
      <path d="M9 25c0-7 1-12 3-16M16 25c0-8 1-13 3-17M23 25c0-6 .5-10 1.5-13" />
    </S>
  ),
} as const;

export type GlyphKey = keyof typeof GLYPHS;

/** Condition slug → glyph. Anything unmapped falls back by group. */
const BY_SLUG: Record<string, GlyphKey> = {
  acne: "spots",
  "hormonal-acne": "spots",
  blackheads: "pores",
  "acne-scars": "texture",
  "post-acne-marks": "pigment",
  melasma: "pigment",
  "dark-spots": "pigment",
  "uneven-tone": "pigment",
  "dark-circles": "eye",
  tanning: "pigment",
  "fine-lines": "lines",
  sagging: "lift",
  "volume-loss": "crease",
  "eye-bags": "eye",
  "neck-lines": "lines",
  "lip-lines": "crease",
  rosacea: "redness",
  "sensitive-skin": "redness",
  dryness: "dry",
  eczema: "dry",
  "large-pores": "pores",
  dullness: "texture",
  "stretch-marks": "texture",
  milia: "pores",
  "keratosis-pilaris": "texture",
  "skin-tags": "texture",
  "unwanted-hair": "strands",
  "back-acne": "spots",
  "underarm-pigmentation": "pigment",
  "ingrown-hair": "strands",
  "excess-sweating": "body",
  cellulite: "body",
  "double-chin": "body",
  "hair-fall": "shedding",
  "pattern-baldness": "parting",
  dandruff: "scalp",
  "thinning-ponytail": "shedding",
  "wide-part": "parting",
  "bald-spots": "patch",
  "hair-breakage": "strands",
  "receding-hairline": "parting",
  "oily-scalp": "scalp",
  "postpartum-shedding": "shedding",
};

export function glyphFor(slug: string, group: string): GlyphKey {
  if (BY_SLUG[slug]) return BY_SLUG[slug];
  if (group === "Hair") return "shedding";
  if (group === "Body") return "body";
  return "texture";
}

export default function RxGlyph({
  slug,
  group,
  className = "h-7 w-7",
}: {
  slug: string;
  group: string;
  className?: string;
}) {
  const Glyph = GLYPHS[glyphFor(slug, group)];
  return <Glyph className={className} />;
}
