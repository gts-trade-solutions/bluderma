import { NextResponse } from "next/server";

import { getOwnDoctor } from "@/lib/doctor/guard";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Whisper on a two-minute clip takes a few seconds; the default 10 is tight
// once the upload itself is counted on a clinic's connection.
export const maxDuration = 60;

/**
 * Speech to text, for a doctor holding a phone.
 *
 * ── Why this exists ──────────────────────────────────────────────────────
 * Aftercare and pre-treatment instructions are written between patients, on a
 * phone, by somebody who has just finished a procedure and is about to start
 * another. Typing four sentences of clinical instruction into a mobile
 * keyboard in that gap does not happen — the field gets one line or nothing,
 * and the sheet goes out with the standard content alone.
 *
 * ── What it deliberately does NOT do ─────────────────────────────────────
 * It transcribes. It does not interpret, summarise or tidy. The rephrasing is
 * a separate, visible step the doctor confirms (see the `clinical-rephrase`
 * task in /api/doctor/assist), because a model quietly rewording a clinical
 * instruction between the doctor saying it and the patient reading it is the
 * one thing that must not happen invisibly.
 *
 * ── Nothing is stored ────────────────────────────────────────────────────
 * The audio is held in memory for the length of the request and forwarded to
 * the transcription API. It is not written to S3, not logged, and no
 * transcript is kept here — what the doctor keeps is what they put in the
 * form. Recordings of a clinician discussing a named patient are not
 * something to accumulate for the convenience of a text field.
 */

const ENDPOINT = "https://api.openai.com/v1/audio/transcriptions";

/** A minute of Opus is well under this; the cap is for a stuck recorder. */
const MAX_BYTES = 20 * 1024 * 1024;

const ALLOWED = [
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/x-m4a",
  "audio/m4a",
];

export async function POST(req: Request) {
  const owner = await getOwnDoctor();
  if (!owner) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    return NextResponse.json(
      {
        ok: false,
        error: "not_configured",
        message: "Dictation is not switched on. Type the instructions instead.",
      },
      { status: 503 }
    );
  }

  // Generous, but not unlimited: this is a paid upstream call and the button
  // is one tap.
  const limit = rateLimit(`dictate:${owner.doctorId}`, 60, 60 * 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "rate_limited",
        message: "That is a lot of dictation in an hour. Try again shortly.",
        retryAfterSeconds: limit.retryAfterSeconds,
      },
      { status: 429 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const audio = form.get("audio");
  if (!(audio instanceof File) || audio.size === 0) {
    return NextResponse.json({ ok: false, error: "no_audio" }, { status: 400 });
  }
  if (audio.size > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: "too_long", message: "That recording is too long. Keep it under a couple of minutes." },
      { status: 413 }
    );
  }

  // The browser labels a MediaRecorder blob "audio/webm;codecs=opus", so the
  // parameters are stripped before the type is checked.
  const base = (audio.type || "").split(";")[0].trim().toLowerCase();
  if (base && !ALLOWED.includes(base)) {
    return NextResponse.json(
      { ok: false, error: "unsupported", message: "That audio format is not supported." },
      { status: 415 }
    );
  }

  const upstream = new FormData();
  upstream.append("file", audio, audio.name || "note.webm");
  upstream.append("model", process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1");
  // English is stated rather than detected. Indian-English clinical dictation
  // is otherwise sometimes detected as Hindi or Urdu on the first few words,
  // and a transcript that switches script mid-sentence is worse than one with
  // a misheard word in it. A doctor dictating in another language types
  // instead — which is why the field never stops being editable.
  upstream.append("language", "en");
  // Steers the vocabulary. Not an instruction to the model about what to
  // write; a hint about what it is likely to be hearing.
  upstream.append(
    "prompt",
    "Dermatology clinic instructions. Terms may include tretinoin, isotretinoin, hydroquinone, benzoyl peroxide, hyaluronic, microneedling, CO2 laser, Q-switched, chemical peel, SPF, erythema, hyperpigmentation."
  );

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { authorization: `Bearer ${key}` },
      body: upstream,
      // A doctor between patients will not wait longer than this, and neither
      // should a request holding a server thread.
      signal: AbortSignal.timeout(45_000),
    });

    if (!res.ok) {
      console.error("transcription failed", res.status, await res.text().catch(() => ""));
      return NextResponse.json(
        {
          ok: false,
          error: "upstream",
          message: "Could not transcribe that. Try again, or type it.",
        },
        { status: 502 }
      );
    }

    const data = (await res.json()) as { text?: string };
    const text = (data.text ?? "").trim();

    if (!text) {
      return NextResponse.json({
        ok: false,
        error: "empty",
        message: "Nothing was picked up. Check the microphone and try again.",
      });
    }

    return NextResponse.json({ ok: true, text });
  } catch (e) {
    console.error("transcription error", e);
    return NextResponse.json(
      {
        ok: false,
        error: "unreachable",
        message: "Could not reach the transcription service. Type it instead.",
      },
      { status: 502 }
    );
  }
}
