"use client";

import { useState, useTransition } from "react";
import { VendorStatus } from "@prisma/client";

import { reviewVendor } from "@/lib/actions/vendor";

/**
 * Deciding on a seller application.
 *
 * Approving is deliberately harder than rejecting: it is disabled until a
 * licence document has been uploaded, because the whole point of this queue is
 * that somebody looked at one. A licence NUMBER on its own is a claim.
 *
 * The note travels back to the applicant, so it is written as a message rather
 * than an internal remark. "Rejected" with no reason is the kind of thing that
 * generates three emails and a phone call.
 */
export default function VendorRow({
  id,
  status,
  reviewNote,
  hasDocument,
}: {
  id: string;
  status: VendorStatus;
  reviewNote: string | null;
  hasDocument: boolean;
}) {
  const [note, setNote] = useState(reviewNote ?? "");
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  function apply(next: VendorStatus) {
    setSaved(false);
    start(async () => {
      await reviewVendor(id, next, note);
      setSaved(true);
    });
  }

  return (
    <div className="min-w-[17rem] space-y-2">
      <textarea
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="What you told them. They see this."
        className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none"
      />
      <div className="flex flex-wrap gap-1.5">
        {status === VendorStatus.SUBMITTED && (
          <button
            type="button"
            disabled={pending}
            onClick={() => apply(VendorStatus.IN_REVIEW)}
            className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-700 transition hover:bg-slate-300 disabled:opacity-60"
          >
            Start review
          </button>
        )}
        {status !== VendorStatus.APPROVED && (
          <button
            type="button"
            disabled={pending || !hasDocument}
            title={
              hasDocument
                ? undefined
                : "No licence document uploaded. A licence number on its own is a claim."
            }
            onClick={() => apply(VendorStatus.APPROVED)}
            className="rounded-full bg-teal-600 px-3 py-1 text-xs font-bold text-white transition hover:bg-teal-700 disabled:opacity-40"
          >
            Approve
          </button>
        )}
        {status !== VendorStatus.REJECTED && (
          <button
            type="button"
            disabled={pending}
            onClick={() => apply(VendorStatus.REJECTED)}
            className="rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-700 transition hover:bg-rose-200 disabled:opacity-60"
          >
            Reject
          </button>
        )}
        {saved && <span className="text-xs font-semibold text-teal-700">Saved</span>}
      </div>
    </div>
  );
}
