import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/session";
import { getAccessState } from "@/lib/integrations/skinEntitlement";
import { prisma } from "@/lib/prisma";
import { enquiryNotifyAddress, sendEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A user asks for another scan once their free one is used. Approval happens in
// the BluDerma admin (/admin/skin-requests).
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const state = await getAccessState(user.id);
  if (state.status === "ready" || state.status === "reserved") {
    return NextResponse.json(
      {
        error: "already_have_access",
        message: "You already have a scan available.",
      },
      { status: 400 }
    );
  }

  const pending = await prisma.skinAccessRequest.findFirst({
    where: { userId: user.id, status: "pending" },
  });
  if (pending) return NextResponse.json({ ok: true, alreadyPending: true });

  await prisma.skinAccessRequest.create({
    data: { userId: user.id, status: "pending" },
  });

  // Best-effort admin notification — never fail the request on a mail error.
  try {
    await sendEmail({
      to: enquiryNotifyAddress(),
      subject: "New skin-analysis access request",
      template: "skin-access-request",
      text: `${user.name ?? user.email ?? user.id} has requested another skin analysis. Approve it in /admin/skin-requests.`,
      html: `<p><strong>${user.name ?? user.email ?? user.id}</strong> has requested another skin analysis.</p><p>Approve it in the admin panel under <a href="/admin/skin-requests">Skin requests</a>.</p>`,
    });
  } catch {
    /* non-fatal */
  }

  return NextResponse.json({ ok: true });
}
