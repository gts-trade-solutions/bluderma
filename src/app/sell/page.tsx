import type { Metadata } from "next";
import { Boxes, ClipboardCheck, ShieldCheck, Truck } from "lucide-react";

import Footer from "@/components/Footer";
import BrandLogo from "@/components/BrandLogo";
import VendorForm from "@/components/vendor/VendorForm";
import { absolute, baseOpenGraph } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Sell medicines on BluDerma",
  description:
    "Apply to supply dermatology medicines through BluDerma. Licensed sellers only; every application is reviewed by a person.",
  alternates: { canonical: absolute("/sell") },
  openGraph: {
    ...baseOpenGraph(),
    title: "Sell medicines on BluDerma",
    url: absolute("/sell"),
  },
};

/**
 * The seller application page.
 *
 * ── A light page, and it says why in its own copy ────────────────────────
 * This is a business document being filled in by somebody who may be at a
 * desk with a licence in front of them. It reads as a form, not as a
 * marketing surface, and every colour is a literal slate: `text-ink` resolves
 * near-white outside `.theme-light`, which would make half of this invisible.
 *
 * The page is honest about what submitting does, which is nothing except put
 * an application in front of a reviewer. Saying "get started selling today"
 * over a form that creates no account would be the easy version and a lie.
 */
export default function SellPage() {
  return (
    <>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5 sm:px-8">
          <BrandLogo href="/" size={44} tone="dark" />
          <a
            href="mailto:info@bluderma.kr"
            className="text-sm font-semibold text-slate-500 transition hover:text-slate-900"
          >
            Questions?
          </a>
        </div>
      </header>

      <main className="bg-slate-50">
        <section className="border-b border-slate-200 bg-gradient-to-br from-slate-100 via-white to-brand-50">
          <div className="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-brand-700 shadow-sm ring-1 ring-brand-200">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-teal-500" />
              For pharmacies and distributors
            </span>

            <h1 className="display mt-5 max-w-2xl text-balance text-4xl leading-[1.08] text-slate-900 sm:text-5xl">
              Supply dermatology medicines through BluDerma
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
              Our doctors prescribe; patients need somewhere to fill those
              prescriptions. If you are a licensed seller, tell us about your
              business and we will get in touch.
            </p>

            <ul className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Point
                icon={ClipboardCheck}
                title="Real prescriptions"
                body="Written by dermatologists on the platform, not scraped demand."
              />
              <Point
                icon={ShieldCheck}
                title="Licensed only"
                body="Every seller is checked. That is what makes the shelf worth being on."
              />
              <Point
                icon={Boxes}
                title="Your own catalogue"
                body="You list what you actually stock, at your own prices."
              />
              <Point
                icon={Truck}
                title="You fulfil"
                body="You dispense and deliver. We do not touch the medicine."
              />
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
          <VendorForm />
        </section>
      </main>

      <Footer />
    </>
  );
}

function Point({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof ShieldCheck;
  title: string;
  body: string;
}) {
  return (
    <li className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-teal-500 text-white">
        <Icon className="h-4.5 w-4.5" strokeWidth={1.9} />
      </span>
      <p className="mt-3 text-sm font-extrabold text-slate-900">{title}</p>
      <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{body}</p>
    </li>
  );
}
