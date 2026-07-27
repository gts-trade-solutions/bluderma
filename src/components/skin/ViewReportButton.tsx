"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2 } from "lucide-react";

/**
 * "View full report" CTA. The report page does server-side work (AI text) before
 * it renders, so this drives navigation through a transition with a spinner.
 */
export function ViewReportButton({ href }: { href: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <span className="relative inline-flex">
      <button
        onClick={() => startTransition(() => router.push(href))}
        disabled={pending}
        className="btn-primary inline-flex items-center text-sm shadow-md ring-2 ring-brand-500/40 transition hover:ring-brand-500/60 disabled:opacity-70"
      >
        {pending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating report…
          </>
        ) : (
          <>
            <FileText className="mr-2 h-4 w-4" /> View full report
          </>
        )}
      </button>
      {!pending ? (
        <span className="pointer-events-none absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
          <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-rose-500" />
        </span>
      ) : null}
    </span>
  );
}
