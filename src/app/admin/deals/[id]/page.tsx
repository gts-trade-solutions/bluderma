import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { saveHubDeal } from "@/lib/actions/admin/marketing";
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
  return { title: params.id === "new" ? "New deal" : "Edit deal" };
}

const dayValue = (d?: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function DealEditPage({
  params,
}: {
  params: { id: string };
}) {
  const isNew = params.id === "new";

  const [row, categories] = await Promise.all([
    isNew ? null : prisma.hubDeal.findUnique({ where: { id: params.id } }),
    prisma.hubCategory.findMany({
      orderBy: { sortOrder: "asc" },
      select: { slug: true, name: true },
    }),
  ]);

  if (!isNew && !row) notFound();

  const action = async (formData: FormData) => {
    "use server";
    return saveHubDeal(isNew ? null : params.id, formData);
  };

  return (
    <>
      <PageHeader
        title={isNew ? "New deal" : `Edit ${row!.title}`}
        description="Shown on the explore hub. A percentage only — the catalogue never shows rupee prices."
      />

      <EntityForm
        action={action}
        cancelHref="/admin/deals"
        redirectTo="/admin/deals"
        submitLabel={isNew ? "Create deal" : "Save changes"}
      >
        <Card title="The offer">
          <div className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                label="Title"
                name="title"
                required
                defaultValue={row?.title ?? ""}
                placeholder="Glass Skin Fortnight"
              />
              <TextField
                label="Slug"
                name="slug"
                required
                defaultValue={row?.slug ?? ""}
                placeholder="glass-skin-fortnight"
              />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                label="Treatment"
                name="treatment"
                required
                defaultValue={row?.treatment ?? ""}
                placeholder="Skin Boosters"
              />
              <TextField
                label="What's included"
                name="perk"
                required
                defaultValue={row?.perk ?? ""}
                placeholder="Free follow-up + take-home kit"
              />
            </div>
            <div className="grid gap-5 sm:grid-cols-3">
              <TextField
                label="Discount (%)"
                name="discount"
                type="number"
                min={1}
                max={90}
                required
                defaultValue={row?.discount ?? 20}
              />
              <TextField
                label="Claimed count"
                name="claimed"
                type="number"
                min={0}
                defaultValue={row?.claimed ?? 0}
                hint="Social proof shown on the card."
              />
              <TextField
                label="Urgency line"
                name="endsIn"
                required
                defaultValue={row?.endsIn ?? ""}
                placeholder="Ends in 6 days"
              />
            </div>
          </div>
        </Card>

        <Card title="Where it sits">
          <div className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <SelectField
                label="Category"
                name="categorySlug"
                required
                defaultValue={row?.categorySlug ?? ""}
                options={categories.map((c) => ({
                  value: c.slug,
                  label: c.name,
                }))}
              />
              <TextField
                label="Category label"
                name="categoryLabel"
                required
                defaultValue={row?.categoryLabel ?? ""}
                hint="Shown on the card — usually the category name."
              />
            </div>
            <ImageField
              label="Image"
              name="image"
              folder="deals"
              required
              defaultValue={row?.image}
            />
            <TextField
              label="Sort order"
              name="sortOrder"
              type="number"
              min={0}
              defaultValue={row?.sortOrder ?? 0}
            />
          </div>
        </Card>

        <Card
          title="When it runs"
          description="Leave both blank to run until you switch it off."
        >
          <div className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                label="Starts"
                name="startsAt"
                type="date"
                defaultValue={dayValue(row?.startsAt)}
              />
              <TextField
                label="Ends"
                name="endsAt"
                type="date"
                defaultValue={dayValue(row?.endsAt)}
              />
            </div>
            <CheckboxField
              label="Hot deal (prominent rail)"
              name="isHot"
              defaultChecked={row?.isHot ?? false}
            />
            <CheckboxField
              label="Active"
              name="isActive"
              defaultChecked={row?.isActive ?? true}
            />
          </div>
        </Card>
      </EntityForm>
    </>
  );
}
