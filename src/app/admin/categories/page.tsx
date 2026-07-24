import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { deleteCategory } from "@/lib/actions/admin/catalog";
import { DeleteButton, EditLink } from "@/components/admin/RowActions";
import { EmptyState, PageHeader, Pill, Table, Td, Th } from "@/components/admin/ui";

export const metadata = { title: "Categories" };
export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { treatments: true } } },
  });

  return (
    <>
      <PageHeader
        title="Categories"
        description="Clinical groups. These drive the site menu and the solution tiles."
        action={
          <Link href="/admin/categories/new" className="btn-primary">
            New category
          </Link>
        }
      />

      {categories.length === 0 ? (
        <EmptyState
          title="No categories yet"
          description="Treatments belong to a category, so start here."
          action={
            <Link href="/admin/categories/new" className="btn-primary">
              New category
            </Link>
          }
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th className="w-16">Order</Th>
              <Th>Name</Th>
              <Th>Blurb</Th>
              <Th className="w-28">Treatments</Th>
              <Th className="w-24">Status</Th>
              <Th className="w-40 text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50/60">
                <Td className="text-ink-muted">{c.sortOrder}</Td>
                <Td>
                  <div className="font-semibold text-ink">{c.name}</div>
                  <div className="text-xs text-ink-muted">/{c.slug}</div>
                </Td>
                <Td className="max-w-md text-ink-soft">{c.blurb}</Td>
                <Td className="text-ink-muted">{c._count.treatments}</Td>
                <Td>
                  <Pill tone={c.isActive ? "success" : "neutral"}>
                    {c.isActive ? "Active" : "Hidden"}
                  </Pill>
                </Td>
                <Td>
                  <div className="flex items-center justify-end gap-3">
                    <EditLink href={`/admin/categories/${c.id}`} />
                    <DeleteButton
                      confirmText={c.name}
                      action={async () => {
                        "use server";
                        return deleteCategory(c.id);
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
