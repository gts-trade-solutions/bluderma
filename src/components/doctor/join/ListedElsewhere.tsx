"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { saveListedElsewhere } from "@/lib/actions/doctorOnboarding";

/**
 * The last question, asked on the review screen.
 *
 * "Are you already listed on another consultation portal or marketplace?"
 *
 * ── Answering is not required, and the form never says "optional" ────────
 * That word was explicitly not wanted, and it is the right call for a reason
 * worth writing down: labelling a field optional is an instruction to skip it.
 * A question with no asterisk, no red text and a Submit button that works
 * regardless is already optional — the reader discovers that by pressing
 * Submit, which is exactly when it costs them nothing.
 *
 * So the answer is genuinely nullable. `listedElsewhere` is Boolean? and
 * stays NULL until somebody picks Yes or No; nothing infers "no" from
 * silence, and the admin review screen can tell the difference between a
 * practitioner who said no and one who did not say.
 *
 * ── Why we ask ───────────────────────────────────────────────────────────
 * It gates nothing and rejects nobody. A practitioner already taking bookings
 * elsewhere has a calendar we cannot see, which is the single most common
 * cause of a double-booked slot in the first month, and knowing changes what
 * we say to them at approval rather than whether we approve them.
 *
 * Saves on change rather than behind its own button: it sits beside "Submit
 * for review", and a second submit button next to the real one is a trap.
 */
export default function ListedElsewhere({
  defaultAnswer,
  defaultNames,
}: {
  defaultAnswer: boolean | null;
  defaultNames: string;
}) {
  const router = useRouter();
  const [answer, setAnswer] = useState<boolean | null>(defaultAnswer);
  const [names, setNames] = useState(defaultNames);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function persist(next: boolean | null, nextNames: string) {
    setError(null);
    setSaved(false);
    start(async () => {
      const res = await saveListedElsewhere({
        listedElsewhere: next,
        names: nextNames,
      });
      if (res.ok) {
        setSaved(true);
        router.refresh();
      } else {
        setError(res.error ?? "Could not save that.");
      }
    });
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="font-bold text-slate-900">
        Are you listed on any other consultation platform?
      </p>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">
        Another online clinic, a doctor marketplace, an aggregator. It has no
        bearing on whether we approve you — we ask because a calendar we cannot
        see is the commonest cause of a clash in the first month, and knowing
        changes what we set up for you rather than whether we set it up.
      </p>

      <div className="mt-3.5 flex flex-wrap gap-2">
        <Choice
          selected={answer === true}
          onClick={() => {
            setAnswer(true);
            persist(true, names);
          }}
        >
          Yes
        </Choice>
        <Choice
          selected={answer === false}
          onClick={() => {
            setAnswer(false);
            setNames("");
            persist(false, "");
          }}
        >
          No
        </Choice>
        {answer !== null && (
          <button
            type="button"
            onClick={() => {
              setAnswer(null);
              setNames("");
              persist(null, "");
            }}
            className="text-xs font-semibold text-slate-500 transition hover:text-slate-800"
          >
            Clear
          </button>
        )}
      </div>

      {answer === true && (
        <div className="mt-3.5">
          <label
            htmlFor="listed-names"
            className="block text-sm font-semibold text-slate-800"
          >
            Which ones?
          </label>
          <input
            id="listed-names"
            value={names}
            onChange={(e) => setNames(e.target.value)}
            onBlur={() => persist(true, names)}
            maxLength={300}
            placeholder="Practo, Apollo 24|7, my own website…"
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
        </div>
      )}

      <p className="mt-2 h-4 text-xs">
        {error ? (
          <span className="text-rose-600">{error}</span>
        ) : pending ? (
          <span className="text-slate-400">Saving…</span>
        ) : saved ? (
          <span className="text-teal-700">Saved.</span>
        ) : null}
      </p>
    </div>
  );
}

function Choice({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-sm font-bold ring-1 transition ${
        selected
          ? "bg-brand-600 text-white ring-brand-600"
          : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50 hover:ring-slate-300"
      }`}
    >
      {children}
    </button>
  );
}
