import { prisma } from "@/lib/prisma";
import {
  approveSkinRequest,
  rejectSkinRequest,
} from "@/lib/actions/admin/skin";
import { ConfirmButton } from "@/components/admin/RowActions";
import { EmptyState, PageHeader, Pill, Table, Td, Th } from "@/components/admin/ui";

export const metadata = { title: "Skin requests" };
export const dynamic = "force-dynamic";

const DATE = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function SkinRequestsPage() {
  const requests = await prisma.skinAccessRequest.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
    include: { user: { select: { name: true, email: true } } },
  });

  const pending = requests.filter((r) => r.status === "pending");
  const handled = requests.filter((r) => r.status !== "pending");

  return (
    <>
      <PageHeader
        title="Skin analysis requests"
        description="People who have used their free scan and asked for another. Approving grants one more scan."
      />

      {requests.length === 0 ? (
        <EmptyState
          title="No requests"
          description="Scan requests from consultations will appear here."
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Consultation</Th>
              <Th className="w-40">Requested</Th>
              <Th className="w-28">Status</Th>
              <Th className="w-56 text-right">Action</Th>
            </tr>
          </thead>
          <tbody>
            {[...pending, ...handled].map((r) => (
              <tr key={r.id} className="hover:bg-slate-50/60">
                <Td>
                  <div className="font-semibold text-ink">
                    {r.user.name ?? "—"}
                  </div>
                  <div className="text-xs text-ink-muted">{r.user.email}</div>
                </Td>
                <Td className="text-xs text-ink-muted">
                  {DATE.format(r.createdAt)}
                </Td>
                <Td>
                  <Pill
                    tone={
                      r.status === "approved"
                        ? "success"
                        : r.status === "rejected"
                          ? "danger"
                          : "warn"
                    }
                  >
                    {r.status}
                  </Pill>
                </Td>
                <Td>
                  {r.status === "pending" ? (
                    <div className="flex justify-end gap-2">
                      <ConfirmButton
                        label="Approve"
                        confirmText="grant one more scan"
                        tone="primary"
                        action={async () => {
                          "use server";
                          return approveSkinRequest(r.id);
                        }}
                      />
                      <ConfirmButton
                        label="Reject"
                        confirmText="reject this request"
                        tone="danger"
                        action={async () => {
                          "use server";
                          return rejectSkinRequest(r.id);
                        }}
                      />
                    </div>
                  ) : (
                    <div className="text-right text-xs text-ink-muted">
                      handled
                    </div>
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
