import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { deleteHubDeal } from "@/lib/actions/admin/marketing";
import { DeleteButton, EditLink } from "@/components/admin/RowActions";
import { EmptyState, PageHeader, Pill, Table, Td, Th } from "@/components/admin/ui";
import { liveState } from "@/lib/admin/liveState";

export const metadata = { title: "Deals" };
export const dynamic = "force-dynamic";

const day = (d: Date | null) =>
  d
    ? d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      })
    : "—";

export default async function DealsPage() {
  const rows = await prisma.hubDeal.findMany({
    orderBy: [{ isHot: "desc" }, { sortOrder: "asc" }],
  });

  return (
    <>
      <PageHeader
        title="Deals"
        description="Offers on the explore hub. They stop showing themselves after their end date, no deploy needed."
        action={
          <Link href="/admin/deals/new" className="btn-primary">
            New deal
          </Link>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No deals yet"
          description="Run `npx tsx prisma/seed-marketing.ts` to load the shipped offers, or create one."
          action={
            <Link href="/admin/deals/new" className="btn-primary">
              New deal
            </Link>
          }
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Deal</Th>
              <Th className="w-32">Category</Th>
              <Th className="w-20">Off</Th>
              <Th className="w-40">Runs</Th>
              <Th className="w-28">State</Th>
              <Th className="w-40" />
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => {
              const state = liveState(d);
              return (
                <tr key={d.id}>
                  <Td>
                    <span className="font-semibold text-ink">{d.title}</span>
                    <span className="block text-xs text-ink-muted">
                      {d.treatment} · {d.perk}
                    </span>
                  </Td>
                  <Td className="text-xs">{d.categoryLabel}</Td>
                  <Td>
                    <span className="font-semibold text-ink">{d.discount}%</span>
                  </Td>
                  <Td className="text-xs">
                    {day(d.startsAt)} → {day(d.endsAt)}
                  </Td>
                  <Td>
                    <div className="flex flex-col gap-1">
                      <Pill tone={state.tone}>{state.label}</Pill>
                      {d.isHot && <Pill tone="warn">Hot</Pill>}
                    </div>
                  </Td>
                  <Td>
                    <div className="flex items-center justify-end gap-3">
                      <EditLink href={`/admin/deals/${d.id}`} />
                      <DeleteButton
                        confirmText={d.title}
                        action={async () => {
                          "use server";
                          return deleteHubDeal(d.id);
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
