import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { markPaymentFailed } from "@/lib/payments/settle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Records a payment that Razorpay reported as failed, or that the patient
 * dismissed. Best-effort telemetry: the appointment is left alone (its slot
 * stays held and it can be paid again or cancelled), and only a CREATED row
 * is moved to FAILED so a late success can still settle it.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const orderId = String(body?.razorpay_order_id ?? "");
  if (!orderId) return NextResponse.json({ ok: false }, { status: 400 });

  const reason = String(body?.reason ?? "").slice(0, 500) || "cancelled";

  // Ownership check first — markPaymentFailed is keyed on the order alone.
  const owned = await prisma.payment.findFirst({
    where: { providerOrderId: orderId, userId: user.id },
    select: { id: true },
  });
  if (owned) await markPaymentFailed(orderId, reason);

  return NextResponse.json({ ok: true });
}
