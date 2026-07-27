import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/session";
import { reserve } from "@/lib/integrations/skinEntitlement";
import { buildHandoffUrl } from "@/lib/integrations/skinAnalyzer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Reserve a scan and mint the signed handoff URL to the analyzer's BluDerma
// tenant. The client then does window.location = redirectUrl.
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const grantId = await reserve(user.id);
  if (!grantId) {
    return NextResponse.json(
      { error: "no_access", message: "You have no analyses remaining." },
      { status: 403 }
    );
  }

  try {
    const redirectUrl = buildHandoffUrl({
      userId: user.id,
      email: user.email ?? null,
      name: user.name ?? null,
      grantId,
    });
    return NextResponse.json({ redirectUrl });
  } catch (e) {
    return NextResponse.json(
      { error: "not_configured", message: (e as Error).message },
      { status: 500 }
    );
  }
}
