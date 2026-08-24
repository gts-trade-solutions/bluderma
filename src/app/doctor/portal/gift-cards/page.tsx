import { OfferStatus } from "@prisma/client";

import { Empty, PageHead, Panel } from "@/components/doctor/portalUi";
import OfferForm, { OfferRow } from "@/components/doctor/OfferForm";
import RedeemForm from "@/components/doctor/RedeemForm";
import SoldCard, { type SoldCardRow } from "@/components/doctor/SoldCard";
import { getOwnDoctor } from "@/lib/doctor/guard";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Gift cards" };
export const dynamic = "force-dynamic";

const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const day = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/**
 * Gift cards a clinic offers, and redeeming one at the counter.
 *
 * ── Each panel says what it is FOR ───────────────────────────────────────
 * "Redeem a card" is a heading that describes a button, not a job. A
 * practitioner meeting this screen for the first time has no reason to know
 * that redemption is what happens when somebody walks in holding a code and
 * wants to pay with it, so every panel here carries a sentence answering
 * "why would I press this".
 */
export default async function GiftCardsPage() {
  const owner = await getOwnDoctor();
  if (!owner) {
    return <Empty title="No practice linked" body="This account has no practice record yet." />;
  }

  const now = new Date();

  const [offers, clinics, sold] = await Promise.all([
    prisma.giftCardOffer.findMany({
      where: { doctorId: owner.doctorId },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        valueInr: true,
        priceInr: true,
        validMonths: true,
        status: true,
        reviewNote: true,
        _count: { select: { cards: true } },
      },
    }),
    prisma.doctorClinic.findMany({
      where: { doctorId: owner.doctorId },
      select: { clinic: { select: { id: true, name: true } } },
    }),
    prisma.giftCard.findMany({
      where: { offer: { doctorId: owner.doctorId }, paidAt: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        code: true,
        valueInr: true,
        balanceInr: true,
        expiresAt: true,
        createdAt: true,
        recipientName: true,
        recipientEmail: true,
        message: true,
        buyer: { select: { name: true, email: true, publicId: true } },
        offer: { select: { title: true } },
        redemptions: {
          orderBy: { redeemedAt: "desc" },
          select: { id: true, amountInr: true, note: true, redeemedAt: true },
        },
      },
    }),
  ]);

  const rows: SoldCardRow[] = sold.map((c) => ({
    id: c.id,
    code: c.code,
    offerTitle: c.offer.title,
    valueInr: c.valueInr,
    balanceInr: c.balanceInr,
    buyerName: c.buyer.name ?? "A client",
    buyerEmail: c.buyer.email,
    buyerPublicId: c.buyer.publicId,
    recipientName: c.recipientName,
    recipientEmail: c.recipientEmail,
    message: c.message,
    boughtOn: day(c.createdAt),
    expiresOn: c.expiresAt ? day(c.expiresAt) : null,
    expired: Boolean(c.expiresAt && c.expiresAt < now),
    redemptions: c.redemptions.map((r) => ({
      id: r.id,
      amountInr: r.amountInr,
      note: r.note,
      at: day(r.redeemedAt),
    })),
  }));

  const live = offers.filter((o) => o.status === OfferStatus.APPROVED).length;
  const pending = offers.filter((o) => o.status === OfferStatus.PENDING).length;

  // Computed rather than stated: what is still owed against cards already
  // paid for is a real liability, and a practice should be able to see it.
  const outstanding = rows.reduce((n, r) => (r.expired ? n : n + r.balanceInr), 0);
  const takenSoFar = rows.reduce((n, r) => n + (r.valueInr - r.balanceInr), 0);

  return (
    <>
      <PageHead
        title="Gift cards"
        sub="Credit somebody buys for somebody else, spendable at your practice."
      />

      {/* The three figures a practice actually wants from this screen. */}
      <div className="mb-5 grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        <Tile label="On sale" value={String(live)} bar="border-teal-500"
              hint={pending > 0 ? `${pending} awaiting review` : "Offers patients can buy"} />
        <Tile label="Cards sold" value={String(rows.length)} bar="border-brand-500"
              hint="Paid for, and in somebody's hands" />
        <Tile label="Still to honour" value={money(outstanding)} bar="border-amber-500"
              hint="What people can still spend with you" />
        <Tile label="Redeemed so far" value={money(takenSoFar)} bar="border-violet-500"
              hint="Treatment already given against a card" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[24rem_minmax(0,1fr)]">
        <div className="space-y-4">
          <Panel
            title="Take payment from a card"
            sub="At the counter"
            icon="rupee"
            accent="teal"
            index={0}
            note={
              <>
                Use this when somebody is standing in front of you with a gift
                card code and wants to pay with it. Type the code and how much
                of it to put towards today&apos;s treatment. A card can be used
                across several visits, so take only what this visit costs.
              </>
            }
          >
            <RedeemForm />
          </Panel>

          <Panel
            title="Create an offer"
            sub="Then send it for review"
            icon="star"
            accent="violet"
            index={1}
            note={
              <>
                An offer is a card patients can buy from your practice. It is
                saved as a draft first; nothing reaches the shop until you send
                it and BluDerma has checked it, because a card sold on our
                storefront is a promise we stand behind too.
              </>
            }
          >
            <OfferForm clinics={clinics.map((c) => c.clinic)} />
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel
            title="Your offers"
            sub={live > 0 ? `${live} on sale` : `${offers.length} total`}
            icon="clinic"
            accent="brand"
            index={2}
            note={
              <>
                What your practice is selling. Editing an approved offer sends
                it back for review, so the figures a patient saw when they
                bought cannot change underneath them.
              </>
            }
          >
            {offers.length === 0 ? (
              <div className="p-1">
                <Empty title="Nothing yet" body="Create an offer and send it for review." />
              </div>
            ) : (
              <ul className="-mx-5 -my-5 divide-y divide-slate-100">
                {offers.map((o) => (
                  <OfferRow
                    key={o.id}
                    id={o.id}
                    title={o.title}
                    valueInr={o.valueInr}
                    priceInr={o.priceInr}
                    validMonths={o.validMonths}
                    status={o.status}
                    reviewNote={o.reviewNote}
                    sold={o._count.cards}
                  />
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="Cards people are holding"
            sub={`${rows.length} sold · ${money(outstanding)} still to honour`}
            icon="today"
            accent="amber"
            index={3}
            padded={false}
            note={
              <>
                Every card bought from you, who paid, who it was bought for,
                and what has been taken off it. Open one before redeeming if
                you want to check the person in front of you is the person it
                was meant for.
              </>
            }
          >
            {rows.length === 0 ? (
              <div className="p-5">
                <Empty
                  title="None sold yet"
                  body="Once a patient buys one of your offers it appears here with its balance and history."
                />
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <SoldCard key={r.id} row={r} />
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

function Tile({
  label,
  value,
  bar,
  hint,
}: {
  label: string;
  value: string;
  bar: string;
  hint: string;
}) {
  return (
    <div
      className={`rounded-2xl border-t-[3px] bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_12px_32px_-24px_rgba(15,23,42,0.35)] ring-1 ring-slate-200/80 sm:p-4 ${bar}`}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400 sm:text-[11px]">
        {label}
      </p>
      <p className="mt-1 font-display text-[20px] font-extrabold leading-none tracking-[-0.03em] tabular-nums text-slate-900 sm:text-[26px]">
        {value}
      </p>
      <p className="mt-1.5 text-[11px] leading-snug text-slate-500">{hint}</p>
    </div>
  );
}
