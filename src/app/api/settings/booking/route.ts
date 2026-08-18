import { NextResponse } from "next/server";

import { getHomeVisitFee } from "@/lib/queries/content";
import { isRazorpayConfigured } from "@/lib/payments/razorpay";

/**
 * The handful of booking settings the browser legitimately needs: what a home
 * visit adds, and whether online payment is available at all (so the UI can
 * say "pay at the clinic" rather than offering a gateway that isn't there).
 *
 * Only these two values — never the key id, never anything secret.
 */
export const revalidate = 300;

export async function GET() {
  const homeVisitFee = await getHomeVisitFee();
  return NextResponse.json({
    homeVisitFee,
    onlinePaymentEnabled: isRazorpayConfigured(),
  });
}
