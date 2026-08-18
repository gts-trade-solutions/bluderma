import Link from "next/link";

import SmartImage from "@/components/SmartImage";
import { IMG } from "@/data/hubImages";

/**
 * Top treatments, as four portrait cards.
 *
 * Photography is desaturated and the treatment sits on a white pill across
 * the bottom — the enterprise-medical look the client pointed at. Greyscale
 * does two useful things at once here: it stops four different shoots with
 * four different colour temperatures from looking like a collage, and it
 * keeps the eye on the label rather than the skin tone.
 *
 * Colour returns on hover, so the photograph still rewards attention.
 *
 * No price, no clinic, no branch — same rule as every other treatment
 * surface on the site (G-1, G-2).
 */

const CARDS = [
  {
    label: "Glass Skin & Glow",
    href: "/patient/explore/glass-skin",
    alt: "Female dermatologist consulting a woman about a glass-skin treatment",
    image: {
      desktop: IMG.topGlassDesktop,
      tablet: IMG.topGlassTablet,
      mobile: IMG.topGlassMobile,
    },
  },
  {
    label: "Botox & Anti-Wrinkle",
    href: "/patient/explore/botox",
    alt: "Professional female aesthetics doctors discussing a treatment plan",
    image: {
      desktop: IMG.topBotoxDesktop,
      tablet: IMG.topBotoxTablet,
      mobile: IMG.topBotoxMobile,
    },
  },
  {
    label: "Acne & Scars",
    href: "/patient/explore/acne-scars",
    alt: "Male dermatologist consulting a man about acne and scarring",
    image: {
      desktop: IMG.topAcneDesktop,
      tablet: IMG.topAcneTablet,
      mobile: IMG.topAcneMobile,
    },
  },
  {
    label: "Hair Restoration",
    href: "/patient/explore/hair-restoration",
    alt: "Professional male hair-restoration doctors reviewing a scalp assessment",
    image: {
      desktop: IMG.topHairDesktop,
      tablet: IMG.topHairTablet,
      mobile: IMG.topHairMobile,
    },
  },
];

export default function TopTreatments() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {CARDS.map((c) => (
        <Link
          key={c.label}
          href={c.href}
          className="group relative block aspect-[3/4] overflow-hidden rounded-[1.75rem] ring-1 ring-white/15 transition duration-300 hover:ring-white/40"
        >
          <SmartImage
            src={c.image.desktop}
            tabletSrc={c.image.tablet}
            mobileSrc={c.image.mobile}
            alt={c.alt}
            sizes="(min-width: 1024px) 25vw, 50vw"
            className="object-top grayscale transition duration-700 group-hover:scale-[1.04] group-hover:grayscale-0"
          />
          {/* Enough shadow at the foot that the pill never floats on a
              light part of the photograph. */}
          <span className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/55 to-transparent" />

          <span className="absolute inset-x-3 bottom-3 flex items-center justify-center rounded-full bg-white px-3 py-2.5 text-center text-[13px] font-bold leading-tight text-[#070d1c] shadow-lg transition group-hover:bg-teal-400/[12%] group-hover:text-brand-200 sm:inset-x-4 sm:bottom-4 sm:text-sm">
            {c.label}
          </span>
        </Link>
      ))}
    </div>
  );
}
