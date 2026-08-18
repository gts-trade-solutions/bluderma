import { prisma } from "@/lib/prisma";
import { EmptyState, PageHeader, Pill, Table, Td, Th } from "@/components/admin/ui";

export const metadata = { title: "Email log" };
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
  SENT: "success",
  QUEUED: "warn",
  FAILED: "danger",
  SKIPPED: "neutral",
};

/**
 * Every email the system tried to send.
 *
 * Read-only, and the point is answering one question: a client says they
 * never got their confirmation — did we send it? Until now the table was
 * written and never displayed, so the only honest answer was "no idea".
 */
export default async function EmailLogPage({
  searchParams,
}: {
  searchParams?: { status?: string };
}) {
  const filter = searchParams?.status?.toUpperCase();

  const [rows, counts] = await Promise.all([
    prisma.emailLog.findMany({
      where: filter ? { status: filter as "SENT" } : undefined,
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.emailLog.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const countFor = (s: string) =>
    counts.find((c) => c.status === s)?._count._all ?? 0;

  return (
    <>
      <PageHeader
        title="Email log"
        description="What the system tried to send, and whether it left. Useful the moment someone says they never received anything."
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {[
          { key: "", label: `All (${counts.reduce((n, c) => n + c._count._all, 0)})` },
          { key: "SENT", label: `Sent (${countFor("SENT")})` },
          { key: "QUEUED", label: `Queued (${countFor("QUEUED")})` },
          { key: "FAILED", label: `Failed (${countFor("FAILED")})` },
          { key: "SKIPPED", label: `Skipped (${countFor("SKIPPED")})` },
        ].map((t) => (
          <a
            key={t.key}
            href={t.key ? `/admin/email-log?status=${t.key}` : "/admin/email-log"}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${
              (filter ?? "") === t.key
                ? "bg-ink text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {t.label}
          </a>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="Nothing logged yet"
          description="Booking confirmations, receipts and password resets all appear here."
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th className="w-56">To</Th>
              <Th>Subject</Th>
              <Th className="w-32">Template</Th>
              <Th className="w-28">Status</Th>
              <Th className="w-36">When</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id}>
                <Td className="text-xs">{e.to}</Td>
                <Td>
                  <span className="text-sm text-ink">{e.subject}</span>
                  {e.error && (
                    <span className="block text-xs text-rose-600">{e.error}</span>
                  )}
                </Td>
                <Td className="text-xs">{e.template}</Td>
                <Td>
                  <Pill tone={TONE[e.status] ?? "neutral"}>{e.status}</Pill>
                </Td>
                <Td className="text-xs">{when(e.createdAt)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
