import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import {
  addTreatmentImage,
  deleteTreatmentImage,
} from "@/lib/actions/admin/products";
import { DeleteButton } from "@/components/admin/RowActions";
import TreatmentImageForm from "@/components/admin/TreatmentImageForm";
import { Card, PageHeader } from "@/components/admin/ui";

export const metadata = { title: "Treatment images" };
export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  HERO: "Hero",
  BEFORE_AFTER: "Before & after",
  RESULT: "Result",
  HOW_IT_WORKS: "How it works",
  GALLERY: "Gallery",
};

export default async function TreatmentImagesPage({
  params,
}: {
  params: { id: string };
}) {
  const treatment = await prisma.treatment.findUnique({
    where: { id: params.id },
    include: {
      images: { orderBy: [{ kind: "asc" }, { sortOrder: "asc" }] },
    },
  });

  if (!treatment) notFound();

  const addAction = async (formData: FormData) => {
    "use server";
    return addTreatmentImage(treatment.id, formData);
  };

  return (
    <>
      <div className="mb-4">
        <Link
          href={`/admin/treatments/${treatment.id}`}
          className="text-sm font-medium text-ink-muted hover:text-brand-700"
        >
          ← Back to {treatment.name}
        </Link>
      </div>

      <PageHeader
        title={`Images: ${treatment.name}`}
        description="Before/after, result and how-it-works images shown on the treatment page. The hero image is set on the main treatment form."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title={`Current images (${treatment.images.length})`}>
            {treatment.images.length === 0 ? (
              <p className="text-sm text-ink-muted">
                No images yet. Add before/after and result images with the form.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {treatment.images.map((img) => (
                  <div
                    key={img.id}
                    className="overflow-hidden rounded-xl border border-slate-200"
                  >
                    <div className="relative aspect-[4/3] bg-slate-50">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.url}
                        alt={img.caption ?? ""}
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
                        {KIND_LABEL[img.kind] ?? img.kind}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 p-3">
                      <span className="truncate text-xs text-ink-muted">
                        {img.caption || "No caption"}
                      </span>
                      <DeleteButton
                        confirmText="this image"
                        label="Remove"
                        action={async () => {
                          "use server";
                          return deleteTreatmentImage(img.id);
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div>
          <Card title="Add an image">
            <TreatmentImageForm action={addAction} />
          </Card>
        </div>
      </div>
    </>
  );
}
