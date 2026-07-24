import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { deleteTestimonial } from "@/lib/actions/admin/content";
import { DeleteButton, EditLink } from "@/components/admin/RowActions";
import { EmptyState, PageHeader, Pill, Table, Td, Th } from "@/components/admin/ui";

export const metadata = { title: "Testimonials" };
export const dynamic = "force-dynamic";

export default async function TestimonialsPage() {
  const testimonials = await prisma.testimonial.findMany({
    orderBy: { sortOrder: "asc" },
    include: { treatment: { select: { name: true } } },
  });

  return (
    <>
      <PageHeader
        title="Testimonials"
        description="Patient quotes shown across the site."
        action={
          <Link href="/admin/testimonials/new" className="btn-primary">
            New testimonial
          </Link>
        }
      />

      {testimonials.length === 0 ? (
        <EmptyState
          title="No testimonials yet"
          description="Add a patient quote to build trust on the public pages."
          action={
            <Link href="/admin/testimonials/new" className="btn-primary">
              New testimonial
            </Link>
          }
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Author</Th>
              <Th>Quote</Th>
              <Th className="w-32">Treatment</Th>
              <Th className="w-24">Status</Th>
              <Th className="w-32 text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {testimonials.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50/60">
                <Td>
                  <div className="font-semibold text-ink">{t.authorName}</div>
                  <div className="text-xs text-ink-muted">{t.authorRole}</div>
                </Td>
                <Td className="max-w-md text-ink-soft">
                  <span className="line-clamp-2">{t.quote}</span>
                </Td>
                <Td className="text-xs text-ink-muted">
                  {t.treatment?.name ?? "—"}
                </Td>
                <Td>
                  <Pill tone={t.isPublished ? "success" : "neutral"}>
                    {t.isPublished ? "Published" : "Draft"}
                  </Pill>
                </Td>
                <Td>
                  <div className="flex items-center justify-end gap-3">
                    <EditLink href={`/admin/testimonials/${t.id}`} />
                    <DeleteButton
                      confirmText={`${t.authorName}'s quote`}
                      action={async () => {
                        "use server";
                        return deleteTestimonial(t.id);
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
