"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { AdminResult } from "@/lib/admin/form";

/**
 * Issuing a refund, behind a deliberate two-step: money leaving the business
 * should never be one stray click. Amount defaults to the full outstanding
 * figure because that is the common case, but stays editable for a partial.
 */
export default function RefundDialog({
  paymentId,
  maxInr,
  patient,
  action,
}: {
  paymentId: string;
  /** What is still refundable — the payment minus anything already returned. */
  maxInr: number;
  patient: string;
  action: (formData: FormData) => Promise<AdminResult>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (maxInr <= 0) {
    return <span className="text-xs text-ink-muted">Fully refunded</span>;
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-sm font-semibold text-rose-600 hover:underline"
      >
        Refund
      </button>
    );
  }

  return (
    <form
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const res = await action(formData);
          if (!res.ok) {
            setError(res.error ?? "Could not issue the refund.");
            return;
          }
          setOpen(false);
          router.refresh();
        });
      }}
      className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-left"
    >
      <input type="hidden" name="paymentId" value={paymentId} />

      <p className="text-xs font-semibold text-ink">
        Refund {patient}: up to ₹{maxInr.toLocaleString("en-IN")}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          type="number"
          name="amountInr"
          min={1}
          max={maxInr}
          defaultValue={maxInr}
          required
          className="w-24 rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm"
          aria-label="Refund amount in rupees"
        />
        <input
          type="text"
          name="reason"
          placeholder="Reason (optional)"
          className="min-w-[10rem] flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm"
          aria-label="Refund reason"
        />
      </div>

      <label className="mt-2 flex items-center gap-2 text-xs text-ink-soft">
        <input type="checkbox" name="cancelAppointment" defaultChecked />
        Cancel the appointment and free the slot
      </label>

      {error && <p className="mt-2 text-xs font-medium text-rose-700">{error}</p>}

      <div className="mt-2 flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
        >
          {pending ? "Refunding…" : "Confirm refund"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-ink-soft"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
