"use client";

import { useState, useTransition } from "react";
import { GalleryStatus } from "@prisma/client";
import { Eye, EyeOff, Trash2 } from "lucide-react";

import { deleteCase, hideCase, publishCase } from "@/lib/actions/gallery";

/**
 * One case, and what can be done with it.
 *
 * The consent state is stated in words rather than left to be inferred from
 * which buttons happen to be enabled. A doctor should be able to see at a
 * glance WHY they cannot publish something, and a greyed-out button does not
 * say "the patient has not answered yet".
 */
export default function GalleryCaseRow({
  id,
  treatmentName,
  detail,
  patientName,
  status,
  consentGiven,
  consentWithdrawn,
}: {
  id: string;
  treatmentName: string;
  detail: string | null;
  patientName: string;
  status: GalleryStatus;
  consentGiven: boolean;
  consentWithdrawn: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const canPublish = consentGiven && !consentWithdrawn;

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Something went wrong.");
    });
  }

  const consent = consentWithdrawn
    ? { text: "Consent withdrawn", className: "bg-coral-50 text-coral-700" }
    : consentGiven
      ? { text: "Patient agreed", className: "bg-mint-50 text-mint-800" }
      : { text: "Waiting on the patient", className: "bg-gold-50 text-gold-800" };

  return (
    <li className="px-4 py-3.5 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-graphite-900">{treatmentName}</p>
          <p className="mt-0.5 text-xs text-graphite-500">
            {patientName}
            {detail ? ` · ${detail}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${consent.className}`}
            >
              {consent.text}
            </span>
            {status === GalleryStatus.PUBLISHED && (
              <span className="rounded-full bg-graphite-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                Live
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 gap-1.5">
          {status !== GalleryStatus.PUBLISHED && (
            <button
              type="button"
              disabled={pending || !canPublish}
              title={canPublish ? undefined : "The patient has not agreed to this yet"}
              onClick={() => run(() => publishCase(id))}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-mint-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-mint-700 disabled:opacity-40"
            >
              <Eye className="h-3.5 w-3.5" /> Publish
            </button>
          )}
          {status === GalleryStatus.PUBLISHED && (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => hideCase(id))}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-graphite-100 px-3 py-1.5 text-xs font-bold text-graphite-700 transition hover:bg-graphite-200 disabled:opacity-60"
            >
              <EyeOff className="h-3.5 w-3.5" /> Hide
            </button>
          )}
          <button
            type="button"
            disabled={pending}
            aria-label="Delete this case"
            onClick={() => run(() => deleteCase(id))}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-coral-600 transition hover:bg-coral-50 disabled:opacity-60"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-xs font-semibold text-coral-600">{error}</p>}
    </li>
  );
}
