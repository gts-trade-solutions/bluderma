import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Empty, PageHead, Panel } from "@/components/doctor/portalUi";
import { getOwnDoctor } from "@/lib/doctor/guard";
import { prisma } from "@/lib/prisma";
import PatientChart, { type ChartPhoto } from "@/components/doctor/PatientChart";
import {
  getPatientTimeline,
  summarise,
  type TimelineKind,
} from "@/lib/doctor/patientTimeline";

export const metadata = { title: "Patient" };
export const dynamic = "force-dynamic";

const stamp = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** Full literal strings: Tailwind scans source text, so interpolation loses the colour. */
const TONE: Record<TimelineKind, { dot: string; label: string }> = {
  booked: { dot: "bg-brand-500", label: "Booked" },
  cancelled: { dot: "bg-rose-500", label: "Cancelled" },
  "no-show": { dot: "bg-rose-600", label: "No-show" },
  completed: { dot: "bg-teal-500", label: "Seen" },
  rescheduled: { dot: "bg-amber-500", label: "Moved" },
  scan: { dot: "bg-violet-500", label: "Analysis" },
  plan: { dot: "bg-violet-500", label: "Plan" },
  aftercare: { dot: "bg-teal-600", label: "Aftercare" },
  review: { dot: "bg-amber-400", label: "Review" },
};

/**
 * One patient, and everything that has happened between them and this doctor.
 *
 * Assembled from the appointment, plan, aftercare and review rows rather than
 * from an activity log. See lib/doctor/patientTimeline.ts for why: a log would
 * have started empty on the day it shipped, and the history a doctor wants is
 * precisely the part that happened before then.
 */
export default async function PatientPage({ params }: { params: { id: string } }) {
  const owner = await getOwnDoctor();
  if (!owner) notFound();

  // Only somebody this doctor has actually seen. A user id in a URL is an
  // assertion, and a practitioner has no business reading the history of
  // someone who is not their patient.
  const seen = await prisma.appointment.findFirst({
    where: { doctorId: owner.doctorId, patientUserId: params.id },
    orderBy: { scheduledAt: "desc" },
    select: { patientName: true, patientEmail: true, patientPhone: true },
  });
  if (!seen) notFound();

  const [patient, timeline, photos, notes] = await Promise.all([
    prisma.user.findUnique({
      where: { id: params.id },
      select: { name: true, publicId: true },
    }),
    getPatientTimeline(owner.doctorId, params.id),
    // Photographs of this patient, whoever took them: their own submissions
    // and anything taken in clinic. A doctor comparing a course needs both.
    prisma.patientPhoto.findMany({
      where: { patientUserId: params.id },
      orderBy: { capturedAt: "desc" },
      take: 60,
      select: {
        id: true,
        angle: true,
        capturedAt: true,
        note: true,
        doctorId: true,
        // Only THIS doctor's marks. A second practitioner's reading of the
        // same image is theirs, not something to edit over.
        annotations: {
          where: { doctorId: owner.doctorId },
          select: { strokes: true, note: true },
        },
        // Same rule as the marks: this doctor's plan for the photograph, not
        // somebody else's.
        pins: {
          where: { doctorId: owner.doctorId },
          orderBy: { label: "asc" },
          select: {
            id: true,
            x: true,
            y: true,
            label: true,
            treatment: true,
            note: true,
            priceInr: true,
            sessions: true,
          },
        },
      },
    }),
    prisma.patientNote.findMany({
      where: { doctorId: owner.doctorId, patientUserId: params.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, body: true, createdAt: true },
    }),
  ]);

  const { events, truncated, totalBookings } = timeline;

  const chartPhotos = photos.map((p) => ({
    id: p.id,
    angle: p.angle,
    capturedAt: stamp(p.capturedAt),
    note: p.note,
    byDoctor: p.doctorId !== null,
    // The Json column is parsed defensively: a stale shape should degrade to
    // "no marks" rather than crash the whole chart.
    strokes: Array.isArray(p.annotations[0]?.strokes)
      ? (p.annotations[0].strokes as unknown as ChartPhoto["strokes"])
      : [],
    markupNote: p.annotations[0]?.note ?? "",
    pins: p.pins,
  }));
  const s = summarise(events);
  const name = patient?.name ?? seen.patientName;

  return (
    <div className="pb-10">
      <Link
        href="/doctor/portal/calendar"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <PageHead
        title={name}
        sub={
          patient?.publicId
            ? `${patient.publicId} · ${seen.patientEmail ?? seen.patientPhone ?? ""}`
            : seen.patientEmail ?? seen.patientPhone ?? "Patient record"
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        {/* The counted total, not the number that fitted on screen. */}
        <Tile label="Booked" value={String(totalBookings)} bar="border-brand-500" />
        <Tile label="Seen" value={String(s.completed)} bar="border-teal-500" />
        <Tile label="Cancelled" value={String(s.cancellations)} bar="border-amber-500" />
        <Tile label="No-shows" value={String(s.noShows)} bar="border-rose-500" />
      </div>

      {/* Only when there is something worth saying. A rate under five bookings
          is not a pattern, and printing one next to somebody's name invites a
          judgement the data cannot support. */}
      {s.flag && (
        <p className="mb-5 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 ring-1 ring-inset ring-amber-200">
          {s.flag}
        </p>
      )}

      <div className="mb-4">
        <Panel
          title="Chart"
          sub="Photographs and your own notes on this patient"
          icon="pulse"
          accent="violet"
          index={0}
        >
          <div className="p-4 sm:p-5">
            <PatientChart
              patientUserId={params.id}
              photos={chartPhotos}
              notes={notes.map((n) => ({
                id: n.id,
                body: n.body,
                at: stamp(n.createdAt),
              }))}
            />
          </div>
        </Panel>
      </div>

      <Panel
        title="History"
        sub={
          truncated
            ? `The most recent ${events.length} events. There are older ones.`
            : "Everything between this patient and your practice"
        }
        icon="today"
        accent="brand"
        index={0}
      >
        {events.length === 0 ? (
          <div className="p-5">
            <Empty title="Nothing recorded yet" body="Activity appears here as it happens." />
          </div>
        ) : (
          <ol className="divide-y divide-slate-100">
            {events.map((e) => {
              const tone = TONE[e.kind];
              return (
                <li key={e.id} className="flex gap-3 px-4 py-3.5 sm:px-5">
                  <span
                    aria-hidden
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${tone.dot}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <p className="text-sm font-semibold text-slate-900">
                        {e.summary}
                      </p>
                      <time className="shrink-0 text-xs tabular-nums text-slate-400">
                        {stamp(e.at)}
                      </time>
                    </div>
                    {e.detail && (
                      <p className="mt-0.5 text-xs text-slate-500">{e.detail}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Panel>
    </div>
  );
}

function Tile({ label, value, bar }: { label: string; value: string; bar: string }) {
  return (
    <div
      className={`rounded-2xl border-t-[3px] bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_12px_32px_-24px_rgba(15,23,42,0.35)] ring-1 ring-slate-200/80 sm:p-4 ${bar}`}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400 sm:text-[11px]">
        {label}
      </p>
      <p className="mt-1 font-display text-[22px] font-extrabold leading-none tabular-nums text-slate-900 sm:text-[28px]">
        {value}
      </p>
    </div>
  );
}
