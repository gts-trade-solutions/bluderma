import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { buildPatientMenu } from "@/lib/queries/nav";
import RxSkinGrid from "@/components/hub/RxSkinGrid";
import KnowYouCta from "@/components/hub/KnowYouCta";
import SectionHead from "@/components/hub/SectionHead";
import SkinScanCard from "@/components/hub/SkinScanCard";
import { SKIN_CONDITIONS } from "@/data/rxSkin";

export const metadata: Metadata = {
  title: "Rx Skin: skin conditions",
  description:
    "Every skin and hair condition BluDerma treats, described in one line each, acne, melasma, rosacea, scarring, hair fall and more, with what treats each one.",
};

/**
 * RX SKIN (C-31 … C-33) with GET EXPERT ADVICE directly below it (C-34).
 * Conditions, not treatments: this is the page for someone who knows what
 * their skin is doing but not what it's called.
 */
export default function RxSkinPage() {
  return (
    <>
      <Navbar
        role="patient"
        menu={buildPatientMenu()}
      />

      <main className="bg-[var(--surface)] pb-20">
        <section className="border-b border-white/10 bg-white/[0.04]">
          <div className="container-page py-10">
            <Link
              href="/patient/explore"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted transition hover:text-brand-200"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to the hub
            </Link>

            <p className="section-eyebrow mt-6">Rx Skin</p>
            <h1 className="display mt-2 max-w-2xl text-3xl text-ink sm:text-5xl">
              Start with the condition, not the treatment
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-muted">
              {SKIN_CONDITIONS.length} conditions, one line each. Hover or tap
              any of them to see what it actually is, then follow through to
              what treats it.
            </p>
          </div>
        </section>

        <section className="container-page pt-10">
          <RxSkinGrid />
        </section>

        {/* Get expert advice sits directly below Rx Skin (C-34). */}
        <section className="container-page pt-12">
          <KnowYouCta variant="advice" />
        </section>

        <section className="container-page pt-12">
          <SectionHead
            eyebrow="Or scan first"
            title="Let the camera name it"
            sub="A free reading scores twelve-plus signals and tells you which of these conditions you're actually looking at."
          />
          <SkinScanCard />
        </section>
      </main>

      <Footer />
    </>
  );
}
