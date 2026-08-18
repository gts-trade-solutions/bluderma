import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState, PageHeader } from "@/components/admin/ui";
import DoctorCalendar from "@/components/doctor/DoctorCalendar";
import { getOwnDoctor } from "@/lib/doctor/guard";
import {
  type CalendarView,
  getCalendarData,
  rangeFor,
  toDaySeed,
} from "@/lib/queries/doctorCalendar";

export const metadata: Metadata = {
  title: "Calendar",
  robots: { index: false, follow: false },
};

// A calendar showing yesterday's state is worse than no calendar.
export const dynamic = "force-dynamic";

const VIEWS: CalendarView[] = ["month", "week", "day"];

/** Today in clinic wall-clock terms — see the contract in availability.ts. */
function clinicToday(): Date {
  const now = new Date(Date.now() + 330 * 60_000);
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams?: { view?: string; date?: string; clinic?: string };
}) {
  const owner = await getOwnDoctor();
  if (!owner) {
    return (
      <EmptyState
        title="No doctor profile linked"
        description="Your account is not connected to a practice yet. Finish your onboarding, or ask an administrator to link you."
        action={
          <Link href="/doctor/join" className="btn-primary">
            Complete onboarding
          </Link>
        }
      />
    );
  }

  const view: CalendarView = VIEWS.includes(searchParams?.view as CalendarView)
    ? (searchParams!.view as CalendarView)
    : "week";

  const requested = searchParams?.date;
  const anchor =
    requested && /^\d{4}-\d{2}-\d{2}$/.test(requested)
      ? new Date(`${requested}T00:00:00.000Z`)
      : clinicToday();
  const safeAnchor = Number.isNaN(anchor.getTime()) ? clinicToday() : anchor;

  const clinicId = searchParams?.clinic?.trim() || undefined;
  const { from, to } = rangeFor(view, safeAnchor);
  const data = await getCalendarData(owner.doctorId, from, to, clinicId);

  return (
    <>
      <PageHeader
        title="Calendar"
        description={
          data.clinics.length > 1
            ? `Your list across ${data.clinics.length} locations. Colours mark the clinic; a booking anywhere blocks the same time everywhere.`
            : "Your appointments. Click any booking to see the client, their analysis and what you can do about it."
        }
      />

      <DoctorCalendar
        view={view}
        anchorSeed={toDaySeed(safeAnchor)}
        appointments={data.appointments}
        clinics={data.clinics}
        awaitingCount={data.awaitingCount}
        activeClinicId={clinicId}
      />
    </>
  );
}
