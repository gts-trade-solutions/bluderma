import { prisma } from "@/lib/prisma";
import { deleteReview, moderateReview } from "@/lib/actions/admin/reviews";
import { DeleteButton } from "@/components/admin/RowActions";
import { EmptyState, PageHeader, Pill, Table, Td, Th } from "@/components/admin/ui";
import ModerateReview from "@/components/admin/ModerateReview";

export const metadata = { title: "Reviews" };
export const dynamic = "force-dynamic";

const day = (d: Date) =>
  d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

const TONE: Record<string, "success" | "warn" | "danger" | "neutral"> = {
  PUBLISHED: "success",
  PENDING: "warn",
  REJECTED: "danger",
};

/**
 * Client reviews awaiting a decision.
 *
 * Pending first, because that is the queue — published and rejected ones are
 * history and only need to be findable.
 */
export default async function ReviewsPage({
  searchParams,
}: {
  searchParams?: { status?: string };
}) {
  const filter = searchParams?.status?.toUpperCase();
  const valid = ["PENDING", "PUBLISHED", "REJECTED"].includes(filter ?? "");

  const [rows, counts] = await Promise.all([
    prisma.review.findMany({
      where: valid ? { status: filter as "PENDING" } : undefined,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 200,
      include: {
        user: { select: { name: true, email: true } },
        doctor: { select: { name: true } },
        appointment: { select: { scheduledAt: true } },
      },
    }),
    prisma.review.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const countFor = (s: string) =>
    counts.find((c) => c.status === s)?._count._all ?? 0;

  return (
    <>
      <PageHeader
        title="Reviews"
        description="Client ratings of the doctors they saw. Nothing appears publicly until it is published here."
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {[
          { key: "", label: `All (${counts.reduce((n, c) => n + c._count._all, 0)})` },
          { key: "PENDING", label: `Pending (${countFor("PENDING")})` },
          { key: "PUBLISHED", label: `Published (${countFor("PUBLISHED")})` },
          { key: "REJECTED", label: `Rejected (${countFor("REJECTED")})` },
        ].map((t) => (
          <a
            key={t.key}
            href={t.key ? `/admin/reviews?status=${t.key}` : "/admin/reviews"}
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
          title="No reviews here"
          description="Clients can review a doctor once their appointment has taken place."
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th className="w-40">Client</Th>
              <Th className="w-36">Doctor</Th>
              <Th className="w-20">Rating</Th>
              <Th>Review</Th>
              <Th className="w-28">State</Th>
              <Th className="w-64">Moderate</Th>
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
                    {r.appointment ? day(r.appointment.scheduledAt) : "—"}
                  </span>
                </Td>
                <Td>{r.doctor.name}</Td>
                <Td>
                  <span className="font-semibold text-ink">{r.rating}</span>
                  <span className="text-ink-muted"> / 5</span>
                </Td>
                <Td>
                  {r.title && (
                    <span className="block font-medium text-ink">{r.title}</span>
                  )}
                  {r.body && (
                    <span className="block text-xs text-ink-muted">{r.body}</span>
                  )}
                  {!r.title && !r.body && (
                    <span className="text-xs text-ink-muted">Rating only</span>
                  )}
                  {r.adminNote && (
                    <span className="mt-1 block text-xs italic text-rose-600">
                      Note: {r.adminNote}
                    </span>
                  )}
                </Td>
                <Td>
                  <Pill tone={TONE[r.status] ?? "neutral"}>{r.status}</Pill>
                </Td>
                <Td>
                  <div className="flex flex-col items-end gap-2">
                    <ModerateReview
                      reviewId={r.id}
                      status={r.status}
                      action={moderateReview}
                    />
                    <DeleteButton
                      confirmText={`${r.user.name ?? "this"} review of ${r.doctor.name}`}
                      action={async () => {
                        "use server";
                        return deleteReview(r.id);
                      }}
                    />
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
