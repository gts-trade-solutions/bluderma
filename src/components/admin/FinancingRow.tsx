"use client";

import { useState, useTransition } from "react";
import { FinancingStatus } from "@prisma/client";

import { updateFinancingRequest } from "@/lib/actions/financing";

/**
 * Recording that somebody has replied to a payment enquiry, and what they said.
 *
 * The note goes back to the client on their own profile, so it is written as a
 * message rather than an internal remark. That is deliberate: an enquiry about
 * affording treatment deserves an answer the person can read, not a status
 * change they have to interpret.
 */
export default function FinancingRow({
  id,
  status,
  staffNote,
}: {
  id: string;
  status: FinancingStatus;
  staffNote: string | null;
}) {
  const [note, setNote] = useState(staffNote ?? "");
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  function apply(next: FinancingStatus) {
    setSaved(false);
    start(async () => {
      await updateFinancingRequest(id, next, note);
      setSaved(true);
    });
  }

  return (
    <div className="min-w-[16rem] space-y-2">
      <textarea
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="What you told them. They see this."
        className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none"
      />
      <div className="flex flex-wrap gap-1.5">
        {status !== FinancingStatus.CONTACTED && (
          <button
            type="button"
            disabled={pending}
            onClick={() => apply(FinancingStatus.CONTACTED)}
            className="rounded-full bg-teal-600 px-3 py-1 text-xs font-bold text-white transition hover:bg-teal-700 disabled:opacity-60"
          >
            Mark replied
          </button>
        )}
        {status !== FinancingStatus.CLOSED && (
          <button
            type="button"
            disabled={pending}
            onClick={() => apply(FinancingStatus.CLOSED)}
            className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-700 transition hover:bg-slate-300 disabled:opacity-60"
          >
            Close
          </button>
        )}
        {saved && <span className="text-xs font-semibold text-teal-700">Saved</span>}
      </div>
    </div>
  );
}
