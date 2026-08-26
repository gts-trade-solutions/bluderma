"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Turning browser reminders on, in the one place it can honestly be offered.
 *
 * ── Why it is never asked for on arrival ─────────────────────────────────
 * A permission prompt on page load is the single most-refused dialog on the
 * web, and a refusal is close to permanent: browsers remember it, and Chrome
 * will not ask again. So this is a button somebody presses, in a section
 * about their appointments, after they have seen what it is for. The
 * permission prompt appears in response to that press and nothing else.
 *
 * ── The five states, said plainly ────────────────────────────────────────
 * Unsupported, not-asked, asking, on, and blocked. "Blocked" is the one worth
 * writing properly: the app cannot re-prompt, so a button that tries again
 * would do nothing and look broken. It says where the setting is instead.
 */

type State =
  | "checking"
  | "unsupported"
  | "idle"
  | "working"
  | "on"
  | "blocked"
  | "failed";

/** The VAPID public key arrives as base64url; PushManager wants bytes. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalised = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalised);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export default function ReminderOptIn() {
  const [state, setState] = useState<State>("checking");
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  useEffect(() => {
    if (!supported || !publicKey) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("blocked");
      return;
    }

    // Already subscribed on this browser? Ask the service worker rather than
    // trusting the permission alone — permission granted and subscription
    // present are different facts, and clearing site data separates them.
    (async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration("/push-sw.js");
        const sub = await reg?.pushManager.getSubscription();
        setState(sub ? "on" : "idle");
      } catch {
        setState("idle");
      }
    })();
  }, [supported, publicKey]);

  const enable = useCallback(async () => {
    setState("working");
    try {
      const permission = await Notification.requestPermission();
      if (permission === "denied") {
        setState("blocked");
        return;
      }
      if (permission !== "granted") {
        setState("idle");
        return;
      }

      const reg = await navigator.serviceWorker.register("/push-sw.js");
      // Registration resolves before the worker is usable; subscribing on an
      // installing worker throws.
      await navigator.serviceWorker.ready;

      const sub = await reg.pushManager.subscribe({
        // Required by every browser now, and the reason a payload can never
        // be sent silently: the person always sees the notification.
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      setState(res.ok ? "on" : "failed");
    } catch (e) {
      console.error("push subscribe failed", e);
      setState("failed");
    }
  }, [publicKey]);

  const disable = useCallback(async () => {
    setState("working");
    try {
      const reg = await navigator.serviceWorker.getRegistration("/push-sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => undefined);
        await sub.unsubscribe();
      }
      setState("idle");
    } catch {
      setState("failed");
    }
  }, []);

  if (state === "checking") return null;

  if (state === "unsupported") {
    return (
      <p className="text-xs text-ink-muted">
        This browser cannot show reminders. You will still get the email.
      </p>
    );
  }

  if (state === "blocked") {
    return (
      <p className="text-xs leading-relaxed text-amber-700">
        Notifications are blocked for this site, and we cannot ask again from
        here — the browser only allows that once. Turn them back on in the site
        settings beside the address bar. You will still get the email either
        way.
      </p>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={state === "on" ? disable : enable}
          disabled={state === "working"}
          className={
            state === "on"
              ? "rounded-full border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
              : "rounded-full bg-gradient-to-r from-brand-600 to-teal-500 px-4 py-2 text-xs font-bold text-white transition hover:on-dark from-brand-700 disabled:opacity-60"
          }
        >
          {state === "working"
            ? "One moment…"
            : state === "on"
              ? "Turn reminders off"
              : "Remind me in this browser"}
        </button>
        {state === "on" && (
          <span className="text-xs font-semibold text-teal-700">
            On for this browser
          </span>
        )}
      </div>

      <p className="mt-2 text-xs leading-relaxed text-ink-muted">
        {state === "on"
          ? "You will get a reminder the day before, on this device. Turning it on somewhere else is a separate switch — a phone and a laptop are two browsers."
          : "A reminder the day before, from the browser rather than an email. It says the time and who you are seeing, and nothing about why — a notification is read by whoever is holding the phone."}
      </p>

      {state === "failed" && (
        <p className="mt-2 text-xs text-rose-600">
          That did not go through. The email reminder is unaffected.
        </p>
      )}
    </div>
  );
}
