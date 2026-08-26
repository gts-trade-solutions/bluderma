"use client";

import { useState, useTransition } from "react";
import { Check, LoaderCircle } from "lucide-react";

import { redeemGiftCard } from "@/lib/actions/giftCards";
import { useFormValidation } from "@/hooks/useFormValidation";

const field =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none";
const labelClass =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500";

/**
 * Spending part of a gift card at the counter.
 *
 * Part, not all: a ₹5,000 card can cover four visits, so the amount is asked
 * for rather than assumed to be the whole balance. The server holds the line
 * on a card being spent twice by two tills at once; this form only has to
 * report what it says.
 */
export default function RedeemForm() {
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const formCheck = useFormValidation();

  return (
    <form
      ref={formCheck.formRef}
      noValidate
      className="space-y-3"
      onSubmit={formCheck.guard((fd, form) => {
        setResult(null);
        start(async () => {
          const res = await redeemGiftCard({
            code: String(fd.get("code") ?? ""),
            amountInr: String(fd.get("amountInr") ?? ""),
            note: String(fd.get("note") ?? ""),
          });
          if (!res.ok) setResult({ ok: false, text: res.error ?? "Could not redeem that." });
          else {
            // What is left is the next thing anybody asks, and making the
            // doctor go and look it up is the difference between a tool and
            // a form.
            setResult({
              ok: true,
              text:
                res.remainingInr === undefined
                  ? "Taken off the card."
                  : `Taken off the card. ₹${res.remainingInr.toLocaleString("en-IN")} left on it.`,
            });
            form.reset();
          }
        });
      })}
    >
      {formCheck.summary}
      <label className="block">
        <span className={labelClass}>Card code</span>
        {/* Upper-cased as they type: these are read off a phone screen or a
            printed card, and being told your own code is invalid because you
            typed it in lower case is the kind of thing that ends in a phone
            call to the clinic. */}
        <input
          name="code"
          required
          placeholder="BLU-G-7Q2NX4WM"
          autoCapitalize="characters"
          className={`${field} font-mono uppercase`}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>How much of it to use today</span>
          <input name="amountInr" required inputMode="numeric" placeholder="1500" className={field} />
        </label>
        <label className="block">
          <span className={labelClass}>
            What it went towards{" "}
            <span className="normal-case tracking-normal">(optional)</span>
          </span>
          {/* Written onto the card's history, which is what a dispute six
              weeks later is actually settled from. */}
          <input name="note" placeholder="Towards a peel" className={field} />
        </label>
      </div>

      {result && (
        <p
          className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${
            result.ok
              ? "border border-teal-200 bg-teal-50 text-teal-700"
              : "border border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {result.ok && <Check className="mr-1.5 inline h-4 w-4" />}
          {result.text}
        </p>
      )}

      <p className="text-[11px] leading-relaxed text-slate-500">
        A card can be spent across several visits. Take only what this visit
        costs and the rest stays on it.
      </p>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-gradient-to-r from-brand-600 to-teal-600 px-6 py-2.5 text-sm font-extrabold text-white transition hover:from-brand-700 hover:to-teal-700 disabled:opacity-60"
      >
        {pending && <LoaderCircle className="h-4 w-4 animate-spin" />}
        Redeem
      </button>
    </form>
  );
}
