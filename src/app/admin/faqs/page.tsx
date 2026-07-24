import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { deleteFaq } from "@/lib/actions/admin/content";
import { DeleteButton, EditLink } from "@/components/admin/RowActions";
import { EmptyState, PageHeader, Pill, Table, Td, Th } from "@/components/admin/ui";

export const metadata = { title: "FAQs" };
export const dynamic = "force-dynamic";

export default async function FaqsPage() {
  const faqs = await prisma.faq.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <>
      <PageHeader
        title="FAQs"
        description="Common questions, grouped by optional category."
        action={
          <Link href="/admin/faqs/new" className="btn-primary">
            New FAQ
          </Link>
        }
      />

      {faqs.length === 0 ? (
        <EmptyState
          title="No FAQs yet"
          description="Nothing was carried over from the frontend MVP — it had no FAQ content. Add the first one here."
          action={
            <Link href="/admin/faqs/new" className="btn-primary">
              New FAQ
            </Link>
          }
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th className="w-16">Order</Th>
              <Th>Question</Th>
              <Th className="w-32">Category</Th>
              <Th className="w-24">Status</Th>
              <Th className="w-32 text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {faqs.map((f) => (
              <tr key={f.id} className="hover:bg-slate-50/60">
                <Td className="text-ink-muted">{f.sortOrder}</Td>
                <Td>
                  <div className="font-semibold text-ink">{f.question}</div>
                  <div className="line-clamp-1 text-xs text-ink-muted">
                    {f.answer}
                  </div>
                </Td>
                <Td className="text-xs text-ink-muted">{f.category ?? "—"}</Td>
                <Td>
                  <Pill tone={f.isPublished ? "success" : "neutral"}>
                    {f.isPublished ? "Published" : "Draft"}
                  </Pill>
                </Td>
                <Td>
                  <div className="flex items-center justify-end gap-3">
                    <EditLink href={`/admin/faqs/${f.id}`} />
                    <DeleteButton
                      confirmText="this FAQ"
                      action={async () => {
                        "use server";
                        return deleteFaq(f.id);
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
