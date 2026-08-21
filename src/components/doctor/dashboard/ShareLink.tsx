"use client";

import { useEffect, useState } from "react";

/**
 * The doctor's own booking link, with a copy button.
 *
 * A practitioner whose month reads ₹0 is not helped by being told so a second
 * time — the useful thing the dashboard can hand them is the address that
 * turns a WhatsApp message into a booking. It was the one obviously actionable
 * item the screen did not carry.
 *
 * The origin is read in the browser rather than baked server-side, because
 * this runs on localhost, on a staging host and on the live domain, and a card
 * that confidently shows a doctor a localhost address is worse than no card.
 * Until the effect runs there is no origin, so the path shows on its own
 * rather than a guess that changes under them.
 */
export default function ShareLink({ slug, name }: { slug: string; name: string }) {
  const path = `/patient/book/${slug}`;
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => setOrigin(window.location.origin), []);

  const url = origin ? `${origin}${path}` : path;
  const pretty = origin ? url.replace(/^https?:\/\//, "") : path;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Clipboard access is refused over plain http in some browsers. A
      // prompt they can copy out of beats a button that silently does nothing.
      window.prompt("Copy your booking link", url);
    }
  }

  function whatsapp() {
    const text = `Book an appointment with ${name} on BluDerma: ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2.5 ring-1 ring-inset ring-white/10">
        <span className="truncate font-mono text-xs text-ink-soft">{pretty}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-brand-700"
        >
          {copied ? "Copied" : "Copy link"}
        </button>
        <button
          type="button"
          onClick={whatsapp}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-bold text-ink-soft transition hover:bg-white/[0.12]"
        >
          Share on WhatsApp
        </button>
        <a
          href={path}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold text-ink-muted transition hover:text-ink"
        >
          Preview →
        </a>
      </div>
    </div>
  );
}
