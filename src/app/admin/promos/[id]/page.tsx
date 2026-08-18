import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { saveHubPromo } from "@/lib/actions/admin/marketing";
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
  return { title: params.id === "new" ? "New promo" : "Edit promo" };
}

const dayValue = (d?: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function PromoEditPage({
  params,
}: {
  params: { id: string };
}) {
  const isNew = params.id === "new";
  const row = isNew
    ? null
    : await prisma.hubPromo.findUnique({ where: { id: params.id } });

  if (!isNew && !row) notFound();

  const action = async (formData: FormData) => {
    "use server";
    return saveHubPromo(isNew ? null : params.id, formData);
  };

  return (
    <>
      <PageHeader
        title={isNew ? "New promo" : `Edit ${row!.title}`}
        description="A slide in the trending carousel on the explore hub."
      />

      <EntityForm
        action={action}
        cancelHref="/admin/promos"
        redirectTo="/admin/promos"
        submitLabel={isNew ? "Create promo" : "Save changes"}
      >
        <Card title="The slide">
          <div className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                label="Eyebrow"
                name="eyebrow"
                required
                defaultValue={row?.eyebrow ?? ""}
                placeholder="THIS FORTNIGHT"
              />
              <TextField
                label="Slug"
                name="slug"
                required
                defaultValue={row?.slug ?? ""}
                placeholder="glow-fortnight"
              />
            </div>
            <TextField
              label="Title"
              name="title"
              required
              defaultValue={row?.title ?? ""}
            />
            <TextArea
              label="Body"
              name="body"
              rows={2}
              required
              defaultValue={row?.body ?? ""}
            />
            <ImageField
              label="Image"
              name="image"
              folder="promos"
              required
              defaultValue={row?.image}
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                label="Button label"
                name="cta"
                required
                defaultValue={row?.cta ?? ""}
                placeholder="See the offer"
              />
              <TextField
                label="Button link"
                name="href"
                required
                defaultValue={row?.href ?? ""}
                placeholder="/patient/explore#deals"
              />
            </div>
          </div>
        </Card>

        <Card
          title="When it runs"
          description="Leave both blank to run until you switch it off."
        >
          <div className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-3">
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
              <TextField
                label="Sort order"
                name="sortOrder"
                type="number"
                min={0}
                defaultValue={row?.sortOrder ?? 0}
              />
            </div>
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
