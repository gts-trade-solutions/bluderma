import { notFound } from "next/navigation";
import { BulletKind } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { saveTreatment } from "@/lib/actions/admin/catalog";
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

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}) {
  if (params.id === "new") return { title: "New treatment" };
  const t = await prisma.treatment.findUnique({
    where: { id: params.id },
    select: { name: true },
  });
  return { title: t ? `Edit ${t.name}` : "Treatment" };
}

export default async function TreatmentEditPage({
  params,
}: {
  params: { id: string };
}) {
  const isNew = params.id === "new";

  const [treatment, categories] = await Promise.all([
    isNew
      ? null
      : prisma.treatment.findUnique({
          where: { id: params.id },
          include: {
            bullets: { orderBy: [{ kind: "asc" }, { sortOrder: "asc" }] },
          },
        }),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  if (!isNew && !treatment) notFound();

  if (categories.length === 0) {
    return (
      <>
        <PageHeader title="New treatment" />
        <Card>
          <p className="text-sm text-ink-soft">
            Create a category first — every treatment belongs to one.
          </p>
        </Card>
      </>
    );
  }

  /** Bullets are edited as one-per-line text, which is far quicker than a repeater. */
  const bulletText = (kind: BulletKind) =>
    (treatment?.bullets ?? [])
      .filter((b) => b.kind === kind)
      .map((b) => b.text)
      .join("\n");

  const action = async (formData: FormData) => {
    "use server";
    return saveTreatment(isNew ? null : params.id, formData);
  };

  return (
    <>
      <PageHeader
        title={isNew ? "New treatment" : `Edit ${treatment!.name}`}
        description={
          isNew
            ? "This becomes a public treatment page once published."
            : `/treatments/${treatment!.slug}`
        }
        action={
          isNew ? undefined : (
            <a
              href={`/admin/treatments/${params.id}/images`}
              className="btn-ghost"
            >
              Manage images
            </a>
          )
        }
      />

      <EntityForm
        action={action}
        cancelHref="/admin/treatments"
        redirectTo={isNew ? "/admin/treatments" : undefined}
        submitLabel={isNew ? "Create treatment" : "Save changes"}
      >
        <Card title="Basics">
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              label="Name"
              name="name"
              required
              defaultValue={treatment?.name}
              placeholder="Anti-wrinkle injections"
            />
            <TextField
              label="Slug"
              name="slug"
              required
              defaultValue={treatment?.slug}
              placeholder="botox"
              hint="The URL segment. Changing it breaks existing links."
            />
            <SelectField
              label="Category"
              name="categoryId"
              required
              defaultValue={treatment?.categoryId}
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
            />
            <TextField
              label="Sort order"
              name="sortOrder"
              type="number"
              min={0}
              defaultValue={treatment?.sortOrder ?? 0}
              hint="Lower numbers appear first."
            />
          </div>

          <div className="mt-5 space-y-5">
            <TextArea
              label="Tagline"
              name="tagline"
              required
              rows={2}
              defaultValue={treatment?.tagline}
            />
            <ImageField
              label="Hero image"
              name="image"
              required
              defaultValue={treatment?.image}
            />
            <TextArea
              label="Summary"
              name="summary"
              required
              defaultValue={treatment?.summary}
            />
            <CheckboxField
              label="Published"
              name="isPublished"
              hint="Unpublished treatments are hidden from the site and its menus."
              defaultChecked={treatment?.isPublished ?? true}
            />
          </div>
        </Card>

        <Card
          title="The concern"
          description="What the client comes in with."
        >
          <div className="space-y-5">
            <TextArea
              label="Concern"
              name="concern"
              required
              defaultValue={treatment?.concern}
            />
            <TextArea
              label="Concern points"
              name="concernPoints"
              rows={5}
              hint="One per line."
              defaultValue={bulletText(BulletKind.CONCERN_POINT)}
            />
          </div>
        </Card>

        <Card title="The solution" description="How the treatment works.">
          <div className="space-y-5">
            <TextArea
              label="How it works"
              name="howItWorks"
              required
              defaultValue={treatment?.howItWorks}
            />
            <TextArea
              label="Procedure steps"
              name="procedureSteps"
              rows={5}
              hint="One per line, in order — rendered as a numbered list."
              defaultValue={bulletText(BulletKind.PROCEDURE_STEP)}
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <TextArea
                label="Key benefits"
                name="benefits"
                rows={5}
                hint="One per line."
                defaultValue={bulletText(BulletKind.BENEFIT)}
              />
              <TextArea
                label="Ideal for"
                name="idealFor"
                rows={5}
                hint="One per line."
                defaultValue={bulletText(BulletKind.IDEAL_FOR)}
              />
            </div>
          </div>
        </Card>

        <Card
          title="Quick facts"
          description="The four-column strip under the hero."
        >
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <TextField
              label="Sessions"
              name="factSessions"
              required
              defaultValue={treatment?.factSessions}
              placeholder="1 session"
            />
            <TextField
              label="Downtime"
              name="factDowntime"
              required
              defaultValue={treatment?.factDowntime}
              placeholder="None"
            />
            <TextField
              label="Results"
              name="factResults"
              required
              defaultValue={treatment?.factResults}
              placeholder="3–5 days"
            />
            <TextField
              label="Lasts"
              name="factDuration"
              required
              defaultValue={treatment?.factDuration}
              placeholder="3–4 months"
            />
          </div>
        </Card>

        <Card
          title="Clinical note"
          description="Visible only to signed-in clinicians and admins. Fetched separately so it never reaches the public page."
        >
          <TextArea
            label="Clinical note"
            name="clinicalNote"
            required
            defaultValue={treatment?.clinicalNote}
          />
        </Card>

        <Card
          title="Matched solution"
          description="The orderable product shown in the enquiry sidebar."
        >
          <div className="space-y-5">
            <TextField
              label="Product name"
              name="productName"
              required
              defaultValue={treatment?.productName}
            />
            <TextArea
              label="Product descriptor"
              name="productDescriptor"
              required
              rows={2}
              defaultValue={treatment?.productDescriptor}
            />
          </div>
        </Card>

        <Card title="SEO" description="Falls back to the name and summary.">
          <div className="space-y-5">
            <TextField
              label="SEO title"
              name="seoTitle"
              defaultValue={treatment?.seoTitle ?? ""}
            />
            <TextArea
              label="SEO description"
              name="seoDescription"
              rows={2}
              defaultValue={treatment?.seoDescription ?? ""}
            />
          </div>
        </Card>
      </EntityForm>
    </>
  );
}
