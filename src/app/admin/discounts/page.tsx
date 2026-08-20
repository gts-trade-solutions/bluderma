import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { deleteDiscountGrant } from "@/lib/actions/admin/records";
import { DeleteButton, EditLink } from "@/components/admin/RowActions";
import { EmptyState, PageHeader, Pill, Table, Td, Th } from "@/components/admin/ui";

export const metadata = { title: "Discounts" };
export const dynamic = "force-dynamic";

const day = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export default async function DiscountsPage() {
  const rows = await prisma.discountGrant.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: { select: { name: true, email: true } } },
  });

  const now = Date.now();

  return (
    <>
      <PageHeader
        title="Discounts"
        description="Granted to a client. Redeemed ones appear in their My Profile."
        action={
          <Link href="/admin/discounts/new" className="btn-primary">
            New discount
          </Link>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No discounts yet"
          description="Grant a client a code, a first-scan offer, a loyalty credit, a promo."
          action={
            <Link href="/admin/discounts/new" className="btn-primary">
              New discount
            </Link>
          }
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Client</Th>
              <Th className="w-32">Code</Th>
              <Th>What it&apos;s for</Th>
              <Th className="w-28">Value</Th>
              <Th className="w-32">State</Th>
              <Th className="w-28" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const expired = !!r.expiresAt && r.expiresAt.getTime() < now;
              return (
                <tr key={r.id}>
                  <Td>
                    <span className="font-semibold text-ink">{r.user.name ?? "—"}</span>
                    <span className="block text-xs text-ink-muted">{r.user.email}</span>
                  </Td>
                  <Td>
                    <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                      {r.code}
                    </code>
                  </Td>
                  <Td>{r.description}</Td>
                  <Td>
                    {r.percentOff ? `${r.percentOff}%` : null}
                    {r.amountOffInr ? `₹${r.amountOffInr.toLocaleString("en-IN")}` : null}
                    {!r.percentOff && !r.amountOffInr ? "—" : null}
                  </Td>
                  <Td>
                    {r.usedAt ? (
                      <Pill tone="success">Used {day(r.usedAt)}</Pill>
                    ) : expired ? (
                      <Pill tone="danger">Expired</Pill>
                    ) : (
                      <Pill tone="neutral">Available</Pill>
                    )}
                  </Td>
                  <Td>
                    <div className="flex items-center justify-end gap-3">
                      <EditLink href={`/admin/discounts/${r.id}`} />
                      <DeleteButton
                        confirmText={`the discount "${r.code}"`}
                        action={async () => {
                          "use server";
                          return deleteDiscountGrant(r.id);
                        }}
                      />
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </>
  );
}
