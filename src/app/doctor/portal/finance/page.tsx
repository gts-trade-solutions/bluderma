import { AppointmentStatus, ApprovalState, MedicineOrderStatus } from "@prisma/client";

import { Empty, PageHead, Panel } from "@/components/doctor/portalUi";
import {
  AssetForm,
  ExpenseForm,
  ExpenseRowItem,
  IncomeForm,
  IncomeRowItem,
  type ClinicOption,
} from "@/components/doctor/FinanceForms";
import MachineCard from "@/components/doctor/MachineCard";
import { getOwnDoctor } from "@/lib/doctor/guard";
import { prisma } from "@/lib/prisma";
import ClinicPerformance from "@/components/doctor/ClinicPerformance";
import {
  MACHINE_TIERS,
  categoryLabel,
  clinicPerformanceFor,
  machineStatus,
  netFor,
  recoveryFor,
  revenueFor,
} from "@/lib/doctor/financeCore";

export const metadata = { title: "Money" };
export const dynamic = "force-dynamic";

const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const day = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const pct = (n: number) => `${Math.round(n * 100)}%`;

/**
 * What the practice earned, what it spent, and how its machines are doing.
 *
 * ── Two figures, kept apart on purpose ───────────────────────────────────
 * Net is revenue minus RUNNING costs. A machine purchase is not in it.
 * Subtracting a ₹5,00,000 laser from one month would show a catastrophic
 * month for something that earns out over years, so capital is tracked
 * separately as a thing being recovered, which is the question a practitioner
 * actually has about it. Both figures are labelled as what they are.
 *
 * ── Revenue is four streams, not one ─────────────────────────────────────
 * It used to be appointments alone, while three other streams sat fully
 * recorded in the database and were never added up. That made the net figure
 * wrong in a particularly unhelpful direction: costs were complete, revenue
 * was a quarter of the picture, so a practitioner who recorded their expenses
 * properly made their own practice look unprofitable. See revenueFor().
 */
export default async function FinancePage() {
  const owner = await getOwnDoctor();
  if (!owner) {
    return <Empty title="No practice linked" body="This account has no practice record yet." />;
  }

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [appointments, orders, expenses, income, assets, clinicLinks] =
    await Promise.all([
      // The same definition the dashboard uses: what clients agreed to pay,
      // cancelled visits excluded.
      prisma.appointment.findMany({
        where: {
          doctorId: owner.doctorId,
          scheduledAt: { gte: monthStart },
          status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW] },
          approvalState: { not: ApprovalState.AWAITING_DOCTOR },
        },
        select: { feeAtBooking: true, visitFee: true, clinicId: true },
      }),
      // Medicine sales. Cancelled orders are excluded for the same reason a
      // cancelled appointment is: nobody paid.
      prisma.medicineOrder.findMany({
        where: {
          doctorId: owner.doctorId,
          createdAt: { gte: monthStart },
          status: { not: MedicineOrderStatus.CANCELLED },
        },
        select: { totalInr: true },
      }),
      prisma.practiceExpense.findMany({
        where: { doctorId: owner.doctorId, spentOn: { gte: monthStart } },
        orderBy: { spentOn: "desc" },
        take: 100,
        select: {
          id: true,
          category: true,
          label: true,
          amountInr: true,
          spentOn: true,
          headcount: true,
          clinicId: true,
          clinic: { select: { name: true } },
        },
      }),
      prisma.practiceIncome.findMany({
        where: { doctorId: owner.doctorId, receivedOn: { gte: monthStart } },
        orderBy: { receivedOn: "desc" },
        take: 100,
        select: {
          id: true,
          source: true,
          label: true,
          amountInr: true,
          receivedOn: true,
          clinicId: true,
          clinic: { select: { name: true } },
        },
      }),
      prisma.practiceAsset.findMany({
        where: { doctorId: owner.doctorId, isActive: true },
        orderBy: { purchasedOn: "desc" },
        select: {
          id: true,
          name: true,
          purpose: true,
          costInr: true,
          upkeepInr: true,
          purchasedOn: true,
          clinicId: true,
          uses: { select: { chargedInr: true, usedOn: true } },
        },
      }),
      prisma.doctorClinic.findMany({
        where: { doctorId: owner.doctorId },
        select: { clinic: { select: { id: true, name: true } } },
      }),
    ]);

  // Machine charges IN THIS MONTH only. The recovery figures below read every
  // use ever recorded, which is right for payback and wrong for revenue —
  // recovery is a lifetime question and revenue is a monthly one.
  const monthUses = assets.flatMap((a) =>
    a.uses.filter((u) => u.usedOn >= monthStart)
  );

  /* ── Where the month actually came from ────────────────────────────
     The totals below answer "how did the practice do". This answers "which
     of my locations did it", which is a different question and the one a
     doctor working three clinics keeps having to guess at.

     Only the streams that carry a clinic on the row are split. The dispensary
     is passed in separately and reported outside the ranking: a medicine
     order belongs to the practice, and dividing it by booking share would
     put a made-up number in a table meant for deciding which rent to keep
     paying. See clinicPerformanceFor(). */
  const clinicPerf = clinicPerformanceFor({
    clinics: clinicLinks.map((l) => l.clinic),
    bookings: appointments.map((a) => ({
      clinicId: a.clinicId,
      amountInr: a.feeAtBooking + a.visitFee,
    })),
    procedures: assets.flatMap((a) =>
      a.uses
        .filter((u) => u.usedOn >= monthStart)
        .map((u) => ({ clinicId: a.clinicId, amountInr: Math.max(u.chargedInr, 0) }))
    ),
    otherIncome: income.map((i) => ({ clinicId: i.clinicId, amountInr: i.amountInr })),
    expenses: expenses.map((e) => ({ clinicId: e.clinicId, amountInr: e.amountInr })),
    unattributableInr: orders.reduce((n, o) => n + o.totalInr, 0),
  });

  const revenue = revenueFor({
    bookingsInr: appointments.reduce((n, a) => n + a.feeAtBooking + a.visitFee, 0),
    bookingCount: appointments.length,
    medicinesInr: orders.reduce((n, o) => n + o.totalInr, 0),
    medicineOrderCount: orders.length,
    proceduresInr: monthUses.reduce((n, u) => n + Math.max(u.chargedInr, 0), 0),
    procedureCount: monthUses.length,
    otherInr: income.reduce((n, i) => n + i.amountInr, 0),
    otherCount: income.length,
  });

  const net = netFor(
    revenue.totalInr,
    expenses.map((e) => ({
      category: e.category,
      amountInr: e.amountInr,
      headcount: e.headcount,
    }))
  );
  const recoveries = assets.map((a) => recoveryFor(a, now));
  const clinics: ClinicOption[] = clinicLinks.map((l) => l.clinic);

  const monthLabel = now.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <>
      <PageHead
        title="Money"
        sub={`Revenue, costs and equipment. ${monthLabel} so far.`}
      />

      {/* ── The four headline figures ────────────────────────────────── */}
      <div className="mb-5 grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        <Tile
          label="Revenue for this month"
          value={money(net.takingsInr)}
          tone="brand"
          hint="Bookings, medicine sales, procedures and other income, added up."
        />
        <Tile
          label="Total cost for this month"
          value={money(net.runningCostInr)}
          tone="amber"
          hint="Running costs only. Machine purchases are tracked below."
        />
        <Tile
          label="Net profit for this month"
          value={money(net.netInr)}
          tone={net.netInr >= 0 ? "teal" : "rose"}
          hint="Revenue minus running costs."
        />
        <Tile
          label="Profit in percentage"
          value={net.profitRatio === null ? "—" : pct(net.profitRatio)}
          tone={net.profitRatio !== null && net.profitRatio < 0 ? "rose" : "violet"}
          hint={
            net.profitRatio === null
              ? "Nothing taken yet this month."
              : "Of every rupee taken, this is what stays."
          }
        />
      </div>

      {/* ── Where the money came FROM ────────────────────────────────── */}
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Panel
          title="Where it came from"
          sub={monthLabel}
          icon="rupee"
          accent="teal"
          index={0}
          note={
            <>
              Four streams, each counted once. Three of them were already in
              your records and were never being added up.
            </>
          }
        >
          <div className="p-4 sm:p-5">
            {net.takingsInr === 0 ? (
              <Empty
                title="Nothing recorded yet"
                body="Bookings and medicine orders appear here on their own. Add anything else below."
              />
            ) : (
              <ul className="space-y-3.5">
                {revenue.streams.map((r) => (
                  <li key={r.key}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-700">
                        {r.label}
                        {r.count > 0 && (
                          <span className="ml-1.5 font-normal text-slate-400">
                            {r.count}
                          </span>
                        )}
                      </span>
                      <span className="text-sm font-bold tabular-nums text-slate-900">
                        {money(r.amountInr)}
                        <span className="ml-2 text-xs font-semibold text-slate-400">
                          {pct(r.share)}
                        </span>
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-teal-400 to-brand-500"
                        style={{ width: `${Math.round(r.share * 100)}%` }}
                      />
                    </div>
                    {/* The basis line, printed rather than hidden in a
                        tooltip: the reader who needs to know what a stream
                        counts is exactly the reader who will not hover. */}
                    <p className="mt-1 text-[11px] leading-snug text-slate-500">
                      {r.basis}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            {revenue.overlapWarning && (
              <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs leading-relaxed text-amber-900">
                {revenue.overlapWarning}
              </p>
            )}
          </div>
        </Panel>

        {/* ── Which location earned it ────────────────────────────────── */}
        <Panel
          title="By location"
          sub={monthLabel}
          icon="clinic"
          accent="brand"
          index={1}
          padded={false}
          note={
            <>
              Strongest first. Blue earns most, rose spends more than it takes.
            </>
          }
        >
          <ClinicPerformance perf={clinicPerf} />
        </Panel>

        {/* ── Where it went ───────────────────────────────────────────── */}
        <Panel
          title="Where it went"
          sub={monthLabel}
          icon="chart"
          accent="amber"
          index={2}
          note={<>Running costs only. Machines are tracked separately below.</>}
        >
          <div className="p-4 sm:p-5">
            {net.groups.length === 0 ? (
              <Empty title="Nothing recorded yet" body="Add a cost below and it appears here." />
            ) : (
              <ul className="space-y-3.5">
                {net.groups.map((g) => (
                  <li key={g.key}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-700">
                        {g.label}
                      </span>
                      <span className="text-sm font-bold tabular-nums text-slate-900">
                        {money(g.amountInr)}
                        <span className="ml-2 text-xs font-semibold text-slate-400">
                          {pct(g.share)}
                        </span>
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
                        style={{ width: `${Math.round(g.share * 100)}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {g.categories
                        .map((c) => `${categoryLabel(c.category)} ${money(c.amountInr)}`)
                        .join(" · ")}
                    </p>
                    {/* The per-head figure. "₹1,42,000 on salaries" is a
                        number nobody can act on; the division is what invites
                        the comparison with what those people are billing. */}
                    {g.headcount !== null && g.headcount > 0 && (
                      <p className="mt-1 text-[11px] font-semibold text-slate-600">
                        {g.headcount} {g.headcount === 1 ? "person" : "people"} ·{" "}
                        {money(g.amountInr / g.headcount)} each
                        {net.takingsInr > 0 && (
                          <>
                            {" "}
                            · {pct(g.amountInr / net.takingsInr)} of revenue
                          </>
                        )}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>
      </div>

      {/* ── The two entry forms ──────────────────────────────────────── */}
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Panel
          title="Add a cost"
          sub="Rent, salaries, dispensary stock, laundry"
          icon="clinic"
          accent="brand"
          index={3}
          note={<>The more of this you record, the more the net figure is worth.</>}
        >
          <div className="p-4 sm:p-5">
            <ExpenseForm clinics={clinics} />
          </div>
        </Panel>

        <Panel
          title="Add other income"
          sub="Retail, packages, room rental"
          icon="rupee"
          accent="teal"
          index={4}
          note={
            <>
              Only what is not already counted. Bookings, medicine orders and
              machine charges come from their own records.
            </>
          }
        >
          <div className="p-4 sm:p-5">
            <IncomeForm clinics={clinics} />
          </div>
        </Panel>
      </div>

      {/* ── The entries ──────────────────────────────────────────────── */}
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Panel
          title="This month's costs"
          sub={`${expenses.length}`}
          icon="today"
          accent="slate"
          index={5}
          note={<>Remove anything mistyped.</>}
        >
          {expenses.length === 0 ? (
            <div className="p-5">
              <Empty title="Nothing yet" body="Costs you add appear here." />
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {expenses.map((e) => (
                <ExpenseRowItem
                  key={e.id}
                  row={{
                    id: e.id,
                    category: e.category,
                    label: e.label,
                    amountInr: e.amountInr,
                    spentOn: day(e.spentOn),
                    clinicName: e.clinic?.name ?? null,
                  }}
                />
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="This month's other income"
          sub={`${income.length}`}
          icon="today"
          accent="slate"
          index={6}
          note={<>Bookings and medicine orders are not listed here — they are counted from their own records.</>}
        >
          {income.length === 0 ? (
            <div className="p-5">
              <Empty
                title="Nothing yet"
                body="Retail sales, packages and rentals you record appear here."
              />
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {income.map((i) => (
                <IncomeRowItem
                  key={i.id}
                  row={{
                    id: i.id,
                    source: i.source,
                    label: i.label,
                    amountInr: i.amountInr,
                    receivedOn: day(i.receivedOn),
                    clinicName: i.clinic?.name ?? null,
                  }}
                />
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* ── Equipment ────────────────────────────────────────────────── */}
      <div className="mt-8">
        <PageHead
          title="Equipment"
          sub="What each machine cost, how much of it has come back, and which of them is actually earning."
        />
        <p className="-mt-2 mb-3 max-w-3xl text-[13px] leading-relaxed text-slate-500">
          Every figure below is counted from uses you have recorded, never
          estimated. The only projection is the &ldquo;months to go&rdquo; line,
          and it says outright that it assumes things carry on as they have.
        </p>

        {/* The legend, because a colour with no key is a decoration. The
            tier is computed from the RATE of recovery against how long the
            machine has been owned, not from the raw percentage — 12%
            recovered is good after a month and a write-off after four
            years. See machineStatus(). */}
        {recoveries.length > 0 && (
          <ul className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {MACHINE_TIERS.map((t) => (
              <li
                key={t.tier}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500"
              >
                <span
                  aria-hidden
                  className={`h-2.5 w-2.5 rounded-full ${
                    {
                      blue: "bg-blue-500",
                      teal: "bg-teal-500",
                      amber: "bg-amber-500",
                      rose: "bg-rose-500",
                      slate: "bg-slate-300",
                    }[t.tone]
                  }`}
                />
                {t.label}
              </li>
            ))}
          </ul>
        )}

        {recoveries.length > 0 && (
          <ul className="mb-4 grid gap-3 lg:grid-cols-2">
            {recoveries.map((r) => (
              <MachineCard key={r.id} recovery={r} status={machineStatus(r)} />
            ))}
          </ul>
        )}

        <Panel
          title="Add a machine"
          sub="Then record each use, and this tracks the payback"
          icon="pulse"
          accent="violet"
          index={7}
          note={<>Log each use and this tracks how much of it has come back.</>}
        >
          <div className="p-4 sm:p-5">
            <AssetForm clinics={clinics} />
          </div>
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
