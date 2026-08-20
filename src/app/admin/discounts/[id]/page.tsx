import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { saveDiscountGrant } from "@/lib/actions/admin/records";
import EntityForm from "@/components/admin/EntityForm";
import {
  Card,
  CheckboxField,
  PageHeader,
  SelectField,
  TextField,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { id: string } }) {
  return { title: params.id === "new" ? "New discount" : "Edit discount" };
}

const dayValue = (d?: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function DiscountEditPage({
  params,
}: {
  params: { id: string };
}) {
  const isNew = params.id === "new";

  const [row, clients] = await Promise.all([
    isNew ? null : prisma.discountGrant.findUnique({ where: { id: params.id } }),
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
      take: 500,
    }),
  ]);

  if (!isNew && !row) notFound();

  const action = async (formData: FormData) => {
    "use server";
    return saveDiscountGrant(isNew ? null : params.id, formData);
  };

  return (
    <>
      <PageHeader
        title={isNew ? "New discount" : "Edit discount"}
        description="Redeemed discounts appear in My Profile → Discounts availed."
      />

      <EntityForm
        action={action}
        cancelHref="/admin/discounts"
        redirectTo="/admin/discounts"
        submitLabel={isNew ? "Create discount" : "Save changes"}
      >
        <Card title="Who it's for">
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
        </Card>

        <Card
          title="The offer"
          description="Set a percentage or a rupee amount. One of the two is required."
        >
          <div className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                label="Code"
                name="code"
                required
                defaultValue={row?.code ?? ""}
                placeholder="FIRSTSCAN"
              />
              <TextField
                label="Expires on"
                name="expiresAt"
                type="date"
                defaultValue={dayValue(row?.expiresAt)}
                hint="Blank never expires."
              />
            </div>
            <TextField
              label="Description"
              name="description"
              required
              defaultValue={row?.description ?? ""}
              placeholder="First skin scan free"
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                label="Percent off"
                name="percentOff"
                type="number"
                min={0}
                max={100}
                defaultValue={row?.percentOff ?? ""}
              />
              <TextField
                label="Amount off (₹)"
                name="amountOffInr"
                type="number"
                min={0}
                defaultValue={row?.amountOffInr ?? ""}
              />
            </div>
            <CheckboxField
              label="Already redeemed"
              name="markUsed"
              defaultChecked={!!row?.usedAt}
              hint="Ticking this stamps the redemption date and lists it in the client's profile."
            />
          </div>
        </Card>
      </EntityForm>
    </>
  );
}
