"use client";

import { useEffect, useRef, useState } from "react";

import { useFieldError } from "@/components/admin/formContext";

/**
 * The doctor's own instructions: spoken, typed, or spoken then tidied.
 *
 * ── Why dictation ────────────────────────────────────────────────────────
 * These are written between patients, on a phone, by somebody who has just
 * finished one procedure and is about to start another. Four sentences of
 * clinical instruction do not get typed into a mobile keyboard in that gap —
 * the field gets one line or nothing, and the sheet goes out with the
 * standard content alone. Twenty seconds of talking is a thing that fits.
 *
 * ── Why the rewrite is a confirmation, not a replacement ─────────────────
 * The tidied version NEVER slides into the field on its own. It appears
 * beside what the doctor actually said, both readable at once, and stays
 * there until they press "Use this" — and even then it lands in an editable
 * textarea rather than being submitted.
 *
 * That is the whole design. A model quietly rewording a clinical instruction
 * between the doctor saying it and the patient reading it is the one failure
 * this cannot have: the patient has no way to tell which sentence came from
 * their doctor, and neither, afterwards, does the doctor. So the model's
 * output is a suggestion a human accepts, every time, with the original still
 * on screen to compare against.
 *
 * ── What happens with no API key ─────────────────────────────────────────
 * Neither button is rendered. It is a plain textarea, which is how every
 * sheet was written until now and is a perfectly good way to write one. A
 * disabled button explaining it needs configuration helps nobody.
 */

type Phase =
  | { kind: "idle" }
  | { kind: "recording"; seconds: number }
  | { kind: "transcribing" }
  | { kind: "rephrasing" }
  | { kind: "review"; original: string; suggestion: string };

/** Long enough for real instructions, short enough not to be a stuck tab. */
const MAX_SECONDS = 180;

export default function ClinicalNoteField({
  name,
  label,
  hint,
  defaultValue = "",
  rows = 6,
  kind,
  aiEnabled,
  placeholder,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultValue?: string;
  rows?: number;
  /** Which side of the treatment, so the rewrite is briefed correctly. */
  kind: "PRE" | "POST";
  aiEnabled: boolean;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const error = useFieldError(name);

  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [problem, setProblem] = useState<string | null>(null);

  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const ticker = useRef<number | null>(null);

  // A recorder left running holds the microphone — and the browser's
  // recording indicator — after the doctor has navigated away.
  useEffect(() => {
    return () => {
      if (ticker.current) window.clearInterval(ticker.current);
      const r = recorder.current;
      if (r && r.state !== "inactive") r.stop();
      r?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  /** Appends rather than replaces: a second thought should not wipe the first. */
  function append(text: string) {
    const el = ref.current;
    if (!el) return;
    const existing = el.value.trim();
    el.value = existing ? `${existing}\n${text}` : text;
    el.focus();
  }

  async function startRecording() {
    setProblem(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Left to the browser: Chrome gives webm/opus, Safari gives mp4, and
      // naming a type Safari does not support throws rather than falling back.
      const rec = new MediaRecorder(stream);
      chunks.current = [];

      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (ticker.current) window.clearInterval(ticker.current);
        const blob = new Blob(chunks.current, { type: rec.mimeType || "audio/webm" });
        chunks.current = [];
        if (blob.size < 2000) {
          setPhase({ kind: "idle" });
          setProblem("That was too short to make out. Hold the button and speak.");
          return;
        }
        await transcribe(blob);
      };

      recorder.current = rec;
      rec.start();
      setPhase({ kind: "recording", seconds: 0 });

      ticker.current = window.setInterval(() => {
        setPhase((p) => {
          if (p.kind !== "recording") return p;
          const seconds = p.seconds + 1;
          // Stopped rather than allowed to run: a recording nobody ended is a
          // microphone left open and an upload nobody wanted.
          if (seconds >= MAX_SECONDS) stopRecording();
          return { kind: "recording", seconds };
        });
      }, 1000);
    } catch {
      setPhase({ kind: "idle" });
      setProblem(
        "The microphone is not available. Check the browser permission, or type it instead."
      );
    }
  }

  function stopRecording() {
    const rec = recorder.current;
    if (rec && rec.state !== "inactive") {
      setPhase({ kind: "transcribing" });
      rec.stop();
    }
  }

  async function transcribe(blob: Blob) {
    setPhase({ kind: "transcribing" });
    try {
      const form = new FormData();
      const ext = blob.type.includes("mp4") ? "mp4" : "webm";
      form.append("audio", blob, `note.${ext}`);

      const res = await fetch("/api/doctor/dictate", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        setPhase({ kind: "idle" });
        setProblem(data?.message ?? "Could not transcribe that. Type it instead.");
        return;
      }

      // Straight into the field, unedited. This is a transcript of what the
      // doctor said — not an interpretation of it — so it needs no approval
      // step. The rewrite, which does change words, is the part that does.
      append(data.text as string);
      setPhase({ kind: "idle" });
    } catch {
      setPhase({ kind: "idle" });
      setProblem("Could not reach the server. Your recording was not saved.");
    }
  }

  async function rephrase() {
    const text = ref.current?.value.trim() ?? "";
    if (text.length < 10) {
      setProblem("Say or write a little more first, then I can format it.");
      return;
    }
    setPhase({ kind: "rephrasing" });
    setProblem(null);
    try {
      const res = await fetch("/api/doctor/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "clinical-rephrase", text, kind }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setPhase({ kind: "idle" });
        setProblem("Could not format that just now. Your words are untouched.");
        return;
      }
      setPhase({
        kind: "review",
        original: text,
        suggestion: data.text as string,
      });
    } catch {
      setPhase({ kind: "idle" });
      setProblem("Could not format that just now. Your words are untouched.");
    }
  }

  const recording = phase.kind === "recording";
  const busy = phase.kind === "transcribing" || phase.kind === "rephrasing";

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-end justify-between gap-2">
        <label className="text-sm font-semibold text-graphite-800">{label}</label>

        {aiEnabled && (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={recording ? stopRecording : startRecording}
              disabled={busy}
              aria-pressed={recording}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold ring-1 transition disabled:opacity-50 ${
                recording
                  ? "bg-coral-600 text-white ring-coral-600"
                  : "bg-azure-50 text-azure-800 ring-azure-200 hover:bg-azure-100"
              }`}
            >
              <MicIcon pulsing={recording} />
              {recording
                ? `Stop · ${format(phase.seconds)}`
                : phase.kind === "transcribing"
                  ? "Transcribing…"
                  : "Dictate"}
            </button>

            <button
              type="button"
              onClick={rephrase}
              disabled={busy || recording}
              className="rounded-full px-2.5 py-1 text-[11px] font-bold text-graphite-600 ring-1 ring-graphite-200 transition hover:bg-graphite-50 disabled:opacity-50"
            >
              {phase.kind === "rephrasing" ? "Formatting…" : "Tidy for the patient"}
            </button>
          </div>
        )}
      </div>

      {/* ── The route from speech to a sheet ────────────────────────────
          Four steps, named, because the field looked like a textarea with
          two mystery buttons over it: nobody presses "Tidy for the patient"
          if they do not already know that what comes back is a suggestion
          they have to accept. Spelling the sequence out is also the honest
          version of it — the model writes a draft, a human approves it, and
          the patient only ever reads what the doctor pressed Issue on. */}
      {aiEnabled && (
        <ol className="mb-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[10.5px] font-semibold text-graphite-500">
          {["Say it", "Tidy it", "Check both", "Issue"].map((step, i) => (
            <li key={step} className="flex items-center gap-1.5">
              {i > 0 && (
                <span aria-hidden className="text-graphite-300">
                  →
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-full bg-graphite-100 px-2 py-0.5">
                <span className="font-bold text-graphite-700">{i + 1}</span>
                {step}
              </span>
            </li>
          ))}
        </ol>
      )}

      <textarea
        ref={ref}
        name={name}
        rows={rows}
        defaultValue={defaultValue}
        placeholder={
          placeholder ??
          (aiEnabled
            ? "Type it, or press Dictate and just say it."
            : "Anything specific to this patient.")
        }
        aria-invalid={error ? true : undefined}
        className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-graphite-900 outline-none transition placeholder:text-graphite-500 focus:border-azure-400 focus:ring-2 focus:ring-azure-100 ${
          error ? "border-coral-300" : "border-graphite-200"
        }`}
      />

      {recording && (
        <p className="mt-1.5 text-xs font-semibold text-coral-600" aria-live="polite">
          Recording. Speak normally — say what you want the patient to do, and
          press Stop.
        </p>
      )}

      {/* ── The confirmation ─────────────────────────────────────────── */}
      {phase.kind === "review" && (
        <div
          className="mt-3 rounded-xl border-2 border-azure-200 bg-azure-50/50 p-3.5"
          aria-live="polite"
        >
          <p className="text-sm font-bold text-azure-900">
            Check this before it goes out
          </p>
          <p className="mt-1 text-xs leading-relaxed text-azure-800/80">
            Formatted from your own words for a patient to read. Nothing has
            been added — if you see an instruction you did not give, use your
            version instead and tell us.
          </p>

          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            <div className="rounded-lg bg-white p-3 ring-1 ring-graphite-200">
              <p className="text-[10px] font-bold uppercase tracking-wide text-graphite-500">
                What you said
              </p>
              <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-graphite-600">
                {phase.original}
              </p>
            </div>
            <div className="rounded-lg bg-white p-3 ring-1 ring-azure-200">
              <p className="text-[10px] font-bold uppercase tracking-wide text-azure-600">
                For the patient
              </p>
              <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-graphite-800">
                {phase.suggestion}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (ref.current) ref.current.value = phase.suggestion;
                setPhase({ kind: "idle" });
                ref.current?.focus();
              }}
              className="rounded-full bg-azure-600 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-azure-700"
            >
              Use this
            </button>
            <button
              type="button"
              onClick={() => setPhase({ kind: "idle" })}
              className="rounded-full bg-white px-3.5 py-1.5 text-xs font-bold text-graphite-600 ring-1 ring-graphite-200 transition hover:bg-graphite-50"
            >
              Keep mine
            </button>
            <span className="text-[11px] text-graphite-500">
              You can edit either one afterwards.
            </span>
          </div>
        </div>
      )}

      {problem && <p className="mt-2 text-xs text-gold-800">{problem}</p>}

      {error ? (
        <p className="mt-1.5 text-xs font-medium text-coral-600">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-graphite-500">{hint}</p>
      ) : null}
    </div>
  );
}

const format = (s: number) =>
  `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function MicIcon({ pulsing }: { pulsing: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`h-3.5 w-3.5 ${pulsing ? "animate-pulse" : ""}`}
    >
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v4" />
    </svg>
  );
}
