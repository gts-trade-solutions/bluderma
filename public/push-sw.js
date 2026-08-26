/* eslint-disable no-undef */
/**
 * The service worker that shows an appointment reminder.
 *
 * ── Why a file in public/ and not a route ────────────────────────────────
 * A service worker's SCOPE is the directory it is served from. Registered
 * from /push-sw.js it controls the whole origin, which is what a
 * site-wide notification needs. Served from a route under /api it would
 * control /api and nothing else, and the registration would appear to work
 * while never receiving a push.
 *
 * ── What it deliberately does not contain ────────────────────────────────
 * Anything clinical. The payload the server sends is a time, a doctor's name
 * and a link — never a procedure, a diagnosis or a medicine. A push
 * notification lands on a lock screen, in front of whoever is holding the
 * phone, and "Your acne scarring review is at 4pm" is a disclosure the
 * patient did not consent to by allowing notifications.
 *
 * This file is plain JavaScript on purpose: a service worker is not part of
 * the Next bundle and nothing compiles it.
 */

self.addEventListener("install", () => {
  // Take over immediately rather than waiting for every tab to close. A
  // reminder that starts working "next time you fully quit the browser" is a
  // reminder that does not work.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    // A malformed payload is still worth showing something for: the person
    // allowed notifications and something was sent.
    data = {};
  }

  const title = data.title || "BluDerma";
  const options = {
    body: data.body || "You have an appointment coming up.",
    icon: "/icon.svg",
    badge: "/icon.svg",
    // Replaces rather than stacks: three reminders for one appointment is a
    // notification tray somebody turns off.
    tag: data.tag || "bluderma",
    renotify: Boolean(data.tag),
    data: { url: data.url || "/patient/appointments" },
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        // Focus a tab that is already open on this site rather than opening a
        // fourth one. Somebody tapping a reminder wants their appointments,
        // not another copy of the browser.
        for (const client of list) {
          if (client.url.includes(new URL(url, self.location.origin).pathname)) {
            return client.focus();
          }
        }
        if (list.length > 0) return list[0].navigate(url).then((c) => c && c.focus());
        return self.clients.openWindow(url);
      })
  );
});
