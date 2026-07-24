import { createHash, randomBytes, timingSafeEqual } from "crypto";

/**
 * Password-reset tokens are stored hashed, never in plaintext. A leaked
 * database dump then can't be used to seize accounts, the same reasoning that
 * applies to passwords themselves.
 */

export function generateResetToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("hex");
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Constant-time compare for two hex digests of equal length. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return timingSafeEqual(bufA, bufB);
}

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
