import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { deleteTreatment, setTreatmentPublished } from "@/lib/actions/admin/catalog";
import { DeleteButton, EditLink, ToggleButton } from "@/components/admin/RowActions";
import { EmptyState, PageHeader, Table, Td, Th } from "@/components/admin/ui";

export const metadata = { title: "Treatments" };
export const dynamic = "force-dynamic";

export default async function TreatmentsPage() {
  const treatments = await prisma.treatment.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      category: { select: { name: true } },
      _count: { select: { bullets: true } },
    },
  });

  return (
    <>
      <PageHeader
        title="Treatments"
        description="The treatment pages on the public site."
        action={
          <Link href="/admin/treatments/new" className="btn-primary">
            New treatment
          </Link>
        }
      />

      {treatments.length === 0 ? (
        <EmptyState
          title="No treatments yet"
          description="Add your first treatment and it will appear on the site immediately."
          action={
            <Link href="/admin/treatments/new" className="btn-primary">
              New treatment
            </Link>
          }
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Category</Th>
              <Th>Product</Th>
              <Th className="w-24">Bullets</Th>
              <Th className="w-24">Status</Th>
              <Th className="w-40 text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {treatments.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50/60">
                <Td>
                  <div className="font-semibold text-ink">{t.name}</div>
                  <div className="text-xs text-ink-muted">/{t.slug}</div>
                </Td>
                <Td className="text-ink-soft">{t.category.name}</Td>
                <Td className="text-ink-soft">{t.productName}</Td>
                <Td className="text-ink-muted">{t._count.bullets}</Td>
                <Td>
                  <ToggleButton
                    active={t.isPublished}
                    action={async (next) => {
                      "use server";
                      return setTreatmentPublished(t.id, next);
                    }}
                  />
                </Td>
                <Td>
                  <div className="flex items-center justify-end gap-3">
                    <a
                      href={`/treatments/${t.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-ink-muted hover:text-ink"
                    >
                      View
                    </a>
                    <EditLink href={`/admin/treatments/${t.id}`} />
                    <DeleteButton
                      confirmText={t.name}
                      action={async () => {
                        "use server";
                        return deleteTreatment(t.id);
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
