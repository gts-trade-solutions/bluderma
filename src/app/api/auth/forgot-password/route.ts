import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { forgotPasswordSchema } from "@/lib/validation";
import { generateResetToken, RESET_TOKEN_TTL_MS } from "@/lib/tokens";
import { passwordResetEmail, sendEmail } from "@/lib/email";
import { clientIp, rateLimit } from "@/lib/rateLimit";

export async function POST(req: Request) {
  const limit = rateLimit(`forgot:${clientIp(req)}`, 5, 15 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 }
    );
  }

  const { email } = parsed.data;
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, isActive: true, passwordHash: true },
  });

  // Only actually send for an active account that has a password (a
  // Google-only account has nothing to reset). Either way the response below
  // is identical, so this endpoint can't be used to enumerate accounts.
  if (user?.isActive && user.passwordHash) {
    const { token, tokenHash } = generateResetToken();

    await prisma.$transaction([
      // One live token per user: invalidate any earlier unused ones.
      prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
      prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        },
      }),
    ]);

    const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const url = `${base}/reset-password?token=${token}`;
    const mail = passwordResetEmail(user.name, url);

    try {
      await sendEmail({
        to: user.email,
        template: "password-reset",
        relatedId: user.id,
        ...mail,
      });
    } catch (err) {
      // Logged in email_logs already; don't leak the failure to the caller.
      console.error("password reset email failed", err);
    }
  }

  return NextResponse.json({
    ok: true,
    message:
      "If an account exists for that address, we've sent a reset link. Check your inbox.",
  });
}
