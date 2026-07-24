import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { resetPasswordSchema, fieldErrors } from "@/lib/validation";
import { hashToken } from "@/lib/tokens";
import { clientIp, rateLimit } from "@/lib/rateLimit";

const INVALID = "This reset link is invalid or has expired. Request a new one.";

export async function POST(req: Request) {
  const limit = rateLimit(`reset:${clientIp(req)}`, 10, 15 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please check the form.", fields: fieldErrors(parsed.error) },
      { status: 400 }
    );
  }

  const { token, password } = parsed.data;

  // Looked up by hash, so the raw token never has to be compared in the DB.
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, isActive: true } } },
  });

  if (
    !record ||
    record.usedAt ||
    record.expiresAt < new Date() ||
    !record.user.isActive
  ) {
    return NextResponse.json({ error: INVALID }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash: await hashPassword(password) },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    // Any other outstanding tokens for this user are now moot.
    prisma.passwordResetToken.updateMany({
      where: { userId: record.userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
    // Drop adapter-persisted sessions so other devices are signed out.
    prisma.session.deleteMany({ where: { userId: record.userId } }),
  ]);

  return NextResponse.json({
    ok: true,
    message: "Your password has been updated. You can sign in now.",
  });
}
