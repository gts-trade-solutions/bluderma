import Link from "next/link";
import { notFound } from "next/navigation";

import { getEnquiry, getLeadOwners } from "@/lib/queries/ops";
import {
  addEnquiryNote,
  assignEnquiry,
  setEnquiryStatus,
} from "@/lib/actions/admin/ops";
import StatusSelect from "@/components/admin/StatusSelect";
import NoteForm from "@/components/admin/NoteForm";
import { Card, PageHeader, Pill } from "@/components/admin/ui";

export const metadata = { title: "Enquiry" };
export const dynamic = "force-dynamic";

const STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "CLOSED"] as const;
const STATUS_LABEL: Record<string, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  CONVERTED: "Converted",
  CLOSED: "Closed",
};

const DATE = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function EnquiryDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [enquiry, owners] = await Promise.all([
    getEnquiry(params.id),
    getLeadOwners(),
  ]);

  if (!enquiry) notFound();

  return (
    <>
      <div className="mb-4">
        <Link
          href="/admin/enquiries"
          className="text-sm font-medium text-ink-muted hover:text-brand-700"
        >
          ← All enquiries
        </Link>
      </div>

      <PageHeader
        title={enquiry.name}
        description={`Received ${DATE.format(enquiry.createdAt)}`}
        action={
          <Pill tone={enquiry.audience === "DOCTOR" ? "success" : "neutral"}>
            {enquiry.audience === "DOCTOR" ? "Doctor" : "Consultation"}
          </Pill>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Contact">
            <dl className="grid gap-4 sm:grid-cols-2">
              <Detail label="Name" value={enquiry.name} />
              <Detail
                label="Email"
                value={
                  <a
                    href={`mailto:${enquiry.email}`}
                    className="text-brand-600 hover:text-brand-700"
                  >
                    {enquiry.email}
                  </a>
                }
              />
              <Detail label="Phone" value={enquiry.phone ?? "—"} />
              <Detail
                label={enquiry.audience === "DOCTOR" ? "Organisation" : "City"}
                value={enquiry.organisation ?? "—"}
              />
            </dl>
          </Card>

          <Card title="Interest">
            <dl className="grid gap-4 sm:grid-cols-2">
              <Detail
                label="Product"
                value={enquiry.productName ?? "General enquiry"}
              />
              <Detail
                label="Treatment"
                value={
                  enquiry.treatment ? (
                    <a
                      href={`/treatments/${enquiry.treatment.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-brand-600 hover:text-brand-700"
                    >
                      {enquiry.treatment.name} ↗
                    </a>
                  ) : (
                    "—"
                  )
                }
              />
              {enquiry.quantity != null && (
                <Detail label="Quantity" value={String(enquiry.quantity)} />
              )}
            </dl>
            {enquiry.message && (
              <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-ink-soft">
                {enquiry.message}
              </div>
            )}
          </Card>

          <Card title="Notes" description="Internal — never shown to the enquirer.">
            <NoteForm
              action={async (formData) => {
                "use server";
                return addEnquiryNote(enquiry.id, formData);
              }}
            />
            <div className="mt-5 space-y-3">
              {enquiry.notes.length === 0 ? (
                <p className="text-sm text-ink-muted">No notes yet.</p>
              ) : (
                enquiry.notes.map((n) => (
                  <div
                    key={n.id}
                    className="rounded-xl border border-slate-100 p-3.5 text-sm"
                  >
                    <p className="text-ink-soft">{n.body}</p>
                    <p className="mt-1.5 text-xs text-ink-muted">
                      {n.author?.name ?? n.author?.email ?? "Unknown"} ·{" "}
                      {DATE.format(n.createdAt)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Status">
            <StatusSelect
              value={enquiry.status}
              className="w-full"
              options={STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
              action={async (next) => {
                "use server";
                return setEnquiryStatus(enquiry.id, next);
              }}
            />
          </Card>

          <Card title="Owner">
            <StatusSelect
              value={enquiry.assignedTo?.id ?? ""}
              className="w-full"
              options={[
                { value: "", label: "Unassigned" },
                ...owners.map((o) => ({
                  value: o.id,
                  label: `${o.name ?? o.email} (${o.role.toLowerCase()})`,
                })),
              ]}
              action={async (next) => {
                "use server";
                return assignEnquiry(enquiry.id, next || null);
              }}
            />
          </Card>
        </div>
      </div>
    </>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-ink">{value}</dd>
    </div>
  );
}
