"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Check, X } from "lucide-react";

/**
 * The site's confirmation toast.
 *
 * Signing in and registering both ended in a silent redirect. The page simply
 * changed, which leaves a reader to work out from the furniture whether it
 * worked, and is worst exactly where confidence matters most: a doctor landing
 * on a portal they have not seen before cannot tell a successful sign-in from
 * a bounce back to a public page.
 *
 * ── Why the URL carries it ───────────────────────────────────────────────
 * The message has to survive a navigation, because the thing worth announcing
 * happens on the page you have just left. A context provider would be reset by
 * that navigation, and module state does not survive a full reload. A search
 * param does both, costs nothing, and degrades to "no toast" rather than to a
 * broken page.
 *
 * It is a closed vocabulary, not free text. `?toast=Your account was hacked`
 * would otherwise render whatever a link says it should, which is a phishing
 * surface on our own domain: anybody could send a BluDerma URL that shows a
 * BluDerma-styled message. KINDS is the whole list of things this can say.
 *
 * The param is stripped with `replace` once shown, so a refresh or a shared
 * link does not replay it, and Back does not walk into it again.
 */

/** Every message this component can ever render. */
const KINDS = {
  "signed-in": {
    title: "Signed in",
    body: (name?: string | null) =>
      name ? `Welcome back, ${name}.` : "Welcome back.",
  },
  registered: {
    title: "Account created",
    body: (name?: string | null) =>
      name ? `You are signed in, ${name}.` : "You are signed in.",
  },
  "signed-out": {
    title: "Signed out",
    body: () => "You can sign back in whenever you like.",
  },
} as const;

type Kind = keyof typeof KINDS;

const isKind = (v: string | null): v is Kind => !!v && v in KINDS;

export default function Toast() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();

  const [kind, setKind] = useState<Kind | null>(null);
  const [leaving, setLeaving] = useState(false);

  const raw = params.get("toast");

  const dismiss = useCallback(() => {
    setLeaving(true);
    // Let the exit finish before unmounting, so it fades rather than blinks.
    window.setTimeout(() => {
      setKind(null);
      setLeaving(false);
    }, 200);
  }, []);

  useEffect(() => {
    if (!isKind(raw)) return;
    setKind(raw);
    setLeaving(false);

    // Strip the param immediately, not on dismiss: if the reader navigates
    // away first the URL would otherwise keep it and replay on Back.
    const next = new URLSearchParams(params.toString());
    next.delete("toast");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [raw, params, pathname, router]);

  // Auto-dismiss. Six seconds: long enough to read two short lines without
  // hunting for the close button, short enough not to sit over the page.
  useEffect(() => {
    if (!kind) return;
    const t = window.setTimeout(dismiss, 6000);
    return () => window.clearTimeout(t);
  }, [kind, dismiss]);

  if (!kind) return null;
  const copy = KINDS[kind];

  return (
    <div
      // `status` + polite, not `alert`: this is a confirmation, and an
      // assertive live region would cut across whatever a screen reader is
      // already saying about the page that just loaded.
      role="status"
      aria-live="polite"
      className={`pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:bottom-6 sm:right-6 sm:left-auto sm:justify-end sm:px-0 sm:pb-0 sm:pr-0 ${
        leaving ? "toast-out" : "toast-in"
      }`}
    >
      {/* Its own solid dark card rather than a theme token. This mounts in the
          root layout, so it appears over the navy client pages AND the white
          doctor portal, and `text-ink` means opposite things in those two
          places. A literal is the only thing that is right in both. */}
      <div className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl bg-[#0d1526] px-4 py-3.5 text-white shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)] ring-1 ring-white/15">
        <span
          aria-hidden
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-teal-500"
        >
          <Check className="h-5 w-5" strokeWidth={2.4} />
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-sm font-bold leading-tight">{copy.title}</p>
          <p className="mt-0.5 truncate text-xs text-white/70">
            {copy.body(session?.user?.name)}
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="-mr-1 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * Add the toast flag to a path that may already carry a query string.
 *
 * Both auth forms build their destination from a callbackUrl, so string
 * concatenation with "?" would produce "/a?b=1?toast=..." often enough to
 * matter.
 */
export function withToast(path: string, kind: Kind): string {
  const [base, ...rest] = path.split("#");
  const hash = rest.length ? `#${rest.join("#")}` : "";
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}toast=${kind}${hash}`;
}
