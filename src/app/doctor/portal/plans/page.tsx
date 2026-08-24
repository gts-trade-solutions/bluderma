import Link from "next/link";

import { Empty, PageHead, Panel } from "@/components/doctor/portalUi";
import StartPlanButton from "@/components/doctor/StartPlanButton";
import { getOwnDoctor } from "@/lib/doctor/guard";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Treatment plans" };
export const dynamic = "force-dynamic";

const DATE = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/**
 * Plans this doctor has built for their patients.
 *
 * The list is ordered drafts-first, because a plan sitting unshared is the one
 * that needs the doctor and a shared one does not.
 */
export default async function PlansPage() {
  const owner = await getOwnDoctor();
  if (!owner) {
    return <Empty title="No practice linked" body="This account has no practice record yet." />;
  }

  const [plans, scannedPatients] = await Promise.all([
    prisma.treatmentPlan.findMany({
      where: { doctorId: owner.doctorId },
      orderBy: [{ sharedAt: "asc" }, { createdAt: "desc" }],
      take: 40,
      select: {
        id: true,
        sharedAt: true,
        createdAt: true,
        patient: { select: { name: true, publicId: true } },
        items: { select: { state: true } },
      },
    }),
    // People this doctor has seen who have run an analysis. A plan is built
    // from a scan, so these are who one can be started for.
    prisma.appointment.findMany({
      where: { doctorId: owner.doctorId, patientUserId: { not: null } },
      distinct: ["patientUserId"],
      orderBy: { scheduledAt: "desc" },
      take: 12,
      select: {
        patientUserId: true,
        patientName: true,
        patient: {
          select: {
            skinScans: {
              where: { status: "done" },
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { id: true, createdAt: true },
            },
          },
        },
      },
    }),
  ]);

  const candidates = scannedPatients
    .filter((a) => a.patientUserId && a.patient?.skinScans.length)
    .map((a) => ({
      userId: a.patientUserId as string,
      name: a.patientName,
      scanId: a.patient!.skinScans[0].id,
      scannedOn: DATE(a.patient!.skinScans[0].createdAt),
    }));

  return (
    <>
      <PageHead
        title="Treatment plans"
        sub="Built from a patient's own analysis. Suggestions are proposed; you decide what goes in."
      />

      <div className="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <Panel title="Start a plan"
          sub="Patients of yours who have run an analysis"
          icon="pulse"
          accent="violet"
          index={0}
          note={
            <>Built from their scan. You accept or set aside each line.</>
          }>
          {candidates.length === 0 ? (
            <div className="p-5">
              <Empty
                title="Nobody to start one for"
                body="A plan is built from a patient's skin analysis. Once one of your patients has run a scan, they appear here."
              />
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {candidates.map((c) => (
                <li key={c.userId} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">{c.name}</p>
                    <p className="text-xs text-slate-500">Scanned {c.scannedOn}</p>
                  </div>
                  <StartPlanButton patientUserId={c.userId} scanId={c.scanId} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Your plans"
          sub={`${plans.length}`}
          icon="sheet"
          accent="brand"
          index={1}
          note={
            <>A draft is yours alone until you share it.</>
          }>
          {plans.length === 0 ? (
            <div className="p-5">
              <Empty title="No plans yet" body="Start one from a patient on the left." />
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {plans.map((p) => {
                const accepted = p.items.filter((i) => i.state === "ACCEPTED").length;
                const waiting = p.items.filter((i) => i.state === "SUGGESTED").length;
                return (
                  <li key={p.id}>
                    <Link href={`/doctor/portal/plans/${p.id}`} className="block px-4 py-3.5 transition hover:bg-slate-50 sm:px-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="min-w-0 text-sm font-bold text-slate-900">
                          {p.patient.name ?? "Client"}
                        </p>
                        {p.sharedAt ? (
                          <span className="shrink-0 rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-teal-700">
                            Shared
                          </span>
                        ) : (
                          <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                            Draft
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {accepted} in the plan
                        {waiting > 0 && ` · ${waiting} still to review`}
                        {p.patient.publicId ? ` · ${p.patient.publicId}` : ""}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
