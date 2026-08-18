"use client";

import { useCallback, useRef } from "react";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (resp: unknown) => void) => void;
    };
  }
}

export type CheckoutOutcome =
  | { status: "paid"; appointmentId: string }
  /** Nothing chargeable, or the gateway isn't configured on this build. */
  | { status: "no_payment_due"; appointmentId: string; message?: string }
  | { status: "cancelled" }
  | { status: "failed"; error: string };

/** What is being bought. The order endpoint differs; nothing else does. */
export interface CheckoutRequest {
  /** The route that creates the Razorpay order and the matching Payment row. */
  createUrl: string;
  /** Posted to it. The server derives the amount — never this. */
  body: Record<string, unknown>;
  /** Shown in the Razorpay modal. */
  description: string;
  /**
   * Echoed back in the outcome and attached to the order as a note. For an
   * appointment this is its id; for a subscription, the subscription id.
   */
  reference: string;
}

/**
 * Razorpay checkout.
 *
 * Whatever is being bought already exists as a server-side row before this
 * runs — an appointment holding its slot, a subscription waiting to start — so
 * an abandoned payment costs nothing and leaves an auditable CREATED row
 * rather than a hole. The server decides the amount and verifies the
 * signature; this hook only carries values between the two endpoints and
 * reports what happened.
 *
 * Resolves rather than throws: every ending — paid, nothing due, dismissed,
 * failed — is a value the caller can render.
 */
export function useRazorpayCheckout() {
  const busy = useRef(false);

  const checkout = useCallback(
    async (req: CheckoutRequest): Promise<CheckoutOutcome> => {
      const appointmentId = req.reference;
      if (busy.current) return { status: "failed", error: "Payment already in progress." };
      busy.current = true;

      try {
        const res = await fetch(req.createUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(req.body),
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok || !data?.ok) {
          return {
            status: "failed",
            error: data?.error ?? "Could not start the payment.",
          };
        }

        // Already settled, nothing to charge, or no gateway on this build.
        if (data.alreadyPaid || data.free || data.unavailable) {
          return data.alreadyPaid
            ? { status: "paid", appointmentId }
            : {
                status: "no_payment_due",
                appointmentId,
                message: data.message,
              };
        }

        if (typeof window === "undefined" || !window.Razorpay) {
          return { status: "failed", error: "Payment window could not load." };
        }

        // Razorpay's callbacks are the only way out of the modal, so the
        // outcome is delivered through a promise the handlers settle.
        return await new Promise<CheckoutOutcome>((resolve) => {
          const reportFailure = (reason: string) =>
            fetch("/api/razorpay/failed", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: data.order.id,
                reason,
              }),
            }).catch(() => {
              /* telemetry only */
            });

          const rzp = new window.Razorpay!({
            key: data.key,
            amount: data.order.amount,
            currency: data.order.currency,
            order_id: data.order.id,
            name: "BluDerma",
            description: req.description,
            prefill: data.prefill,
            notes: { reference: req.reference },
            theme: { color: "#1f6fd6" },
            handler: async (resp: Record<string, string>) => {
              try {
                const verify = await fetch("/api/razorpay/verify", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    razorpay_order_id: resp.razorpay_order_id,
                    razorpay_payment_id: resp.razorpay_payment_id,
                    razorpay_signature: resp.razorpay_signature,
                  }),
                });
                const vj = await verify.json().catch(() => ({}));
                if (!verify.ok || !vj?.ok) {
                  resolve({
                    status: "failed",
                    error: vj?.error ?? "We could not verify that payment.",
                  });
                  return;
                }
                resolve({ status: "paid", appointmentId });
              } catch {
                resolve({
                  status: "failed",
                  error: "Payment taken but not verified. Our team will confirm shortly.",
                });
              }
            },
            modal: {
              ondismiss: () => {
                void reportFailure("dismissed");
                resolve({ status: "cancelled" });
              },
            },
          });

          rzp.on("payment.failed", (resp: unknown) => {
            const err =
              (resp as { error?: { description?: string; reason?: string } })
                ?.error ?? {};
            const message = err.description ?? err.reason ?? "Payment failed.";
            void reportFailure(message);
            resolve({ status: "failed", error: message });
          });

          rzp.open();
        });
      } catch (e) {
        return {
          status: "failed",
          error: e instanceof Error ? e.message : "Payment could not start.",
        };
      } finally {
        busy.current = false;
      }
    },
    []
  );

  /**
   * Pay for a booked appointment. The original entry point, kept as-is so the
   * two booking components did not have to change when subscriptions arrived.
   */
  const pay = useCallback(
    (appointmentId: string) =>
      checkout({
        createUrl: "/api/razorpay/create",
        body: { appointmentId },
        description: "Consultation fee",
        reference: appointmentId,
      }),
    [checkout]
  );

  /** Buy or renew a White Collar term. */
  const paySubscription = useCallback(
    (planSlug: string, planName: string) =>
      checkout({
        createUrl: "/api/subscription/checkout",
        body: { planSlug },
        description: `${planName} membership`,
        reference: planSlug,
      }),
    [checkout]
  );

  return { pay, paySubscription, checkout };
}
