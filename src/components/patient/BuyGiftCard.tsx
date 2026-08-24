"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Check, LoaderCircle } from "lucide-react";

import { buyGiftCard } from "@/lib/actions/giftCards";
import { useRazorpayCheckout } from "@/hooks/useRazorpayCheckout";

const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/**
 * Buying a gift card.
 *
 * ── The card is created before the payment, and is worth nothing ─────────
 * `buyGiftCard` makes it with a zero balance and no `paidAt`. Only the
 * settlement path releases the value. That ordering is deliberate: a card that
 * could be spent the moment checkout opened would let an abandoned payment
 * walk out with treatment.
 *
 * So an abandoned checkout leaves an unpaid card behind, which is exactly what
 * should happen. It is inert, it is a record that somebody tried, and the same
 * person pressing buy again simply gets another.
 */
export default function BuyGiftCard({
  offerId,
  title,
  priceInr,
  signedIn,
}: {
  offerId: string;
  title: string;
  priceInr: number;
  signedIn: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const { checkout } = useRazorpayCheckout();

  if (!signedIn) {
    return (
      <Link
        href={`/login?callbackUrl=${encodeURIComponent("/patient/gift-cards")}`}
        className="block w-full rounded-full bg-white px-4 py-2.5 text-center text-sm font-bold text-brand-900 transition hover:bg-teal-100"
      >
        Sign in to buy
      </Link>
    );
  }

  if (done) {
    return (
      <p className="inline-flex items-center gap-2 rounded-xl bg-teal-400/15 px-3.5 py-2.5 text-sm font-semibold text-teal-100">
        <Check className="h-4 w-4" /> Bought. It is in your profile.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-full bg-white px-4 py-2.5 text-sm font-bold text-brand-900 transition hover:bg-teal-100"
      >
        Buy for {money(priceInr)}
      </button>
    );
  }

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const made = await buyGiftCard({
            offerId,
            recipientName: String(fd.get("recipientName") ?? ""),
            recipientEmail: String(fd.get("recipientEmail") ?? ""),
            message: String(fd.get("message") ?? ""),
          });
          if (!made.ok || !made.cardId) {
            setError(made.error ?? "Could not start that purchase.");
            return;
          }

          const outcome = await checkout({
            createUrl: "/api/gift-cards/pay",
            body: { cardId: made.cardId },
            description: title,
            reference: "gift-card",
          });
          if (outcome.status === "paid" || outcome.status === "no_payment_due") {
            setDone(true);
          } else if (outcome.status === "failed") {
            setError(outcome.error);
          }
        });
      }}
    >
      <input
        name="recipientName"
        placeholder="Who is it for? (optional)"
        className="w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/45 focus:border-teal-300 focus:outline-none"
      />
      <input
        name="recipientEmail"
        type="email"
        placeholder="Their email (optional)"
        className="w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/45 focus:border-teal-300 focus:outline-none"
      />
      <input
        name="message"
        placeholder="A message (optional)"
        className="w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/45 focus:border-teal-300 focus:outline-none"
      />

      {error && (
        <p className="rounded-lg bg-rose-500/20 px-3 py-2 text-xs text-rose-100">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-bold text-brand-900 transition hover:bg-teal-100 disabled:opacity-60"
        >
          {pending && <LoaderCircle className="h-4 w-4 animate-spin" />}
          Pay {money(priceInr)}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full px-3 py-2 text-sm font-semibold text-white/60 transition hover:text-white"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
