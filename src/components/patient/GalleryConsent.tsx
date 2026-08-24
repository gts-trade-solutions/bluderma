"use client";

import { useState, useTransition } from "react";
import { Check, LoaderCircle, ShieldOff } from "lucide-react";

import {
  giveGalleryConsent,
  withdrawGalleryConsent,
} from "@/lib/actions/gallery";

export interface ConsentCase {
  id: string;
  treatmentName: string;
  detail: string | null;
  doctorName: string;
  consentGiven: boolean;
  consentWithdrawn: boolean;
  published: boolean;
}

/**
 * A client deciding whether their before-and-after may be shown.
 *
 * ── They see the actual images ───────────────────────────────────────────
 * Consent to "photographs from your treatment" is not consent to a particular
 * pair of pictures of your own face. The images are rendered here, through the
 * same route that serves the public gallery, so what is being agreed to is the
 * thing on screen and not a description of it.
 *
 * Withdrawal is offered permanently and takes the pictures down on the next
 * request, because they are private objects served behind a consent check
 * rather than public URLs somebody could have kept.
 */
export default function GalleryConsent({ cases }: { cases: ConsentCase[] }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Something went wrong.");
    });
  }

  return (
    <div>
      {error && (
        <p className="mb-3 rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-100">
          {error}
        </p>
      )}

      <ul className="grid gap-3 sm:grid-cols-2">
        {cases.map((c) => (
          <li key={c.id} className="card-soft overflow-hidden">
            {/* Always rendered, including before they agree. Consent to
                "photographs from your treatment" is not consent to two
                particular pictures of your own face, so the thing being
                agreed to has to be on the screen. The image route allows the
                subject of a case to see it at any status. */}
            <div className="grid grid-cols-2 gap-px bg-white/10">
              {(["before", "after"] as const).map((side) => (
                <div key={side} className="relative aspect-[4/5] bg-[#0b1220]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/gallery/${c.id}/${side}`}
                    alt={`Your ${side} photograph for ${c.treatmentName}`}
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    {side}
                  </span>
                </div>
              ))}
            </div>

            <div className="p-4">
              <p className="text-sm font-bold text-ink">{c.treatmentName}</p>
              <p className="mt-0.5 text-xs text-ink-muted">
                {c.doctorName}
                {c.detail ? ` · ${c.detail}` : ""}
              </p>

              {c.consentWithdrawn ? (
                <p className="mt-3 text-xs font-semibold text-ink-muted">
                  You withdrew this. It is not shown anywhere.
                </p>
              ) : c.consentGiven ? (
                <>
                  <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-teal-300">
                    <Check className="h-3.5 w-3.5" />
                    {c.published ? "Shown on their profile" : "Agreed, not yet shown"}
                  </p>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => withdrawGalleryConsent(c.id))}
                    className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-rose-300/90 transition hover:text-rose-200 disabled:opacity-60"
                  >
                    <ShieldOff className="h-3.5 w-3.5" /> Change my mind
                  </button>
                </>
              ) : (
                <>
                  <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">
                    {c.doctorName} would like to show these on their public
                    profile. Your name is never shown. You can change your mind
                    at any time and they come down straight away.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => giveGalleryConsent(c.id))}
                      className="btn-primary !py-2 text-sm disabled:opacity-60"
                    >
                      {pending ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      I agree
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => withdrawGalleryConsent(c.id))}
                      className="btn-ghost !py-2 text-sm disabled:opacity-60"
                    >
                      No thanks
                    </button>
                  </div>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
