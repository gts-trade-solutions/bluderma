import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { deleteHubConcern } from "@/lib/actions/admin/marketing";
import { DeleteButton, EditLink } from "@/components/admin/RowActions";
import { EmptyState, PageHeader, Pill, Table, Td, Th } from "@/components/admin/ui";

export const metadata = { title: "Concerns" };
export const dynamic = "force-dynamic";

/**
 * The "what's bothering you?" tiles.
 *
 * Each one routes into a hub category, so a tile pointing at a category that
 * no longer exists is a dead end — the list flags that rather than waiting
 * for a client to find it.
 */
export default async function ConcernsPage() {
  const [rows, categories] = await Promise.all([
    prisma.hubConcern.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    }),
    prisma.hubCategory.findMany({ select: { slug: true } }),
  ]);

  const known = new Set(categories.map((c) => c.slug));

  return (
    <>
      <PageHeader
        title="Concerns"
        description="The concern tiles on the explore hub. Each opens a category."
        action={
          <Link href="/admin/concerns/new" className="btn-primary">
            New concern
          </Link>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No concerns yet"
          description="Run `npx tsx prisma/seed-marketing.ts` to load the shipped tiles, or create one."
          action={
            <Link href="/admin/concerns/new" className="btn-primary">
              New concern
            </Link>
          }
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th className="w-16">Order</Th>
              <Th>Concern</Th>
              <Th className="w-48">Opens</Th>
              <Th className="w-24">State</Th>
              <Th className="w-40" />
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <Td>{c.sortOrder}</Td>
                <Td>
                  <span className="font-semibold text-ink">{c.label}</span>
                  <span className="block text-xs text-ink-muted">{c.hint}</span>
                </Td>
                <Td>
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                    {c.category}
                  </code>
                  {!known.has(c.category) && (
                    <span className="mt-1 block text-xs font-semibold text-rose-600">
                      No such category — this tile is a dead end
                    </span>
                  )}
                </Td>
                <Td>
                  <Pill tone={c.isActive ? "success" : "neutral"}>
                    {c.isActive ? "Live" : "Off"}
                  </Pill>
                </Td>
                <Td>
                  <div className="flex items-center justify-end gap-3">
                    <EditLink href={`/admin/concerns/${c.id}`} />
                    <DeleteButton
                      confirmText={c.label}
                      action={async () => {
                        "use server";
                        return deleteHubConcern(c.id);
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
