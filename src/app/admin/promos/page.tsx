import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { deleteHubPromo } from "@/lib/actions/admin/marketing";
import { DeleteButton, EditLink } from "@/components/admin/RowActions";
import { EmptyState, PageHeader, Pill, Table, Td, Th } from "@/components/admin/ui";
import { liveState } from "@/lib/admin/liveState";

export const metadata = { title: "Promos" };
export const dynamic = "force-dynamic";

const day = (d: Date | null) =>
  d
    ? d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })
    : "—";

export default async function PromosPage() {
  const rows = await prisma.hubPromo.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return (
    <>
      <PageHeader
        title="Promos"
        description="The trending carousel on the explore hub. Scheduled slides appear and retire on their own."
        action={
          <Link href="/admin/promos/new" className="btn-primary">
            New promo
          </Link>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No promos yet"
          description="Run `npx tsx prisma/seed-marketing.ts` to load the shipped slides, or create one."
          action={
            <Link href="/admin/promos/new" className="btn-primary">
              New promo
            </Link>
          }
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th className="w-16">Order</Th>
              <Th>Slide</Th>
              <Th className="w-40">Button</Th>
              <Th className="w-40">Runs</Th>
              <Th className="w-28">State</Th>
              <Th className="w-40" />
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const state = liveState(p);
              return (
                <tr key={p.id}>
                  <Td>{p.sortOrder}</Td>
                  <Td>
                    <span className="block text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                      {p.eyebrow}
                    </span>
                    <span className="font-semibold text-ink">{p.title}</span>
                    <span className="block text-xs text-ink-muted">{p.body}</span>
                  </Td>
                  <Td className="text-xs">
                    {p.cta}
                    <span className="block text-ink-muted">{p.href}</span>
                  </Td>
                  <Td className="text-xs">
                    {day(p.startsAt)} → {day(p.endsAt)}
                  </Td>
                  <Td>
                    <Pill tone={state.tone}>{state.label}</Pill>
                  </Td>
                  <Td>
                    <div className="flex items-center justify-end gap-3">
                      <EditLink href={`/admin/promos/${p.id}`} />
                      <DeleteButton
                        confirmText={p.title}
                        action={async () => {
                          "use server";
                          return deleteHubPromo(p.id);
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
