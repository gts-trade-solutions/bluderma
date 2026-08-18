import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { deleteHubTreatment } from "@/lib/actions/admin/catalogue";
import { DeleteButton, EditLink } from "@/components/admin/RowActions";
import { EmptyState, PageHeader, Pill, Table, Td, Th } from "@/components/admin/ui";

export const metadata = { title: "Hub treatments" };
export const dynamic = "force-dynamic";

export default async function HubTreatmentsPage({
  searchParams,
}: {
  searchParams?: { category?: string };
}) {
  const filter = searchParams?.category;

  const [rows, categories] = await Promise.all([
    prisma.hubTreatment.findMany({
      where: filter ? { category: { slug: filter } } : undefined,
      orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
      include: { category: { select: { name: true, slug: true } } },
    }),
    prisma.hubCategory.findMany({
      orderBy: { sortOrder: "asc" },
      select: {
        slug: true,
        name: true,
        _count: { select: { treatments: true } },
      },
    }),
  ]);

  const total = categories.reduce((n, c) => n + c._count.treatments, 0);

  return (
    <>
      <PageHeader
        title="Hub treatments"
        description="Every treatment a client can open from the explore hub."
        action={
          <Link href="/admin/hub-treatments/new" className="btn-primary">
            New treatment
          </Link>
        }
      />

      {/* Category filter — a hundred rows is a lot to scan unfiltered. */}
      <div className="mb-5 flex flex-wrap gap-2">
        <Link
          href="/admin/hub-treatments"
          className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${
            !filter
              ? "bg-ink text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          All ({total})
        </Link>
        {categories.map((c) => (
          <Link
            key={c.slug}
            href={`/admin/hub-treatments?category=${c.slug}`}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${
              filter === c.slug
                ? "bg-ink text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {c.name} ({c._count.treatments})
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No treatments here"
          description="Create one, or clear the category filter."
          action={
            <Link href="/admin/hub-treatments/new" className="btn-primary">
              New treatment
            </Link>
          }
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Treatment</Th>
              <Th className="w-40">Category</Th>
              <Th className="w-40">Meta</Th>
              <Th className="w-24">State</Th>
              <Th className="w-40" />
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id}>
                <Td>
                  <span className="font-semibold text-ink">{t.name}</span>
                  <span className="block text-xs text-ink-muted">
                    /{t.category.slug}/{t.slug}
                  </span>
                </Td>
                <Td>{t.category.name}</Td>
                <Td className="text-xs">{t.meta ?? "—"}</Td>
                <Td>
                  <Pill tone={t.isActive ? "success" : "neutral"}>
                    {t.isActive ? "Live" : "Hidden"}
                  </Pill>
                </Td>
                <Td>
                  <div className="flex items-center justify-end gap-3">
                    <EditLink href={`/admin/hub-treatments/${t.id}`} />
                    <DeleteButton
                      confirmText={t.name}
                      action={async () => {
                        "use server";
                        return deleteHubTreatment(t.id);
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
