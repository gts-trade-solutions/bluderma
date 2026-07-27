import Link from "next/link";

import { requireRole } from "@/lib/session";
import {
  getDoctorAppointments,
  getDoctorForUser,
  getDoctorStats,
} from "@/lib/queries/doctorPortal";
import AppointmentActions from "@/components/doctor/AppointmentActions";
import { EmptyState, Pill, Table, Td, Th } from "@/components/admin/ui";

export const metadata = { title: "Appointments" };
export const dynamic = "force-dynamic";

const DATETIME = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

const STATUS_TONE: Record<string, "success" | "warn" | "danger" | "neutral"> = {
  CONFIRMED: "success",
  PENDING: "warn",
  CANCELLED: "danger",
  COMPLETED: "neutral",
  NO_SHOW: "neutral",
};

export default async function DoctorPortalPage({
  searchParams,
}: {
  searchParams: { when?: string };
}) {
  const user = await requireRole(["DOCTOR", "ADMIN"], "/doctor/portal");
  const doctor = await getDoctorForUser(user.id);

  // An admin, or a doctor whose login isn't linked to a directory record yet.
  if (!doctor) {
    return (
      <EmptyState
        title="No doctor profile linked"
        description="Your account isn't connected to a doctor record. An administrator links these from the Doctors admin."
        action={
          user.role === "ADMIN" ? (
            <Link href="/admin/doctors" className="btn-primary">
              Go to Doctors admin
            </Link>
          ) : undefined
        }
      />
    );
  }

  const when = searchParams.when === "past" ? "past" : "upcoming";
  const [appointments, stats] = await Promise.all([
    getDoctorAppointments(doctor.id, when),
    getDoctorStats(doctor.id),
  ]);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">
            Welcome, {doctor.name}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {doctor.clinic}, {doctor.location}
          </p>
        </div>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Stat label="Upcoming" value={stats.upcoming} />
        <Stat label="Completed" value={stats.completed} />
        <Stat label="Cancelled" value={stats.cancelled} />
      </div>

      <div className="mb-5 flex gap-2">
        <Tab href="/doctor/portal?when=upcoming" active={when === "upcoming"} label="Upcoming" />
        <Tab href="/doctor/portal?when=past" active={when === "past"} label="Past" />
      </div>

      {appointments.length === 0 ? (
        <EmptyState
          title={`No ${when} appointments`}
          description={
            when === "upcoming"
              ? "When someone books a consultation with you, they'll appear here."
              : "Past appointments will be listed here once they've happened."
          }
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th className="w-44">When</Th>
              <Th>Consultation</Th>
              <Th className="w-24">Mode</Th>
              <Th className="w-28">Status</Th>
              <Th className="w-44 text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {appointments.map((a) => (
              <tr key={a.id} className="hover:bg-slate-50/60">
                <Td className="font-medium text-ink-soft">
                  {DATETIME.format(a.scheduledAt)}
                </Td>
                <Td>
                  <div className="font-semibold text-ink">{a.patientName}</div>
                  <div className="text-xs text-ink-muted">
                    {a.patientPhone ?? a.patientEmail ?? "—"}
                  </div>
                  {a.notes && (
                    <div className="mt-1 text-xs italic text-ink-muted">
                      “{a.notes}”
                    </div>
                  )}
                </Td>
                <Td className="text-xs text-ink-soft">
                  {a.mode === "VIDEO" ? "Video" : "In-clinic"}
                </Td>
                <Td>
                  <Pill tone={STATUS_TONE[a.status] ?? "neutral"}>
                    {a.status.charAt(0) + a.status.slice(1).toLowerCase()}
                  </Pill>
                </Td>
                <Td>
                  {a.status === "CONFIRMED" || a.status === "PENDING" ? (
                    <AppointmentActions
                      appointmentId={a.id}
                      upcoming={when === "upcoming"}
                    />
                  ) : (
                    <span className="block text-right text-xs text-ink-muted">
                      —
                    </span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {label}
      </p>
      <p className="mt-1 text-3xl font-extrabold text-ink">{value}</p>
    </div>
  );
}

function Tab({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center rounded-full border px-4 py-1.5 text-sm font-medium transition ${
        active
          ? "border-brand-600 bg-brand-600 text-white"
          : "border-slate-200 bg-white text-ink-soft hover:border-brand-300"
      }`}
    >
      {label}
    </Link>
  );
}
