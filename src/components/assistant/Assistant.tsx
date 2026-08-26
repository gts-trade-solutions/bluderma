"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

import { useVoice } from "@/components/assistant/useVoice";

/**
 * The assistant panel, for clients and practitioners alike.
 *
 * ── One mount, two audiences ─────────────────────────────────────────────
 * Who is asking is decided by the SERVER from the session, not by which page
 * the button was pressed on. The panel renders what comes back, so a doctor
 * gets practice answers and a client gets their own bookings without this
 * file knowing anything about either.
 *
 * ── Signed out, it does not exist ────────────────────────────────────────
 * The route refuses anyone without a session; this hides the button so nobody
 * is offered a door that is locked. Both, because either alone is wrong: a
 * hidden button is not access control, and a bare 401 is a control nobody can
 * see.
 *
 * ── `theme-light` is load-bearing ────────────────────────────────────────
 * globals.css styles every input at specificity (0,4,1) — four `:not()`
 * attribute selectors — and paints the text `ink.DEFAULT`, which is near
 * WHITE. A Tailwind `text-slate-900` is (0,1,0) and loses, so on this white
 * panel people could not see their own typing. `.theme-light` re-maps the
 * same selector at (0,5,1) and is the fix this codebase already uses.
 *
 * Every other colour here is a full literal string: Tailwind scans source
 * text, so an interpolated class name compiles to nothing and the colour
 * silently goes missing.
 */

type Msg = { role: "user" | "assistant"; content: string; source?: string };

/** Remembers that the launcher has introduced itself. Set once, read forever. */
const NUDGE_KEY = "bd-assistant-nudged";
const HIDDEN_ON = ["/admin", "/login", "/register", "/signin", "/signup", "/forgot", "/reset"];

export default function Assistant() {
  const pathname = usePathname() ?? "";
  const { data: session, status } = useSession();

  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [starters, setStarters] = useState<string[]>([]);
  /** The one-time nudge beside the launcher. See dismissNudge below. */
  const [nudge, setNudge] = useState(false);
  const [audience, setAudience] = useState<"patient" | "doctor">("patient");
  const [readAloud, setReadAloud] = useState(false);

  const scroller = useRef<HTMLDivElement | null>(null);
  const input = useRef<HTMLInputElement | null>(null);
  const sayRef = useRef<(t: string) => void>(() => {});

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
          data?.answer ??
          (res.status === 401
            ? "Your session has ended. Please sign in again."
            : "Something went wrong at our end. Please try that again.");
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
  sayRef.current = voice.say;

  const signedIn = status === "authenticated";

  // Who is asking, and four things worth asking. Fetched when the panel first
  // opens rather than on every page load — an unopened panel costs nothing.
  useEffect(() => {
    if (!open || starters.length) return;
    let live = true;
    fetch("/api/assistant")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!live || !d) return;
        setStarters(d.starters ?? []);
        if (d.audience) setAudience(d.audience);
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
    // Only on open/close. Including the voice handles would re-run this on
    // every recognition tick and steal focus mid-sentence.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // On a phone the panel is a sheet over the page. Without this the page
  // behind it scrolls under your thumb whenever the transcript hits its end.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    const phone = window.matchMedia("(max-width: 639px)").matches;
    if (phone) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  /* ── The one-time nudge ──────────────────────────────────────────────
     An assistant nobody notices is an assistant nobody uses, and a floating
     circle in the corner is easy not to notice. So it says one sentence, once
     — after forty seconds, which is long enough to be past skim-reading and
     into actually wondering something.

     Once, ever, is the whole point: it is remembered in localStorage rather
     than in state, so it does not reappear on the next page or the next
     visit. Anything that pops up twice is an interruption the second time. */
  useEffect(() => {
    if (open) return;
    try {
      if (localStorage.getItem(NUDGE_KEY)) return;
    } catch {
      // No storage means no way to remember having shown it, and something
      // that cannot be dismissed permanently should not appear at all.
      return;
    }
    const t = window.setTimeout(() => setNudge(true), 40_000);
    return () => window.clearTimeout(t);
  }, [open]);

  function dismissNudge() {
    setNudge(false);
    try {
      localStorage.setItem(NUDGE_KEY, "1");
    } catch {
      /* nothing to remember it with */
    }
  }

  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;
  if (!signedIn) return null;

  const isDoctor = audience === "doctor";
  const label = isDoctor ? "Practice assistant" : "Your care assistant";
  const firstName = (session?.user?.name ?? "").trim().split(/\s+/)[0] ?? "";

  return (
    <>
      {/* ── The button ─────────────────────────────────────────────── */}
      {/* The launcher ─────────────────────────── */}
      <div
        className="fixed bottom-5 right-5 z-[60] flex items-center gap-2.5"
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* The nudge. Shown once, ever, and only after somebody has been on
            the page long enough to have a question — an assistant that
            announces itself on arrival is an advert for itself. */}
        {nudge && !open && (
          <button
            type="button"
            onClick={() => {
              setOpen(true);
              dismissNudge();
            }}
            className="on-dark animate-scale-in max-w-[13rem] rounded-2xl rounded-br-md bg-gradient-to-br from-brand-800 to-brand-900 px-3.5 py-2.5 text-left text-[12.5px] font-semibold leading-snug text-white shadow-[0_10px_30px_-10px_rgba(2,32,71,0.8)] ring-1 ring-white/15"
          >
            {isDoctor ? "Ask me about your day" : "Question about a treatment?"}
            <span className="mt-0.5 block text-[10.5px] font-medium text-white/60">
              Tap to ask — no waiting
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            setOpen((o) => !o);
            dismissNudge();
          }}
          aria-label={open ? "Close the assistant" : "Ask the assistant"}
          aria-expanded={open}
          className="on-dark group relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-700 via-brand-800 to-teal-800 text-white shadow-[0_12px_36px_-8px_rgba(2,32,71,0.75)] ring-1 ring-white/20 transition duration-200 hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
        >
          {/* The halo. Only while closed and only until it has been opened
              once — a permanent pulse in the corner of every page is a
              distraction, not an affordance. */}
          {!open && nudge && (
            <span
              aria-hidden
              className="absolute inset-0 animate-ping rounded-full bg-teal-400/30"
            />
          )}
          <span className="relative transition-transform duration-200 group-hover:scale-110">
            {open ? <CloseGlyph /> : <ChatGlyph />}
          </span>
          {!open && (
            <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-brand-900 bg-teal-400" />
          )}
        </button>
      </div>

      {!open ? null : (
        <div
          role="dialog"
          aria-label={label}
          // theme-light: see the header comment. Without it nobody can see
          // what they are typing.
          className="theme-light animate-scale-in fixed inset-x-0 bottom-0 z-[59] flex h-[88dvh] max-h-[88dvh] flex-col overflow-hidden rounded-t-[28px] bg-white shadow-[0_-10px_70px_-12px_rgba(15,23,42,0.5)] ring-1 ring-slate-200 sm:inset-x-auto sm:bottom-24 sm:right-5 sm:h-[min(36rem,78vh)] sm:w-[26rem] sm:rounded-3xl"
        >
          {/* Thumb handle. Only on the phone sheet, where it says "this
              slides" before anybody has to discover it. */}
          <div className="flex justify-center pt-2.5 sm:hidden">
            <span className="h-1.5 w-10 rounded-full bg-slate-300" />
          </div>

          {/* ── Header ───────────────────────────────────────────── */}
          {/* on-dark: this header is a brand gradient on every theme, so the
              white type on it must stay white. Without the mark the generated
              theme layer repaints it to var(--ink) — near-black on daylight,
              on a near-black header. */}
          <div className="on-dark relative flex items-center gap-3 overflow-hidden bg-gradient-to-br from-brand-800 via-brand-900 to-teal-900 px-4 py-3.5 sm:rounded-t-3xl">
            <span
              aria-hidden
              className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-teal-400/25 blur-2xl"
            />
            <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10 ring-1 ring-white/20">
              <Avatar kind={isDoctor ? "bot" : "doctor"} size={30} />
            </span>
            <div className="relative min-w-0 flex-1">
              <p className="truncate font-display text-[15px] font-bold leading-tight text-white">
                {label}
              </p>
              <p className="flex items-center gap-1.5 truncate text-[11px] leading-tight text-white/70">
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-70" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-teal-300" />
                </span>
                {isDoctor ? "Your practice, on call" : "Treatments and bookings. Not medical advice."}
              </p>
            </div>

            {msgs.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setMsgs([]);
                  voice.hush();
                }}
                aria-label="Start a new conversation"
                title="New conversation"
                className="relative rounded-full bg-white/10 p-2 text-white/70 transition hover:bg-white/20 hover:text-white"
              >
                <RefreshGlyph />
              </button>
            )}

            {voice.canSpeak && (
              <button
                type="button"
                onClick={() => {
                  if (readAloud) voice.hush();
                  setReadAloud((v) => !v);
                }}
                aria-pressed={readAloud}
                aria-label={readAloud ? "Stop reading answers aloud" : "Read answers aloud"}
                title={readAloud ? "Reading aloud" : "Read answers aloud"}
                className={
                  readAloud
                    ? "relative rounded-full bg-teal-400 p-2 text-slate-900 transition"
                    : "rounded-full bg-white/10 p-2 text-slate-300 transition hover:bg-white/20 hover:text-white"
                }
              >
                <SpeakerGlyph muted={!readAloud} />
              </button>
            )}

            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="relative rounded-full bg-white/10 p-2 text-white/70 transition hover:bg-white/20 hover:text-white sm:hidden"
            >
              <CloseGlyph />
            </button>
          </div>

          {/* ── Transcript ───────────────────────────────────────── */}
          <div
            ref={scroller}
            className="flex-1 space-y-3.5 overflow-y-auto overscroll-contain bg-slate-50/60 px-4 py-4"
          >
            {msgs.length === 0 && (
              <div className="space-y-4">
                <div className="flex gap-2.5">
                  <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white shadow-sm ring-1 ring-slate-200">
                    <Avatar kind={isDoctor ? "bot" : "doctor"} size={24} />
                  </span>
                  <p className="rounded-2xl rounded-tl-md bg-white px-3.5 py-2.5 text-[13.5px] leading-relaxed text-slate-700 shadow-sm ring-1 ring-slate-200">
                    {firstName ? `Hello ${firstName}. ` : "Hello. "}
                    {isDoctor
                      ? "Ask me about your day, your month, or anything in your portal."
                      : "Ask me about a treatment, your bookings, or how something here works. Anything clinical I will hand to a doctor rather than guess."}
                  </p>
                </div>
                {/* The prefilled questions, as rows rather than pills.
                    A pill truncates the moment a question is a real sentence,
                    and these are the part people actually use — giving them
                    the full width is what makes them readable at a glance. */}
                {starters.length > 0 && (
                  <div className="pl-11">
                    <p className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-400">
                      Try asking
                    </p>
                    <div className="grid gap-1.5">
                      {starters.map((s, i) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => void send(s)}
                          style={{ animationDelay: `${i * 55}ms` }}
                          className="animate-scale-in group flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-left text-[12.5px] font-semibold leading-snug text-slate-700 shadow-sm transition hover:-translate-y-px hover:border-teal-400 hover:bg-teal-50 hover:text-teal-900 hover:shadow-md active:scale-[0.99]"
                        >
                          <SparkGlyph />
                          <span className="min-w-0 flex-1">{s}</span>
                          <ArrowGlyph />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {msgs.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <p className="max-w-[85%] rounded-2xl rounded-br-md on-dark bg-slate-900 px-3.5 py-2.5 text-[13.5px] leading-relaxed text-white">
                    {m.content}
                  </p>
                </div>
              ) : (
                <div key={i} className="flex gap-2.5">
                  <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white shadow-sm ring-1 ring-slate-200">
                    <Avatar kind={isDoctor ? "bot" : "doctor"} size={24} />
                  </span>
                  <div className="min-w-0 max-w-[85%]">
                    <p
                      className={
                        m.source === "deflected"
                          ? "rounded-2xl rounded-tl-md border-l-[3px] border-amber-400 bg-amber-50 px-3.5 py-2.5 text-[13.5px] leading-relaxed text-slate-800 shadow-sm ring-1 ring-amber-200/70"
                          : "rounded-2xl rounded-tl-md bg-white px-3.5 py-2.5 text-[13.5px] leading-relaxed text-slate-800 shadow-sm ring-1 ring-slate-200"
                      }
                    >
                      {m.content}
                    </p>
                    {voice.canSpeak && (
                      <button
                        type="button"
                        onClick={() => voice.say(m.content)}
                        className="mt-1 inline-flex items-center gap-1 pl-1 text-[11px] font-semibold text-slate-400 transition hover:text-teal-600"
                      >
                        <SpeakerGlyph />
                        Listen
                      </button>
                    )}
                  </div>
                </div>
              )
            )}

            {busy && (
              <div className="flex gap-2.5">
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white shadow-sm ring-1 ring-slate-200">
                  <Avatar kind={isDoctor ? "bot" : "doctor"} size={24} />
                </span>
                <span className="flex items-center gap-1 rounded-2xl rounded-tl-md bg-white px-4 py-3.5 shadow-sm ring-1 ring-slate-200">
                  <Dot /> <Dot delay="150ms" /> <Dot delay="300ms" />
                </span>
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
            className="flex items-center gap-2 border-t border-slate-200 bg-white px-3 py-3"
            style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
          >
            {voice.canListen && (
              <button
                type="button"
                onClick={() => (voice.listening ? voice.stop() : voice.listen())}
                aria-label={voice.listening ? "Stop listening" : "Speak your question"}
                aria-pressed={voice.listening}
                className={
                  voice.listening
                    ? "flex h-11 w-11 shrink-0 animate-pulse items-center justify-center rounded-full bg-rose-500 text-white shadow-sm"
                    : "flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 active:scale-95"
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
              enterKeyHint="send"
              // 16px on a phone: iOS Safari zooms the whole page in on focus
              // for anything smaller, and the sheet ends up half off-screen.
              className="min-w-0 flex-1 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-[16px] text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100 sm:text-[13.5px]"
            />
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              aria-label="Send"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-500 text-white shadow-sm transition hover:bg-teal-600 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            >
              <SendGlyph />
            </button>
          </form>
        </div>
      )}
    </>
  );
}

/* ── Faces ────────────────────────────────────────────────────────────── */

/**
 * A client is talking to their clinic, so the face is a clinician. A
 * practitioner is talking to their own software, so the face is a machine —
 * showing a doctor a picture of a doctor would suggest a colleague is reading
 * their takings.
 */
function Avatar({ kind, size }: { kind: "doctor" | "bot"; size: number }) {
  if (kind === "doctor") {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
        <defs>
          <linearGradient id="bd-doc" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#2dd4bf" />
            <stop offset="100%" stopColor="#0ea5e9" />
          </linearGradient>
        </defs>
        <circle cx="20" cy="20" r="20" fill="url(#bd-doc)" />
        {/* Coat and shoulders */}
        <path d="M8 40c0-6.6 5.4-10.5 12-10.5S32 33.4 32 40z" fill="#ffffff" />
        <path d="M20 29.5 16.6 40h6.8z" fill="#e2e8f0" />
        <circle cx="20" cy="16" r="7" fill="#ffffff" />
        {/* Stethoscope: the one detail that reads as clinical at 24px */}
        <path
          d="M15 31v3.5a3.4 3.4 0 0 0 6.8 0V32"
          stroke="#0f172a"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
        />
        <circle cx="26" cy="33.5" r="2.2" fill="#0f172a" />
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient id="bd-bot" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#14b8a6" />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="20" fill="url(#bd-bot)" />
      <circle cx="20" cy="8.5" r="1.9" fill="#ffffff" />
      <path d="M20 10.4v3.2" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" />
      <rect x="9.5" y="13.5" width="21" height="16" rx="5.5" fill="#ffffff" />
      <circle cx="16" cy="21" r="2.1" fill="#0f172a" />
      <circle cx="24" cy="21" r="2.1" fill="#0f172a" />
      <path d="M16.5 25.6h7" stroke="#0f172a" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M6.5 19v4M33.5 19v4" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/* ── Glyphs. Hand-rolled: the portal carries no icon library. ─────────── */

/** The messenger mark. A speech bubble reads as "talk to something" in a way
 *  an avatar in a circle does not — an avatar reads as a person who is not
 *  there. */
function ChatGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-7 w-7">
      <path
        d="M12 3.2c-4.9 0-8.8 3.4-8.8 7.6 0 2.4 1.3 4.6 3.3 6v3.4a.6.6 0 0 0 .93.5l2.9-1.9c.53.09 1.08.14 1.64.14 4.9 0 8.8-3.4 8.8-7.6S16.9 3.2 12 3.2Z"
        fill="currentColor"
      />
      <circle cx="8.3" cy="10.8" r="1.15" fill="#0b2545" />
      <circle cx="12" cy="10.8" r="1.15" fill="#0b2545" />
      <circle cx="15.7" cy="10.8" r="1.15" fill="#0b2545" />
    </svg>
  );
}

function SparkGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className="h-3.5 w-3.5 shrink-0 text-teal-500 transition group-hover:text-teal-600"
    >
      <path d="M12 2l2.2 6.1L20 10l-5.8 1.9L12 18l-2.2-6.1L4 10l5.8-1.9z" />
    </svg>
  );
}

function ArrowGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="h-3.5 w-3.5 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-teal-600"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
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

function RefreshGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12a9 9 0 1 1-3-6.7M21 3v6h-6" />
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
