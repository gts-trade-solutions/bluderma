import "server-only";
import crypto from "node:crypto";

/**
 * Skin Analyzer integration — cryptographic contract (BluDerma side).
 *
 * BluDerma is the authority for identity + entitlement. It hands a user off to
 * the standalone analyzer (skinanalyzer.madenkorea.com, `/bd/*` tenant surface)
 * with a short-lived single-use signed token, and later receives a signed
 * server-to-server post-back with the analysis result.
 *
 * Two primitives, both keyed by SKIN_ANALYZER_SHARED_SECRET (which must hold the
 * SAME value as the analyzer's BLUDERMA_SHARED_SECRET):
 *   1. Handoff token — HS256 JWT, 5-min TTL, single-use `jti`. BluDerma SIGNS;
 *      the analyzer verifies.
 *   2. Callback signature — HMAC-SHA256 over `${t}.${rawBody}`, in the
 *      `X-Analyzer-Signature` header. The analyzer SIGNS; BluDerma VERIFIES.
 *
 * MIRROR of the analyzer repo's lib/bd/crypto.ts — keep byte-compatible.
 */

const SECRET = process.env.SKIN_ANALYZER_SHARED_SECRET || "";

/** Base URL of the standalone analyzer, e.g. https://skinanalyzer.madenkorea.com */
export const ANALYZER_URL = (process.env.SKIN_ANALYZER_URL || "").replace(
  /\/+$/,
  ""
);

export const HANDOFF_TTL_SEC = 300; // 5 minutes
export const CALLBACK_TOLERANCE_SEC = 300; // ±5 minutes clock skew

function assertSecret(): void {
  if (!SECRET) {
    throw new Error(
      "SKIN_ANALYZER_SHARED_SECRET is not set — refusing to sign/verify."
    );
  }
}

export function isAnalyzerConfigured(): boolean {
  return !!SECRET && !!ANALYZER_URL;
}

function b64urlJson(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}
function decodeSegment<T>(seg: string): T {
  return JSON.parse(Buffer.from(seg, "base64url").toString("utf8")) as T;
}

/** Constant-time compare that never throws on length mismatch. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

// ── Handoff token (BluDerma → analyzer) ───────────────────────────────

export type HandoffClaims = {
  iss: "bluderma";
  aud: "skin-analyzer";
  sub: string; // BluDerma user id (the identity the analyzer trusts)
  email: string | null;
  name: string | null;
  grant_id: string; // the reserved skin_entitlements row — echoed back on callback
  kind: "face";
  jti: string; // single-use nonce (replay-guarded on the analyzer)
  iat: number;
  exp: number;
};

export type HandoffInput = {
  userId: string;
  email: string | null;
  name: string | null;
  grantId: string;
};

export function signHandoffToken(
  input: HandoffInput,
  ttlSec: number = HANDOFF_TTL_SEC
): string {
  assertSecret();
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const payload: HandoffClaims = {
    iss: "bluderma",
    aud: "skin-analyzer",
    sub: input.userId,
    email: input.email,
    name: input.name,
    grant_id: input.grantId,
    kind: "face",
    jti: crypto.randomUUID(),
    iat: now,
    exp: now + ttlSec,
  };
  const signingInput = `${b64urlJson(header)}.${b64urlJson(payload)}`;
  const sig = crypto
    .createHmac("sha256", SECRET)
    .update(signingInput)
    .digest("base64url");
  return `${signingInput}.${sig}`;
}

export function verifyHandoffToken(token: string): HandoffClaims | null {
  assertSecret();
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, sig] = parts;
  const expected = crypto
    .createHmac("sha256", SECRET)
    .update(`${h}.${p}`)
    .digest("base64url");
  if (!safeEqual(sig, expected)) return null;
  let claims: HandoffClaims;
  try {
    claims = decodeSegment<HandoffClaims>(p);
  } catch {
    return null;
  }
  if (claims.iss !== "bluderma" || claims.aud !== "skin-analyzer") return null;
  const now = Math.floor(Date.now() / 1000);
  if (typeof claims.exp !== "number" || claims.exp < now) return null;
  return claims;
}

/** Full redirect URL that hands the user off to the analyzer's BluDerma tenant. */
export function buildHandoffUrl(input: HandoffInput): string {
  if (!ANALYZER_URL) throw new Error("SKIN_ANALYZER_URL is not set.");
  const token = signHandoffToken(input);
  return `${ANALYZER_URL}/bd/enter?t=${encodeURIComponent(token)}`;
}

// ── Callback signature (analyzer → BluDerma) ──────────────────────────

/** Produce the `X-Analyzer-Signature` header value for a raw JSON body. */
export function signCallback(
  rawBody: string,
  tSec: number = Math.floor(Date.now() / 1000)
): string {
  assertSecret();
  const mac = crypto
    .createHmac("sha256", SECRET)
    .update(`${tSec}.${rawBody}`)
    .digest("hex");
  return `t=${tSec},v1=${mac}`;
}

/** Verify an incoming callback signature against the raw request body. */
export function verifyCallback(
  rawBody: string,
  header: string | null,
  toleranceSec: number = CALLBACK_TOLERANCE_SEC
): boolean {
  assertSecret();
  if (!header) return false;
  let t = "";
  let v1 = "";
  for (const part of header.split(",")) {
    const [k, val] = part.split("=");
    if (k?.trim() === "t") t = val?.trim() ?? "";
    if (k?.trim() === "v1") v1 = val?.trim() ?? "";
  }
  if (!t || !v1) return false;
  const tNum = Number(t);
  if (!Number.isFinite(tNum)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - tNum) > toleranceSec) return false;
  const expected = crypto
    .createHmac("sha256", SECRET)
    .update(`${t}.${rawBody}`)
    .digest("hex");
  return safeEqual(v1, expected);
}
