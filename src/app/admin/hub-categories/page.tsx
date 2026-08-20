import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { deleteHubCategory } from "@/lib/actions/admin/catalogue";
import { DeleteButton, EditLink } from "@/components/admin/RowActions";
import { EmptyState, PageHeader, Pill, Table, Td, Th } from "@/components/admin/ui";

export const metadata = { title: "Hub categories" };
export const dynamic = "force-dynamic";

/**
 * The client-facing catalogue. Distinct from Content → Categories, which is
 * the clinician-facing catalogue behind /treatments.
 */
export default async function HubCategoriesPage() {
  const rows = await prisma.hubCategory.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      _count: { select: { treatments: true } },
      protocol: { select: { id: true } },
    },
  });

  return (
    <>
      <PageHeader
        title="Hub categories"
        description="What clients browse at /patient/explore, 18 categories and the treatments beneath them."
        action={
          <Link href="/admin/hub-categories/new" className="btn-primary">
            New category
          </Link>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No categories yet"
          description="Run `npx tsx prisma/seed-hub-catalogue.ts` to load the shipped catalogue, or create one here."
          action={
            <Link href="/admin/hub-categories/new" className="btn-primary">
              New category
            </Link>
          }
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th className="w-16">Order</Th>
              <Th>Category</Th>
              <Th className="w-28">Treatments</Th>
              <Th className="w-32">Protocol</Th>
              <Th className="w-24">State</Th>
              <Th className="w-40" />
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <Td>{c.sortOrder}</Td>
                <Td>
                  <span className="font-semibold text-ink">{c.name}</span>
                  <span className="block text-xs text-ink-muted">/{c.slug}</span>
                </Td>
                <Td>{c._count.treatments}</Td>
                <Td>
                  <Link
                    href={`/admin/hub-categories/${c.id}/protocol`}
                    className="text-sm font-semibold text-brand-700 hover:underline"
                  >
                    {c.protocol ? "Edit protocol" : "Add protocol"}
                  </Link>
                </Td>
                <Td>
                  <Pill tone={c.isActive ? "success" : "neutral"}>
                    {c.isActive ? "Live" : "Hidden"}
                  </Pill>
                </Td>
                <Td>
                  <div className="flex items-center justify-end gap-3">
                    <EditLink href={`/admin/hub-categories/${c.id}`} />
                    <DeleteButton
                      confirmText={`${c.name} and its ${c._count.treatments} treatment(s)`}
                      action={async () => {
                        "use server";
                        return deleteHubCategory(c.id);
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
