"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { AdminResult } from "@/lib/admin/form";

/**
 * Publish or reject a review, with a note.
 *
 * The note is required to reject and optional to publish: rejecting is the
 * decision someone may have to justify later, and "why was my review not
 * shown" deserves an answer that exists in the record.
 */
export default function ModerateReview({
  reviewId,
  status,
  action,
}: {
  reviewId: string;
  status: string;
  action: (formData: FormData) => Promise<AdminResult>;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (next: "PUBLISHED" | "REJECTED" | "PENDING") => {
    if (next === "REJECTED" && !note.trim()) {
      setError("Add a note saying why.");
      return;
    }
    setError(null);
    const fd = new FormData();
    fd.set("reviewId", reviewId);
    fd.set("status", next);
    fd.set("adminNote", note.trim());
    startTransition(async () => {
      const res = await action(fd);
      if (!res.ok) {
        setError(res.error ?? "Could not update that review.");
        return;
      }
      setNote("");
      router.refresh();
    });
  };

  return (
    <div className="w-full">
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (required to reject)"
        className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs"
        aria-label="Moderation note"
      />
      <div className="mt-1.5 flex justify-end gap-2">
        {status !== "PUBLISHED" && (
          <button
            onClick={() => run("PUBLISHED")}
            disabled={pending}
            className="rounded-lg bg-teal-600 px-2.5 py-1 text-xs font-bold text-white disabled:opacity-60"
          >
            Publish
          </button>
        )}
        {status !== "REJECTED" && (
          <button
            onClick={() => run("REJECTED")}
            disabled={pending}
            className="rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-bold text-white disabled:opacity-60"
          >
            Reject
          </button>
        )}
        {status !== "PENDING" && (
          <button
            onClick={() => run("PENDING")}
            disabled={pending}
            className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 disabled:opacity-60"
          >
            Re-queue
          </button>
        )}
      </div>
      {error && <p className="mt-1 text-xs font-medium text-rose-700">{error}</p>}
    </div>
  );
}
