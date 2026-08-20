import Link from "next/link";

import {
  Empty,
  PageHead,
  portalBtnPrimary,
} from "@/components/doctor/portalUi";
import ClinicsStep from "@/components/doctor/join/ClinicsStep";
import HoursStep from "@/components/doctor/join/HoursStep";
import PracticeSettings from "@/components/doctor/PracticeSettings";
import { getOwnDoctor } from "@/lib/doctor/guard";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "My practice" };
export const dynamic = "force-dynamic";

/**
 * Locations, hours and diary settings, after onboarding.
 *
 * Deliberately the same two components the wizard uses. A doctor who opens a
 * new branch a year later should meet the form they already know, and there is
 * no second implementation to drift out of step with the first.
 */
export default async function PracticePage() {
  const owner = await getOwnDoctor();
  if (!owner) {
    return (
      <Empty
        title="No doctor profile linked"
        body="Your account is not connected to a practice yet."
        action={
          <Link href="/doctor/join" className={portalBtnPrimary}>
            Complete onboarding
          </Link>
        }
      />
    );
  }

  const doctor = await prisma.doctor.findUniqueOrThrow({
    where: { id: owner.doctorId },
    select: {
      travelBufferMin: true,
      requiresApproval: true,
      priorityHoldPerDay: true,
      clinics: {
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
        select: {
          feeInr: true,
          isPrimary: true,
          clinic: {
            select: {
              id: true,
              name: true,
              addressLine1: true,
              addressLine2: true,
              area: true,
              city: true,
              state: true,
              pincode: true,
              phone: true,
              colorKey: true,
              photos: { select: { kind: true, url: true } },
              facilities: { orderBy: { sortOrder: "asc" }, select: { name: true } },
            },
          },
        },
      },
      availability: {
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
        select: {
          id: true,
          clinicId: true,
          dayOfWeek: true,
          startTime: true,
          endTime: true,
          slotMinutes: true,
        },
      },
    },
  });

  return (
    <div className="space-y-10">
      <section>
        <PageHead
          title="Where you practise"
          sub="Every location you consult at. Clients search by area, so keep the addresses right."
        />
        <ClinicsStep doctor={doctor} mode="manage" />
      </section>

      <section>
        <PageHead
          title="Your hours"
          sub="Sessions per location. A booking at one clinic blocks the same time at every other. You can only be in one place."
        />
        <HoursStep doctor={doctor} mode="manage" />
      </section>

      <section>
        <PageHead
          title="Diary settings"
          sub="How bookings reach you, and how much room you leave between locations."
        />
        <PracticeSettings
          travelBufferMin={doctor.travelBufferMin}
          requiresApproval={doctor.requiresApproval}
          priorityHoldPerDay={doctor.priorityHoldPerDay}
          multiClinic={doctor.clinics.length > 1}
        />
      </section>
    </div>
  );
}
