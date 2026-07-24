import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { deleteBanner } from "@/lib/actions/admin/content";
import { DeleteButton, EditLink } from "@/components/admin/RowActions";
import { EmptyState, PageHeader, Pill, Table, Td, Th } from "@/components/admin/ui";

export const metadata = { title: "Banners" };
export const dynamic = "force-dynamic";

const PLACEMENT_LABEL: Record<string, string> = {
  HOME_HERO: "Home hero",
  DOCTOR_HERO: "Clinical hub hero",
  PATIENT_HERO: "Patient hub hero",
};

export default async function BannersPage() {
  const banners = await prisma.banner.findMany({
    orderBy: [{ placement: "asc" }, { sortOrder: "asc" }],
  });

  return (
    <>
      <PageHeader
        title="Banners"
        description="Hero media for each area of the site."
        action={
          <Link href="/admin/banners/new" className="btn-primary">
            New banner
          </Link>
        }
      />

      {banners.length === 0 ? (
        <EmptyState
          title="No banners yet"
          description="Heroes currently use hardcoded fallback media. Add a banner to take control of one."
          action={
            <Link href="/admin/banners/new" className="btn-primary">
              New banner
            </Link>
          }
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th className="w-24">Preview</Th>
              <Th>Placement</Th>
              <Th>Title</Th>
              <Th className="w-20">Type</Th>
              <Th className="w-24">Status</Th>
              <Th className="w-32 text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {banners.map((b) => (
              <tr key={b.id} className="hover:bg-slate-50/60">
                <Td>
                  <div className="h-12 w-20 overflow-hidden rounded-lg bg-slate-100">
                    {b.mediaType === "IMAGE" && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={b.posterUrl ?? b.mediaUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                </Td>
                <Td className="text-ink-soft">
                  {PLACEMENT_LABEL[b.placement] ?? b.placement}
                </Td>
                <Td>
                  <div className="font-semibold text-ink">{b.title ?? "—"}</div>
                  <div className="line-clamp-1 text-xs text-ink-muted">
                    {b.subtitle}
                  </div>
                </Td>
                <Td className="text-xs text-ink-muted">{b.mediaType}</Td>
                <Td>
                  <Pill tone={b.isActive ? "success" : "neutral"}>
                    {b.isActive ? "Active" : "Off"}
                  </Pill>
                </Td>
                <Td>
                  <div className="flex items-center justify-end gap-3">
                    <EditLink href={`/admin/banners/${b.id}`} />
                    <DeleteButton
                      confirmText={b.title ?? "this banner"}
                      action={async () => {
                        "use server";
                        return deleteBanner(b.id);
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
