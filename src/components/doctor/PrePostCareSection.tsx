import Link from "next/link";
import { AppointmentStatus } from "@prisma/client";

import { Empty, Panel } from "@/components/doctor/portalUi";
import AftercareForm, {
  type RecentVisit,
} from "@/components/doctor/AftercareForm";
import { getOwnDoctor } from "@/lib/doctor/guard";
import { prisma } from "@/lib/prisma";
import { reasonLabel } from "@/lib/booking/visitIntake";
import { aiEnabled } from "@/lib/integrations/aiAssist";

/**
 * Issuing the sheets that go around a treatment, and what has been issued.
 *
 * ── Why it lives inside Treatment programs now ───────────────────────────
 * It was its own rail entry, two links away from the plan it belongs to. But
 * these are one job seen from three angles: what course of treatment somebody
 * is on, how they should prepare for the next session of it, and what they
 * must do afterwards. A doctor writing a plan is the same doctor, in the same
 * minute, who should be sending the "stop your retinoid on Thursday" sheet.
 *
 * The route it used to own still exists and redirects here, because these
 * links have been emailed.
 *
 * Everything below is the screen as it was, moved rather than rewritten: the
 * standard content, the per-treatment memory of what a doctor added last time,
 * and the dictation pipeline are all load-bearing and all subtle.
 */

export default async function PrePostCareSection() {
  const owner = await getOwnDoctor();
  if (!owner) {
    return (
      <Empty
        title="No practice linked"
        body="This account has no practice record yet."
      />
    );
  }

  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const [recent, sheets, primary] = await Promise.all([
    // Visits that have happened, newest first. These are what a sheet is
    // normally issued against, so filling the form from one saves retyping a
    // name and a date that are already recorded.
    prisma.appointment.findMany({
      where: {
        doctorId: owner.doctorId,
        scheduledAt: { lte: new Date() },
        status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW] },
      },
      orderBy: { scheduledAt: "desc" },
      take: 8,
      select: {
        id: true,
        patientName: true,
        patientUserId: true,
        scheduledAt: true,
        reason: true,
      },
    }),
    prisma.aftercareSheet.findMany({
      where: { doctorId: owner.doctorId },
      orderBy: { issuedAt: "desc" },
      take: 40,
      select: {
        id: true,
        kind: true,
        patientName: true,
        patientPublicId: true,
        procedure: true,
        procedureDate: true,
        issuedAt: true,
        acknowledgedAt: true,
        doctorNotes: true,
      },
    }),
    prisma.doctorClinic.findFirst({
      where: { doctorId: owner.doctorId, isPrimary: true },
      select: { clinic: { select: { phone: true } } },
    }),
  ]);

  const ai = aiEnabled();

  const visits: RecentVisit[] = recent.map((a) => ({
    id: a.id,
    label: `${a.patientName} · ${a.scheduledAt.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    })}`,
    patientName: a.patientName,
    patientUserId: a.patientUserId,
    procedure: a.reason ? reasonLabel(a.reason) ?? "" : "",
    date: iso(a.scheduledAt),
  }));

  return (
    <>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          {/*
            Before first, because that is the order it happens in and the
            half that gets forgotten. It is also the half that prevents the
            appointment being wasted.
          */}
          <Panel
            title="Before the treatment"
            sub="What to stop, what to avoid, when to arrive"
            icon="clock"
            accent="violet"
            index={0}
            note={
              <>
                Send it when the appointment is booked. Two days&rsquo; notice
                is what saves a wasted slot.
              </>
            }
          >
            <div className="p-4 sm:p-5">
              <AftercareForm
                kind="PRE"
                visits={visits}
                defaultEmergencyContact={primary?.clinic.phone ?? ""}
                aiEnabled={ai}
              />
            </div>
          </Panel>

          <Panel
            title="After the treatment"
            sub="The clinic's standard instructions, plus your own"
            icon="sheet"
            accent="brand"
            index={1}
            note={
              <>The standard instructions are attached. What you add is remembered for next time.</>
            }
          >
            <div className="p-4 sm:p-5">
              <AftercareForm
                kind="POST"
                visits={visits}
                defaultEmergencyContact={primary?.clinic.phone ?? ""}
                aiEnabled={ai}
              />
            </div>
          </Panel>
        </div>

        <Panel
          title="Issued"
          sub={sheets.length === 1 ? "1 sheet" : `${sheets.length} sheets`}
          icon="today"
          accent="teal"
          index={2}
          note={
            <>Kept exactly as worded on the day it was issued.</>
          }
        >
          {sheets.length === 0 ? (
            <div className="p-5">
              <Empty
                title="Nothing issued yet"
                body="Sheets you issue appear here, and in the patient's own profile."
              />
            </div>
          ) : (
            <ul className="divide-y divide-graphite-100">
              {sheets.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/doctor/portal/aftercare/${s.id}`}
                    className="block px-4 py-3.5 transition hover:bg-graphite-50 sm:px-5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="flex min-w-0 items-center gap-1.5 text-sm font-bold text-graphite-900">
                        {/* Which side, at a glance. Two sheets for one patient
                            on one day is the normal case, and without this
                            they are indistinguishable in the list. */}
                        <span
                          className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide ${
                            s.kind === "PRE"
                              ? "bg-graphite-100 text-graphite-800"
                              : "bg-azure-100 text-azure-800"
                          }`}
                        >
                          {s.kind === "PRE" ? "Before" : "After"}
                        </span>
                        <span className="min-w-0 truncate">{s.patientName}</span>
                      </p>
                      {/* Whether they have confirmed it was explained to them.
                          Never inferred from a page view: the sheet asks them
                          to say so, and only they can. */}
                      {s.acknowledgedAt ? (
                        <span className="shrink-0 rounded-full bg-mint-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-mint-800">
                          Confirmed
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-graphite-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-graphite-500">
                          Not confirmed
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-graphite-500">
                      {s.procedure} ·{" "}
                      {s.procedureDate.toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                      {s.patientPublicId ? ` · ${s.patientPublicId}` : ""}
                    </p>
                    {s.doctorNotes && (
                      <p className="mt-1 line-clamp-1 text-[11px] text-graphite-500">
                        Your notes: {s.doctorNotes}
                      </p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
