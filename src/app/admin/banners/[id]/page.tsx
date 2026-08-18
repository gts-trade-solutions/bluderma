import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { saveBanner } from "@/lib/actions/admin/content";
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
  return { title: params.id === "new" ? "New banner" : "Edit banner" };
}

export default async function BannerEditPage({
  params,
}: {
  params: { id: string };
}) {
  const isNew = params.id === "new";
  const banner = isNew
    ? null
    : await prisma.banner.findUnique({ where: { id: params.id } });

  if (!isNew && !banner) notFound();

  const action = async (formData: FormData) => {
    "use server";
    return saveBanner(isNew ? null : params.id, formData);
  };

  return (
    <>
      <PageHeader
        title={isNew ? "New banner" : "Edit banner"}
        description="The home hero rotates through every active Home banner in sort order; other placements show only the first."
      />

      <EntityForm
        action={action}
        cancelHref="/admin/banners"
        redirectTo="/admin/banners"
        submitLabel={isNew ? "Create banner" : "Save changes"}
      >
        <Card title="Placement">
          <div className="grid gap-5 sm:grid-cols-2">
            <SelectField
              label="Where it appears"
              name="placement"
              required
              defaultValue={banner?.placement ?? "DOCTOR_HERO"}
              options={[
                { value: "HOME_HERO", label: "Home hero" },
                { value: "DOCTOR_HERO", label: "Clinical hub hero" },
                { value: "PATIENT_HERO", label: "Client hub hero" },
              ]}
            />
            <TextField
              label="Sort order"
              name="sortOrder"
              type="number"
              min={0}
              defaultValue={banner?.sortOrder ?? 0}
              hint="Lowest active number wins."
            />
          </div>
        </Card>

        <Card title="Media">
          <div className="space-y-5">
            <SelectField
              label="Media type"
              name="mediaType"
              required
              defaultValue={banner?.mediaType ?? "IMAGE"}
              options={[
                { value: "IMAGE", label: "Image" },
                { value: "VIDEO", label: "Video" },
              ]}
            />
            <ImageField
              label="Media URL (desktop)"
              name="mediaUrl"
              folder="banners"
              accept="image/*,video/mp4,video/webm"
              required
              defaultValue={banner?.mediaUrl}
              hint="For video, this is the MP4/WebM file. Tablet and mobile fall back to this when unset."
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <ImageField
                label="Tablet image"
                name="mediaUrlTablet"
                folder="banners"
                defaultValue={banner?.mediaUrlTablet}
                hint="Shown 768–1023px. Optional."
              />
              <ImageField
                label="Mobile image"
                name="mediaUrlMobile"
                folder="banners"
                defaultValue={banner?.mediaUrlMobile}
                hint="Shown below 768px. Optional."
              />
            </div>
            <ImageField
              label="Poster image"
              name="posterUrl"
              folder="banners"
              defaultValue={banner?.posterUrl}
              hint="Shown while a video loads. Ignored for image banners."
            />
          </div>
        </Card>

        <Card title="Copy" description="Leave blank to show media only.">
          <div className="space-y-5">
            <TextField
              label="Eyebrow"
              name="eyebrow"
              defaultValue={banner?.eyebrow ?? ""}
              placeholder="KNOW YOUR SKIN"
              hint="Small letterspaced line above the title."
            />
            <TextField
              label="Title"
              name="title"
              defaultValue={banner?.title ?? ""}
            />
            <TextField
              label="Title accent line"
              name="titleAccent"
              defaultValue={banner?.titleAccent ?? ""}
              placeholder="Unlock Its Potential."
              hint="Second line of the title, rendered in the brand gradient."
            />
            <TextArea
              label="Subtitle"
              name="subtitle"
              rows={2}
              defaultValue={banner?.subtitle ?? ""}
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                label="Button label"
                name="ctaLabel"
                defaultValue={banner?.ctaLabel ?? ""}
                placeholder="Explore treatments"
              />
              <TextField
                label="Button link"
                name="ctaHref"
                defaultValue={banner?.ctaHref ?? ""}
                placeholder="/patient/explore"
              />
            </div>
            <CheckboxField
              label="Active"
              name="isActive"
              defaultChecked={banner?.isActive ?? true}
            />
          </div>
        </Card>
      </EntityForm>
    </>
  );
}
