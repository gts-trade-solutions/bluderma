import type { Metadata } from "next";
import Link from "next/link";

import BrandLogo from "@/components/BrandLogo";
import IntakeFlow from "@/components/hub/IntakeFlow";

export const metadata: Metadata = {
  title: "Your skin consultation",
  description:
    "Answer a few questions about your goals, your skin and your health, and see the doctors who match. What they charge and when they're free.",
  robots: { index: false, follow: false },
};

/**
 * The consultation questionnaire.
 *
 * This is now the ONLY way it renders. It used to open in a dialog from five
 * different buttons, with this page as an alternative for anyone who would
 * rather not work inside one — which was the tell: a seven-step form with
 * photo uploads is a page, and offering the page as the escape hatch meant
 * admitting the dialog was the worse option.
 *
 * Deliberately without site chrome: no nav bar, no footer, no menu. Every link
 * on a page like this is a way out of it. A logo, a progress bar, the
 * question, and one clearly-marked exit — the same shape as /doctor/join.
 */
export default function KnowYouPage() {
  return (
    <div className="min-h-screen bg-[#0d1526]">
      <header className="border-b border-white/10">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-4 px-5 sm:px-8">
          {/* tone="light" — the header sits on #0d1526, and the dark logotype
              rendered its first word invisible. */}
          <BrandLogo href="/" size={46} tone="light" />
          <Link
            href="/patient/explore"
            className="text-sm font-semibold text-ink-muted transition hover:text-ink"
          >
            Exit
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl">
        <IntakeFlow />
      </main>
    </div>
  );
}
