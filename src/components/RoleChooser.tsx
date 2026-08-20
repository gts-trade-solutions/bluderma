"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import { ROLE_STORAGE_KEY } from "@/lib/roles";

/**
 * "Are you here as a client, or as a doctor?" — asked once.
 *
 * This replaces a thin dismissible strip at the top of the page, which was
 * the right idea executed too quietly: a single muted line above the navbar
 * reads as a cookie notice and gets skipped by exactly the people it was for.
 *
 * WHY THIS IS NOT A GATE. It mounts only after hydration and only on the
 * client, so the server still sends a complete page: search engines and AI
 * crawlers (requirement A-1/A-2) index the real content, not a wall. It also
 * waits a beat before appearing, so someone who landed here from a search
 * result sees what they came for first. That is the difference between a
 * dialog and an interstitial, and it is the whole reason this is safe.
 *
 * It is asked ONCE. After a choice — or a dismissal — the answer lives in
 * localStorage and this never renders again. Which is why the permanent
 * entry points matter just as much: a "For doctors" link in the navbar and
 * in the footer, both server-rendered, both always there. This dialog is a
 * convenience for the first visit, not the only way in.
 */
export default function RoleChooser() {
  const router = useRouter();
  const { status } = useSession();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    // The site already knows who a signed-in visitor is — their role decides
    // the experience, and asking anyway is the site admitting it did not
    // check. Clearing site data, or opening on a second device, used to put
    // this question in front of a listed doctor.
    if (status !== "unauthenticated") return;

    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(ROLE_STORAGE_KEY);
    } catch {
      // Storage blocked. Ask once this visit rather than never — being asked
      // again is a smaller problem than never finding the doctor portal.
    }
    if (stored) return;

    // Let the page paint and settle first. Appearing in the same frame as the
    // hero is what makes a dialog feel like an interstitial.
    const t = window.setTimeout(() => setOpen(true), 1400);
    return () => window.clearTimeout(t);
  }, [status]);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && choose("patient", false);
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const choose = (role: "doctor" | "patient", navigate: boolean) => {
    try {
      window.localStorage.setItem(ROLE_STORAGE_KEY, role);
    } catch {
      /* the navigation below still works */
    }
    setOpen(false);
    if (navigate && role === "doctor") router.push("/doctor");
  };

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center">
      {/* Dismissing by clicking away is deliberate: this is a helpful
          question, not a toll gate, and it must never trap anybody. */}
      <button
        aria-label="Close"
        onClick={() => choose("patient", false)}
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-[3px] animate-fade-in-fast"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="role-chooser-title"
        className="relative w-full max-w-md animate-scale-in overflow-hidden rounded-3xl sheet"
      >
        <button
          onClick={() => choose("patient", false)}
          aria-label="Close"
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-ink-muted transition hover:bg-white/10 hover:text-ink"
        >
          ✕
        </button>

        <div className="px-6 pb-6 pt-8 text-center sm:px-8">
          <h2
            id="role-chooser-title"
            className="display-sm text-xl text-ink sm:text-2xl"
          >
            Welcome to BluDerma
          </h2>
          <p className="mx-auto mt-2 max-w-xs text-sm text-ink-soft">
            So we show you the right thing — which are you here as?
          </p>

          <div className="mt-6 grid gap-3">
            <button
              onClick={() => choose("patient", false)}
              className="group flex items-center gap-3.5 rounded-2xl bg-white/[0.05] p-4 text-left ring-1 ring-white/10 transition hover:bg-white/[0.09] hover:ring-teal-300/40"
            >
              <span
                aria-hidden
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-teal-400/15 text-xl"
              >
                ✨
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold text-ink">
                  I&apos;m here for a consultation
                </span>
                <span className="block text-xs text-ink-muted">
                  Book a doctor, scan your skin free, browse treatments
                </span>
              </span>
              <span
                aria-hidden
                className="shrink-0 text-ink-muted transition group-hover:translate-x-0.5 group-hover:text-teal-300"
              >
                →
              </span>
            </button>

            <button
              onClick={() => choose("doctor", true)}
              className="group flex items-center gap-3.5 rounded-2xl bg-white/[0.05] p-4 text-left ring-1 ring-white/10 transition hover:bg-white/[0.09] hover:ring-brand-300/40"
            >
              <span
                aria-hidden
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-400/15 text-xl"
              >
                🩺
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold text-ink">
                  I&apos;m a doctor
                </span>
                <span className="block text-xs text-ink-muted">
                  List your practice — free, no commission
                </span>
              </span>
              <span
                aria-hidden
                className="shrink-0 text-ink-muted transition group-hover:translate-x-0.5 group-hover:text-brand-300"
              >
                →
              </span>
            </button>
          </div>

          <p className="mt-5 text-[11px] text-ink-muted">
            Asked once. &ldquo;For doctors&rdquo; in the menu takes you
            across at any time.
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}
