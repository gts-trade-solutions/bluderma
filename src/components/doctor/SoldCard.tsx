"use client";

import { useState } from "react";
import { ChevronDown, Gift, Mail, User } from "lucide-react";

export interface Redemption {
  id: string;
  amountInr: number;
  note: string | null;
  at: string;
}

export interface SoldCardRow {
  id: string;
  code: string;
  offerTitle: string;
  valueInr: number;
  balanceInr: number;
  buyerName: string;
  buyerEmail: string;
  buyerPublicId: string | null;
  recipientName: string | null;
  recipientEmail: string | null;
  message: string | null;
  boughtOn: string;
  expiresOn: string | null;
  expired: boolean;
  redemptions: Redemption[];
}

const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/**
 * One sold card, in full.
 *
 * ── Why the buyer and the recipient are shown separately ─────────────────
 * The commonest gift card is bought by one person for another, and at the
 * counter those are two different facts a practitioner needs. Whoever walks in
 * holding the code is usually NOT whoever paid, so a screen that shows only
 * "bought by Demo Client" leaves the doctor unable to answer the one question
 * they actually get asked: is this card really for you?
 *
 * ── Why every redemption is listed ───────────────────────────────────────
 * A balance is a single number and disputes are about history. "It said ₹5,000
 * last month" is answerable from a list of what was taken and when; it is not
 * answerable from a balance alone.
 */
export default function SoldCard({ row }: { row: SoldCardRow }) {
  const [open, setOpen] = useState(false);
  const spent = row.valueInr - row.balanceInr;
  const pct = row.valueInr > 0 ? Math.round((spent / row.valueInr) * 100) : 0;

  return (
    <li className="px-4 py-3.5 sm:px-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full flex-wrap items-start justify-between gap-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="select-all font-mono text-sm font-bold tracking-wide text-slate-900">
              {row.code}
            </span>
            {row.expired && (
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-700">
                Expired
              </span>
            )}
            {row.balanceInr === 0 && !row.expired && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                Spent
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-500">{row.offerTitle}</p>

          {/* Both parties on the collapsed row, because both matter before a
              practitioner has decided whether to open anything. */}
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <User className="h-3 w-3" /> Paid by {row.buyerName}
            </span>
            {row.recipientName && (
              <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                <Gift className="h-3 w-3" /> For {row.recipientName}
              </span>
            )}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-sm font-bold tabular-nums text-slate-900">
            {money(row.balanceInr)}
          </p>
          <p className="text-[11px] text-slate-400">of {money(row.valueInr)} left</p>
          <ChevronDown
            aria-hidden
            className={`ml-auto mt-1 h-4 w-4 text-slate-300 transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-teal-500 to-brand-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {open && (
        <div className="mt-3 space-y-3 rounded-xl bg-slate-50 p-4">
          <dl className="grid gap-3 sm:grid-cols-2">
            <Fact label="Paid by" value={row.buyerName} sub={row.buyerEmail} id={row.buyerPublicId} />
            <Fact
              label="Bought for"
              value={row.recipientName ?? "Not named"}
              sub={row.recipientEmail ?? undefined}
            />
            <Fact label="Bought on" value={row.boughtOn} />
            <Fact
              label="Valid until"
              value={row.expiresOn ?? "No expiry"}
              sub={row.expired ? "This card has expired and cannot be redeemed." : undefined}
            />
          </dl>

          {row.message && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Their message
              </p>
              {/* Shown because a practitioner handed a card at the counter is
                  often asked to read it out, and because it is one more way to
                  tell whether the person holding it is the person it is for. */}
              <p className="mt-1 flex items-start gap-2 text-[13px] italic leading-relaxed text-slate-600">
                <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                {row.message}
              </p>
            </div>
          )}

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              What has been taken
            </p>
            {row.redemptions.length === 0 ? (
              <p className="mt-1 text-[13px] text-slate-500">
                Nothing yet. The full {money(row.valueInr)} is available.
              </p>
            ) : (
              <ul className="mt-1.5 space-y-1.5">
                {row.redemptions.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 text-[13px]"
                  >
                    <span className="text-slate-600">
                      {r.at}
                      {r.note ? ` · ${r.note}` : ""}
                    </span>
                    <span className="font-bold tabular-nums text-slate-900">
                      −{money(r.amountInr)}
                    </span>
                  </li>
                ))}
                <li className="flex items-baseline justify-between gap-2 border-t border-slate-200 pt-1.5 text-[13px]">
                  <span className="font-semibold text-slate-700">Left</span>
                  <span className="font-bold tabular-nums text-teal-700">
                    {money(row.balanceInr)}
                  </span>
                </li>
              </ul>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function Fact({
  label,
  value,
  sub,
  id,
}: {
  label: string;
  value: string;
  sub?: string;
  id?: string | null;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-sm font-semibold text-slate-900">{value}</dd>
      {sub && <p className="truncate text-xs text-slate-500">{sub}</p>}
      {id && <p className="font-mono text-[11px] text-slate-400">{id}</p>}
    </div>
  );
}
