import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { saveTestimonial } from "@/lib/actions/admin/content";
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
  return { title: params.id === "new" ? "New testimonial" : "Edit testimonial" };
}

export default async function TestimonialEditPage({
  params,
}: {
  params: { id: string };
}) {
  const isNew = params.id === "new";

  const [testimonial, treatments] = await Promise.all([
    isNew
      ? null
      : prisma.testimonial.findUnique({ where: { id: params.id } }),
    prisma.treatment.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!isNew && !testimonial) notFound();

  const action = async (formData: FormData) => {
    "use server";
    return saveTestimonial(isNew ? null : params.id, formData);
  };

  return (
    <>
      <PageHeader title={isNew ? "New testimonial" : "Edit testimonial"} />

      <EntityForm
        action={action}
        cancelHref="/admin/testimonials"
        redirectTo="/admin/testimonials"
        submitLabel={isNew ? "Create testimonial" : "Save changes"}
      >
        <Card>
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              label="Author name"
              name="authorName"
              required
              defaultValue={testimonial?.authorName}
              placeholder="Ananya R."
            />
            <TextField
              label="Author role or city"
              name="authorRole"
              defaultValue={testimonial?.authorRole ?? ""}
              placeholder="Mumbai"
            />
          </div>

          <div className="mt-5 space-y-5">
            <TextArea
              label="Quote"
              name="quote"
              required
              defaultValue={testimonial?.quote}
            />
            <ImageField
              label="Avatar"
              name="avatarUrl"
              folder="testimonials"
              defaultValue={testimonial?.avatarUrl}
            />

            <div className="grid gap-5 sm:grid-cols-3">
              <TextField
                label="Rating"
                name="rating"
                type="number"
                min={1}
                max={5}
                defaultValue={testimonial?.rating ?? 5}
              />
              <SelectField
                label="Related treatment"
                name="treatmentId"
                defaultValue={testimonial?.treatmentId ?? ""}
                options={[
                  { value: "", label: "None" },
                  ...treatments.map((t) => ({ value: t.id, label: t.name })),
                ]}
              />
              <TextField
                label="Sort order"
                name="sortOrder"
                type="number"
                min={0}
                defaultValue={testimonial?.sortOrder ?? 0}
              />
            </div>

            <CheckboxField
              label="Published"
              name="isPublished"
              defaultChecked={testimonial?.isPublished ?? true}
            />
          </div>
        </Card>
      </EntityForm>
    </>
  );
}
