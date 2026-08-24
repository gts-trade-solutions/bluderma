import { AppointmentStatus, ApprovalState } from "@prisma/client";

import { Empty, PageHead, Panel } from "@/components/doctor/portalUi";
import {
  AssetForm,
  ExpenseForm,
  ExpenseRowItem,
  type ClinicOption,
} from "@/components/doctor/FinanceForms";
import MachineCard from "@/components/doctor/MachineCard";
import { getOwnDoctor } from "@/lib/doctor/guard";
import { prisma } from "@/lib/prisma";
import { categoryLabel, netFor, recoveryFor } from "@/lib/doctor/financeCore";

export const metadata = { title: "Money" };
export const dynamic = "force-dynamic";

const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const day = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/**
 * What the practice earned, what it spent, and how its machines are doing.
 *
 * ── Two figures, kept apart on purpose ───────────────────────────────────
 * Net is takings minus RUNNING costs. A machine purchase is not in it.
 * Subtracting a ₹5,00,000 laser from one month would show a catastrophic
 * month for something that earns out over years, so capital is tracked
 * separately as a thing being recovered, which is the question a practitioner
 * actually has about it. Both figures are labelled as what they are.
 */
export default async function FinancePage() {
  const owner = await getOwnDoctor();
  if (!owner) {
    return <Empty title="No practice linked" body="This account has no practice record yet." />;
  }

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [appointments, expenses, assets, clinicLinks] = await Promise.all([
    // The same definition the dashboard uses: what clients agreed to pay,
    // cancelled visits excluded.
    prisma.appointment.findMany({
      where: {
        doctorId: owner.doctorId,
        scheduledAt: { gte: monthStart },
        status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW] },
        approvalState: { not: ApprovalState.AWAITING_DOCTOR },
      },
      select: { feeAtBooking: true, visitFee: true },
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
        uses: { select: { chargedInr: true, usedOn: true } },
      },
    }),
    prisma.doctorClinic.findMany({
      where: { doctorId: owner.doctorId },
      select: { clinic: { select: { id: true, name: true } } },
    }),
  ]);

  const takings = appointments.reduce((n, a) => n + a.feeAtBooking + a.visitFee, 0);
  const net = netFor(
    takings,
    expenses.map((e) => ({ category: e.category, amountInr: e.amountInr }))
  );
  const recoveries = assets.map((a) => recoveryFor(a, now));
  const clinics: ClinicOption[] = clinicLinks.map((l) => l.clinic);

  const monthLabel = now.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <>
      <PageHead
        title="Money"
        sub={`Takings, running costs and equipment. ${monthLabel} so far.`}
      />

      {/* ── The three headline figures ───────────────────────────────── */}
      <div className="mb-5 grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        <Tile label="Booked this month" value={money(net.takingsInr)} tone="brand" />
        <Tile label="Running costs" value={money(net.runningCostInr)} tone="amber" />
        <Tile
          label="Net"
          value={money(net.netInr)}
          tone={net.netInr >= 0 ? "teal" : "rose"}
          hint="Takings minus running costs. Machine purchases are not in this."
        />
        <Tile
          label="Costs as a share"
          value={net.costRatio === null ? "—" : `${Math.round(net.costRatio * 100)}%`}
          tone="violet"
          hint={net.costRatio === null ? "Nothing booked yet this month." : "Of what you booked."}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Where it went"
          sub={monthLabel}
          icon="chart"
          accent="amber"
          index={0}
          note={
            <>
              What the practice spent this month, heaviest first. Only running
              costs: rent, staff, consumables. Machines are capital and are
              tracked separately below, because subtracting a laser from one
              month would make a good month look like a disaster.
            </>
          }
        >
          <div className="p-4 sm:p-5">
            {net.byCategory.length === 0 ? (
              <Empty title="Nothing recorded yet" body="Add a cost below and it appears here." />
            ) : (
              <ul className="space-y-3">
                {net.byCategory.map((c) => {
                  const share = net.runningCostInr
                    ? Math.round((c.amountInr / net.runningCostInr) * 100)
                    : 0;
                  return (
                    <li key={c.category}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-700">
                          {categoryLabel(c.category)}
                        </span>
                        <span className="text-sm font-bold tabular-nums text-slate-900">
                          {money(c.amountInr)}
                          <span className="ml-2 text-xs font-semibold text-slate-400">
                            {share}%
                          </span>
                        </span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
                          style={{ width: `${share}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Panel>

        <Panel
          title="Add a cost"
          sub="Rent, salaries, consumables"
          icon="clinic"
          accent="brand"
          index={1}
          note={
            <>
              Enter what the practice pays out. The more of it that is here,
              the more the net figure at the top is worth trusting: with
              nothing recorded, &ldquo;net&rdquo; is just your takings again.
            </>
          }
        >
          <div className="p-4 sm:p-5">
            <ExpenseForm clinics={clinics} />
          </div>
        </Panel>
      </div>

      <div className="mt-4">
        <Panel
          title="This month's entries"
          sub={`${expenses.length}`}
          icon="today"
          accent="slate"
          index={2}
          note={<>Everything recorded this month. Remove anything mistyped.</>}
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
      </div>

      {/* ── Equipment ────────────────────────────────────────────────── */}
      <div className="mt-8">
        <PageHead
          title="Equipment"
          sub="What each machine cost, and how much of it has come back."
        />
        <p className="-mt-2 mb-4 max-w-3xl text-[13px] leading-relaxed text-slate-500">
          Every figure below is counted from uses you have recorded, never
          estimated. The only projection is the &ldquo;months to go&rdquo; line,
          and it says outright that it assumes things carry on as they have.
        </p>

        {recoveries.length > 0 && (
          <ul className="mb-4 grid gap-3 lg:grid-cols-2">
            {recoveries.map((r) => (
              <MachineCard key={r.id} recovery={r} />
            ))}
          </ul>
        )}

        <Panel
          title="Add a machine"
          sub="Then record each use, and this tracks the payback"
          icon="pulse"
          accent="violet"
          index={3}
          note={
            <>
              Register what a machine cost, then log each time you use it and
              what you charged. That is what turns &ldquo;we bought a
              laser&rdquo; into an answer to the question you actually have:
              how much of it has come back, and roughly how many more
              treatments until it has paid for itself.
            </>
          }
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
