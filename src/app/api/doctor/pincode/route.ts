import { NextResponse } from "next/server";

import { getOwnDoctor } from "@/lib/doctor/guard";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * Area, city and state for an Indian PIN code.
 *
 * Backed by India Post's public API — free, keyless, and *real*. That last
 * word is the whole point: an address is the one field on this form a doctor
 * cannot check by reading it back, because a wrong-but-plausible street will
 * look right to them and send patients to the wrong building. So no model is
 * ever asked to produce one. This relays India Post or it returns nothing.
 *
 * Every failure mode leaves the form exactly as it was — the fields stay
 * editable and the doctor types the address themselves, which is what they did
 * before this existed.
 */

interface PostOffice {
  Name?: unknown;
  District?: unknown;
  State?: unknown;
}

export interface PincodeResult {
  areas: string[];
  city: string;
  state: string;
}

/** PIN codes do not change, so a hit is good for the life of the process. */
const cache = new Map<string, { data: PincodeResult | null; expires: number }>();
const TTL_MS = 12 * 60 * 60 * 1000;

function remember(pin: string, data: PincodeResult | null) {
  // Keep the map from growing without bound on a long-lived server.
  if (cache.size >= 500) {
    const now = Date.now();
    for (const [k, v] of cache) if (v.expires <= now) cache.delete(k);
    if (cache.size >= 500) cache.clear();
  }
  cache.set(pin, { data, expires: Date.now() + TTL_MS });
}

export async function GET(req: Request) {
  // Only ever used by the onboarding and practice forms, so it is gated the
  // same way they are rather than left open as a public lookup service.
  const owner = await getOwnDoctor();
  if (!owner) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const pin = (new URL(req.url).searchParams.get("pin") ?? "").trim();
  if (!/^\d{6}$/.test(pin)) {
    // Matches the server-side clinicSchema contract exactly.
    return NextResponse.json({ ok: false, error: "invalid_pincode" }, { status: 422 });
  }

  const limit = rateLimit(`pincode:${owner.doctorId}`, 40, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", retryAfterSeconds: limit.retryAfterSeconds },
      { status: 429 }
    );
  }

  const hit = cache.get(pin);
  if (hit && hit.expires > Date.now()) {
    return hit.data
      ? NextResponse.json({ ok: true, found: true, ...hit.data, cached: true })
      : NextResponse.json({ ok: true, found: false, cached: true });
  }

  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`, {
      signal: AbortSignal.timeout(4000),
      headers: { accept: "application/json" },
    });
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: "lookup_failed" }, { status: 502 });
    }

    const json = await res.json();
    const entry = Array.isArray(json) ? json[0] : null;

    // India Post answers "no such PIN code" with HTTP 200 and Status:"Error",
    // so a status check is not enough — the body has to be read.
    const offices: PostOffice[] = Array.isArray(entry?.PostOffice)
      ? entry.PostOffice
      : [];
    if (entry?.Status !== "Success" || offices.length === 0) {
      remember(pin, null);
      return NextResponse.json({ ok: true, found: false });
    }

    const areas: string[] = [];
    for (const o of offices) {
      const name = typeof o.Name === "string" ? o.Name.trim() : "";
      if (name && !areas.includes(name)) areas.push(name);
    }

    const first = offices[0];
    const data: PincodeResult = {
      areas,
      city: typeof first.District === "string" ? first.District.trim() : "",
      state: typeof first.State === "string" ? first.State.trim() : "",
    };

    remember(pin, data);
    return NextResponse.json({ ok: true, found: true, ...data });
  } catch (e) {
    // A timeout or a DNS failure is not "no such PIN code" — say the lookup
    // failed so the UI can tell the doctor to fill it in themselves.
    console.error("[pincode] lookup failed:", e);
    return NextResponse.json({ ok: false, error: "lookup_failed" }, { status: 502 });
  }
}
