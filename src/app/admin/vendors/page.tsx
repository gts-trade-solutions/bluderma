import { VendorStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { EmptyState, PageHeader, Pill, Table, Td, Th } from "@/components/admin/ui";
import VendorRow from "@/components/admin/VendorRow";

export const metadata = { title: "Medicine sellers" };
export const dynamic = "force-dynamic";

const DATE = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });

/**
 * Applications from pharmacies and distributors.
 *
 * Reviewed by a person, always. Dispensing medicine is licensed, so there is
 * no automatic approval path anywhere in this feature: somebody reads the
 * licence number and looks at the document before anyone can sell.
 */
export default async function VendorsPage() {
  const rows = await prisma.medicineVendor.findMany({
    orderBy: [{ status: "asc" }, { submittedAt: "desc" }],
    take: 200,
  });

  const waiting = rows.filter(
    (r) => r.status === VendorStatus.SUBMITTED || r.status === VendorStatus.IN_REVIEW
  ).length;

  return (
    <>
      <PageHeader
        title="Medicine sellers"
        description="Applications to supply medicines. Each one needs a licence checked before it is approved; nothing here approves itself."
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No applications"
          description="Sellers who apply through /sell appear here."
        />
      ) : (
        <>
          {waiting > 0 && (
            <p className="mb-4 text-sm text-slate-600">
              <strong className="font-bold text-slate-900">{waiting}</strong>{" "}
              waiting to be reviewed.
            </p>
          )}
          <Table>
            <thead>
              <tr>
                <Th>Business</Th>
                <Th>Contact</Th>
                <Th>Licence</Th>
                <Th>Where</Th>
                <Th>Applied</Th>
                <Th>Status</Th>
                <Th>Decide</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <Td>
                    <span className="font-semibold text-slate-900">
                      {r.businessName}
                    </span>
                    {r.publicId && (
                      <span className="block font-mono text-[11px] text-slate-400">
                        {r.publicId}
                      </span>
                    )}
                    {r.categories && (
                      <span className="block text-xs text-slate-500">
                        {r.categories}
                      </span>
                    )}
                  </Td>
                  <Td>
                    {r.contactName}
                    <span className="block text-xs text-slate-500">
                      {r.email}
                      <br />
                      {r.phone}
                    </span>
                  </Td>
                  <Td>
                    <span className="font-mono text-xs text-slate-900">
                      {r.drugLicenceNo}
                    </span>
                    {/* Through the signing route, never the stored URL: the
                        document is in a private prefix. */}
                    {r.drugLicenceUrl ? (
                      <a
                        href={`/api/uploads/view?url=${encodeURIComponent(r.drugLicenceUrl)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 block text-xs font-semibold text-brand-700 underline underline-offset-2"
                      >
                        Open the document
                      </a>
                    ) : (
                      <span className="mt-1 block text-xs text-amber-700">
                        No document uploaded
                      </span>
                    )}
                    {r.gstin && (
                      <span className="mt-1 block text-[11px] text-slate-400">
                        GSTIN {r.gstin}
                      </span>
                    )}
                  </Td>
                  <Td>
                    <span className="text-xs text-slate-600">
                      {[r.area, r.city, r.state, r.pincode]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  </Td>
                  <Td>{DATE.format(r.submittedAt)}</Td>
                  <Td>
                    <Pill
                      tone={
                        r.status === VendorStatus.APPROVED
                          ? "success"
                          : r.status === VendorStatus.REJECTED
                            ? "danger"
                            : r.status === VendorStatus.IN_REVIEW
                              ? "neutral"
                              : "warn"
                      }
                    >
                      {r.status.replace("_", " ").toLowerCase()}
                    </Pill>
                  </Td>
                  <Td>
                    <VendorRow
                      id={r.id}
                      status={r.status}
                      reviewNote={r.reviewNote}
                      hasDocument={Boolean(r.drugLicenceUrl)}
                    />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      )}
    </>
  );
}
