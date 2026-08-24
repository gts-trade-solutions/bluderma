"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Speech in and speech out, using only what the browser already ships.
 *
 * ── Why not a speech service ─────────────────────────────────────────────
 * Sending microphone audio from a dermatology site to a third party means
 * somebody's voice describing their skin leaves the country, and it means
 * another key to hold and another bill. The Web Speech API runs the
 * recognition the browser already has, costs nothing, and adds no vendor.
 *
 * The trade is real and is handled rather than hidden: Chrome and Edge do
 * recognition well, Safari partially, Firefox not at all. `canListen` is false
 * there and the microphone button is not rendered, so nobody is offered a
 * control that does nothing. Typing is always available.
 */

type Recogniser = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechEvent) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechEvent = {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
};

type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recogniser;
  webkitSpeechRecognition?: new () => Recogniser;
};

function recogniserClass(): (new () => Recogniser) | null {
  if (typeof window === "undefined") return null;
  const w = window as SpeechWindow;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useVoice(onTranscript: (text: string) => void) {
  const [canListen, setCanListen] = useState(false);
  const [canSpeak, setCanSpeak] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [interim, setInterim] = useState("");

  const ref = useRef<Recogniser | null>(null);
  // The callback changes on every render of the parent; keeping it in a ref
  // means the recogniser is built once rather than torn down mid-sentence.
  const sink = useRef(onTranscript);
  sink.current = onTranscript;

  // Capability is checked after mount, never during render: the server has no
  // window, and a server/client disagreement here is a hydration error.
  useEffect(() => {
    setCanListen(Boolean(recogniserClass()));
    setCanSpeak(typeof window !== "undefined" && "speechSynthesis" in window);
  }, []);

  const stop = useCallback(() => {
    ref.current?.stop();
    setListening(false);
    setInterim("");
  }, []);

  const listen = useCallback(() => {
    const Klass = recogniserClass();
    if (!Klass) return;

    ref.current?.abort();

    const r = new Klass();
    // en-IN so Indian place names and "lakh" survive the transcription.
    r.lang = "en-IN";
    r.continuous = false;
    r.interimResults = true;

    r.onresult = (e) => {
      let done = "";
      let pending = "";
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        const slot = e.results[i];
        const text = slot[0]?.transcript ?? "";
        if (slot.isFinal) done += text;
        else pending += text;
      }
      setInterim(pending);
      if (done.trim()) {
        setInterim("");
        sink.current(done.trim());
      }
    };

    r.onerror = (e) => {
      // "no-speech" and "aborted" are ordinary — somebody opened the mic and
      // said nothing. Only a real fault is worth a console line.
      if (e.error && e.error !== "no-speech" && e.error !== "aborted") {
        console.error("[voice] recognition error:", e.error);
      }
      setListening(false);
      setInterim("");
    };

    r.onend = () => {
      setListening(false);
      setInterim("");
    };

    ref.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      // start() throws if called while already running. Nothing to recover.
      setListening(false);
    }
  }, []);

  const say = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-IN";
    u.rate = 1.02;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(u);
  }, []);

  const hush = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  // A panel that closes while still talking would carry on talking over the
  // next page, which is the kind of thing people describe as haunted.
  useEffect(() => () => {
    ref.current?.abort();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  return { canListen, canSpeak, listening, speaking, interim, listen, stop, say, hush };
}
