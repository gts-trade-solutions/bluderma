import Link from "next/link";
import { AppointmentStatus } from "@prisma/client";

import { Empty, PageHead, Panel } from "@/components/doctor/portalUi";
import AftercareForm, {
  type RecentVisit,
} from "@/components/doctor/AftercareForm";
import { getOwnDoctor } from "@/lib/doctor/guard";
import { prisma } from "@/lib/prisma";
import { reasonLabel } from "@/lib/booking/visitIntake";

export const metadata = { title: "Aftercare" };
export const dynamic = "force-dynamic";

/**
 * Post-procedure aftercare sheets.
 *
 * The clinic's own sheet, issued to a named patient and kept as a record. The
 * standard do's, don'ts and warning signs come from lib/aftercare/standard.ts
 * and are copied into every sheet at the moment it is issued, so revising the
 * guidance later never changes a document a patient is already following.
 *
 * What a doctor adds is remembered per treatment and offered back the next
 * time they issue for the same one, which is the part the clinic asked for.
 */
export default async function AftercarePage() {
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
      take: 30,
      select: {
        id: true,
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
      <PageHead
        title="Aftercare sheets"
        sub="The clinic's post-procedure instructions, issued to a named patient and kept as a record."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Panel
          title="Issue a sheet"
          sub="The clinic's standard instructions, plus your own"
          icon="sheet"
          accent="brand"
          index={0}
          note={
            <>
              Give this to a patient after a procedure. The do&apos;s,
              don&apos;ts and warning signs are attached for you; what you type
              is specific to this person and overrides them. Anything you write
              is offered again next time you issue for the same treatment.
            </>
          }
        >
          <div className="p-4 sm:p-5">
            <AftercareForm
              visits={visits}
              defaultEmergencyContact={primary?.clinic.phone ?? ""}
            />
          </div>
        </Panel>

        <Panel
          title="Issued"
          sub={sheets.length === 1 ? "1 sheet" : `${sheets.length} sheets`}
          icon="today"
          accent="teal"
          index={1}
          note={
            <>
              Every sheet you have given out, exactly as it was worded on the
              day. <strong className="font-bold">Not confirmed</strong> means
              the patient has not yet ticked that the instructions were
              explained to them.
            </>
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
            <ul className="divide-y divide-slate-100">
              {sheets.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/doctor/portal/aftercare/${s.id}`}
                    className="block px-4 py-3.5 transition hover:bg-slate-50 sm:px-5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="min-w-0 text-sm font-bold text-slate-900">
                        {s.patientName}
                      </p>
                      {/* Whether they have confirmed it was explained to them.
                          Never inferred from a page view: the sheet asks them
                          to say so, and only they can. */}
                      {s.acknowledgedAt ? (
                        <span className="shrink-0 rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-teal-700">
                          Confirmed
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                          Not confirmed
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {s.procedure} ·{" "}
                      {s.procedureDate.toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                      {s.patientPublicId ? ` · ${s.patientPublicId}` : ""}
                    </p>
                    {s.doctorNotes && (
                      <p className="mt-1 line-clamp-1 text-[11px] text-slate-400">
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
