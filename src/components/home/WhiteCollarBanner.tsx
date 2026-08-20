import Link from "next/link";

import { prisma } from "@/lib/prisma";

/**
 * White Collar, on the client home page.
 *
 * A section rather than a menu item, because a membership is something you are
 * persuaded into once, not something you navigate to repeatedly. Once someone
 * has joined, it lives on their profile — which is where they will look for it
 * afterwards.
 *
 * Prices appear here deliberately. G-3 in the requirements brief allows a
 * figure in exactly three places and a subscription is one of them; everything
 * else on the client side stays enquiry-first.
 *
 * Renders nothing at all when no plan is live, so switching memberships off in
 * the admin removes the pitch rather than leaving an empty band.
 */
export default async function WhiteCollarBanner() {
  const plans = await prisma.subscriptionPlan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    take: 2,
    select: {
      slug: true,
      priceInr: true,
      interval: true,
      discountPercent: true,
      scanCredits: true,
    },
  });
  if (plans.length === 0) return null;

  const cheapest = plans.reduce((a, b) => (a.priceInr <= b.priceInr ? a : b));
  const best = plans.reduce((a, b) =>
    a.discountPercent >= b.discountPercent ? a : b
  );

  return (
    <section className="container-page pt-16" id="white-collar">
      <div className="relative overflow-hidden rounded-[2rem] ring-1 ring-amber-300/20">
        {/* Warm, and deliberately unlike anything else on the page — this is
            the one commercial ask on a site that otherwise refuses to quote. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-br from-amber-500/[0.14] via-[#0d1526] to-[#070d1c]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-amber-400/20 blur-[120px]"
        />

        <div className="relative grid gap-8 p-8 sm:p-11 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-amber-400/15 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-amber-200 ring-1 ring-amber-300/30">
              <span aria-hidden>◆</span>
              Membership
            </span>

            <h2 className="display mt-4 text-3xl leading-tight text-white sm:text-4xl">
              White Collar
            </h2>
            <p className="mt-3 max-w-lg text-base leading-relaxed text-white/60">
              For people who treat their skin as ongoing care rather than a
              one-off. Money off every consultation, analyses included instead
              of bought one at a time, and the appointment times everyone else
              is competing for.
            </p>

            <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
              <Perk>Up to {best.discountPercent}% off every consultation</Perk>
              <Perk>Skin analyses included each term</Perk>
              <Perk>Priority slots held back for members</Perk>
              <Perk>No late-cancellation fee, ever</Perk>
            </ul>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/patient/membership"
                className="inline-flex items-center gap-2 rounded-full bg-amber-400 px-6 py-3 text-sm font-bold text-[#231703] transition hover:bg-amber-300"
              >
                See what it includes
                <span aria-hidden>→</span>
              </Link>
              <p className="text-sm text-white/50">
                From ₹{cheapest.priceInr.toLocaleString("en-IN")} a{" "}
                {cheapest.interval === "ANNUAL" ? "year" : "month"}
              </p>
            </div>
          </div>

          {/* The one benefit that is easiest to misread, spelled out. */}
          <div className="rounded-2xl bg-white/[0.04] p-6 ring-1 ring-white/10">
            <p className="text-sm font-bold text-white">
              What &ldquo;priority&rdquo; actually means
            </p>
            <p className="mt-2 text-sm leading-relaxed text-white/60">
              Doctors can hold back a few of the day&rsquo;s most-wanted slots
              for members. If nobody takes them, the hold lifts 24 hours before
              and they open to everyone, so a member gets first refusal, not a
              slot nobody else could ever have had.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-white/60">
              And once you have booked, a clinic moving your appointment takes a
              written reason. You get told either way.
            </p>
            <p className="mt-4 border-t border-white/10 pt-4 text-xs text-white/40">
              A membership runs for the term you buy and then stops. Nothing is
              auto-debited and there is no mandate on your card.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Perk({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-sm text-white/75">
      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300" />
      {children}
    </li>
  );
}
