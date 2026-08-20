"use client";

import { useRouter, useSearchParams } from "next/navigation";

/**
 * Client or doctor, said with a control rather than a paragraph.
 *
 * One login form serves both roles, and a sentence explaining that was not
 * enough — the client's words were "still there is confusion in login or
 * create account". A paragraph is something you read; a segmented control is
 * something you see, and the question "is this the right page for me" is
 * answered before any reading happens.
 *
 * ── What it actually changes, and what it deliberately does not ──────────
 * It does NOT change how you are authenticated. The role lives on the
 * account, not on this switch, so a doctor who leaves it on "Client" still
 * signs in and still lands in the portal. A control that changed credentials
 * would be a lie about how the system works.
 *
 * What it does change is where you are headed and what you are offered:
 *   - the destination after signing in, when no explicit one was requested;
 *   - which kind of account "create one" makes, which is the half that was
 *     genuinely breaking. A doctor who registered through the plain form got
 *     a CLIENT account and only found out at /doctor/join.
 *
 * An explicit `?callbackUrl=` always wins. Somebody who clicked "sign in to
 * book this appointment" is going back to that appointment whatever this says.
 *
 * Picking the wrong one is safe by construction: postLoginPath() checks
 * canRoleOpen() and quietly sends anybody to their own home rather than to a
 * page that would bounce them.
 */

export type Audience = "client" | "doctor";

export default function AudienceToggle({
  value,
  /** Omitted on the register form, which drives it from the URL instead. */
  onChange,
  /** The query key to write. "as" on register, "role" on login. */
  paramKey = "role",
}: {
  value: Audience;
  onChange?: (next: Audience) => void;
  paramKey?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  function pick(next: Audience) {
    if (onChange) {
      onChange(next);
      return;
    }
    // Kept in the URL so a refresh, a Back press, or a shared link all land
    // on the same side of the toggle.
    const q = new URLSearchParams(params.toString());
    if (next === "doctor") q.set(paramKey, "doctor");
    else q.delete(paramKey);
    const qs = q.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  }

  return (
    <div
      role="tablist"
      aria-label="Are you a client or a doctor?"
      className="mt-6 grid grid-cols-2 gap-1 rounded-2xl bg-white/[0.05] p-1 ring-1 ring-inset ring-white/10"
    >
      {(
        [
          {
            key: "client" as const,
            label: "I'm a client",
            hint: "Book and track",
            glyph: (
              <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM5 20a7 7 0 0 1 14 0" />
            ),
          },
          {
            key: "doctor" as const,
            label: "I'm a doctor",
            hint: "Run your practice",
            glyph: (
              <>
                <path d="M6 3v6a6 6 0 0 0 12 0V3" />
                <path d="M12 15v2a4 4 0 0 0 8 0v-1" />
                <circle cx="20" cy="14" r="2" />
              </>
            ),
          },
        ] as const
      ).map((opt) => {
        const on = value === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => pick(opt.key)}
            className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl px-3 py-2 text-center transition duration-150 ${
              on
                ? "bg-gradient-to-br from-brand-600 to-teal-600 text-white shadow-[0_8px_20px_-8px_rgba(31,111,214,0.9)]"
                : "text-ink-muted hover:bg-white/[0.06] hover:text-ink"
            }`}
          >
            <span className="flex items-center gap-1.5 text-sm font-bold">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
                aria-hidden
              >
                {opt.glyph}
              </svg>
              {opt.label}
            </span>
            <span
              className={`text-[11px] ${on ? "text-white/75" : "text-ink-muted"}`}
            >
              {opt.hint}
            </span>
          </button>
        );
      })}
    </div>
  );
}
