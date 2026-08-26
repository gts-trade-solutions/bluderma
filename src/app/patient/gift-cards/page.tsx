import { OfferStatus } from "@prisma/client";
import { Gift } from "lucide-react";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { buildPatientMenu } from "@/lib/queries/nav";
import BuyGiftCard from "@/components/patient/BuyGiftCard";
import { prisma } from "@/lib/prisma";
import { PUBLIC_DOCTOR_WHERE } from "@/lib/queries/doctorAccess";
import { getCurrentUser } from "@/lib/session";
import { absolute, baseOpenGraph } from "@/lib/seo";

export const metadata = {
  title: "Gift a treatment",
  description:
    "Buy a BluDerma gift card towards treatment at a listed clinic. Every offer is reviewed before it goes on sale.",
  alternates: { canonical: absolute("/patient/gift-cards") },
  openGraph: { ...baseOpenGraph(), title: "Gift a treatment", url: absolute("/patient/gift-cards") },
};
export const dynamic = "force-dynamic";

const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/**
 * Gift cards on sale.
 *
 * Only APPROVED offers from listed practitioners. Both halves matter: an
 * unreviewed offer has had nobody check what it promises, and a suspended
 * doctor should not keep a shopfront selling credit against a practice
 * patients cannot book.
 */
export default async function GiftCardsPage() {
  const [offers, user] = await Promise.all([
    prisma.giftCardOffer.findMany({
      where: {
        status: OfferStatus.APPROVED,
        doctor: PUBLIC_DOCTOR_WHERE,
      },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        title: true,
        description: true,
        terms: true,
        valueInr: true,
        priceInr: true,
        validMonths: true,
        doctor: { select: { name: true, specialty: true } },
        clinic: { select: { name: true, area: true } },
      },
    }),
    getCurrentUser(),
  ]);

  return (
    <>
      <Navbar role="patient" menu={buildPatientMenu()} cta="know-you" />

      <main className="bg-surface pb-20">
        <section className="border-b border-white/10 bg-white/[0.04]">
          <div className="container-page py-9">
            <p className="section-eyebrow">Gift cards</p>
            <h1 className="display mt-1.5 text-3xl text-ink sm:text-4xl">
              Give someone their treatment
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
              Credit towards treatment at a listed clinic. The person you give
              it to books whatever they like with it, and you never see what
              they chose.
            </p>
          </div>
        </section>

        <div className="container-page pt-6">
          {offers.length === 0 ? (
            <div className="card-soft px-6 py-16 text-center">
              <Gift aria-hidden className="mx-auto h-7 w-7 text-ink-muted" strokeWidth={1.6} />
              <p className="mt-3 text-base font-bold text-ink">Nothing on sale yet</p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-muted">
                Clinics offer these and we check each one before it appears
                here. Come back soon.
              </p>
            </div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {offers.map((o) => {
                const off =
                  o.valueInr > o.priceInr
                    ? Math.round(((o.valueInr - o.priceInr) / o.valueInr) * 100)
                    : 0;
                return (
                  <li
                    key={o.id}
                    className="flex flex-col overflow-hidden rounded-2xl bg-gradient-to-br on-dark from-brand-800 via-brand-900 to-teal-800 p-5 ring-1 ring-inset ring-white/15"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Gift aria-hidden className="h-6 w-6 text-teal-200" strokeWidth={1.7} />
                      {/* Only when there IS a saving. A "0% off" badge on a
                          card sold at face value is noise pretending to be an
                          offer. */}
                      {off > 0 && (
                        <span className="rounded-full bg-teal-300 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wide text-[#04121f]">
                          {off}% off
                        </span>
                      )}
                    </div>

                    <p className="display mt-4 text-2xl text-white">
                      {money(o.valueInr)}
                    </p>
                    <p className="text-xs font-semibold uppercase tracking-wide text-teal-200">
                      of treatment credit
                    </p>

                    <p className="mt-3 text-sm font-bold text-white">{o.title}</p>
                    {o.description && (
                      <p className="mt-1 text-[13px] leading-relaxed text-white/70">
                        {o.description}
                      </p>
                    )}

                    <p className="mt-3 text-xs text-white/60">
                      {o.doctor.name}
                      {o.clinic ? ` · ${o.clinic.area}` : ""} · valid{" "}
                      {o.validMonths} months
                    </p>
                    {o.terms && (
                      <p className="mt-2 text-[11px] leading-relaxed text-white/45">
                        {o.terms}
                      </p>
                    )}

                    <div className="mt-auto pt-4">
                      <BuyGiftCard
                        offerId={o.id}
                        title={o.title}
                        priceInr={o.priceInr}
                        signedIn={Boolean(user)}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <p className="mt-6 text-xs leading-relaxed text-ink-muted">
            A card is spendable once the payment has settled, and can be used
            across several visits until the balance runs out.
          </p>
        </div>
      </main>

      <Footer />
    </>
  );
}
