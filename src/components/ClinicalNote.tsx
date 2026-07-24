"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

interface NoteState {
  loading: boolean;
  note: string | null;
}

/**
 * Practitioner-only clinical note.
 *
 * The text is deliberately NOT passed in as a prop: /treatments/[slug] is
 * statically generated, so anything rendered on the server ends up in the
 * public HTML regardless of what we hide with CSS or client-side state. The
 * note is fetched from an authenticated route instead, and only ever reaches
 * a clinician's browser.
 */
export default function ClinicalNote({ slug }: { slug: string }) {
  const { status } = useSession();
  const pathname = usePathname();
  const [state, setState] = useState<NoteState>({ loading: true, note: null });

  useEffect(() => {
    if (status === "loading") return;

    if (status !== "authenticated") {
      setState({ loading: false, note: null });
      return;
    }

    let cancelled = false;
    fetch(`/api/treatments/${slug}/clinical-note`)
      .then((r) => (r.ok ? r.json() : { allowed: false }))
      .then((data) => {
        if (cancelled) return;
        setState({
          loading: false,
          note: data.allowed ? data.clinicalNote ?? null : null,
        });
      })
      .catch(() => {
        if (!cancelled) setState({ loading: false, note: null });
      });

    return () => {
      cancelled = true;
    };
  }, [slug, status]);

  if (state.loading) {
    return (
      <div className="h-32 animate-pulse rounded-2xl border border-brand-100 bg-brand-50/40" />
    );
  }

  if (state.note) {
    return (
      <div className="rounded-2xl border border-brand-200 bg-brand-50/50 p-6">
        <div className="flex items-center gap-2">
          <span className="chip">Clinical note</span>
          <span className="text-xs text-ink-muted">For practitioners</span>
        </div>
        <p className="mt-3 leading-relaxed text-ink-soft">{state.note}</p>
      </div>
    );
  }

  // Signed in but not a clinician, or not signed in at all.
  return (
    <div className="rounded-2xl border border-dashed border-brand-200 bg-brand-50/30 p-6">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
            <path
              d="M7 10V7a5 5 0 0 1 10 0v3m-11 0h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="text-sm font-bold text-ink">Clinical note</span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-ink-muted">
        Dosing, protocol and reassessment guidance for this treatment is
        available to verified medical professionals.
      </p>
      <div className="mt-4 flex flex-wrap gap-2.5">
        {status === "authenticated" ? (
          <Link href="/doctor#contact" className="btn-ghost !px-5 !py-2 text-xs">
            Request clinical access
          </Link>
        ) : (
          <>
            <Link
              href={`/login?callbackUrl=${encodeURIComponent(pathname ?? "/")}`}
              className="btn-primary !px-5 !py-2 text-xs"
            >
              Sign in
            </Link>
            <Link href="/doctor#contact" className="btn-ghost !px-5 !py-2 text-xs">
              Request access
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
