import Link from "next/link";

import { getEnquiries, getEnquiryCounts } from "@/lib/queries/ops";
import { setEnquiryStatus } from "@/lib/actions/admin/ops";
import StatusSelect from "@/components/admin/StatusSelect";
import { EmptyState, PageHeader, Pill, Table, Td, Th } from "@/components/admin/ui";

export const metadata = { title: "Enquiries" };
export const dynamic = "force-dynamic";

const STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "CLOSED"] as const;

const STATUS_LABEL: Record<string, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  CONVERTED: "Converted",
  CLOSED: "Closed",
};

const RELATIVE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function EnquiriesPage({
  searchParams,
}: {
  searchParams: { status?: string; audience?: string };
}) {
  const status = STATUSES.includes(searchParams.status as never)
    ? (searchParams.status as (typeof STATUSES)[number])
    : undefined;
  const audience =
    searchParams.audience === "DOCTOR" || searchParams.audience === "PATIENT"
      ? searchParams.audience
      : undefined;

  const [enquiries, counts] = await Promise.all([
    getEnquiries({ status, audience }),
    getEnquiryCounts(),
  ]);

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <>
      <PageHeader
        title="Enquiries"
        description="Product and treatment leads captured from the site."
      />

      {/* Status filter tabs — counts come from the whole table, not the filter. */}
      <div className="mb-6 flex flex-wrap gap-2">
        <FilterTab href="/admin/enquiries" active={!status} label="All" count={total} />
        {STATUSES.map((s) => (
          <FilterTab
            key={s}
            href={`/admin/enquiries?status=${s}`}
            active={status === s}
            label={STATUS_LABEL[s]}
            count={counts[s] ?? 0}
          />
        ))}
      </div>

      {enquiries.length === 0 ? (
        <EmptyState
          title="No enquiries here"
          description="When visitors send a product or treatment enquiry, it lands in this list as a lead."
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Contact</Th>
              <Th>Interest</Th>
              <Th className="w-24">Type</Th>
              <Th className="w-28">Received</Th>
              <Th className="w-40">Status</Th>
              <Th className="w-20 text-right"></Th>
            </tr>
          </thead>
          <tbody>
            {enquiries.map((e) => (
              <tr key={e.id} className="hover:bg-slate-50/60">
                <Td>
                  <div className="font-semibold text-ink">{e.name}</div>
                  <div className="text-xs text-ink-muted">{e.email}</div>
                  {e.organisation && (
                    <div className="text-xs text-ink-muted">{e.organisation}</div>
                  )}
                </Td>
                <Td className="text-ink-soft">
                  {e.productName ?? e.treatment?.name ?? "General enquiry"}
                  {e.quantity != null && (
                    <span className="text-xs text-ink-muted"> · qty {e.quantity}</span>
                  )}
                  {e._count.notes > 0 && (
                    <div className="text-xs text-ink-muted">
                      {e._count.notes} note{e._count.notes === 1 ? "" : "s"}
                    </div>
                  )}
                </Td>
                <Td>
                  <Pill tone={e.audience === "DOCTOR" ? "success" : "neutral"}>
                    {e.audience === "DOCTOR" ? "Clinician" : "Client"}
                  </Pill>
                </Td>
                <Td className="text-xs text-ink-muted">
                  {RELATIVE.format(e.createdAt)}
                </Td>
                <Td>
                  <StatusSelect
                    value={e.status}
                    options={STATUSES.map((s) => ({
                      value: s,
                      label: STATUS_LABEL[s],
                    }))}
                    action={async (next) => {
                      "use server";
                      return setEnquiryStatus(e.id, next);
                    }}
                  />
                </Td>
                <Td className="text-right">
                  <Link
                    href={`/admin/enquiries/${e.id}`}
                    className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                  >
                    Open
                  </Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}

function FilterTab({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition ${
        active
          ? "border-brand-600 bg-brand-600 text-white"
          : "border-slate-200 bg-white text-ink-soft hover:border-brand-300"
      }`}
    >
      {label}
      <span
        className={`rounded-full px-1.5 text-[11px] font-semibold ${
          active ? "bg-white/20" : "bg-slate-100 text-ink-muted"
        }`}
      >
        {count}
      </span>
    </Link>
  );
}
