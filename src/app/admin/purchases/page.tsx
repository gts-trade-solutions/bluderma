import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { deletePurchase } from "@/lib/actions/admin/records";
import { DeleteButton, EditLink } from "@/components/admin/RowActions";
import { EmptyState, PageHeader, Pill, Table, Td, Th } from "@/components/admin/ui";

export const metadata = { title: "Purchases" };
export const dynamic = "force-dynamic";

const day = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** Only a delivered order is "done"; a cancelled one should not read as good. */
const TONE: Record<string, "success" | "warn" | "danger" | "neutral"> = {
  DELIVERED: "success",
  SHIPPED: "warn",
  PROCESSING: "warn",
  PLACED: "neutral",
  CANCELLED: "danger",
};

export default async function PurchasesPage() {
  const rows = await prisma.purchase.findMany({
    orderBy: { orderedAt: "desc" },
    take: 200,
    include: { user: { select: { name: true, email: true } } },
  });

  return (
    <>
      <PageHeader
        title="Purchases"
        description="Online orders shown in the client's My Profile."
        action={
          <Link href="/admin/purchases/new" className="btn-primary">
            New purchase
          </Link>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No purchases yet"
          description="Record an order so it appears in the client's profile."
          action={
            <Link href="/admin/purchases/new" className="btn-primary">
              New purchase
            </Link>
          }
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Client</Th>
              <Th>Item</Th>
              <Th className="w-24">Qty</Th>
              <Th className="w-32">Amount</Th>
              <Th className="w-32">Status</Th>
              <Th className="w-32">Ordered</Th>
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
                <Td>{r.itemName}</Td>
                <Td>{r.quantity}</Td>
                <Td>{r.amountInr == null ? "—" : `₹${r.amountInr.toLocaleString("en-IN")}`}</Td>
                <Td>
                  <Pill tone={TONE[r.status] ?? "neutral"}>{r.status}</Pill>
                </Td>
                <Td>{day(r.orderedAt)}</Td>
                <Td>
                  <div className="flex items-center justify-end gap-3">
                    <EditLink href={`/admin/purchases/${r.id}`} />
                    <DeleteButton
                      confirmText={`the purchase "${r.itemName}"`}
                      action={async () => {
                        "use server";
                        return deletePurchase(r.id);
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
