"use client";

import { useCallback, useEffect, useState } from "react";

import { useRazorpayCheckout } from "./useRazorpayCheckout";

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
      /** True when this deployment can actually take a card. */
      payable?: boolean;
      /** What another scan costs, and whether this one is free. */
      offer?: {
        free: boolean;
        priceInr: number;
        listPriceInr: number;
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
  const { checkout } = useRazorpayCheckout();

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

  /**
   * Buy another analysis.
   *
   * This lived only on the analyser's own landing page, so the card on the
   * browse hub offered "request another scan" instead — an admin had to
   * approve it, while the card sat there quoting a price. A visitor who is
   * shown a figure expects to be able to pay it.
   *
   * One POST. /api/skin/purchase creates the order and the Payment row;
   * useRazorpayCheckout handles all three of its answers: a real order, a
   * free grant, or the gateway not being configured on this build.
   *
   * The credit is granted when the payment SETTLES, not when checkout opens
   * (see releaseScanCredit in lib/payments/settle.ts), so an abandoned
   * payment leaves nothing behind and this only has to reload.
   */
  const purchase = useCallback(async () => {
    setBusy(true);
    setError(null);
    const outcome = await checkout({
      createUrl: "/api/skin/purchase",
      body: {},
      description: "Skin analysis",
      reference: "skin-scan",
    });
    if (outcome.status === "paid" || outcome.status === "no_payment_due") {
      await load();
    } else if (outcome.status === "failed") {
      setError(outcome.error);
    }
    setBusy(false);
  }, [checkout, load]);

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
    purchase,
    requestAccess,
    firstScanFree,
    /** What another analysis costs, from settings. Never hardcoded in a card. */
    priceInr: status?.authed ? status.offer?.priceInr ?? null : null,
    /**
     * The "usually" anchor. Null where there is no offer running, which is
     * how a card knows not to draw a strike-through: the server has already
     * collapsed an anchor that is not above the charged price.
     */
    listPriceInr: status?.authed
      ? status.offer && status.offer.listPriceInr > status.offer.priceInr
        ? status.offer.listPriceInr
        : null
      : null,
    /** Whether asking staff is still offered when payment is unavailable. */
    allowRequests: status?.authed ? status.offer?.allowRequests ?? false : false,
    /** Whether a card can be charged here at all. */
    payable: status?.authed ? status.payable === true : false,
  };
}
