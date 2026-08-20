import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { savePurchase } from "@/lib/actions/admin/records";
import EntityForm from "@/components/admin/EntityForm";
import { Card, PageHeader, SelectField, TextField } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { id: string } }) {
  return { title: params.id === "new" ? "New purchase" : "Edit purchase" };
}

const dayValue = (d?: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function PurchaseEditPage({
  params,
}: {
  params: { id: string };
}) {
  const isNew = params.id === "new";

  const [row, clients] = await Promise.all([
    isNew ? null : prisma.purchase.findUnique({ where: { id: params.id } }),
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
    return savePurchase(isNew ? null : params.id, formData);
  };

  return (
    <>
      <PageHeader
        title={isNew ? "New purchase" : "Edit purchase"}
        description="Shown to the client in My Profile → Online purchases."
      />

      <EntityForm
        action={action}
        cancelHref="/admin/purchases"
        redirectTo="/admin/purchases"
        submitLabel={isNew ? "Create purchase" : "Save changes"}
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

        <Card title="Order">
          <div className="space-y-5">
            <TextField
              label="Item"
              name="itemName"
              required
              defaultValue={row?.itemName ?? ""}
              placeholder="Hydrating serum 30ml"
            />
            <div className="grid gap-5 sm:grid-cols-3">
              <TextField
                label="Quantity"
                name="quantity"
                type="number"
                min={1}
                defaultValue={row?.quantity ?? 1}
              />
              <TextField
                label="Amount paid (₹)"
                name="amountInr"
                type="number"
                min={0}
                defaultValue={row?.amountInr ?? ""}
                hint="What this client paid. Blank if not recorded."
              />
              <TextField
                label="Ordered on"
                name="orderedAt"
                type="date"
                defaultValue={dayValue(row?.orderedAt)}
                hint="Blank for today."
              />
            </div>
            <SelectField
              label="Status"
              name="status"
              required
              defaultValue={row?.status ?? "PLACED"}
              options={[
                { value: "PLACED", label: "Placed" },
                { value: "PROCESSING", label: "Processing" },
                { value: "SHIPPED", label: "Shipped" },
                { value: "DELIVERED", label: "Delivered" },
                { value: "CANCELLED", label: "Cancelled" },
              ]}
            />
          </div>
        </Card>
      </EntityForm>
    </>
  );
}
