import { NextResponse } from "next/server";

import {
  isWebhookConfigured,
  verifyWebhookSignature,
} from "@/lib/payments/razorpay";
import { markPaymentFailed, settlePayment } from "@/lib/payments/settle";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Razorpay's server-to-server payment events — the reliable settlement path.
 *
 * The browser's return from checkout is best-effort: close the tab during the
 * redirect and a captured payment would otherwise sit against a PENDING
 * appointment forever. Razorpay retries this endpoint until it gets a 2xx, so
 * this is what guarantees a paid booking ends up confirmed.
 *
 * There is no session here — it is Razorpay calling, not a browser. The HMAC
 * over the raw body *is* the authentication, so it is checked before the
 * payload is trusted for anything, and the body is read as text so the bytes
 * hashed are exactly the bytes sent.
 *
 * Always answers 2xx once the signature is good, even for events we ignore or
 * rows we cannot find: a non-2xx makes Razorpay retry, and retrying an event
 * we have already handled (or will never handle) achieves nothing.
 *
 * Setup: Razorpay Dashboard → Settings → Webhooks → add
 * `https://<host>/api/razorpay/webhook`, subscribe to `payment.captured` and
 * `payment.failed`, and put the secret it gives you in RAZORPAY_WEBHOOK_SECRET.
 */
export async function POST(req: Request) {
  if (!isWebhookConfigured()) {
    // Nothing to verify against — refuse rather than trust an unsigned caller.
    return NextResponse.json(
      { ok: false, error: "webhook not configured" },
      { status: 503 }
    );
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";

  if (!verifyWebhookSignature(rawBody, signature)) {
    console.warn("[RZP:webhook] rejected: bad signature");
    return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 400 });
  }

  let event: {
    event?: string;
    payload?: {
      payment?: {
        entity?: {
          order_id?: string;
          id?: string;
          error_description?: string;
          error_reason?: string;
        };
      };
    };
  };
  try {
    event = JSON.parse(rawBody);
  } catch {
    // Signed but unparseable: acknowledge so it isn't retried forever.
    return NextResponse.json({ ok: true, ignored: "unparseable" });
  }

  const entity = event.payload?.payment?.entity;
  const orderId = entity?.order_id;
  const paymentId = entity?.id;

  if (!orderId || !paymentId) {
    return NextResponse.json({ ok: true, ignored: "no payment entity" });
  }

  switch (event.event) {
    case "payment.captured": {
      const settled = await settlePayment({
        providerOrderId: orderId,
        providerPaymentId: paymentId,
        // The webhook carries no per-payment signature; the body HMAC above is
        // what proved this genuine, and the browser path records its own.
        signature: null,
      });
      if (!settled.ok) {
        // A capture for an order we never created. Log it — it needs a human,
        // not a retry.
        console.error("[RZP:webhook] captured payment for unknown order", orderId);
        return NextResponse.json({ ok: true, ignored: "unknown order" });
      }
      console.info(
        `[RZP:webhook] ${settled.alreadySettled ? "already settled" : "settled"} ${orderId}`
      );
      return NextResponse.json({ ok: true, appointmentId: settled.appointmentId });
    }

    case "payment.failed": {
      const reason =
        entity.error_description ?? entity.error_reason ?? "payment failed";
      await markPaymentFailed(orderId, reason);
      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json({ ok: true, ignored: event.event ?? "unknown" });
  }
}
