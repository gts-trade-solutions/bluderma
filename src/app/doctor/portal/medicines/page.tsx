import { MedicineOrderStatus } from "@prisma/client";

import { Empty, PageHead, Panel } from "@/components/doctor/portalUi";
import MedicineForm, {
  MedicineRow,
} from "@/components/doctor/MedicineForm";
import OrderRow from "@/components/doctor/OrderRow";
import { getOwnDoctor } from "@/lib/doctor/guard";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Medicines" };
export const dynamic = "force-dynamic";

const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const day = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/**
 * The practice's own dispensary, and orders against it.
 *
 * Deliberately NOT the injectables catalogue. Those 210 rows are botulinum
 * toxins, fillers and biostimulators: prescription-only consumables a
 * practitioner administers, whose prices that model marks internal-only. They
 * cannot be sold to a consumer and nothing here reaches them.
 *
 * This is what a doctor actually hands a patient after a consultation.
 */
export default async function MedicinesPage() {
  const owner = await getOwnDoctor();
  if (!owner) {
    return <Empty title="No practice linked" body="This account has no practice record yet." />;
  }

  const [medicines, orders] = await Promise.all([
    prisma.medicine.findMany({
      where: { doctorId: owner.doctorId, isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        brand: true,
        form: true,
        strength: true,
        priceInr: true,
        mrpInr: true,
        stock: true,
        prescriptionOnly: true,
      },
    }),
    prisma.medicineOrder.findMany({
      where: { doctorId: owner.doctorId },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 40,
      select: {
        id: true,
        publicId: true,
        status: true,
        totalInr: true,
        createdAt: true,
        deliverTo: true,
        phone: true,
        prescriptionUrl: true,
        user: { select: { name: true, publicId: true } },
        items: { select: { id: true, name: true, qty: true, priceInr: true } },
      },
    }),
  ]);

  const open = orders.filter(
    (o) =>
      o.status !== MedicineOrderStatus.DELIVERED &&
      o.status !== MedicineOrderStatus.CANCELLED
  ).length;

  return (
    <>
      <PageHead
        title="Medicines"
        sub="What you dispense, and what patients have ordered. Your own list, not the clinical consumables catalogue."
      />

      <div className="grid gap-4 lg:grid-cols-[24rem_minmax(0,1fr)]">
        <Panel title="Add a medicine"
          sub="What you dispense yourself"
          icon="rupee"
          accent="teal"
          index={0}
          note={
            <>What you hand a patient after a consultation.</>
          }>
          <div className="p-4 sm:p-5">
            <MedicineForm />
          </div>
        </Panel>

        <Panel
          title="Your list"
          sub={`${medicines.length} listed`}
          icon="clinic"
          accent="brand"
          index={1}
          note={
            <>Rx items ask the patient for their prescription at checkout.</>
          }
        >
          {medicines.length === 0 ? (
            <div className="p-5">
              <Empty
                title="Nothing listed yet"
                body="Add what you dispense and patients can order it after a consultation."
              />
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {medicines.map((m) => (
                <MedicineRow key={m.id} row={{ ...m }} />
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-4">
        <Panel
          title="Orders"
          sub={open > 0 ? `${open} to deal with` : `${orders.length} in total`}
          icon="inbox"
          accent="amber"
          index={2}
          note={
            <>Move each one along as you dispense and send it.</>
          }
        >
          {orders.length === 0 ? (
            <div className="p-5">
              <Empty title="No orders yet" body="Orders from your patients appear here." />
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {orders.map((o) => (
                <OrderRow
                  key={o.id}
                  id={o.id}
                  reference={o.publicId ?? o.id.slice(0, 8)}
                  status={o.status}
                  patient={o.user.name ?? "Client"}
                  patientId={o.user.publicId}
                  placed={day(o.createdAt)}
                  total={money(o.totalInr)}
                  deliverTo={o.deliverTo}
                  phone={o.phone}
                  prescriptionUrl={o.prescriptionUrl}
                  items={o.items.map((i) => `${i.qty} × ${i.name}`)}
                />
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
