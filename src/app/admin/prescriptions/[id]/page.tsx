import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { savePrescription } from "@/lib/actions/admin/records";
import EntityForm from "@/components/admin/EntityForm";
import ImageField from "@/components/admin/ImageField";
import {
  Card,
  PageHeader,
  SelectField,
  TextArea,
  TextField,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { id: string } }) {
  return { title: params.id === "new" ? "New prescription" : "Edit prescription" };
}

/** A date input wants YYYY-MM-DD; the column is a full timestamp. */
const dayValue = (d?: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function PrescriptionEditPage({
  params,
}: {
  params: { id: string };
}) {
  const isNew = params.id === "new";

  const [row, clients, doctors] = await Promise.all([
    isNew ? null : prisma.prescription.findUnique({ where: { id: params.id } }),
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
      take: 500,
    }),
    prisma.doctor.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!isNew && !row) notFound();

  const action = async (formData: FormData) => {
    "use server";
    return savePrescription(isNew ? null : params.id, formData);
  };

  return (
    <>
      <PageHeader
        title={isNew ? "New prescription" : "Edit prescription"}
        description="Shown to the client in My Profile → Prescriptions."
      />

      <EntityForm
        action={action}
        cancelHref="/admin/prescriptions"
        redirectTo="/admin/prescriptions"
        submitLabel={isNew ? "Create prescription" : "Save changes"}
      >
        <Card title="Who it's for">
          <div className="grid gap-5 sm:grid-cols-2">
            <SelectField
              label="Client"
              name="userId"
              required
              defaultValue={row?.userId ?? ""}
              options={clients.map((c) => ({
                value: c.id,
                label: c.name ? `${c.name}: ${c.email}` : c.email,
              }))}
            />
            <SelectField
              label="Issued by"
              name="doctorId"
              defaultValue={row?.doctorId ?? ""}
              options={[
                { value: "", label: "Not specified" },
                ...doctors.map((d) => ({ value: d.id, label: d.name })),
              ]}
            />
          </div>
        </Card>

        <Card title="Prescription">
          <div className="space-y-5">
            <TextField
              label="Title"
              name="title"
              required
              defaultValue={row?.title ?? ""}
              placeholder="Tretinoin 0.025%: nightly"
            />
            <TextArea
              label="Notes"
              name="notes"
              rows={4}
              defaultValue={row?.notes ?? ""}
              hint="Dosage, duration, cautions: whatever the client should see."
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                label="Issued on"
                name="issuedAt"
                type="date"
                defaultValue={dayValue(row?.issuedAt)}
                hint="Leave blank for today."
              />
              <ImageField
                label="Scanned prescription"
                name="fileUrl"
                folder="prescriptions"
                accept="image/*,application/pdf"
                defaultValue={row?.fileUrl}
                hint="Optional PDF or photo the client can download."
              />
            </div>
          </div>
        </Card>
      </EntityForm>
    </>
  );
}
