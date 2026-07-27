import Link from "next/link";

import { getAdminAppointments, getAppointmentCounts } from "@/lib/queries/ops";
import { setAppointmentStatus } from "@/lib/actions/admin/ops";
import StatusSelect from "@/components/admin/StatusSelect";
import { EmptyState, PageHeader, Table, Td, Th } from "@/components/admin/ui";

export const metadata = { title: "Appointments" };
export const dynamic = "force-dynamic";

const STATUSES = [
  "PENDING",
  "CONFIRMED",
  "CANCELLED",
  "COMPLETED",
  "NO_SHOW",
] as const;

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
  NO_SHOW: "No-show",
};

const DATETIME = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

export default async function AdminAppointmentsPage({
  searchParams,
}: {
  searchParams: { when?: string; status?: string };
}) {
  const when =
    searchParams.when === "past" ? "past" : ("upcoming" as "upcoming" | "past");
  const status = STATUSES.includes(searchParams.status as never)
    ? (searchParams.status as (typeof STATUSES)[number])
    : undefined;

  const [appointments, counts] = await Promise.all([
    getAdminAppointments({ when, status }),
    getAppointmentCounts(),
  ]);

  return (
    <>
      <PageHeader
        title="Appointments"
        description="Every booking across all doctors. Cancelling frees the slot."
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Tab href="/admin/appointments?when=upcoming" active={when === "upcoming"} label="Upcoming" />
        <Tab href="/admin/appointments?when=past" active={when === "past"} label="Past" />
        <span className="mx-2 hidden text-slate-300 sm:inline">|</span>
        <span className="text-xs text-ink-muted">
          {counts.CONFIRMED ?? 0} confirmed · {counts.CANCELLED ?? 0} cancelled ·{" "}
          {counts.COMPLETED ?? 0} completed
        </span>
      </div>

      {appointments.length === 0 ? (
        <EmptyState
          title={`No ${when} appointments`}
          description="Bookings made through the site's booking flow appear here."
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th className="w-44">When</Th>
              <Th>Consultation</Th>
              <Th>Doctor</Th>
              <Th className="w-24">Mode</Th>
              <Th className="w-20">Fee</Th>
              <Th className="w-40">Status</Th>
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
                    {a.patientPhone ?? a.patient?.email ?? a.patientEmail ?? "—"}
                  </div>
                </Td>
                <Td className="text-ink-soft">
                  {a.doctor.name}
                  <div className="text-xs text-ink-muted">
                    {a.doctor.clinic}, {a.doctor.location}
                  </div>
                </Td>
                <Td className="text-xs text-ink-soft">
                  {a.mode === "VIDEO" ? "Video" : "In-clinic"}
                </Td>
                <Td className="text-ink-soft">₹{a.feeAtBooking}</Td>
                <Td>
                  <StatusSelect
                    value={a.status}
                    options={STATUSES.map((s) => ({
                      value: s,
                      label: STATUS_LABEL[s],
                    }))}
                    action={async (next) => {
                      "use server";
                      return setAppointmentStatus(a.id, next);
                    }}
                  />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
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
