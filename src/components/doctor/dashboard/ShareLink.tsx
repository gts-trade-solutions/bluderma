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
      <div className="flex items-center gap-2 rounded-xl bg-graphite-50 px-3 py-2.5 ring-1 ring-inset ring-graphite-200">
        <span className="truncate font-mono text-xs text-graphite-600">{pretty}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-full bg-azure-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-azure-700"
        >
          {copied ? "Copied" : "Copy link"}
        </button>
        <button
          type="button"
          onClick={whatsapp}
          className="inline-flex items-center gap-1.5 rounded-full border border-graphite-200 bg-white px-4 py-2 text-xs font-bold text-graphite-700 transition hover:bg-graphite-50"
        >
          Share on WhatsApp
        </button>
        <a
          href={path}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold text-graphite-500 transition hover:text-graphite-800"
        >
          Preview →
        </a>
      </div>
    </div>
  );
}
