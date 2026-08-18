/**
 * Seeds the four launch hero slides as HOME_HERO banners — idempotent
 * (fixed ids, upsert), safe to re-run. These are the same slides the
 * carousel falls back to when the CMS is empty, so a fresh database starts
 * with the live look already editable in Admin → Banners.
 *
 * Run: npx tsx prisma/seed-hero-banners.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const G = (f: string) => `/images/global/${f}`;
const R = (f: string) => `/images/home-responsive/${f}`;

const SLIDES = [
  {
    id: "home-hero-analyzer",
    eyebrow: "KNOW YOUR SKIN",
    title: "Understand Your Skin.",
    titleAccent: "Unlock Its Potential.",
    subtitle: "Discover what your skin truly needs with expert-guided skin analysis.",
    mediaUrl: G("home-hero-global-skin-analysis-v6.png"),
    mediaUrlTablet: R("hero-skin-tablet-v1.png"),
    mediaUrlMobile: R("hero-skin-mobile-v2.png"),
    ctaLabel: "Start skin analysis",
    ctaHref: "/patient/skin-analyzer",
    sortOrder: 0,
  },
  {
    id: "home-hero-teleconsult",
    eyebrow: "WORLD-CLASS EXPERTISE. FROM THE COMFORT OF HOME.",
    title: "Consult a World-Class Aesthetician",
    titleAccent: "— 2,000 Miles Away.",
    subtitle: "Get personalized aesthetic and skincare guidance through convenient online consultations.",
    mediaUrl: G("home-hero-global-teleconsult-v6.png"),
    mediaUrlTablet: R("hero-consult-tablet-v1.png"),
    mediaUrlMobile: R("hero-consult-mobile-v2.png"),
    ctaLabel: "Consult online",
    ctaHref: "/patient/doctors",
    sortOrder: 1,
  },
  {
    id: "home-hero-concern-care",
    eyebrow: "HAVE A SKIN CONCERN? DON'T WORRY.",
    title: "Expert Consultation.",
    titleAccent: "Best-in-Class Care.",
    subtitle: "From acne and pigmentation to ageing concerns, get the right guidance for your skin.",
    mediaUrl: G("home-hero-global-concern-care-v6.png"),
    mediaUrlTablet: R("hero-concern-tablet-v1.png"),
    mediaUrlMobile: R("hero-concern-mobile-v2.png"),
    ctaLabel: "Explore skin concerns",
    ctaHref: "/patient/rx-skin",
    sortOrder: 2,
  },
  {
    id: "home-hero-financing",
    eyebrow: "AESTHETIC FINANCING — GET STARTED TODAY.",
    title: "Avail Now.",
    titleAccent: "Pay Later.",
    subtitle: "Make your aesthetic journey more accessible with flexible financing options.",
    mediaUrl: G("home-hero-global-financing-v6.png"),
    mediaUrlTablet: R("hero-financing-tablet-v1.png"),
    mediaUrlMobile: R("hero-financing-mobile-v2.png"),
    ctaLabel: "Get started",
    ctaHref: "/patient/know-you",
    sortOrder: 3,
  },
];

async function main() {
  for (const s of SLIDES) {
    const { id, ...data } = s;
    await prisma.banner.upsert({
      where: { id },
      create: { id, placement: "HOME_HERO", isActive: true, ...data },
      update: { placement: "HOME_HERO", ...data },
    });
  }
  const n = await prisma.banner.count({ where: { placement: "HOME_HERO" } });
  console.log(`HOME_HERO banners in DB: ${n}`);
}

main().finally(() => prisma.$disconnect());
