import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { saveFaq } from "@/lib/actions/admin/content";
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
  return { title: params.id === "new" ? "New FAQ" : "Edit FAQ" };
}

export default async function FaqEditPage({
  params,
}: {
  params: { id: string };
}) {
  const isNew = params.id === "new";
  const faq = isNew ? null : await prisma.faq.findUnique({ where: { id: params.id } });

  if (!isNew && !faq) notFound();

  const action = async (formData: FormData) => {
    "use server";
    return saveFaq(isNew ? null : params.id, formData);
  };

  return (
    <>
      <PageHeader title={isNew ? "New FAQ" : "Edit FAQ"} />

      <EntityForm
        action={action}
        cancelHref="/admin/faqs"
        redirectTo="/admin/faqs"
        submitLabel={isNew ? "Create FAQ" : "Save changes"}
      >
        <Card>
          <div className="space-y-5">
            <TextArea
              label="Question"
              name="question"
              required
              rows={2}
              defaultValue={faq?.question}
            />
            <TextArea
              label="Answer"
              name="answer"
              required
              rows={5}
              defaultValue={faq?.answer}
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                label="Category"
                name="category"
                defaultValue={faq?.category ?? ""}
                placeholder="Booking"
                hint="Optional grouping label."
              />
              <TextField
                label="Sort order"
                name="sortOrder"
                type="number"
                min={0}
                defaultValue={faq?.sortOrder ?? 0}
              />
            </div>
            <CheckboxField
              label="Published"
              name="isPublished"
              defaultChecked={faq?.isPublished ?? true}
            />
          </div>
        </Card>
      </EntityForm>
    </>
  );
}
