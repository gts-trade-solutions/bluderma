"use client";

import { useState, useTransition } from "react";
import { Check, LoaderCircle } from "lucide-react";

import { acknowledgeAftercareSheet } from "@/lib/actions/aftercare";

/**
 * The patient confirming the instructions were explained to them.
 *
 * The wording is the sheet's own, not a paraphrase, because this is the line
 * they are agreeing to. It is a deliberate act and never inferred from the
 * page being opened: "they loaded the URL" is not the same claim as "it was
 * explained and I could ask questions", and only one of those is true of
 * somebody who tapped a link from an email on a bus.
 */
export default function AcknowledgeButton({ id }: { id: string }) {
  const [error, setError] = useState<string | null>(null);
  const [ticked, setTicked] = useState(false);
  const [pending, start] = useTransition();

  return (
    <div className="rounded-2xl bg-white/[0.04] p-5 ring-1 ring-inset ring-white/10">
      <label className="flex items-start gap-3 text-sm leading-relaxed text-ink-soft">
        <input
          type="checkbox"
          checked={ticked}
          onChange={(e) => setTicked(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-white/10"
        />
        I confirm that the above instructions have been explained to me and I have
        had the opportunity to ask questions.
      </label>

      {error && (
        <p className="mt-3 rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-100">
          {error}
        </p>
      )}

      <button
        type="button"
        // Disabled until the box is ticked: the button IS the signature, so
        // pressing it without having read the statement would record a
        // confirmation nobody gave.
        disabled={!ticked || pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await acknowledgeAftercareSheet(id);
            if (!res.ok) setError(res.error ?? "Could not confirm that.");
          })
        }
        className="btn-primary mt-4 disabled:opacity-50"
      >
        {pending ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <Check className="h-4 w-4" />
        )}
        Confirm
      </button>
    </div>
  );
}
