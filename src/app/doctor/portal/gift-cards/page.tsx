import { OfferStatus } from "@prisma/client";

import { Empty, PageHead, Panel } from "@/components/doctor/portalUi";
import OfferForm, { OfferRow } from "@/components/doctor/OfferForm";
import SoldCard, { type SoldCardRow } from "@/components/doctor/SoldCard";
import { getOwnDoctor } from "@/lib/doctor/guard";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Gift cards" };
export const dynamic = "force-dynamic";

const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const day = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/**
 * Gift cards a clinic offers, and what people are holding.
 *
 * ── There is no counter-redemption screen ────────────────────────────────
 * One stood here and was removed at the clinic's request. Note what that
 * leaves: a card can be BOUGHT, but there is no path for a practitioner to
 * spend one against a visit, so the balances below are a record rather than
 * something anybody can draw on. redeemGiftCard is still in the actions
 * module, unwired, for whenever that path is decided.
 *
 * ── The notes are one line ───────────────────────────────────────────────
 * Each panel says what it is for in a sentence. Longer than that and the
 * explanation competes with the thing it is explaining.
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
        mark="cards"
        sub="Credit somebody buys for somebody else, spendable at your practice."
      />

      {/* The three figures a practice actually wants from this screen. */}
      <div className="mb-5 grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-3">
        <Tile label="On sale" value={String(live)} bar="border-mint-500"
              hint={pending > 0 ? `${pending} awaiting review` : "Offers patients can buy"} />
        <Tile label="Cards sold" value={String(rows.length)} bar="border-azure-500"
              hint="Paid for, and in somebody's hands" />
        <Tile label="Still to honour" value={money(outstanding)} bar="border-gold-500"
              hint="Face value people are holding" />
        {/* Only when something actually has been. With the counter screen
            gone there is no way for this to move, so a permanent zero would
            read as a broken tile rather than an honest one. */}
        {takenSoFar > 0 && (
          <Tile label="Redeemed so far" value={money(takenSoFar)} bar="border-graphite-500"
                hint="Treatment already given against a card" />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[24rem_minmax(0,1fr)]">
        <div className="space-y-4">


          <Panel
            title="Create an offer"
            sub="Then send it for review"
            icon="star"
            accent="violet"
            index={1}
            note={
              <>Saved as a draft. It reaches the shop once BluDerma approves it.</>
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
              <>Editing an approved offer sends it back for review.</>
            }
          >
            {offers.length === 0 ? (
              <div className="p-1">
                <Empty title="Nothing yet" body="Create an offer and send it for review." />
              </div>
            ) : (
              <ul className="-mx-5 -my-5 divide-y divide-graphite-100">
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
              <>Who paid, who it is for, and what has been taken off it.</>
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
              <ul className="divide-y divide-graphite-100">
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
      className={`rounded-[10px] border-t-[3px] bg-white p-3 shadow-flat ring-1 ring-graphite-200 sm:p-4 ${bar}`}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-graphite-500 sm:text-[11px]">
        {label}
      </p>
      <p className="mt-1 font-display text-[20px] font-extrabold leading-none tracking-[-0.03em] tabular-nums text-graphite-900 sm:text-[26px]">
        {value}
      </p>
      <p className="mt-1.5 text-[11px] leading-snug text-graphite-500">{hint}</p>
    </div>
  );
}
