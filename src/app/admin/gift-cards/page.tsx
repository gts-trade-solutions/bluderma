import { OfferStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { EmptyState, PageHeader, Pill, Table, Td, Th } from "@/components/admin/ui";
import OfferReview from "@/components/admin/OfferReview";

export const metadata = { title: "Gift cards" };
export const dynamic = "force-dynamic";

const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const DATE = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });

/**
 * Gift card offers waiting on BluDerma.
 *
 * An offer is a promise about money made in our name, on our storefront. That
 * is the whole reason this queue exists rather than clinics publishing
 * directly, and it is why the discount is computed and shown: a card worth
 * ₹10,000 sold for ₹1,000 is the thing a reviewer is here to catch.
 */
export default async function AdminGiftCardsPage() {
  const rows = await prisma.giftCardOffer.findMany({
    where: { status: { not: OfferStatus.DRAFT } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
    select: {
      id: true,
      title: true,
      description: true,
      terms: true,
      valueInr: true,
      priceInr: true,
      validMonths: true,
      status: true,
      reviewNote: true,
      createdAt: true,
      doctor: { select: { name: true, publicId: true } },
      clinic: { select: { name: true } },
      _count: { select: { cards: true } },
    },
  });

  const waiting = rows.filter((r) => r.status === OfferStatus.PENDING).length;

  return (
    <>
      <PageHeader
        title="Gift card offers"
        description="Clinics selling credit on our storefront. Nothing here reaches a patient until it is approved."
      />

      {rows.length === 0 ? (
        <EmptyState
          title="Nothing submitted"
          description="Offers a clinic sends for review appear here."
        />
      ) : (
        <>
          {waiting > 0 && (
            <p className="mb-4 text-sm text-slate-600">
              <strong className="font-bold text-slate-900">{waiting}</strong>{" "}
              waiting on a decision.
            </p>
          )}
          <Table>
            <thead>
              <tr>
                <Th>Offer</Th>
                <Th>Practice</Th>
                <Th>Value</Th>
                <Th>Price</Th>
                <Th>Discount</Th>
                <Th>Status</Th>
                <Th>Decide</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                // Computed here rather than trusted from the clinic. This is
                // the number a reviewer is actually looking for.
                const off = r.valueInr > 0
                  ? Math.round(((r.valueInr - r.priceInr) / r.valueInr) * 100)
                  : 0;
                return (
                  <tr key={r.id}>
                    <Td>
                      <span className="font-semibold text-slate-900">{r.title}</span>
                      {r.description && (
                        <span className="block text-xs text-slate-500">
                          {r.description}
                        </span>
                      )}
                      {r.terms && (
                        <span className="mt-1 block text-[11px] text-slate-400">
                          Terms: {r.terms}
                        </span>
                      )}
                      <span className="mt-1 block text-[11px] text-slate-400">
                        Valid {r.validMonths} months · submitted{" "}
                        {DATE.format(r.createdAt)}
                        {r._count.cards > 0 && ` · ${r._count.cards} sold`}
                      </span>
                    </Td>
                    <Td>
                      {r.doctor.name}
                      <span className="block text-xs text-slate-500">
                        {r.clinic?.name ?? "Any location"}
                      </span>
                      {r.doctor.publicId && (
                        <span className="block font-mono text-[11px] text-slate-400">
                          {r.doctor.publicId}
                        </span>
                      )}
                    </Td>
                    <Td>{money(r.valueInr)}</Td>
                    <Td>{money(r.priceInr)}</Td>
                    <Td>
                      <span
                        className={
                          off >= 50
                            ? "font-bold text-rose-600"
                            : off > 0
                              ? "font-semibold text-amber-700"
                              : "text-slate-400"
                        }
                      >
                        {off > 0 ? `${off}% off` : "at face value"}
                      </span>
                    </Td>
                    <Td>
                      <Pill
                        tone={
                          r.status === OfferStatus.APPROVED
                            ? "success"
                            : r.status === OfferStatus.REJECTED
                              ? "danger"
                              : r.status === OfferStatus.PENDING
                                ? "warn"
                                : "neutral"
                        }
                      >
                        {r.status.toLowerCase()}
                      </Pill>
                    </Td>
                    <Td>
                      <OfferReview
                        id={r.id}
                        status={r.status}
                        reviewNote={r.reviewNote}
                        soldCount={r._count.cards}
                      />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </>
      )}
    </>
  );
}
