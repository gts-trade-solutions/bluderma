import type { Metadata } from "next";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import MembershipPlans from "@/components/patient/MembershipPlans";
import { buildPatientMenu } from "@/lib/queries/nav";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getMembership } from "@/lib/subscription/membership";
import { isRazorpayConfigured } from "@/lib/payments/razorpay";

export const metadata: Metadata = {
  title: "White Collar membership",
  description:
    "Discounts at every listed clinic, priority appointments and skin analyses included.",
};

export const dynamic = "force-dynamic";

export default async function MembershipPage() {
  const user = await getCurrentUser();
  const [plans, membership] = await Promise.all([
    prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        slug: true,
        name: true,
        interval: true,
        priceInr: true,
        compareAtInr: true,
        discountPercent: true,
        scanCredits: true,
        priorityBooking: true,
        waiveCancellationFee: true,
        perks: true,
      },
    }),
    getMembership(user?.id),
  ]);

  return (
    <>
      <Navbar role="patient" menu={buildPatientMenu()} />
      <main className="min-h-screen bg-[#070d1c]">
        <div className="container-page py-16 sm:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="section-eyebrow">Membership</p>
            <h1 className="display mt-3 text-4xl sm:text-5xl">White Collar</h1>
            <p className="mt-4 text-lg text-ink-soft">
              For people who treat their skin as ongoing care rather than a
              one-off. Better prices, first refusal on the times everyone wants,
              and analyses included rather than bought one at a time.
            </p>
          </div>

          <MembershipPlans
            plans={plans.map((p) => ({
              ...p,
              perks: Array.isArray(p.perks) ? (p.perks as string[]) : [],
            }))}
            signedIn={Boolean(user)}
            current={
              membership
                ? {
                    planName: membership.planName,
                    endsOn: membership.currentPeriodEnd.toISOString().slice(0, 10),
                  }
                : null
            }
            payable={isRazorpayConfigured()}
          />

          {/* Stated rather than buried: this is a term, not a standing order. */}
          <p className="mx-auto mt-10 max-w-2xl text-center text-sm text-ink-muted">
            A membership runs for the term you buy and then stops. Nothing is
            auto-debited and there is no standing mandate on your card — we email
            you before it ends, and renewing is a decision you make each time.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
