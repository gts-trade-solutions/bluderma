import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { saveHubCategory } from "@/lib/actions/admin/catalogue";
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
  return { title: params.id === "new" ? "New category" : "Edit category" };
}

/** Keys of CATEGORY_ICONS in components/hub/icons.tsx. */
const ICONS = [
  "sparkles", "lift", "syringe", "droplet", "zap", "scissors", "sprout",
  "scan", "sun", "eye", "aperture", "hexagon", "activity", "crown", "user",
  "smile", "flask",
];

/** The gradients already in use, so a new category matches the set. */
const TINTS = [
  "from-brand-500 to-teal-400",
  "from-teal-400 to-emerald-400",
  "from-rose-400 to-orange-300",
  "from-violet-500 to-brand-400",
  "from-amber-400 to-rose-400",
  "from-sky-400 to-brand-500",
  "from-emerald-400 to-teal-500",
  "from-fuchsia-500 to-violet-400",
];

export default async function HubCategoryEditPage({
  params,
}: {
  params: { id: string };
}) {
  const isNew = params.id === "new";
  const row = isNew
    ? null
    : await prisma.hubCategory.findUnique({ where: { id: params.id } });

  if (!isNew && !row) notFound();

  const action = async (formData: FormData) => {
    "use server";
    return saveHubCategory(isNew ? null : params.id, formData);
  };

  return (
    <>
      <PageHeader
        title={isNew ? "New category" : `Edit ${row!.name}`}
        description="Shown on the explore hub and as the header of its own category page."
      />

      <EntityForm
        action={action}
        cancelHref="/admin/hub-categories"
        redirectTo="/admin/hub-categories"
        submitLabel={isNew ? "Create category" : "Save changes"}
      >
        <Card title="Identity">
          <div className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                label="Name"
                name="name"
                required
                defaultValue={row?.name ?? ""}
                placeholder="Glass Skin"
              />
              <TextField
                label="Slug"
                name="slug"
                required
                defaultValue={row?.slug ?? ""}
                placeholder="glass-skin"
                hint="The URL segment. Changing it breaks existing links."
              />
            </div>
            <div className="grid gap-5 sm:grid-cols-3">
              <SelectField
                label="Icon"
                name="icon"
                required
                defaultValue={row?.icon ?? "sparkles"}
                options={ICONS.map((i) => ({ value: i, label: i }))}
              />
              <SelectField
                label="Tint"
                name="tint"
                required
                defaultValue={row?.tint ?? TINTS[0]}
                options={TINTS.map((t) => ({ value: t, label: t.replace("from-", "").replace(" to-", " → ") }))}
                hint="Gradient behind the icon."
              />
              <TextField
                label="Sort order"
                name="sortOrder"
                type="number"
                min={0}
                defaultValue={row?.sortOrder ?? 0}
              />
            </div>
          </div>
        </Card>

        <Card title="Copy">
          <div className="space-y-5">
            <TextField
              label="Blurb"
              name="blurb"
              required
              defaultValue={row?.blurb ?? ""}
              hint="One line under the tile on the hub."
            />
            <TextArea
              label="Intro"
              name="intro"
              rows={3}
              required
              defaultValue={row?.intro ?? ""}
              hint="The longer paragraph at the top of the category page."
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
      </EntityForm>
    </>
  );
}
