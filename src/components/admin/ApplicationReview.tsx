"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  approveDoctor,
  rejectDoctor,
  suspendDoctor,
} from "@/lib/actions/admin/doctorApplications";

/**
 * Approve, send back, or pause.
 *
 * Rejection insists on a written reason because the practitioner is emailed it
 * verbatim and is expected to act on it — "rejected" with no explanation
 * produces a support ticket, not a corrected application.
 */
export default function ApplicationReview({
  doctorId,
  status,
  name,
  canApprove,
}: {
  doctorId: string;
  status: string;
  name: string;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (res.ok) {
        setRejecting(false);
        setReason("");
        router.refresh();
      } else {
        setError(res.error ?? "That did not work.");
      }
    });

  if (rejecting) {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-ink">
          What does {name.split(" ")[0] || "this applicant"} need to change?
        </label>
        <textarea
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. The registration number does not match the Tamil Nadu Medical Council register. Please check it and upload your certificate."
          className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm"
        />
        <p className="text-xs text-ink-muted">
          Emailed to them word for word. Their profile and everything they
          entered is kept, so they only have to fix what you name here.
        </p>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div className="flex gap-2">
          <button
            disabled={pending || reason.trim().length < 10}
            onClick={() => {
              const fd = new FormData();
              fd.set("doctorId", doctorId);
              fd.set("reason", reason.trim());
              run(() => rejectDoctor(fd));
            }}
            className="rounded-full bg-rose-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-rose-700 disabled:opacity-40"
          >
            {pending ? "Sending…" : "Send back with this note"}
          </button>
          <button
            onClick={() => setRejecting(false)}
            className="rounded-full px-4 py-2 text-sm font-semibold text-ink-muted hover:text-ink"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {status !== "APPROVED" && (
          <button
            disabled={pending || !canApprove}
            title={
              canApprove
                ? undefined
                : "Needs registration details and at least one location first."
            }
            onClick={() => run(() => approveDoctor(doctorId))}
            className="rounded-full bg-brand-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-40"
          >
            {pending ? "Working…" : "Approve and publish"}
          </button>
        )}

        {status !== "REJECTED" && status !== "DRAFT" && (
          <button
            disabled={pending}
            onClick={() => setRejecting(true)}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Send back
          </button>
        )}

        {status === "APPROVED" && (
          <button
            disabled={pending}
            onClick={() => run(() => suspendDoctor(doctorId))}
            className="rounded-full px-4 py-2 text-sm font-bold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
          >
            Pause listing
          </button>
        )}

        {status === "DRAFT" && (
          <p className="self-center text-sm text-ink-muted">
            Not submitted yet — they are still filling it in.
          </p>
        )}
      </div>
      {!canApprove && status !== "APPROVED" && (
        <p className="text-xs text-amber-700">
          Cannot approve until registration details and a location are on file.
        </p>
      )}
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}
