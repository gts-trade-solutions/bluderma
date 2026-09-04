import { MedicineOrderStatus } from "@prisma/client";

import Link from "next/link";

import {
  Empty,
  PageHead,
  Panel,
  RxMark,
  portalBtnQuiet,
} from "@/components/doctor/portalUi";
import { MedicineRow } from "@/components/doctor/MedicineForm";
import PrescriptionHistory, {
  parseWindow,
  windowStart,
  type PrescriptionRow,
} from "@/components/doctor/PrescriptionHistory";
import OrderRow from "@/components/doctor/OrderRow";
import { getOwnDoctor } from "@/lib/doctor/guard";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Prescriptions" };
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
 *
 * ── What moved out, and why ──────────────────────────────────────────────
 * Adding stock, counting the shelf and booking in a delivery used to happen
 * on this screen. They are a different job: a doctor prescribes during a
 * consultation, and somebody counts the shelf on a Friday afternoon — often
 * not the same person, never at the same moment. Folding the second into the
 * first meant it had no home and did not get done, and a stock figure nobody
 * maintains is worse than none, because the order flow refuses orders against
 * it.
 *
 * So it lives at /doctor/portal/inventory now. This screen is what you give a
 * patient; that one is what you have.
 */
export default async function MedicinesPage({
  searchParams,
}: {
  searchParams?: { since?: string };
}) {
  const owner = await getOwnDoctor();
  if (!owner) {
    return <Empty title="No practice linked" body="This account has no practice record yet." />;
  }

  const since = parseWindow(searchParams?.since);
  const from = windowStart(since);

  const [medicines, orders, written] = await Promise.all([
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
        lowStockAt: true,
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

    /* ── What this practice has actually prescribed ──────────────────
       Scoped to this doctor, which is both the point and the boundary: a
       prescription written at another clinic is that clinician's record and
       does not appear here.

       The medicine relation is joined for one field — the price — so a line
       picked off the practice's own shelf can be valued. `take` is a
       guardrail rather than paging: a year of prescribing is a few hundred
       rows, and the window control above is how somebody narrows it. */
    prisma.prescription.findMany({
      where: {
        doctorId: owner.doctorId,
        ...(from ? { issuedAt: { gte: from } } : {}),
      },
      orderBy: { issuedAt: "desc" },
      take: 200,
      select: {
        id: true,
        title: true,
        notes: true,
        issuedAt: true,
        userId: true,
        user: { select: { name: true, publicId: true } },
        items: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            name: true,
            strength: true,
            form: true,
            dose: true,
            duration: true,
            medicine: { select: { priceInr: true } },
          },
        },
      },
    }),
  ]);

  // Everything ever written, so an empty window can say what lies outside it.
  const writtenAllTime = await prisma.prescription.count({
    where: { doctorId: owner.doctorId },
  });

  const prescriptions: PrescriptionRow[] = written.map((w) => ({
    id: w.id,
    title: w.title,
    notes: w.notes,
    issuedAt: w.issuedAt,
    patientName: w.user?.name ?? "Client",
    patientPublicId: w.user?.publicId ?? null,
    patientUserId: w.userId,
    items: w.items.map((i) => ({
      id: i.id,
      name: i.name,
      strength: i.strength,
      form: i.form,
      dose: i.dose,
      duration: i.duration,
      // Null means freehand or delisted, and is priced at nothing on purpose.
      priceInr: i.medicine?.priceInr ?? null,
    })),
  }));

  const open = orders.filter(
    (o) =>
      o.status !== MedicineOrderStatus.DELIVERED &&
      o.status !== MedicineOrderStatus.CANCELLED
  ).length;

  return (
    <>
      <PageHead
        title={
          <>
            <RxMark /> Prescriptions
          </>
        }
        sub="What you prescribe, and what patients have ordered against it. Write a prescription from a booking in Today or Calendar; this is the list it draws on."
        action={
          <Link href="/doctor/portal/inventory" className={portalBtnQuiet}>
            My inventory
          </Link>
        }
      />

      {/* ── What has been written, and what it is worth ────────────────
          First on the page now. The dispensary and the order list are both
          about stock; this is the clinical record, and it is what a doctor
          opens this screen to read. */}
      <div id="written" className="mb-5 scroll-mt-24">
        <Panel
          title="Prescriptions you have written"
          sub="By patient, newest first"
          icon="rx"
          accent="brand"
          index={0}
          note={
            <>
              Every line picked off your own shelf carries its price, so a
              prescription has a value: what it comes to if the patient fills
              it here. That is what could be earned, not what has been —
              orders actually placed are in the panel below.
            </>
          }
        >
          <PrescriptionHistory
            rows={prescriptions}
            active={since}
            olderCount={Math.max(0, writtenAllTime - prescriptions.length)}
          />
        </Panel>
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Panel
          title="What you prescribe"
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
                body="Add what you dispense in My inventory, and it becomes something you can prescribe in one tap and patients can reorder from you."
                action={
                  <Link href="/doctor/portal/inventory" className={portalBtnQuiet}>
                    Open my inventory
                  </Link>
                }
              />
            </div>
          ) : (
            <ul className="divide-y divide-graphite-100">
              {medicines.map((m) => (
                <MedicineRow key={m.id} row={{ ...m }} />
              ))}
            </ul>
          )}
        </Panel>

        {/* Where a prescription is actually written, said plainly. It happens
            inside an appointment — which is correct, because a prescription
            has to be against a visit — and nothing on this page said so, so
            the screen read as a list with no verb. */}
        <Panel
          title="How to write one"
          sub="It happens against a booking"
          icon="sheet"
          accent="violet"
          index={2}
          note={<>A prescription is always tied to a visit you actually had.</>}
        >
          <div className="p-4 sm:p-5">
            <ol className="space-y-3">
              {[
                {
                  n: 1,
                  t: "Open the booking",
                  b: "From Today or the Calendar, tap the appointment.",
                },
                {
                  n: 2,
                  t: "Issue a prescription",
                  b: "Near the foot of the panel. Give it a heading — what the course is for.",
                },
                {
                  n: 3,
                  t: "Pick off your list",
                  b: "Anything you stock fills in its own strength and form, and warns you if you have run out. Anything else you type.",
                },
                {
                  n: 4,
                  t: "It reaches them",
                  b: "Filed to their record, readable in their profile, and reorderable from you where you stock it.",
                },
              ].map((s) => (
                <li key={s.n} className="flex gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-graphite-100 text-[11px] font-black text-graphite-800">
                    {s.n}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-graphite-900">{s.t}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-graphite-500">
                      {s.b}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/doctor/portal/today" className={portalBtnQuiet}>
                Today
              </Link>
              <Link href="/doctor/portal/calendar" className={portalBtnQuiet}>
                Calendar
              </Link>
            </div>
          </div>
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
            <>Dispensing one takes it off your shelf automatically.</>
          }
        >
          {orders.length === 0 ? (
            <div className="p-5">
              <Empty title="No orders yet" body="Orders from your patients appear here." />
            </div>
          ) : (
            <ul className="divide-y divide-graphite-100">
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
