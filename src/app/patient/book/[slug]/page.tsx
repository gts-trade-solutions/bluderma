import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import BrandLogo from "@/components/BrandLogo";
import BookingWizard from "@/components/booking/BookingWizard";
import { getDoctor } from "@/lib/queries/doctors";
import type { Doctor } from "@/data/doctors";
import { getCurrentUser } from "@/lib/session";
import { getHomeVisitFee } from "@/lib/queries/content";
import { getBookingPolicy } from "@/lib/booking/policySettings";
import { getMembership, benefitsOf } from "@/lib/subscription/membership";
import { isRazorpayConfigured } from "@/lib/payments/razorpay";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const doctor = await getDoctor(params.slug);
  return {
    title: doctor ? `Book ${doctor.name}` : "Book a consultation",
    robots: { index: false, follow: false },
  };
}

/**
 * Booking, as a page.
 *
 * It used to be a cramped dialog: a clinic picker, a five-day strip, a slot
 * grid, a mode selector, a name, a phone and a payment summary, all inside a
 * panel bounded to the viewport with its own internal scrollbar. On a phone
 * the confirm button sat below a fold inside a fold.
 *
 * The doctor onboarding wizard at /doctor/join already showed the better
 * shape for this: one question per screen, the step in the URL, room to
 * breathe, and a browser Back button that does the obvious thing without any
 * history trickery at all. This is that, for clients.
 *
 * Everything that identifies the booking lives in the URL — step, clinic, day,
 * time, mode — so a half-finished booking survives a sign-in round trip, and
 * Back genuinely works because each step is a real navigation. Personal
 * details are NOT in the URL; they stay in component state.
 */
export default async function BookPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams?: Record<string, string | undefined>;
}) {
  const doctor = await getDoctor(params.slug);
  if (!doctor) notFound();

  const [user, homeVisitFee, policy] = await Promise.all([
    getCurrentUser(),
    getHomeVisitFee(),
    getBookingPolicy(),
  ]);
  const membership = await getMembership(user?.id);
  const benefits = benefitsOf(membership);

  return (
    <div className="min-h-screen bg-[var(--surface)]">
      <header className="border-b border-white/10">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5 sm:px-8">
          {/* The page ground is --surface (#070d1c); tone defaults to "dark",
              which painted the mark almost out of existence. */}
          <BrandLogo href="/" size={44} tone="light" />
          <Link
            href="/patient/doctors"
            className="text-sm font-semibold text-ink-muted transition hover:text-ink"
          >
            Exit
          </Link>
        </div>
      </header>

      {/* Same cast the other client surfaces use: DoctorDTO and the client
          Doctor type are structurally the same except that `focus` is
          string[] on the wire and a narrowed MetricKey[] here. */}
      <BookingWizard
        doctor={doctor as unknown as Doctor}
        signedIn={Boolean(user)}
        patientName={user?.name ?? ""}
        homeVisitFee={homeVisitFee}
        onlinePayment={isRazorpayConfigured()}
        receptionPhone={policy.receptionPhone}
        memberDiscountPercent={benefits.discountPercent}
        memberPlanName={membership?.planName ?? null}
        initial={{
          step: searchParams?.step ?? "",
          clinic: searchParams?.clinic ?? "",
          day: searchParams?.day ?? "",
          time: searchParams?.time ?? "",
          mode: searchParams?.mode ?? "",
        }}
      />
    </div>
  );
}
