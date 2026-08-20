import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { saveProduct } from "@/lib/actions/admin/products";
import EntityForm from "@/components/admin/EntityForm";
import {
  Card,
  CheckboxField,
  PageHeader,
  TextArea,
  TextField,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { id: string } }) {
  if (params.id === "new") return { title: "New product" };
  const p = await prisma.product.findUnique({
    where: { id: params.id },
    select: { name: true },
  });
  return { title: p ? `Edit ${p.name}` : "Product" };
}

export default async function ProductEditPage({
  params,
}: {
  params: { id: string };
}) {
  const isNew = params.id === "new";

  const [product, treatments] = await Promise.all([
    isNew
      ? null
      : prisma.product.findUnique({
          where: { id: params.id },
          include: {
            variants: { orderBy: { sortOrder: "asc" } },
            bullets: { orderBy: [{ kind: "asc" }, { sortOrder: "asc" }] },
            images: { orderBy: { sortOrder: "asc" } },
            treatments: true,
          },
        }),
    prisma.treatment.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, slug: true, name: true },
    }),
  ]);

  if (!isNew && !product) notFound();

  const mapped = new Set(
    product?.treatments.map((t) => t.treatmentId) ?? []
  );
  const primaryTreatmentId = product?.treatments.find((t) => t.isPrimary)
    ?.treatmentId;
  const bulletsOf = (kind: string) =>
    (product?.bullets ?? [])
      .filter((b) => b.kind === kind)
      .map((b) => b.text)
      .join("\n");

  // Map primary treatment id → slug for the select's default.
  const primarySlug = treatments.find((t) => t.id === primaryTreatmentId)?.slug ?? "";

  const action = async (formData: FormData) => {
    "use server";
    return saveProduct(isNew ? null : params.id, formData);
  };

  return (
    <>
      <PageHeader
        title={isNew ? "New product" : `Edit ${product!.name}`}
        description={isNew ? undefined : `/products/${product!.slug}`}
      />

      <EntityForm
        action={action}
        cancelHref="/admin/products"
        redirectTo={isNew ? "/admin/products" : undefined}
        submitLabel={isNew ? "Create product" : "Save changes"}
      >
        <Card title="Basics">
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField label="Name" name="name" required defaultValue={product?.name} />
            <TextField
              label="Slug"
              name="slug"
              required
              defaultValue={product?.slug}
              hint="URL segment. Changing it breaks existing links."
            />
            <TextField
              label="Brand / manufacturer"
              name="brand"
              defaultValue={product?.brand ?? ""}
              placeholder="Hugel"
            />
            <TextField
              label="Category"
              name="category"
              required
              defaultValue={product?.category}
              placeholder="Botulinum Toxin"
            />
            <TextField
              label="Origin"
              name="origin"
              defaultValue={product?.origin ?? "Korea"}
            />
            <TextField
              label="Sort order"
              name="sortOrder"
              type="number"
              min={0}
              defaultValue={product?.sortOrder ?? 0}
            />
          </div>
          <div className="mt-5 space-y-5">
            <TextArea
              label="Tagline"
              name="tagline"
              rows={2}
              defaultValue={product?.tagline ?? ""}
            />
            <CheckboxField
              label="Published"
              name="isPublished"
              hint="Unpublished products are hidden from the site."
              defaultChecked={product?.isPublished ?? true}
            />
          </div>
        </Card>

        <Card
          title="Treatment mapping"
          description="Which treatments this product suits. It appears under each. The primary treatment lists it first."
        >
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {treatments.map((t) => (
              <label key={t.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="treatments"
                  value={t.slug}
                  defaultChecked={isNew ? false : mapped.has(t.id)}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-400"
                />
                <span className="text-ink-soft">{t.name}</span>
              </label>
            ))}
          </div>
          <div className="mt-5 max-w-xs">
            <label className="mb-1.5 block text-sm font-semibold text-ink">
              Primary treatment
            </label>
            <select
              name="primaryTreatment"
              defaultValue={primarySlug}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            >
              <option value="">First selected (default)</option>
              {treatments.map((t) => (
                <option key={t.id} value={t.slug}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </Card>

        <Card
          title="Options & images"
          description="Variants and images, one per line."
        >
          <div className="space-y-5">
            <TextArea
              label="Variants / unit sizes"
              name="variants"
              rows={4}
              hint="One per line, e.g. '100 unit', '200 unit', or 'Sub-Q', 'Deep', 'Fine'."
              defaultValue={product?.variants.map((v) => v.label).join("\n") ?? ""}
            />
            <TextArea
              label="Image URLs (up to 5)"
              name="images"
              rows={5}
              hint="One image URL per line. The first is the main image. Extra lines beyond 5 are ignored."
              defaultValue={product?.images.map((i) => i.url).join("\n") ?? ""}
            />
          </div>
        </Card>

        <Card title="Details" description="Web-researched product information.">
          <div className="space-y-5">
            <TextArea
              label="Description"
              name="description"
              rows={4}
              defaultValue={product?.description ?? ""}
            />
            <TextArea
              label="How it works"
              name="howItWorks"
              rows={3}
              defaultValue={product?.howItWorks ?? ""}
            />
            <div className="grid gap-5 sm:grid-cols-3">
              <TextArea
                label="Features"
                name="features"
                rows={5}
                hint="One per line."
                defaultValue={bulletsOf("FEATURE")}
              />
              <TextArea
                label="Benefits"
                name="benefits"
                rows={5}
                hint="One per line."
                defaultValue={bulletsOf("BENEFIT")}
              />
              <TextArea
                label="Indications"
                name="indications"
                rows={5}
                hint="One per line."
                defaultValue={bulletsOf("INDICATION")}
              />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <TextArea
                label="Composition"
                name="composition"
                rows={3}
                defaultValue={product?.composition ?? ""}
              />
              <TextArea
                label="Usage & handling"
                name="usageNotes"
                rows={3}
                defaultValue={product?.usageNotes ?? ""}
              />
            </div>
          </div>
        </Card>

        <Card
          title="Internal"
          description="Reference price is stored for staff only and is NEVER shown on the public site. The site is enquiry-to-order."
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              label="Reference price (₹, internal)"
              name="priceInr"
              type="number"
              min={0}
              defaultValue={product?.priceInr ?? ""}
            />
            <TextField
              label="Price note (internal)"
              name="priceNote"
              defaultValue={product?.priceNote ?? ""}
            />
          </div>
        </Card>
      </EntityForm>
    </>
  );
}
