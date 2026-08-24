import { FinancingStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { EmptyState, PageHeader, Pill, Table, Td, Th } from "@/components/admin/ui";
import FinancingRow from "@/components/admin/FinancingRow";

export const metadata = { title: "Payment enquiries" };
export const dynamic = "force-dynamic";

const DATE = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
});

/**
 * Clients asking whether a treatment can be paid for over time.
 *
 * These are enquiries, not applications. Nothing was approved and no limit was
 * quoted, so the job here is a reply, not a decision. The status is about
 * whether somebody has got back to them.
 */
export default async function FinancingPage() {
  const rows = await prisma.financingRequest.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
    include: {
      user: { select: { name: true, email: true, phone: true, publicId: true } },
    },
  });

  const open = rows.filter((r) => r.status !== FinancingStatus.CLOSED);

  return (
    <>
      <PageHeader
        title="Payment enquiries"
        description="Clients asking about spreading the cost of a treatment. Nothing here has been approved or quoted; they are waiting on a reply."
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No enquiries"
          description="When a client asks about paying over time, it appears here."
        />
      ) : (
        <>
          {open.length > 0 && (
            <p className="mb-4 text-sm text-slate-600">
              <strong className="font-bold text-slate-900">{open.length}</strong>{" "}
              waiting on a reply.
            </p>
          )}
          <Table>
            <thead>
              <tr>
                <Th>Client</Th>
                <Th>Treatment</Th>
                <Th>Their estimate</Th>
                <Th>Asked</Th>
                <Th>Status</Th>
                <Th>Reply</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <Td>
                    <span className="font-semibold text-slate-900">
                      {r.user.name ?? "Client"}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {r.user.email}
                      {r.user.phone ? ` · ${r.user.phone}` : ""}
                    </span>
                    {r.user.publicId && (
                      <span className="block font-mono text-[11px] text-slate-400">
                        {r.user.publicId}
                      </span>
                    )}
                  </Td>
                  <Td>
                    {r.treatment}
                    {r.note && (
                      <span className="block text-xs text-slate-500">{r.note}</span>
                    )}
                  </Td>
                  <Td>
                    {/* Labelled as theirs everywhere it appears. It is what the
                        client believes the treatment costs, not a quote. */}
                    {r.estimatedInr === null ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      `₹${r.estimatedInr.toLocaleString("en-IN")}`
                    )}
                  </Td>
                  <Td>{DATE.format(r.createdAt)}</Td>
                  <Td>
                    <Pill
                      tone={
                        r.status === FinancingStatus.NEW
                          ? "warn"
                          : r.status === FinancingStatus.CONTACTED
                            ? "success"
                            : "neutral"
                      }
                    >
                      {r.status === FinancingStatus.NEW
                        ? "Waiting"
                        : r.status === FinancingStatus.CONTACTED
                          ? "Replied"
                          : "Closed"}
                    </Pill>
                  </Td>
                  <Td>
                    <FinancingRow
                      id={r.id}
                      status={r.status}
                      staffNote={r.staffNote}
                    />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      )}
    </>
  );
}
