import crypto from "crypto";
import Razorpay from "razorpay";

/**
 * Razorpay wiring, following the flow proven on Made-in-Korea: the server
 * creates the order, the browser opens checkout with it, and the server
 * verifies the returned signature before anything is marked paid. The client
 * is never trusted to report its own success.
 *
 * Everything here degrades rather than throws when the keys are absent, so
 * the app runs — and bookings still complete — before the secrets land in
 * `.env`. Call `isRazorpayConfigured()` at the decision points instead of
 * catching failures downstream.
 */

/** Razorpay refuses anything under ₹1, so a smaller total is settled as free. */
export const MIN_CHARGE_INR = 1;

export function isRazorpayConfigured(): boolean {
  return Boolean(
    process.env.RAZORPAY_KEY_ID?.trim() && process.env.RAZORPAY_KEY_SECRET?.trim()
  );
}

export function razorpayKeyId(): string {
  return process.env.RAZORPAY_KEY_ID?.trim() ?? "";
}

let client: Razorpay | null = null;

/** The SDK instance. Throws only if called without configuration. */
export function razorpayClient(): Razorpay {
  if (!isRazorpayConfigured()) {
    throw new Error("Razorpay is not configured on this environment.");
  }
  if (!client) {
    client = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!.trim(),
      key_secret: process.env.RAZORPAY_KEY_SECRET!.trim(),
    });
  }
  return client;
}

/** Rupees → paise. Razorpay works entirely in minor units. */
export function toMinorUnits(amountInr: number): number {
  return Math.round(amountInr * 100);
}

/** Constant-time compare — a fast-exit compare on a signature is an oracle. */
function sameDigest(expected: string, provided: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided ?? "", "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * The signature Razorpay returns to the browser is HMAC-SHA256 of
 * "<order_id>|<payment_id>" keyed with the API secret.
 */
export function verifyPaymentSignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  if (!isRazorpayConfigured()) return false;

  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!.trim())
    .update(`${input.orderId}|${input.paymentId}`)
    .digest("hex");

  return sameDigest(expected, input.signature);
}

export function isWebhookConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_WEBHOOK_SECRET?.trim());
}

/**
 * Webhook signatures are a different scheme from the checkout one: HMAC-SHA256
 * of the **raw request body**, keyed with the webhook secret (which is set in
 * the Razorpay dashboard and is not the API secret). The body must be hashed
 * byte-for-byte as received — parsing and re-serialising it changes the bytes
 * and the digest will never match.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string
): boolean {
  if (!isWebhookConfigured()) return false;

  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!.trim())
    .update(rawBody)
    .digest("hex");

  return sameDigest(expected, signature);
}
