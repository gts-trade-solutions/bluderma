import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { saveCategory } from "@/lib/actions/admin/catalog";
import EntityForm from "@/components/admin/EntityForm";
import ImageField from "@/components/admin/ImageField";
import {
  Card,
  CheckboxField,
  PageHeader,
  TextArea,
  TextField,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { id: string } }) {
  if (params.id === "new") return { title: "New category" };
  const c = await prisma.category.findUnique({
    where: { id: params.id },
    select: { name: true },
  });
  return { title: c ? `Edit ${c.name}` : "Category" };
}

export default async function CategoryEditPage({
  params,
}: {
  params: { id: string };
}) {
  const isNew = params.id === "new";
  const category = isNew
    ? null
    : await prisma.category.findUnique({ where: { id: params.id } });

  if (!isNew && !category) notFound();

  const action = async (formData: FormData) => {
    "use server";
    return saveCategory(isNew ? null : params.id, formData);
  };

  return (
    <>
      <PageHeader title={isNew ? "New category" : `Edit ${category!.name}`} />

      <EntityForm
        action={action}
        cancelHref="/admin/categories"
        redirectTo="/admin/categories"
        submitLabel={isNew ? "Create category" : "Save changes"}
      >
        <Card>
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              label="Name"
              name="name"
              required
              defaultValue={category?.name}
              placeholder="Injectables"
            />
            <TextField
              label="Slug"
              name="slug"
              required
              defaultValue={category?.slug}
              placeholder="injectables"
              hint="Used for the #cat- anchors on the hub page."
            />
          </div>

          <div className="mt-5 space-y-5">
            <TextArea
              label="Blurb"
              name="blurb"
              rows={2}
              defaultValue={category?.blurb ?? ""}
              hint="Shown on the category tile."
            />
            <ImageField
              label="Tile image"
              name="image"
              folder="categories"
              defaultValue={category?.image}
              hint="Falls back to the first treatment's image when empty."
            />
            <TextField
              label="Sort order"
              name="sortOrder"
              type="number"
              min={0}
              defaultValue={category?.sortOrder ?? 0}
            />
            <CheckboxField
              label="Active"
              name="isActive"
              hint="Hidden categories drop out of the menu and tiles."
              defaultChecked={category?.isActive ?? true}
            />
          </div>
        </Card>
      </EntityForm>
    </>
  );
}
