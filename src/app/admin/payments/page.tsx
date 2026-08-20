import { prisma } from "@/lib/prisma";
import { EmptyState, PageHeader, Pill, Table, Td, Th } from "@/components/admin/ui";
import { isRazorpayConfigured } from "@/lib/payments/razorpay";
import { refundPayment } from "@/lib/actions/admin/refunds";
import RefundDialog from "@/components/admin/RefundDialog";

export const metadata = { title: "Payments" };
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
  PAID: "success",
  CREATED: "warn",
  FAILED: "danger",
  REFUNDED: "neutral",
};

/**
 * The payment ledger, with refunds.
 *
 * Money still moves at Razorpay — a refund here calls their API and records
 * what they say, so their dashboard remains the system of record and this
 * table always reconciles against it.
 */
export default async function PaymentsPage() {
  const rows = await prisma.payment.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      appointment: {
        select: {
          patientName: true,
          scheduledAt: true,
          doctor: { select: { name: true } },
        },
      },
    },
  });

  const paid = rows.filter((r) => r.status === "PAID");
  const collected = paid.reduce((sum, r) => sum + r.amountInr, 0);

  return (
    <>
      <PageHeader
        title="Payments"
        description={
          isRazorpayConfigured()
            ? `Razorpay is connected. ₹${collected.toLocaleString("en-IN")} collected across ${paid.length} payment(s). Refunds are issued here and mirrored in the Razorpay dashboard.`
            : "Razorpay keys are not set on this environment. Bookings are settled at the clinic."
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No payments yet"
          description="Consultation payments appear here as soon as a client pays online."
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Client</Th>
              <Th className="w-40">Doctor</Th>
              <Th className="w-28">Amount</Th>
              <Th className="w-28">Status</Th>
              <Th>Reference</Th>
              <Th className="w-36">When</Th>
              <Th className="w-56">Refund</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <Td>
                  <span className="font-semibold text-ink">
                    {r.appointment?.patientName ?? "Skin analysis"}
                  </span>
                  {!r.appointment && (
                    <span className="block text-xs text-ink-muted">
                      Scan credit
                    </span>
                  )}
                </Td>
                <Td>{r.appointment?.doctor.name ?? "—"}</Td>
                <Td>₹{r.amountInr.toLocaleString("en-IN")}</Td>
                <Td>
                  <Pill tone={TONE[r.status] ?? "neutral"}>{r.status}</Pill>
                  {r.failureReason && (
                    <span className="block max-w-[16rem] truncate text-xs text-ink-muted">
                      {r.failureReason}
                    </span>
                  )}
                </Td>
                <Td>
                  <code className="text-xs">{r.providerPaymentId ?? r.providerOrderId}</code>
                </Td>
                <Td>{when(r.paidAt ?? r.createdAt)}</Td>
                <Td>
                  {r.status === "PAID" || r.status === "REFUNDED" ? (
                    <>
                      {r.refundedInr ? (
                        <span className="block text-xs text-ink-muted">
                          ₹{r.refundedInr.toLocaleString("en-IN")} returned
                          {r.refundReason ? `${r.refundReason}` : ""}
                        </span>
                      ) : null}
                      <RefundDialog
                        paymentId={r.id}
                        maxInr={r.amountInr - (r.refundedInr ?? 0)}
                        patient={r.appointment?.patientName ?? "this payment"}
                        action={refundPayment}
                      />
                    </>
                  ) : (
                    <span className="text-xs text-ink-muted">—</span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
