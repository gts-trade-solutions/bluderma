"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

/**
 * The pay-later offer, as something people actually notice.
 *
 * ── Why it is a modal and not another section ────────────────────────────
 * It was a panel at the foot of the signed-in profile, which is the one place
 * somebody who has already decided to spend money goes. The people it exists
 * for are the ones still deciding — and most of them are not signed in.
 *
 * ── The line this must not cross, and where it is ────────────────────────
 * This platform deleted a financing feature once for quoting an "approved
 * limit of ₹60,000 through BluDerma Care Credit" and listing EMI options. It
 * read as though BluDerma were a lender. It is not one, no finance partner is
 * integrated, and nothing is approved.
 *
 * So the panel this replaces was rewritten as an ENQUIRY, and this is that
 * enquiry made visible rather than that decision reversed. It may be
 * eye-catching. It may not:
 *
 *   - name a lender, a rate, an APR or a tenure;
 *   - show a monthly figure, because a monthly figure is a quote;
 *   - say "approved", "eligible", "pre-qualified" or "instant";
 *   - imply anything has been arranged.
 *
 * What it says is that clinics can often spread a cost, and offers to put the
 * question to one. That is true, and it is the whole of what is true.
 *
 * ── Why it is not shown on arrival ───────────────────────────────────────
 * A modal over a page somebody has not read yet is an advert. This waits for
 * one of two signals that they are actually weighing a cost: they have
 * scrolled most of the way down a treatment page, or they are on their way
 * out. Once dismissed it stays dismissed for thirty days.
 */

const KEY = "bd-paylater-seen";
const QUIET_DAYS = 30;

/**
 * Where this must never appear.
 *
 * The professional surfaces, because a doctor mid-clinic is not the audience
 * and a modal over a calendar is an obstruction. The auth screens, because
 * interrupting somebody signing in is how they stop signing in. And the
 * profile, where the real enquiry form already lives — offering to take you
 * somewhere you already are is the kind of thing that makes an offer feel
 * automated rather than meant.
 */
const NEVER = [
  "/admin",
  "/doctor",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/patient/profile",
  "/sell",
];

function seenRecently(): boolean {
  try {
    const at = Number(localStorage.getItem(KEY) ?? 0);
    return Date.now() - at < QUIET_DAYS * 86_400_000;
  } catch {
    // Private browsing. Treat as seen rather than as a reason to show it on
    // every page — an offer that cannot remember being dismissed is one that
    // dismisses nothing.
    return true;
  }
}

export default function PayLaterOffer({
  /** Set on pages where the offer is relevant — treatments, a doctor, booking. */
  armed = true,
}: {
  armed?: boolean;
}) {
  const { status } = useSession();
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);

  const allowed =
    armed && !NEVER.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  useEffect(() => {
    if (!allowed || seenRecently()) return;

    let fired = false;
    const show = () => {
      if (fired) return;
      fired = true;
      setOpen(true);
    };

    // Deep into the page: they are reading, not bouncing.
    const onScroll = () => {
      const seen =
        (window.scrollY + window.innerHeight) /
        Math.max(document.body.scrollHeight, 1);
      if (seen > 0.62) show();
    };

    // Or on the way out, which on a desktop is the pointer leaving upward.
    const onLeave = (e: MouseEvent) => {
      if (e.clientY <= 0) show();
    };

    // Or after long enough that they are clearly considering it. Two minutes,
    // not twenty seconds: the shorter version is an interruption.
    const timer = window.setTimeout(show, 120_000);

    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("mouseleave", onLeave);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, [allowed]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dismiss();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // A modal that survives a navigation is a modal over the wrong page.
  useEffect(() => setOpen(false), [pathname]);

  function dismiss() {
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {
      /* nothing to remember it with */
    }
    setOpen(false);
  }

  if (!open) return null;

  const signedIn = status === "authenticated";

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-[var(--scrim)] backdrop-blur-sm"
        onClick={dismiss}
        aria-hidden
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="paylater-title"
        className="relative z-10 w-full max-w-lg animate-scale-in overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--band-a)] via-[var(--band-b)] to-[var(--band-c)] shadow-[0_40px_100px_-30px_rgba(0,0,0,0.9)] ring-1 ring-white/15"
      >
        {/* The glow. CSS rather than an image so it costs nothing and cannot
            fail to load. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -left-16 -top-20 h-56 w-72 rounded-full bg-teal-400/25 blur-[80px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 top-1/3 h-52 w-64 rounded-full bg-brand-500/25 blur-[80px]"
        />

        <button
          type="button"
          onClick={dismiss}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          ×
        </button>

        <div className="relative px-6 py-8 text-center sm:px-9 sm:py-10">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-300/40 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-teal-300">
            <SparkIcon /> Worth asking
          </span>

          <h2
            id="paylater-title"
            className="mt-4 font-display text-[1.9rem] font-extrabold italic leading-[0.98] tracking-[-0.035em] text-white sm:text-[2.4rem]"
          >
            Start treatment now.
            <br />
            {/* "Paid for over time" was doing the work of a phrase nobody
                uses. "Pay later" is what the feature is called everywhere
                else in the product — in the profile nav, in the section
                heading — and it is what somebody would say out loud. A
                headline that needs a second read is a headline that gets
                skipped. */}
            <span className="bg-gradient-to-r from-teal-200 to-brand-300 bg-clip-text text-transparent">
              Pay later.
            </span>
          </h2>

          <p className="mx-auto mt-3.5 max-w-md text-sm leading-relaxed text-white/70">
            Most courses are not a single bill. Clinics on BluDerma will often
            split one across the sessions you actually have — and the only way
            to find out what yours will do is to ask them.
          </p>

          {/* Three facts, all of them true. Deliberately not three numbers:
              a figure here would be a quote, and nothing has been arranged. */}
          <ul className="mx-auto mt-5 grid max-w-sm gap-2 text-left">
            {[
              "Ask before you book, not after",
              "No credit check, because nothing is being lent by us",
              "The clinic answers you directly",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2.5">
                <TickIcon />
                <span className="text-[13px] leading-snug text-white/80">{t}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex flex-col items-center gap-3">
            <Link
              href={
                signedIn
                  ? "/patient/profile#pay-later"
                  : "/login?callbackUrl=%2Fpatient%2Fprofile%23pay-later"
              }
              onClick={dismiss}
              className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-teal-300 to-brand-400 px-7 py-3.5 text-sm font-extrabold uppercase tracking-wide text-[#04121f] shadow-[0_0_40px_-6px_rgba(84,215,194,0.85)] transition hover:from-teal-200 hover:to-brand-300 active:scale-[0.98] sm:w-auto"
            >
              {signedIn ? "Ask about spreading the cost" : "Sign in and ask"}
              <ArrowIcon />
            </Link>

            <button
              type="button"
              onClick={dismiss}
              className="text-xs font-semibold text-white/45 transition hover:text-white/80"
            >
              Not right now
            </button>
          </div>

          {/* The disclosure, in the modal rather than behind a link. It is the
              reason this is allowed to look like this. */}
          <p className="mx-auto mt-5 max-w-md border-t border-white/10 pt-4 text-[11px] leading-relaxed text-white/40">
            BluDerma does not lend money and is not a finance provider. Nothing
            here is an offer, an approval or a credit agreement — it puts your
            question to the clinic, and whatever they can arrange is between
            you and them.
          </p>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- Icons ---------------------------------- */

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-3 w-3">
      <path d="M12 2l2.2 6.1L20 10l-5.8 1.9L12 18l-2.2-6.1L4 10l5.8-1.9z" />
    </svg>
  );
}

function TickIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-300"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
