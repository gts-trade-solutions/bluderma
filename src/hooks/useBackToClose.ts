"use client";

import { useEffect, useRef } from "react";

/**
 * Makes the browser Back button close an overlay, or step back inside one,
 * instead of leaving the page.
 *
 * Every dialog on the client side was opened from `useState` with no history
 * entry behind it. Pressing Back from an open booking dialog did not close the
 * dialog — it navigated away from the page entirely, and in the intake
 * questionnaire it threw away everything the client had typed. On a phone,
 * where Back is the primary gesture, that is the whole complaint.
 *
 * ── ONE GUARD PER OVERLAY ─────────────────────────────────────────────────
 * This is the rule, and breaking it is what stopped the ✕ working. The first
 * version had the modal shell pushing a history entry AND the wizard inside it
 * pushing one per step: two owners, one stack. Closing popped a step entry
 * rather than the shell's, leaving orphans that made Back appear dead for the
 * rest of the session.
 *
 * A component that has both a "close" and a "go back a step" therefore decides
 * between them itself, in one handler. Nothing else in that tree touches
 * history.
 *
 * ── NEVER STRAND THE USER ─────────────────────────────────────────────────
 * Every history call here is conditional on our own token still being on top
 * of the stack. If anything else navigated in the meantime, we do nothing
 * rather than risk calling history.back() on a real page entry and throwing
 * the user off the page — which would look exactly like a dialog that will not
 * close. The worst case is one wasted Back press; the alternative is losing
 * the page.
 *
 * The URL is deliberately untouched. Encoding overlay state in a query param
 * would make it linkable, but in the App Router it also triggers a server
 * round-trip on every open and close, and these overlays sit on pages that are
 * expensive to re-render.
 *
 * @param active whether the overlay is showing and Back should be intercepted
 * @param onBack what Back means here — close, or retreat one step
 */
export function useBackGuard(active: boolean, onBack: () => void) {
  // Held in a ref so a fresh closure each render does not tear the guard down
  // and rebuild it, which would churn the history stack.
  const handler = useRef(onBack);
  handler.current = onBack;

  /** Our sentinel's id while it is the top of the stack; null when it is not. */
  const token = useRef<string | null>(null);

  /**
   * True while a `history.back()` WE called is still travelling.
   *
   * popstate is asynchronous, so a back() fired from the disarm cleanup lands
   * after the listener has been re-attached. In development React's
   * StrictMode deliberately runs every effect twice — mount, tear down, mount
   * again — which means the guard arms, disarms (calling back()), and re-arms
   * within a tick. Without this flag the resulting popstate is read as the
   * user pressing Back, and the overlay closes the instant it opens.
   *
   * A ref survives that cycle because StrictMode reuses the same component
   * instance; only the effects are replayed.
   */
  const selfPop = useRef(false);

  /** Is our exact entry still on top? */
  const ours = () => {
    try {
      const state = window.history.state as { bdGuard?: string } | null;
      return Boolean(token.current) && state?.bdGuard === token.current;
    } catch {
      return false;
    }
  };

  // ── Listen ────────────────────────────────────────────────────────────
  // Declared before the disarm effect on purpose: React runs cleanups in
  // declaration order, so when `active` flips this listener is removed BEFORE
  // the disarm below touches history. Otherwise our own tidy-up would fire the
  // handler and, in a wizard, silently step backwards while it was closing.
  useEffect(() => {
    if (!active || typeof window === "undefined") return;

    const onPop = () => {
      // Our own teardown, not the user. Swallow it — see selfPop above.
      if (selfPop.current) {
        selfPop.current = false;
        return;
      }
      // The user's Back consumed our sentinel. Record that before handing
      // over, so a handler that keeps the overlay open re-arms rather than
      // double-popping.
      token.current = null;
      handler.current();
    };

    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [active]);

  // ── Keep exactly one sentinel on the stack ────────────────────────────
  // No dependency array: after a pop that did not close the overlay (a wizard
  // stepping back), this re-arms on the very next render.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!active || token.current) return;

    const id = `bd-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    try {
      // Next's router keeps its own bookkeeping in history.state, so spread it
      // rather than replacing it.
      window.history.pushState({ ...window.history.state, bdGuard: id }, "");
      token.current = id;
    } catch {
      // Some embedded browsers refuse pushState. Back then behaves as it did
      // before — the overlay still closes by every other means.
      token.current = null;
    }
  });

  // ── Take it back off when we stop guarding ────────────────────────────
  useEffect(() => {
    if (!active || typeof window === "undefined") return;
    return () => {
      // Closed by the ✕, Escape, the backdrop, or by finishing. Only pop when
      // the entry on top is provably still ours.
      if (ours()) {
        token.current = null;
        // Mark before travelling: the popstate this triggers must never be
        // mistaken for a Back press.
        selfPop.current = true;
        window.history.back();
      } else {
        token.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}

/**
 * The common case: Back closes the overlay.
 *
 * A named wrapper because most callers have nothing to step back through, and
 * `useBackToClose(open, onClose)` says exactly what happens at the call site.
 */
export function useBackToClose(open: boolean, onClose: () => void) {
  useBackGuard(open, onClose);
}
