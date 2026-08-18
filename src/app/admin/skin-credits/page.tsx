import { prisma } from "@/lib/prisma";
import { grantScanCredits, revokeScanCredit } from "@/lib/actions/admin/skinCredits";
import { DeleteButton } from "@/components/admin/RowActions";
import { EmptyState, PageHeader, Pill, Table, Td, Th } from "@/components/admin/ui";
import GrantCredits from "@/components/admin/GrantCredits";
import { getScanPricing } from "@/lib/integrations/skinPricing";

export const metadata = { title: "Skin credits" };
export const dynamic = "force-dynamic";

const when = (d: Date) =>
  d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });

const TONE: Record<string, "success" | "warn" | "danger" | "neutral"> = {
  available: "success",
  reserved: "warn",
  consumed: "neutral",
  revoked: "danger",
};

const SOURCE_LABEL: Record<string, string> = {
  free: "First scan (free)",
  granted: "Granted by staff",
  paid: "Paid",
};

/**
 * Who holds a scan credit, where it came from, and what happened to it.
 *
 * The scan is priced now, so this is also the revenue picture for analyses —
 * a "paid" credit corresponds to a payment in the ledger, and a "granted" one
 * is revenue deliberately given away.
 */
export default async function SkinCreditsPage() {
  const [rows, pricing, clients, totals] = await Promise.all([
    prisma.skinEntitlement.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { user: { select: { name: true, email: true } } },
    }),
    getScanPricing(),
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
      take: 500,
    }),
    prisma.skinEntitlement.groupBy({ by: ["state"], _count: { _all: true } }),
  ]);

  const countFor = (s: string) =>
    totals.find((t) => t.state === s)?._count._all ?? 0;

  return (
    <>
      <PageHeader
        title="Skin credits"
        description={
          pricing.firstScanFree
            ? `First analysis free, then ₹${pricing.priceInr} each. Change both under Settings → Skin.`
            : `Every analysis is ₹${pricing.priceInr}. Change this under Settings → Skin.`
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        {[
          ["Available", countFor("available")],
          ["Reserved", countFor("reserved")],
          ["Consumed", countFor("consumed")],
          ["Revoked", countFor("revoked")],
        ].map(([label, n]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {label}
            </p>
            <p className="mt-1 text-2xl font-bold text-ink">{n}</p>
          </div>
        ))}
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-bold text-ink">Grant a credit</h2>
        <p className="mt-1 text-xs text-slate-500">
          For a client who can&apos;t pay, a scan that failed, or something
          promised at reception. The reason is recorded.
        </p>
        <div className="mt-3">
          <GrantCredits clients={clients} action={grantScanCredits} />
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No credits yet"
          description="A credit appears when a client signs up, buys an analysis, or is granted one here."
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Client</Th>
              <Th className="w-40">Source</Th>
              <Th className="w-28">State</Th>
              <Th className="w-40">Created</Th>
              <Th className="w-28" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <Td>
                  <span className="font-semibold text-ink">
                    {r.user.name ?? "—"}
                  </span>
                  <span className="block text-xs text-ink-muted">
                    {r.user.email}
                  </span>
                </Td>
                <Td className="text-xs">{SOURCE_LABEL[r.source] ?? r.source}</Td>
                <Td>
                  <Pill tone={TONE[r.state] ?? "neutral"}>{r.state}</Pill>
                </Td>
                <Td className="text-xs">{when(r.createdAt)}</Td>
                <Td>
                  <div className="flex justify-end">
                    {r.state === "available" ? (
                      <DeleteButton
                        label="Revoke"
                        confirmText={`this unused credit for ${r.user.email}`}
                        action={async () => {
                          "use server";
                          return revokeScanCredit(r.id);
                        }}
                      />
                    ) : (
                      <span className="text-xs text-ink-muted">—</span>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
