"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { useVoice } from "@/components/assistant/useVoice";

/**
 * The assistant panel, for clients and practitioners alike.
 *
 * ── One mount, two audiences ─────────────────────────────────────────────
 * Who is asking is decided by the SERVER from the session, not by which page
 * the button was pressed on. The panel just renders what comes back, so a
 * doctor gets practice answers and a client gets their own bookings without
 * this file knowing anything about either.
 *
 * ── Colours are written out in full ──────────────────────────────────────
 * Every class here is a literal string. Tailwind scans source text, so an
 * interpolated class name compiles to nothing and the colour silently goes
 * missing — and `text-ink` is near-WHITE outside `.theme-light`, so explicit
 * slate is the only thing that reads correctly on both the marketing site and
 * inside the portal.
 */

type Msg = { role: "user" | "assistant"; content: string; source?: string };

const HIDDEN_ON = ["/admin", "/login", "/register", "/signin", "/signup", "/forgot", "/reset"];

export default function Assistant() {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [starters, setStarters] = useState<string[]>([]);
  const [audience, setAudience] = useState<"patient" | "doctor" | "visitor">("visitor");
  const [readAloud, setReadAloud] = useState(false);

  const scroller = useRef<HTMLDivElement | null>(null);
  const input = useRef<HTMLInputElement | null>(null);

  const send = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q || busy) return;

      setDraft("");
      setMsgs((m) => [...m, { role: "user", content: q }]);
      setBusy(true);

      try {
        const res = await fetch("/api/assistant", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            question: q,
            // Sent back each time: the server keeps no transcript.
            history: msgs.slice(-8).map(({ role, content }) => ({ role, content })),
          }),
        });
        const data = await res.json();
        const reply: string =
          data?.answer ?? "Something went wrong at our end. Please try that again.";
        setMsgs((m) => [...m, { role: "assistant", content: reply, source: data?.source }]);
        if (data?.audience) setAudience(data.audience);
        if (readAloud) sayRef.current(reply);
      } catch {
        setMsgs((m) => [
          ...m,
          { role: "assistant", content: "I could not reach the server. Please try again." },
        ]);
      } finally {
        setBusy(false);
      }
    },
    [busy, msgs, readAloud]
  );

  const voice = useVoice(
    useCallback(
      (text: string) => {
        setDraft(text);
        void send(text);
      },
      [send]
    )
  );

  // send() is defined before useVoice, so speaking a reply goes through a ref.
  const sayRef = useRef(voice.say);
  sayRef.current = voice.say;

  // Who is asking, and four things worth asking. Fetched once the panel opens
  // rather than on every page load — an unopened panel should cost nothing.
  useEffect(() => {
    if (!open || starters.length) return;
    let live = true;
    fetch("/api/assistant")
      .then((r) => r.json())
      .then((d) => {
        if (!live) return;
        setStarters(d?.starters ?? []);
        setAudience(d?.audience ?? "visitor");
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [open, starters.length]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [msgs, busy]);

  useEffect(() => {
    if (open) input.current?.focus();
    else {
      voice.stop();
      voice.hush();
    }
    // Only on open/close; including the voice handles would re-run this on
    // every recognition tick and steal focus mid-sentence.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;

  const label = audience === "doctor" ? "Practice assistant" : "BluDerma assistant";

  return (
    <>
      {/* ── The button ─────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close the assistant" : "Ask the assistant"}
        aria-expanded={open}
        className="fixed bottom-5 right-5 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white shadow-[0_8px_30px_-6px_rgba(15,23,42,0.5)] ring-1 ring-white/10 transition hover:scale-105 hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 sm:h-14 sm:w-14"
      >
        {open ? <CloseGlyph /> : <ChatGlyph />}
      </button>

      {!open ? null : (
        <div
          role="dialog"
          aria-label={label}
          className="fixed inset-x-0 bottom-0 z-[59] flex max-h-[85vh] flex-col overflow-hidden rounded-t-3xl bg-white shadow-[0_-8px_60px_-12px_rgba(15,23,42,0.45)] ring-1 ring-slate-200 sm:inset-x-auto sm:bottom-24 sm:right-5 sm:h-[min(34rem,80vh)] sm:w-[24rem] sm:rounded-3xl"
        >
          {/* ── Header ───────────────────────────────────────────── */}
          <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-900 px-4 py-3 sm:rounded-t-3xl">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-400/15 text-teal-300">
              <ChatGlyph small />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-[15px] font-bold leading-tight text-white">
                {label}
              </p>
              <p className="truncate text-[11px] leading-tight text-slate-400">
                Treatments, bookings and orders. Not medical advice.
              </p>
            </div>
            {voice.canSpeak && (
              <button
                type="button"
                onClick={() => {
                  if (readAloud) voice.hush();
                  setReadAloud((v) => !v);
                }}
                aria-pressed={readAloud}
                aria-label={readAloud ? "Stop reading answers aloud" : "Read answers aloud"}
                className={
                  readAloud
                    ? "rounded-full bg-teal-400 p-2 text-slate-900 transition"
                    : "rounded-full bg-white/10 p-2 text-slate-300 transition hover:bg-white/20"
                }
              >
                <SpeakerGlyph muted={!readAloud} />
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="rounded-full bg-white/10 p-2 text-slate-300 transition hover:bg-white/20 sm:hidden"
            >
              <CloseGlyph />
            </button>
          </div>

          {/* ── Transcript ───────────────────────────────────────── */}
          <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {msgs.length === 0 && (
              <div className="space-y-3">
                <p className="text-[13px] leading-relaxed text-slate-600">
                  Ask about a treatment, your bookings, or how something here works.
                  For anything clinical you will want a doctor — I will say so rather
                  than guess.
                </p>
                <div className="flex flex-wrap gap-2">
                  {starters.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void send(s)}
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-left text-[12px] font-semibold text-slate-700 transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {msgs.map((m, i) => (
              <div
                key={i}
                className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
              >
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[85%] rounded-2xl rounded-br-md bg-slate-900 px-3.5 py-2.5 text-[13px] leading-relaxed text-white"
                      : "max-w-[90%] rounded-2xl rounded-bl-md bg-slate-100 px-3.5 py-2.5 text-[13px] leading-relaxed text-slate-800"
                  }
                >
                  {m.content}
                  {m.role === "assistant" && voice.canSpeak && (
                    <button
                      type="button"
                      onClick={() => voice.say(m.content)}
                      aria-label="Read this aloud"
                      className="ml-2 align-middle text-slate-400 transition hover:text-teal-600"
                    >
                      <SpeakerGlyph />
                    </button>
                  )}
                </div>
              </div>
            ))}

            {busy && (
              <div className="flex justify-start">
                <div className="flex gap-1 rounded-2xl rounded-bl-md bg-slate-100 px-4 py-3">
                  <Dot /> <Dot delay="150ms" /> <Dot delay="300ms" />
                </div>
              </div>
            )}

            {voice.interim && (
              <p className="text-right text-[12px] italic text-slate-400">{voice.interim}…</p>
            )}
          </div>

          {/* ── Composer ─────────────────────────────────────────── */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(draft);
            }}
            className="flex items-center gap-2 border-t border-slate-100 px-3 py-3"
          >
            {voice.canListen && (
              <button
                type="button"
                onClick={() => (voice.listening ? voice.stop() : voice.listen())}
                aria-label={voice.listening ? "Stop listening" : "Speak your question"}
                aria-pressed={voice.listening}
                className={
                  voice.listening
                    ? "flex h-10 w-10 shrink-0 animate-pulse items-center justify-center rounded-full bg-rose-500 text-white"
                    : "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200"
                }
              >
                <MicGlyph />
              </button>
            )}
            <input
              ref={input}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={voice.listening ? "Listening…" : "Ask a question"}
              maxLength={500}
              className="min-w-0 flex-1 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100"
            />
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              aria-label="Send"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-500 text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            >
              <SendGlyph />
            </button>
          </form>
        </div>
      )}
    </>
  );
}

/* ── Glyphs. Hand-rolled: the portal carries no icon library. ─────────── */

function ChatGlyph({ small }: { small?: boolean }) {
  const n = small ? 16 : 22;
  return (
    <svg width={n} height={n} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function CloseGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function MicGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
    </svg>
  );
}

function SendGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m22 2-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}

function SpeakerGlyph({ muted }: { muted?: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5 6 9H2v6h4l5 4V5z" />
      {muted ? <path d="m23 9-6 6M17 9l6 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" />}
    </svg>
  );
}

function Dot({ delay }: { delay?: string }) {
  return (
    <span
      className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400"
      style={delay ? { animationDelay: delay } : undefined}
    />
  );
}
