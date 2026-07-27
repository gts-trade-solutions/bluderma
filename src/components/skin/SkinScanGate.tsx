"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type Status =
  | { authed: false }
  | {
      authed: true;
      state:
        | { status: "ready"; remaining: number }
        | { status: "reserved"; grantId: string }
        | { status: "none" };
      lastAnalysisId: string | null;
      pendingRequest: boolean;
    };

const ERROR_COPY: Record<string, string> = {
  missing_token: "That analysis link was incomplete. Please start again.",
  invalid_token: "That analysis link was invalid or expired. Please start again.",
  token_used: "That analysis link was already used. Start a new scan.",
  no_access: "You have no scans remaining.",
};

export default function SkinScanGate() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(() => {
    const code = params.get("error");
    return code ? ERROR_COPY[code] ?? "Something went wrong. Please try again." : null;
  });
  const [requested, setRequested] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/skin/status", { cache: "no-store" });
      setStatus(await res.json());
    } catch {
      setStatus({ authed: false });
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/skin/start", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.redirectUrl) {
        setError(data.message ?? "Could not start your analysis.");
        setBusy(false);
        return;
      }
      window.location.href = data.redirectUrl;
    } catch {
      setError("Could not start your analysis. Please try again.");
      setBusy(false);
    }
  }

  async function requestAccess() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/skin/request-access", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Could not send your request.");
      } else {
        setRequested(true);
      }
    } catch {
      setError("Could not send your request. Please try again.");
    }
    setBusy(false);
  }

  return (
    <div className="container-page max-w-2xl py-14 sm:py-20">
      <div className="text-center">
        <p className="section-eyebrow">AI Skin Analyzer</p>
        <h1 className="mt-2 text-3xl font-bold text-ink sm:text-4xl">
          Analyze your skin in seconds
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-ink-muted">
          A quick, camera-based scan measures signals like wrinkles, pores,
          redness and hydration, then gives you an overall score and a concern
          breakdown you can review with a clinician.
        </p>
      </div>

      {error && (
        <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="mt-8 rounded-2xl border border-slate-200 p-6 sm:p-8">
        {!status && <p className="text-center text-ink-muted">Loading…</p>}

        {status && !status.authed && (
          <div className="text-center">
            <p className="text-ink-soft">Sign in to run your skin analysis.</p>
            <Link
              href="/login?callbackUrl=/patient/skin-analyzer"
              className="btn-primary mt-4 inline-flex"
            >
              Sign in to continue
            </Link>
          </div>
        )}

        {status && status.authed && (
          <div className="space-y-5">
            {(status.state.status === "ready" ||
              status.state.status === "reserved") && (
              <div className="text-center">
                <button
                  onClick={start}
                  disabled={busy}
                  className="btn-primary inline-flex disabled:opacity-60"
                >
                  {busy
                    ? "Starting…"
                    : status.state.status === "reserved"
                      ? "Continue your scan"
                      : "Start skin analysis"}
                </button>
                <p className="mt-3 text-xs text-ink-muted">
                  You&apos;ll be taken to the secure analyzer, then brought back
                  here with your results. No photo is stored.
                </p>
              </div>
            )}

            {status.state.status === "none" && (
              <div className="text-center">
                {requested || status.pendingRequest ? (
                  <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                    Your request for another scan has been received — we&apos;ll
                    approve it shortly.
                  </p>
                ) : (
                  <>
                    <p className="text-ink-soft">
                      You&apos;ve used your available scan.
                    </p>
                    <button
                      onClick={requestAccess}
                      disabled={busy}
                      className="btn-primary mt-4 inline-flex disabled:opacity-60"
                    >
                      {busy ? "Sending…" : "Request another scan"}
                    </button>
                  </>
                )}
              </div>
            )}

            {status.lastAnalysisId && (
              <div className="border-t border-slate-100 pt-5 text-center">
                <Link
                  href={`/patient/skin-analysis/${status.lastAnalysisId}`}
                  className="font-semibold text-brand-600 hover:text-brand-700"
                >
                  View your last result →
                </Link>
                <div className="mt-1">
                  <Link
                    href="/patient/skin-analysis"
                    className="text-sm text-ink-muted hover:text-ink"
                  >
                    All past analyses
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
