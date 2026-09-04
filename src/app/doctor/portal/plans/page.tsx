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
 *
 * ── What was wrong with this screen ──────────────────────────────────────
 * Two things, and together they made it unusable for most practitioners.
 *
 * It only offered patients who had run a SKIN SCAN. `startTreatmentPlan` has
 * always taken the scan as an optional argument — it is a head start, not a
 * prerequisite — but the list filtered scanned patients and showed everybody
 * else "Nobody to start one for". A doctor whose patients had not used the
 * analyzer met a dead end and reasonably concluded the feature was broken.
 *
 * And nothing said what a plan IS. "Treatment plans" over an empty list is a
 * heading, not an explanation, and the sequence — start it, accept the lines
 * you agree with, add your own, then share it — is not guessable from a
 * button called Start.
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
    // Everybody this doctor has seen. A scan makes the first draft better; it
    // is not what makes a plan possible.
    prisma.appointment.findMany({
      where: { doctorId: owner.doctorId, patientUserId: { not: null } },
      distinct: ["patientUserId"],
      orderBy: { scheduledAt: "desc" },
      take: 20,
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
    .filter((a) => a.patientUserId)
    .map((a) => {
      const scan = a.patient?.skinScans[0];
      return {
        userId: a.patientUserId as string,
        name: a.patientName,
        // Undefined where they have not scanned. The action treats that as
        // "no head start" rather than as a reason to refuse.
        scanId: scan?.id,
        scannedOn: scan ? DATE(scan.createdAt) : null,
      };
    });

  return (
    <>
      <PageHead
        title="Treatment plans"
        mark="plans"
        sub="A course of treatment you propose for one patient, in writing, that they can read and think about at home."
      />

      {/* What it is and how it goes, before the buttons. The sequence is not
          guessable from a control called Start, and a doctor who cannot guess
          it does not press it. */}
      <ol className="mb-5 grid gap-3 sm:grid-cols-3">
        {[
          {
            n: 1,
            t: "Start it for a patient",
            b: "Anyone you have seen. If they have run a skin analysis, the first draft is written from it — otherwise you start from a blank one.",
          },
          {
            n: 2,
            t: "Keep what you agree with",
            b: "Every suggested line arrives unaccepted. Take the ones you would actually do, set the rest aside, and add anything of your own.",
          },
          {
            n: 3,
            t: "Share it when it is right",
            b: "Until you do, it is yours alone. Once shared it appears in their profile and they can read it at home.",
          },
        ].map((s) => (
          <li
            key={s.n}
            className="rounded-[10px] bg-white p-4 shadow-flat ring-1 ring-graphite-200"
          >
            <span className="grid h-6 w-6 place-items-center rounded-full bg-graphite-100 text-[11px] font-black text-graphite-800">
              {s.n}
            </span>
            <p className="mt-2 text-sm font-bold text-graphite-900">{s.t}</p>
            <p className="mt-1 text-xs leading-relaxed text-graphite-500">{s.b}</p>
          </li>
        ))}
      </ol>

      <div className="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <Panel title="Start a plan"
          sub="Anyone you have seen"
          icon="pulse"
          accent="violet"
          index={0}
          note={
            <>A scan writes the first draft. Without one you start blank.</>
          }>
          {candidates.length === 0 ? (
            <div className="p-5">
              <Empty
                title="Nobody yet"
                body="Patients you have seen appear here, and you can start a plan for any of them. Your first booking is what fills this."
              />
            </div>
          ) : (
            <ul className="divide-y divide-graphite-100">
              {candidates.map((c) => (
                <li key={c.userId} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-graphite-900">{c.name}</p>
                    {/* Said either way. "No analysis" is not a problem to be
                        solved before starting — it only changes whether the
                        first draft is pre-filled. */}
                    <p className="text-xs text-graphite-500">
                      {c.scannedOn
                        ? `Scanned ${c.scannedOn} — the draft starts from it`
                        : "No analysis yet — you will start from blank"}
                    </p>
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
              <Empty
                title="No plans yet"
                body="Pick a patient on the left to start one. Nothing reaches them until you press Share, so a plan you are still thinking about is safe to leave here."
              />
            </div>
          ) : (
            <ul className="divide-y divide-graphite-100">
              {plans.map((p) => {
                const accepted = p.items.filter((i) => i.state === "ACCEPTED").length;
                const waiting = p.items.filter((i) => i.state === "SUGGESTED").length;
                return (
                  <li key={p.id}>
                    <Link href={`/doctor/portal/plans/${p.id}`} className="block px-4 py-3.5 transition hover:bg-graphite-50 sm:px-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="min-w-0 text-sm font-bold text-graphite-900">
                          {p.patient.name ?? "Client"}
                        </p>
                        {p.sharedAt ? (
                          <span className="shrink-0 rounded-full bg-mint-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-mint-800">
                            Shared
                          </span>
                        ) : (
                          <span className="shrink-0 rounded-full bg-gold-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold-800">
                            Draft
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-graphite-500">
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
