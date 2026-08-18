import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { deletePrescription } from "@/lib/actions/admin/records";
import { DeleteButton, EditLink } from "@/components/admin/RowActions";
import { EmptyState, PageHeader, Table, Td, Th } from "@/components/admin/ui";

export const metadata = { title: "Prescriptions" };
export const dynamic = "force-dynamic";

const day = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export default async function PrescriptionsPage() {
  const rows = await prisma.prescription.findMany({
    orderBy: { issuedAt: "desc" },
    take: 200,
    include: {
      user: { select: { name: true, email: true } },
      doctor: { select: { name: true } },
    },
  });

  return (
    <>
      <PageHeader
        title="Prescriptions"
        description="Issued after a consultation. These appear in the client's My Profile."
        action={
          <Link href="/admin/prescriptions/new" className="btn-primary">
            New prescription
          </Link>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No prescriptions yet"
          description="Record what a clinician prescribed so the client can see it in their profile."
          action={
            <Link href="/admin/prescriptions/new" className="btn-primary">
              New prescription
            </Link>
          }
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Client</Th>
              <Th>Prescription</Th>
              <Th className="w-40">Clinician</Th>
              <Th className="w-32">Issued</Th>
              <Th className="w-28" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <Td>
                  <span className="font-semibold text-ink">{r.user.name ?? "—"}</span>
                  <span className="block text-xs text-ink-muted">{r.user.email}</span>
                </Td>
                <Td>
                  <span className="font-medium text-ink">{r.title}</span>
                  {r.notes && (
                    <span className="block max-w-md truncate text-xs text-ink-muted">
                      {r.notes}
                    </span>
                  )}
                </Td>
                <Td>{r.doctor?.name ?? "—"}</Td>
                <Td>{day(r.issuedAt)}</Td>
                <Td>
                  <div className="flex items-center justify-end gap-3">
                    <EditLink href={`/admin/prescriptions/${r.id}`} />
                    <DeleteButton
                      confirmText={`the prescription "${r.title}"`}
                      action={async () => {
                        "use server";
                        return deletePrescription(r.id);
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
