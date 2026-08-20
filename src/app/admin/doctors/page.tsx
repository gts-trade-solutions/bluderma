import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { deleteDoctor, setDoctorActive } from "@/lib/actions/admin/doctors";
import { DeleteButton, EditLink, ToggleButton } from "@/components/admin/RowActions";
import { EmptyState, PageHeader, Table, Td, Th } from "@/components/admin/ui";

export const metadata = { title: "Doctors" };
export const dynamic = "force-dynamic";

export default async function DoctorsPage() {
  const doctors = await prisma.doctor.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      modes: { select: { mode: true } },
      _count: { select: { appointments: true, availability: true } },
      user: { select: { email: true } },
    },
  });

  return (
    <>
      <PageHeader
        title="Doctors"
        description="The doctor directory clients book against."
        action={
          <Link href="/admin/doctors/new" className="btn-primary">
            New doctor
          </Link>
        }
      />

      {doctors.length === 0 ? (
        <EmptyState
          title="No doctors yet"
          description="Add doctors so clients have someone to book with."
          action={
            <Link href="/admin/doctors/new" className="btn-primary">
              New doctor
            </Link>
          }
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Clinic</Th>
              <Th className="w-28">Modes</Th>
              <Th className="w-20">Fee</Th>
              <Th className="w-28">Bookings</Th>
              <Th className="w-24">Status</Th>
              <Th className="w-40 text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {doctors.map((d) => (
              <tr key={d.id} className="hover:bg-slate-50/60">
                <Td>
                  <div className="font-semibold text-ink">{d.name}</div>
                  <div className="text-xs text-ink-muted">
                    {d.specialty}
                    {d.user && ` · ${d.user.email}`}
                  </div>
                </Td>
                <Td className="text-ink-soft">
                  {d.clinic}
                  <div className="text-xs text-ink-muted">{d.location}</div>
                </Td>
                <Td className="text-xs text-ink-soft">
                  {d.modes.map((m) => (m.mode === "VIDEO" ? "Video" : "Clinic")).join(", ") ||
                    "—"}
                  {d._count.availability === 0 && (
                    <div className="text-[11px] font-medium text-amber-600">
                      No working hours
                    </div>
                  )}
                </Td>
                <Td className="text-ink-soft">₹{d.fee}</Td>
                <Td className="text-ink-muted">{d._count.appointments}</Td>
                <Td>
                  <ToggleButton
                    active={d.isActive}
                    activeLabel="Active"
                    inactiveLabel="Hidden"
                    action={async (next) => {
                      "use server";
                      return setDoctorActive(d.id, next);
                    }}
                  />
                </Td>
                <Td>
                  <div className="flex items-center justify-end gap-3">
                    <EditLink href={`/admin/doctors/${d.id}`} />
                    <DeleteButton
                      confirmText={d.name}
                      action={async () => {
                        "use server";
                        return deleteDoctor(d.id);
                      }}
                    />
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
