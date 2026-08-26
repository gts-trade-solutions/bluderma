import Link from "next/link";
import { StockMoveReason } from "@prisma/client";

import { Empty, PageHead, Panel, portalBtnQuiet } from "@/components/doctor/portalUi";
import MedicineForm, { MedicineRow } from "@/components/doctor/MedicineForm";
import { getOwnDoctor } from "@/lib/doctor/guard";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "My inventory" };
export const dynamic = "force-dynamic";

const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const when = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) +
  " " +
  d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

/**
 * What is on the shelf.
 *
 * ── Why this is its own screen ───────────────────────────────────────────
 * Stock lived inside Prescriptions, which conflated two jobs a practice does
 * at different times, for different reasons, often by different people. A
 * doctor prescribes during a consultation. Somebody counts the shelf on a
 * Friday afternoon, books in a delivery, writes off an expired tube. Putting
 * the second inside the first meant the counting job had no home and never
 * got done — and a stock figure nobody maintains is worse than none, because
 * the order flow refuses orders against it.
 *
 * So: Prescriptions is what you give a patient. This is what you have.
 *
 * ── What is worth looking at first ───────────────────────────────────────
 * The list is ordered by urgency rather than alphabetically — out of stock,
 * then running low, then everything else. A dispensary screen that opens on
 * "Acnelak" when three things ran out this morning is sorted for the database
 * rather than for the person reading it.
 */

const REASON_LABEL: Record<StockMoveReason, string> = {
  RECEIVED: "Delivery received",
  DISPENSED: "Dispensed in clinic",
  ORDER: "Online order",
  ORDER_CANCELLED: "Order cancelled",
  CORRECTION: "Counted and corrected",
  EXPIRED: "Expired",
  DAMAGED: "Damaged or lost",
};

export default async function InventoryPage() {
  const owner = await getOwnDoctor();
  if (!owner) {
    return <Empty title="No practice linked" body="This account has no practice record yet." />;
  }

  const [medicines, movements] = await Promise.all([
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
    // The ledger. Every change to every count, newest first — this is the
    // half that makes the number trustworthy: a doctor who finds 8 where they
    // expected 12 can see which four went and when.
    prisma.stockMovement.findMany({
      where: { medicine: { doctorId: owner.doctorId } },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        delta: true,
        balance: true,
        reason: true,
        note: true,
        createdAt: true,
        medicine: { select: { name: true } },
      },
    }),
  ]);

  const tracked = medicines.filter((m) => m.stock !== null);
  const out = tracked.filter((m) => m.stock === 0);
  const low = tracked.filter(
    (m) => m.stock !== null && m.stock > 0 && m.lowStockAt !== null && m.stock <= m.lowStockAt
  );

  // Urgency first. See the note at the top.
  const rank = (m: (typeof medicines)[number]) =>
    m.stock === 0 ? 0 : low.some((x) => x.id === m.id) ? 1 : m.stock === null ? 3 : 2;
  const ordered = [...medicines].sort(
    (a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name)
  );

  // What the shelf is worth at what it sells for. A rough figure and labelled
  // as one: it counts only what is actually tracked.
  const shelfValue = tracked.reduce((n, m) => n + (m.stock ?? 0) * m.priceInr, 0);

  return (
    <>
      <PageHead
        title="My inventory"
        sub="What you hold, what is running out, and every change to the count. Separate from Prescriptions, which is what you give a patient."
        action={
          <Link href="/doctor/portal/medicines" className={portalBtnQuiet}>
            Prescriptions
          </Link>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        <Tile label="Items listed" value={String(medicines.length)} tone="brand" />
        <Tile
          label="Out of stock"
          value={String(out.length)}
          tone={out.length ? "rose" : "teal"}
          hint={out.length ? "Patients cannot order these." : "Nothing has run out."}
        />
        <Tile
          label="Running low"
          value={String(low.length)}
          tone={low.length ? "amber" : "teal"}
          hint="At or below the level you set."
        />
        <Tile
          label="Shelf value"
          value={money(shelfValue)}
          tone="violet"
          hint="At your selling price, across the items you count."
        />
      </div>

      {(out.length > 0 || low.length > 0) && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-900">
            {out.length > 0
              ? `${out.length} ${out.length === 1 ? "item has" : "items have"} run out`
              : `${low.length} ${low.length === 1 ? "item is" : "items are"} running low`}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-amber-800">
            {[...out, ...low].map((m) => m.name).join(", ")}.{" "}
            {out.length > 0 &&
              "A patient cannot order anything at zero, and prescribing it will warn you. "}
            Book a delivery in from the Stock button on the row.
          </p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[24rem_minmax(0,1fr)]">
        <Panel
          title="Add to your list"
          sub="Something new you stock"
          icon="rx"
          accent="teal"
          index={0}
          note={<>Set a warn-at level and the list flags it before it runs out.</>}
        >
          <div className="p-4 sm:p-5">
            <MedicineForm />
          </div>
        </Panel>

        <Panel
          title="On the shelf"
          sub={`${medicines.length} listed`}
          icon="clinic"
          accent="brand"
          index={1}
          note={<>Anything short is at the top. Press Stock to record a change.</>}
        >
          {medicines.length === 0 ? (
            <div className="p-5">
              <Empty
                title="Nothing listed yet"
                body="Add what you keep in the clinic. Once it is here you can prescribe from it, patients can reorder it, and the count keeps itself up to date."
              />
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {ordered.map((m) => (
                <MedicineRow key={m.id} row={{ ...m }} />
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-4">
        <Panel
          title="Every change"
          sub={movements.length ? `last ${movements.length}` : "nothing yet"}
          icon="today"
          accent="slate"
          index={2}
          note={
            <>
              Written automatically for orders, and by you for everything else.
            </>
          }
        >
          {movements.length === 0 ? (
            <div className="p-5">
              <Empty
                title="No movements yet"
                body="Every delivery, dispense, order and correction is recorded here with who did it and when."
              />
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {movements.map((mv) => (
                <li
                  key={mv.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {mv.medicine.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {REASON_LABEL[mv.reason]} · {when(mv.createdAt)}
                      {mv.note ? ` · ${mv.note}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={`text-sm font-bold tabular-nums ${
                        mv.delta > 0 ? "text-teal-700" : "text-rose-600"
                      }`}
                    >
                      {mv.delta > 0 ? "+" : ""}
                      {mv.delta}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      left {mv.balance}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}

function Tile({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone: "brand" | "teal" | "amber" | "violet" | "rose";
  hint?: string;
}) {
  // Full literal strings: Tailwind scans source text, so an interpolated class
  // compiles to nothing and the colour silently goes missing.
  const bar = {
    brand: "border-brand-500",
    teal: "border-teal-500",
    amber: "border-amber-500",
    violet: "border-violet-500",
    rose: "border-rose-500",
  }[tone];

  return (
    <div
      className={`rounded-2xl border-t-[3px] bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_12px_32px_-24px_rgba(15,23,42,0.35)] ring-1 ring-slate-200/80 sm:p-4 ${bar}`}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400 sm:text-[11px]">
        {label}
      </p>
      <p className="mt-1 font-display text-[20px] font-extrabold leading-none tracking-[-0.03em] tabular-nums text-slate-900 sm:text-[26px]">
        {value}
      </p>
      {hint && <p className="mt-1.5 text-[11px] leading-snug text-slate-500">{hint}</p>}
    </div>
  );
}
