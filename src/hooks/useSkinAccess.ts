"use client";

import { useCallback, useEffect, useState } from "react";

export type SkinStatus =
  | { authed: false }
  | {
      authed: true;
      state:
        | { status: "ready"; remaining: number }
        | { status: "reserved"; grantId: string }
        | { status: "none" };
      lastAnalysisId: string | null;
      pendingRequest: boolean;
      /** What another scan costs, and whether this one is free. */
      offer?: {
        free: boolean;
        priceInr: number;
        creditsAvailable: number;
        scansUsed: number;
        allowRequests: boolean;
      };
    };

/**
 * Entitlement + hand-off for the AI skin analyzer, shared by the analyzer
 * landing page and the "analyse your skin" card on the client hub so both
 * drive the same flow (`/api/skin/status` → `/api/skin/start` → redirect).
 */
export function useSkinAccess() {
  const [status, setStatus] = useState<SkinStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/skin/status", { cache: "no-store" });
      setStatus(await r.json());
    } catch {
      setStatus({ authed: false });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const start = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/skin/start", { method: "POST" });
      const data = await r.json();
      if (!r.ok || !data.redirectUrl) {
        setError(data.message ?? "Could not start your analysis.");
        setBusy(false);
        return;
      }
      window.location.href = data.redirectUrl;
    } catch {
      setError("Something went wrong. Please try again.");
      setBusy(false);
    }
  }, []);

  const requestAccess = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/skin/request-access", { method: "POST" });
      const data = await r.json();
      if (!r.ok) setError(data.message ?? "Could not submit your request.");
      else await load();
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setBusy(false);
  }, [load]);

  /** True while the client still has their complimentary first scan. */
  const firstScanFree =
    !status ||
    !status.authed ||
    status.state.status === "ready" ||
    status.state.status === "reserved";

  return {
    status,
    busy,
    error,
    setError,
    reload: load,
    start,
    requestAccess,
    firstScanFree,
  };
}
