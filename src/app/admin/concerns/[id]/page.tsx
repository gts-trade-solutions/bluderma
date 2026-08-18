import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { saveHubConcern } from "@/lib/actions/admin/marketing";
import EntityForm from "@/components/admin/EntityForm";
import ImageField from "@/components/admin/ImageField";
import {
  Card,
  CheckboxField,
  PageHeader,
  SelectField,
  TextField,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { id: string } }) {
  return { title: params.id === "new" ? "New concern" : "Edit concern" };
}

export default async function ConcernEditPage({
  params,
}: {
  params: { id: string };
}) {
  const isNew = params.id === "new";

  const [row, categories] = await Promise.all([
    isNew ? null : prisma.hubConcern.findUnique({ where: { id: params.id } }),
    prisma.hubCategory.findMany({
      orderBy: { sortOrder: "asc" },
      select: { slug: true, name: true },
    }),
  ]);

  if (!isNew && !row) notFound();

  const action = async (formData: FormData) => {
    "use server";
    return saveHubConcern(isNew ? null : params.id, formData);
  };

  return (
    <>
      <PageHeader
        title={isNew ? "New concern" : `Edit ${row!.label}`}
        description="A tile on the hub that takes a client from the problem to what treats it."
      />

      <EntityForm
        action={action}
        cancelHref="/admin/concerns"
        redirectTo="/admin/concerns"
        submitLabel={isNew ? "Create concern" : "Save changes"}
      >
        <Card title="The tile">
          <div className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                label="Label"
                name="label"
                required
                defaultValue={row?.label ?? ""}
                placeholder="Acne that keeps coming back"
              />
              <TextField
                label="Slug"
                name="slug"
                required
                defaultValue={row?.slug ?? ""}
                placeholder="persistent-acne"
              />
            </div>
            <TextField
              label="Hint"
              name="hint"
              required
              defaultValue={row?.hint ?? ""}
              hint="The one line under the label."
            />
            <ImageField
              label="Image"
              name="image"
              folder="concerns"
              required
              defaultValue={row?.image}
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <SelectField
                label="Opens category"
                name="category"
                required
                defaultValue={row?.category ?? ""}
                options={categories.map((c) => ({
                  value: c.slug,
                  label: c.name,
                }))}
              />
              <TextField
                label="Sort order"
                name="sortOrder"
                type="number"
                min={0}
                defaultValue={row?.sortOrder ?? 0}
              />
            </div>
            <CheckboxField
              label="Live on the hub"
              name="isActive"
              defaultChecked={row?.isActive ?? true}
            />
          </div>
        </Card>
      </EntityForm>
    </>
  );
}
