import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { saveHubTreatment } from "@/lib/actions/admin/catalogue";
import EntityForm from "@/components/admin/EntityForm";
import ImageField from "@/components/admin/ImageField";
import {
  Card,
  CheckboxField,
  PageHeader,
  SelectField,
  TextArea,
  TextField,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { id: string } }) {
  return { title: params.id === "new" ? "New treatment" : "Edit treatment" };
}

export default async function HubTreatmentEditPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { category?: string };
}) {
  const isNew = params.id === "new";

  const [row, categories] = await Promise.all([
    isNew ? null : prisma.hubTreatment.findUnique({ where: { id: params.id } }),
    prisma.hubCategory.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!isNew && !row) notFound();

  const action = async (formData: FormData) => {
    "use server";
    return saveHubTreatment(isNew ? null : params.id, formData);
  };

  return (
    <>
      <PageHeader
        title={isNew ? "New treatment" : `Edit ${row!.name}`}
        description="Its page renders the category protocol, edit that under Hub categories."
      />

      <EntityForm
        action={action}
        cancelHref="/admin/hub-treatments"
        redirectTo="/admin/hub-treatments"
        submitLabel={isNew ? "Create treatment" : "Save changes"}
      >
        <Card title="Identity">
          <div className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <SelectField
                label="Category"
                name="categoryId"
                required
                defaultValue={row?.categoryId ?? searchParams?.category ?? ""}
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
              />
              <TextField
                label="Sort order"
                name="sortOrder"
                type="number"
                min={0}
                defaultValue={row?.sortOrder ?? 0}
              />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                label="Name"
                name="name"
                required
                defaultValue={row?.name ?? ""}
                placeholder="Skin Boosters"
              />
              <TextField
                label="Slug"
                name="slug"
                required
                defaultValue={row?.slug ?? ""}
                placeholder="skin-boosters"
                hint="Unique within its category. Changing it breaks existing links."
              />
            </div>
          </div>
        </Card>

        <Card title="Copy">
          <div className="space-y-5">
            <TextArea
              label="Blurb"
              name="blurb"
              rows={2}
              required
              defaultValue={row?.blurb ?? ""}
              hint="The line under the name on cards and at the top of its page."
            />
            <TextField
              label="Meta"
              name="meta"
              defaultValue={row?.meta ?? ""}
              placeholder="3 sessions · no downtime"
              hint="Session or downtime note. Never a price: the catalogue is price-free."
            />
            <ImageField
              label="Image"
              name="image"
              folder="hub"
              required
              defaultValue={row?.image}
            />
            <CheckboxField
              label="Live on the hub"
              name="isActive"
              defaultChecked={row?.isActive ?? true}
            />
          </div>
        </Card>

        <Card title="Before & after">
          <div className="grid gap-5 sm:grid-cols-2">
            <ImageField
              label="Before image"
              name="beforeImage"
              folder={`hub/${row?.categoryId ?? searchParams?.category ?? "new"}/before-after`}
              defaultValue={row?.beforeImage}
              hint="Use a consented client image or a clearly illustrative comparison."
            />
            <ImageField
              label="After image"
              name="afterImage"
              folder={`hub/${row?.categoryId ?? searchParams?.category ?? "new"}/before-after`}
              defaultValue={row?.afterImage}
              hint="Match the subject, crop, pose, lighting, and camera angle."
            />
          </div>
        </Card>
      </EntityForm>
    </>
  );
}
