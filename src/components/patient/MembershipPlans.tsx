"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useRazorpayCheckout } from "@/hooks/useRazorpayCheckout";

/**
 * The two membership terms, and the button that buys one.
 *
 * Prices appear here on purpose: G-3 in the requirements brief allows a price
 * in exactly three places, and a subscription is one of them. Everything else
 * on the client side stays enquiry-first.
 */

interface Plan {
  slug: string;
  name: string;
  interval: string;
  priceInr: number;
  compareAtInr: number | null;
  discountPercent: number;
  scanCredits: number;
  priorityBooking: boolean;
  waiveCancellationFee: boolean;
  perks: string[];
}

export default function MembershipPlans({
  plans,
  signedIn,
  current,
  payable,
}: {
  plans: Plan[];
  signedIn: boolean;
  current: { planName: string; endsOn: string } | null;
  payable: boolean;
}) {
  const router = useRouter();
  const { paySubscription } = useRazorpayCheckout();
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const buy = async (plan: Plan) => {
    setError(null);
    setNote(null);
    setBusy(plan.slug);
    const out = await paySubscription(plan.slug, plan.name);
    setBusy(null);

    if (out.status === "paid") {
      setNote(`Your ${plan.name} membership is active.`);
      router.refresh();
    } else if (out.status === "no_payment_due") {
      setNote(out.message ?? "Your membership is active.");
      router.refresh();
    } else if (out.status === "failed") {
      setError(out.error);
    }
    // "cancelled" needs no message — they closed the window deliberately.
  };

  if (plans.length === 0) {
    return (
      <p className="mt-12 text-center text-ink-muted">
        Memberships are not open yet. Check back soon.
      </p>
    );
  }

  return (
    <div className="mt-12">
      {current && (
        <div className="mx-auto mb-8 max-w-xl rounded-2xl border border-amber-400/30 bg-amber-400/10 px-5 py-4 text-center">
          <p className="font-bold text-amber-200">
            You are a {current.planName} member
          </p>
          <p className="mt-0.5 text-sm text-amber-100/80">
            Your term runs until {current.endsOn}. Renewing below extends it
            rather than restarting it.
          </p>
        </div>
      )}

      {note && (
        <p className="mx-auto mb-6 max-w-xl rounded-xl bg-teal-500/[12%] px-4 py-3 text-center text-sm text-teal-200">
          {note}
        </p>
      )}
      {error && (
        <p className="mx-auto mb-6 max-w-xl rounded-xl bg-rose-500/[12%] px-4 py-3 text-center text-sm text-rose-200">
          {error}
        </p>
      )}

      <div className="mx-auto grid max-w-4xl gap-5 sm:grid-cols-2">
        {plans.map((p, i) => {
          const best = i === plans.length - 1 && plans.length > 1;
          return (
            <div
              key={p.slug}
              className={`relative flex flex-col rounded-3xl p-6 sm:p-8 ${
                best
                  ? "bg-gradient-to-b from-brand-600/20 to-teal-500/10 ring-1 ring-brand-400/40"
                  : "sheet"
              }`}
            >
              {best && (
                <span className="absolute -top-3 left-6 rounded-full bg-gradient-to-r from-brand-500 to-teal-500 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
                  Best value
                </span>
              )}

              <h2 className="display-sm text-2xl">{p.name}</h2>

              <p className="mt-3 flex items-baseline gap-2">
                <span className="text-4xl font-bold text-ink">
                  ₹{p.priceInr.toLocaleString("en-IN")}
                </span>
                <span className="text-ink-muted">
                  / {p.interval === "ANNUAL" ? "year" : "month"}
                </span>
              </p>
              {p.compareAtInr && p.compareAtInr > p.priceInr && (
                <p className="mt-1 text-sm text-ink-muted">
                  <span className="line-through">
                    ₹{p.compareAtInr.toLocaleString("en-IN")}
                  </span>{" "}
                  <span className="font-semibold text-teal-300">
                    save ₹{(p.compareAtInr - p.priceInr).toLocaleString("en-IN")}
                  </span>
                </p>
              )}

              <ul className="mt-6 flex-1 space-y-2.5">
                {p.perks.map((perk) => (
                  <li key={perk} className="flex gap-2.5 text-sm text-ink-soft">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-400" />
                    {perk}
                  </li>
                ))}
              </ul>

              {!signedIn ? (
                <Link
                  href={`/login?callbackUrl=/patient/membership`}
                  className="mt-7 inline-flex justify-center rounded-full bg-brand-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-700"
                >
                  Sign in to join
                </Link>
              ) : !payable ? (
                <p className="mt-7 rounded-xl bg-white/5 px-4 py-3 text-center text-sm text-ink-muted">
                  Online payment is not switched on yet — contact us to start a
                  membership.
                </p>
              ) : (
                <button
                  disabled={busy !== null}
                  onClick={() => buy(p)}
                  className="mt-7 rounded-full bg-brand-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-50"
                >
                  {busy === p.slug
                    ? "Opening payment…"
                    : current
                    ? "Renew with this plan"
                    : `Join for ₹${p.priceInr.toLocaleString("en-IN")}`}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
