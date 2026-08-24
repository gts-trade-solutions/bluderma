"use client";

import { useState, useTransition } from "react";
import { MedicineOrderStatus } from "@prisma/client";
import { FileText } from "lucide-react";

import { setOrderStatus } from "@/lib/actions/medicines";

const FLOW: Record<string, { label: string; next: MedicineOrderStatus | null }> = {
  PLACED: { label: "Placed", next: MedicineOrderStatus.CONFIRMED },
  CONFIRMED: { label: "Confirmed", next: MedicineOrderStatus.DISPATCHED },
  DISPATCHED: { label: "Dispatched", next: MedicineOrderStatus.DELIVERED },
  DELIVERED: { label: "Delivered", next: null },
  CANCELLED: { label: "Cancelled", next: null },
};

const TONE: Record<string, string> = {
  PLACED: "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-brand-100 text-brand-800",
  DISPATCHED: "bg-violet-100 text-violet-800",
  DELIVERED: "bg-teal-100 text-teal-800",
  CANCELLED: "bg-slate-100 text-slate-500",
};

/**
 * One order, and the single next step available on it.
 *
 * Deliberately one button rather than a dropdown of every state. Dispensing
 * runs in one direction and offering "back to placed" invites somebody to
 * undo a dispatch that physically happened.
 */
export default function OrderRow({
  id,
  reference,
  status,
  patient,
  patientId,
  placed,
  total,
  deliverTo,
  phone,
  prescriptionUrl,
  items,
}: {
  id: string;
  reference: string;
  status: MedicineOrderStatus;
  patient: string;
  patientId: string | null;
  placed: string;
  total: string;
  deliverTo: string;
  phone: string | null;
  prescriptionUrl: string | null;
  items: string[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const flow = FLOW[status];

  return (
    <li className="px-4 py-3.5 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-slate-900">{patient}</p>
            <span className="font-mono text-[11px] text-slate-400">{reference}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${TONE[status]}`}
            >
              {flow.label}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {placed}
            {patientId ? ` · ${patientId}` : ""} · {total}
          </p>
          <p className="mt-1 text-xs text-slate-600">{items.join(", ")}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
            {deliverTo}
            {phone ? ` · ${phone}` : ""}
          </p>
          {/* Through the signing route: prescriptions are a private prefix. */}
          {prescriptionUrl && (
            <a
              href={`/api/uploads/view?url=${encodeURIComponent(prescriptionUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 underline underline-offset-2"
            >
              <FileText className="h-3.5 w-3.5" /> The prescription
            </a>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {flow.next && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await setOrderStatus(id, flow.next!);
                  if (!res.ok) setError(res.error ?? "Could not update that.");
                })
              }
              className="rounded-full bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-slate-700 disabled:opacity-60"
            >
              Mark {FLOW[flow.next].label.toLowerCase()}
            </button>
          )}
          {status !== MedicineOrderStatus.CANCELLED &&
            status !== MedicineOrderStatus.DELIVERED && (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await setOrderStatus(id, MedicineOrderStatus.CANCELLED);
                    if (!res.ok) setError(res.error ?? "Could not cancel that.");
                  })
                }
                className="text-xs font-semibold text-slate-400 transition hover:text-rose-600 disabled:opacity-60"
              >
                Cancel
              </button>
            )}
        </div>
      </div>
      {error && <p className="mt-2 text-xs font-semibold text-rose-600">{error}</p>}
    </li>
  );
}
