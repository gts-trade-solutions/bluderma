"use client";

import { useState, useTransition } from "react";
import { OfferStatus } from "@prisma/client";

import { reviewOffer } from "@/lib/actions/giftCards";

/**
 * Approving or rejecting a gift card offer.
 *
 * The note goes back to the clinic, so it is written as a message. "Rejected"
 * with no reason produces three emails and a phone call.
 *
 * Rejecting an offer that has already SOLD cards is warned about rather than
 * blocked: the cards themselves stay valid whatever happens to the listing,
 * and a reviewer needs to know that taking the offer down does not unmake
 * somebody's purchase.
 */
export default function OfferReview({
  id,
  status,
  reviewNote,
  soldCount,
}: {
  id: string;
  status: OfferStatus;
  reviewNote: string | null;
  soldCount: number;
}) {
  const [note, setNote] = useState(reviewNote ?? "");
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  function apply(next: OfferStatus) {
    setSaved(false);
    start(async () => {
      await reviewOffer(id, next, note);
      setSaved(true);
    });
  }

  return (
    <div className="min-w-[17rem] space-y-2">
      <textarea
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="What you told the clinic. They see this."
        className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none"
      />

      {soldCount > 0 && status === OfferStatus.APPROVED && (
        <p className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] leading-snug text-amber-800">
          {soldCount} card{soldCount === 1 ? " has" : "s have"} been sold. Taking
          this down stops new sales; cards already bought stay valid.
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {status !== OfferStatus.APPROVED && (
          <button
            type="button"
            disabled={pending}
            onClick={() => apply(OfferStatus.APPROVED)}
            className="rounded-full bg-teal-600 px-3 py-1 text-xs font-bold text-white transition hover:bg-teal-700 disabled:opacity-60"
          >
            Approve
          </button>
        )}
        {status !== OfferStatus.REJECTED && (
          <button
            type="button"
            disabled={pending}
            onClick={() => apply(OfferStatus.REJECTED)}
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
