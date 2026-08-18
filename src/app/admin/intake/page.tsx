import { prisma } from "@/lib/prisma";
import { EmptyState, PageHeader, Pill, Table, Td, Th } from "@/components/admin/ui";

export const metadata = { title: "Intake leads" };
export const dynamic = "force-dynamic";

const when = (d: Date) =>
  d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });

/** Answers are a free-form blob; render whatever the quiz actually captured. */
function readable(answers: unknown): { label: string; value: string }[] {
  if (!answers || typeof answers !== "object") return [];
  const out: { label: string; value: string }[] = [];
  for (const [key, raw] of Object.entries(answers as Record<string, unknown>)) {
    const value = Array.isArray(raw)
      ? raw.filter((v) => typeof v === "string").join(", ")
      : typeof raw === "string" || typeof raw === "number"
      ? String(raw)
      : "";
    if (!value.trim()) continue;
    out.push({
      // The quiz keys are camelCase ids; make them readable without a map
      // that would drift every time a question changes.
      label: key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()),
      value: value.slice(0, 300),
    });
  }
  return out;
}

/**
 * The "Help us to know you" submissions.
 *
 * These are leads: someone told us their name, city and skin goals and then
 * saw a doctor list. Until now they were written and never read, which is the
 * worst of both worlds — the client answered questions for nothing.
 */
export default async function IntakePage({
  searchParams,
}: {
  searchParams?: { who?: string };
}) {
  const onlyKnown = searchParams?.who === "known";

  const [rows, total, known] = await Promise.all([
    prisma.intakeResponse.findMany({
      where: onlyKnown ? { userId: { not: null } } : undefined,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { user: { select: { name: true, email: true, phone: true } } },
    }),
    prisma.intakeResponse.count(),
    prisma.intakeResponse.count({ where: { userId: { not: null } } }),
  ]);

  return (
    <>
      <PageHeader
        title="Intake leads"
        description="Completed questionnaires from the client hub. Anonymous ones have no account attached — the answers are still the lead."
      />

      <div className="mb-5 flex flex-wrap gap-2">
        <a
          href="/admin/intake"
          className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${
            !onlyKnown ? "bg-ink text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          All ({total})
        </a>
        <a
          href="/admin/intake?who=known"
          className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${
            onlyKnown ? "bg-ink text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          With an account ({known})
        </a>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No submissions yet"
          description="They appear here as soon as someone finishes the questionnaire."
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th className="w-44">Who</Th>
              <Th className="w-56">Summary</Th>
              <Th>Answers</Th>
              <Th className="w-36">When</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const answers = readable(r.answers);
              return (
                <tr key={r.id}>
                  <Td>
                    {r.user ? (
                      <>
                        <span className="font-semibold text-ink">
                          {r.user.name ?? "Client"}
                        </span>
                        <span className="block text-xs text-ink-muted">
                          {r.user.email}
                        </span>
                        {r.user.phone && (
                          <span className="block text-xs text-ink-muted">
                            {r.user.phone}
                          </span>
                        )}
                      </>
                    ) : (
                      <Pill tone="neutral">Anonymous</Pill>
                    )}
                  </Td>
                  <Td className="text-xs">{r.summary ?? "—"}</Td>
                  <Td>
                    <dl className="grid gap-x-4 gap-y-0.5 sm:grid-cols-2">
                      {answers.slice(0, 10).map((a) => (
                        <div key={a.label} className="text-xs">
                          <dt className="inline font-semibold text-ink-soft">
                            {a.label}:{" "}
                          </dt>
                          <dd className="inline text-ink-muted">{a.value}</dd>
                        </div>
                      ))}
                    </dl>
                    {answers.length === 0 && (
                      <span className="text-xs text-ink-muted">No answers recorded</span>
                    )}
                  </Td>
                  <Td className="text-xs">{when(r.createdAt)}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </>
  );
}
