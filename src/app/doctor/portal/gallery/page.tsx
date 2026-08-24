import { GalleryStatus } from "@prisma/client";

import { Empty, PageHead, Panel } from "@/components/doctor/portalUi";
import GalleryComposer, {
  type GalleryPatient,
} from "@/components/doctor/GalleryComposer";
import GalleryCaseRow from "@/components/doctor/GalleryCaseRow";
import { getOwnDoctor } from "@/lib/doctor/guard";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Gallery" };
export const dynamic = "force-dynamic";

/**
 * Before-and-after cases this doctor shows publicly.
 *
 * Ordered by what needs the doctor: a case the patient has already agreed to
 * but which is not published yet is sitting on a consent somebody gave, and
 * that is the one worth surfacing first.
 */
export default async function GalleryPage() {
  const owner = await getOwnDoctor();
  if (!owner) {
    return (
      <Empty
        title="No practice linked"
        body="This account has no practice record yet."
      />
    );
  }

  const [cases, seen] = await Promise.all([
    prisma.doctorGalleryCase.findMany({
      where: { doctorId: owner.doctorId },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 60,
      select: {
        id: true,
        treatmentName: true,
        detail: true,
        status: true,
        consentGivenAt: true,
        consentWithdrawnAt: true,
        patient: { select: { name: true } },
      },
    }),
    // Only people this doctor has actually seen can be the subject of a case.
    prisma.appointment.findMany({
      where: { doctorId: owner.doctorId, patientUserId: { not: null } },
      distinct: ["patientUserId"],
      orderBy: { scheduledAt: "desc" },
      take: 40,
      select: { patientUserId: true, patientName: true },
    }),
  ]);

  const patients: GalleryPatient[] = seen
    .filter((a) => a.patientUserId)
    .map((a) => ({ userId: a.patientUserId as string, name: a.patientName }));

  const live = cases.filter((c) => c.status === GalleryStatus.PUBLISHED).length;
  const waiting = cases.filter(
    (c) => !c.consentGivenAt && !c.consentWithdrawnAt
  ).length;

  return (
    <>
      <PageHead
        title="Before and after"
        sub="Your own cases, shown on your public profile. Every one needs the patient's agreement first."
      />

      <div className="grid gap-4 lg:grid-cols-[24rem_minmax(0,1fr)]">
        <Panel
          title="Add a case"
          sub="Both images, then ask the patient"
          icon="star"
          accent="violet"
          index={0}
          note={
            <>
              Before-and-after pairs shown on the public gallery, where people
              choosing a doctor look. The patient is asked first and sees these
              exact images; nothing is published until they agree, and they can
              change their mind at any time.
            </>
          }
        >
          <div className="p-4 sm:p-5">
            {patients.length === 0 ? (
              <Empty
                title="No patients yet"
                body="A gallery case is of somebody you have treated, so this fills up once you have seen patients here."
              />
            ) : (
              <GalleryComposer patients={patients} />
            )}
          </div>
        </Panel>

        <Panel
          title="Your cases"
          sub={`${live} shown publicly${waiting > 0 ? ` · ${waiting} awaiting consent` : ""}`}
          icon="clinic"
          accent="teal"
          index={1}
          note={
            <>
              Publish becomes available once the patient has agreed. If they
              later withdraw, the images stop being served straight away, on
              the gallery and everywhere else.
            </>
          }
        >
          {cases.length === 0 ? (
            <div className="p-5">
              <Empty title="Nothing here yet" body="Add a case on the left." />
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {cases.map((c) => (
                <GalleryCaseRow
                  key={c.id}
                  id={c.id}
                  treatmentName={c.treatmentName}
                  detail={c.detail}
                  patientName={c.patient.name ?? "Client"}
                  status={c.status}
                  consentGiven={Boolean(c.consentGivenAt)}
                  consentWithdrawn={Boolean(c.consentWithdrawnAt)}
                />
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
