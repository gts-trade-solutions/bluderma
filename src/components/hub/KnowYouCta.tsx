import Link from "next/link";
import { ArrowRight, ClipboardList, MessageSquareHeart, Sparkles } from "lucide-react";

/**
 * Entry points into the consultation questionnaire.
 *
 *  - "banner"  — the HELP US TO KNOW YOU block on the hub (C-40)
 *  - "advice"  — GET EXPERT ADVICE, which sits directly below Rx Skin (C-34)
 *  - "nav"     — the navbar pill
 *  - "rail"    — the sticky sidebar on the hub
 *  - "button"  — a plain button, for reuse anywhere else
 *
 * Every one of them is a LINK to /patient/know-you. It used to open the
 * questionnaire in a dialog: seven steps of questions inside a panel bounded
 * to the viewport, with its own internal scrollbar and a Next button that
 * could sit below a fold inside a fold. A form that long is a page.
 *
 * Being links rather than buttons also means the whole thing needs no client
 * JavaScript, works on middle-click and long-press, and gets Back for free.
 */
export default function KnowYouCta({
  variant = "button",
  label = "Help us to know you",
}: {
  variant?: "banner" | "advice" | "button" | "nav" | "rail";
  label?: string;
}) {
  const href = "/patient/know-you";

  // Full-width, for the sidebar rail.
  // White, not brand blue: the rail card behind this is a teal gradient now,
  // and a saturated blue button on it reads as muddy rather than as the
  // card's primary action. It matches the skin analyser's button, which is
  // the point — the three cards are siblings.
  if (variant === "rail") {
    return (
      <Link
        href={href}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-sm font-bold text-brand-900 transition hover:bg-teal-100 active:scale-[0.98]"
      >
        <ClipboardList className="h-4 w-4" />
        Know about you
      </Link>
    );
  }

  // The navbar pill. Takes over the slot the analyzer CTA used to hold, so
  // the questionnaire is the first action on every client page.
  if (variant === "nav") {
    return (
      <Link
        href={href}
        className="hidden items-center gap-1.5 rounded-full bg-gradient-to-r from-brand-600 to-teal-500 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:shadow-card active:scale-[0.98] sm:inline-flex"
      >
        <ClipboardList className="h-4 w-4" />
        Know About You
      </Link>
    );
  }

  if (variant === "banner") {
    return (
      <div className="overflow-hidden rounded-3xl bg-white/[0.04] ring-1 ring-white/10">
        <div className="grid gap-0 sm:grid-cols-[1.4fr_1fr]">
          <div className="p-7 sm:p-9">
            <p className="section-eyebrow">Help us to know you</p>
            <h2 className="display-sm mt-2 text-2xl text-ink sm:text-3xl">
              Seven short steps, and the guesswork goes away
            </h2>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-ink-muted">
              Tell us about your skin, your routine and what you&apos;ve already
              tried. Attach your skin analysis or an old report if you have one
it&apos;s optional. At the end you&apos;ll see the doctors who
              match, their fees and their next free slot.
            </p>

            <ul className="mt-5 grid gap-2 sm:grid-cols-2">
              {[
                "Takes about 3 minutes",
                "Skin report upload is optional",
                "Your answers save as you go",
                "No cost to complete it",
              ].map((p) => (
                <li key={p} className="flex items-center gap-2 text-sm text-ink-soft">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-400/[12%] text-teal-300">
                    <Sparkles className="h-3 w-3" />
                  </span>
                  {p}
                </li>
              ))}
            </ul>

            <div className="mt-7">
              <Link href={href} className="btn-primary">
                <ClipboardList className="h-4 w-4" />
                {label}
              </Link>
            </div>
          </div>

          <div className="relative hidden bg-gradient-to-br on-dark from-brand-700 to-teal-600 p-9 sm:block">
            <div className="flex h-full flex-col justify-center text-white">
              <p className="text-5xl font-extrabold tracking-[-0.04em]">7</p>
              <p className="mt-1 text-sm font-semibold text-white/80">
                steps, in plain language
              </p>
              <div className="mt-6 space-y-2.5 text-sm text-white/75">
                {[
                  "About you",
                  "Your skin today",
                  "Routine & history",
                  "Health & lifestyle",
                  "Your skin report",
                  "What you're hoping for",
                  "Check and confirm",
                ].map((s, i) => (
                  <p key={s} className="flex items-center gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15 text-[11px] font-bold">
                      {i + 1}
                    </span>
                    {s}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (variant === "advice") {
    return (
      <div className="flex flex-col items-start justify-between gap-5 rounded-3xl bg-gradient-to-r on-dark from-brand-700 to-teal-600 p-7 text-white sm:flex-row sm:items-center sm:p-9">
        <div className="flex items-start gap-4">
          <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 sm:flex">
            <MessageSquareHeart className="h-6 w-6" strokeWidth={1.7} />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-200">
              Get expert advice
            </p>
            <h2 className="display-sm mt-1.5 text-xl sm:text-2xl">
              Not sure which of these is yours?
            </h2>
            <p className="mt-1.5 max-w-lg text-sm text-white/80">
              Answer a few questions and a dermatologist will tell you what
              you&apos;re actually looking at. Then you can book a slot, take an
              instant appointment, or ask for a home visit.
            </p>
          </div>
        </div>
        <Link
          href={href}
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-bold text-brand-700 transition hover:bg-teal-50 active:scale-[0.98]"
        >
          Get expert advice
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <Link href={href} className="btn-primary">
      <ClipboardList className="h-4 w-4" />
      {label}
    </Link>
  );
}
