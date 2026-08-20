import Link from "next/link";

import { Empty, portalBtnPrimary } from "@/components/doctor/portalUi";
import { getOwnDoctor } from "@/lib/doctor/guard";
import OnboardingHome from "@/components/doctor/onboarding/OnboardingHome";
import PendingPreview from "@/components/doctor/onboarding/PendingPreview";
import DashboardHome from "@/components/doctor/dashboard/DashboardHome";
import { parsePeriod } from "@/lib/doctor/metrics";

export const metadata = { title: "Your practice" };
export const dynamic = "force-dynamic";

/**
 * The portal home, which is a different screen depending on where the
 * practitioner is.
 *
 * They signed up to list a practice, so until that is done this IS the
 * application. Once it is live, the same route becomes the dashboard and the
 * day's list moves to /doctor/portal/today.
 */
export default async function DoctorPortalHome({
  searchParams,
}: {
  searchParams?: { step?: string; period?: string };
}) {
  const owner = await getOwnDoctor();
  if (!owner) {
    return (
      <Empty
        icon="user"
        title="No practice linked yet"
        body="Your account is not connected to a practice. Reload and we will create one; tell us if this keeps happening."
        action={
          <Link href="/doctor/portal" className={portalBtnPrimary}>
            Try again
          </Link>
        }
      />
    );
  }

  if (owner.status === "DRAFT" || owner.status === "REJECTED") {
    return (
      <OnboardingHome doctorId={owner.doctorId} requestedStep={searchParams?.step} />
    );
  }
  if (owner.status === "PENDING") {
    return <PendingPreview doctorId={owner.doctorId} doctorName={owner.name} />;
  }

  return (
    <DashboardHome
      doctorId={owner.doctorId}
      doctorName={owner.name}
      // parsePeriod never throws: ?period=nonsense falls back to this month
      // rather than 500-ing the doctor's home screen.
      period={parsePeriod(searchParams?.period)}
    />
  );
}
