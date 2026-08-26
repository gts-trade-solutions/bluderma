/**
 * Photographs, gift cards and medicines.
 *
 * Three features, one suite, because they share the rules that actually
 * matter and those rules are about money and about somebody's face:
 *
 *   - a photograph of a patient is never public, at any status
 *   - a gift card is worth nothing until the payment has settled
 *   - a card cannot be spent twice by two tills at once
 *   - a price is read from the database, never from the request
 *   - the injectables catalogue cannot reach a consumer checkout
 *
 *   npx tsx prisma/verify-commerce.ts
 */
import { readFileSync } from "node:fs";

import { OfferStatus, PrismaClient } from "@prisma/client";

import {
  exactMatches,
  fold,
  merge,
  parseMatches,
  buildPrompt,
} from "../src/lib/integrations/prescriptionReadCore";
import { isGiftCardCode, isOrderId, newGiftCardCode, newOrderId } from "../src/lib/publicId";

const prisma = new PrismaClient({ log: ["error"] });

let pass = 0;
const fails: string[] = [];
function check(name: string, ok: boolean, detail?: string) {
  if (ok) pass++;
  else fails.push(detail ? `${name} (${detail})` : name);
}
const codeOnly = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ");

async function main() {
  /* ── Photographs are never public ──────────────────────────────────── */

  const route = codeOnly("src/app/api/patient-photos/[id]/route.ts");
  check("the photo route requires a session", /getCurrentUser/.test(route));
  check(
    "the patient may always see their own",
    /user\.id === photo\.patientUserId/.test(route)
  );
  check(
    "a doctor must have actually seen them",
    /appointment\.findFirst[\s\S]{0,200}patientUserId: photo\.patientUserId/.test(route),
    "a role is not a clinical relationship"
  );
  check(
    "an admin is NOT on the list",
    !/role === "ADMIN"/.test(route),
    "running the platform is not a reason to look at somebody's face"
  );
  check("refusal is a 404, not a 403", /status: 404/.test(route));
  check("and the signed redirect is never cached", /no-store/.test(route));

  const chart = codeOnly("src/components/doctor/PatientChart.tsx");
  const mine = codeOnly("src/components/patient/MyPhotos.tsx");
  for (const [name, src] of [["the chart", chart], ["the patient's own page", mine]] as const) {
    // Every upload in the app now goes through lib/uploadClient.ts, so the
    // folder is an argument rather than a property of an inline presign call.
    check(
      `${name} uploads to the private prefix`,
      /uploadFile\((?:file|\w+), "patients"\)/.test(src)
    );
    check(`${name} serves through the signing route`, /api\/patient-photos\//.test(src));
  }

  /* ── Marks are beside the image, not burnt into it ─────────────────── */

  const markup = codeOnly("src/components/doctor/PhotoMarkup.tsx");
  check(
    "strokes are drawn on a canvas over the photograph",
    /<canvas/.test(markup) && !/toDataURL|toBlob/.test(markup),
    "rewriting the file would make a March circle part of a February record"
  );
  check(
    "coordinates are normalised, not pixels",
    /r\.width/.test(markup) && /\* width/.test(markup),
    "pixel coordinates put a phone-drawn mark somewhere else on a monitor"
  );
  const photoAction = codeOnly("src/lib/actions/photos.ts");
  check(
    "one markup layer per doctor",
    /photoId_doctorId/.test(photoAction),
    "a second practitioner must not overwrite somebody else's reading"
  );
  check(
    "a patient cannot delete a clinical photograph",
    /doctorId: null/.test(photoAction),
    "the practice's copy is part of a record"
  );
  check(
    "every clinical write checks the doctor has seen them",
    /mustHaveSeen/.test(photoAction)
  );

  /* ── Gift cards ────────────────────────────────────────────────────── */

  const code = newGiftCardCode();
  check("a card code is well formed", isGiftCardCode(code), code);
  // Compared on the RANDOM part, not the whole string: "BLU-G-" is two
  // characters shorter than "BLU-DR-", so the totals tie while the entropy
  // does not. The entropy is the thing that matters.
  const body = (v: string) => v.slice(v.lastIndexOf("-") + 1).length;
  check(
    "a card code carries more entropy than an identity id",
    body(code) > body("BLU-DR-0000000"),
    "it is a bearer token: whoever can say it can spend the money"
  );
  check(
    "and guessing at one is rate limited",
    /rateLimit\(`redeem:/.test(codeOnly("src/lib/actions/giftCards.ts")),
    "a large code space only helps against an attacker who is slowed down"
  );
  const order = newOrderId();
  check("an order reference is well formed", isOrderId(order), order);
  check("and is not a card code", !isGiftCardCode(order));

  const gift = codeOnly("src/lib/actions/giftCards.ts");
  check(
    "a new card carries no balance",
    /balanceInr: 0/.test(gift),
    "a card spendable on an abandoned payment is treatment given away"
  );
  check(
    "the price cannot exceed the value",
    /price cannot be more than the card is worth/.test(gift)
  );
  check(
    "only an approved offer can be bought",
    /status: OfferStatus\.APPROVED/.test(gift)
  );
  check(
    "editing an approved offer sends it back for review",
    /OfferStatus\.PENDING/.test(gift),
    "otherwise a clinic gets figures approved and then changes them"
  );
  check(
    "redemption is conditional on the balance not having moved",
    /balanceInr: card\.balanceInr/.test(gift),
    "two tills must not both spend the same money"
  );
  check("an expired card is refused", /has expired/.test(gift));
  check("an unpaid card is refused", /has not been paid for/.test(gift));

  const settle = codeOnly("src/lib/payments/settle.ts");
  check(
    "the balance is released only on settlement",
    /releaseGiftCardBalance/.test(settle)
  );
  check(
    "and releasing it is idempotent",
    /paidAt: null[\s\S]{0,120}balanceInr: card\.valueInr/.test(settle),
    "a retried webhook must not double a card"
  );

  const payRoute = codeOnly("src/app/api/gift-cards/pay/route.ts");
  check(
    "the charge comes from the offer, not the request",
    /card\.offer\.priceInr/.test(payRoute)
  );
  check("and the buyer must own the card", /buyerUserId: user\.id/.test(payRoute));

  /* ── Medicines ─────────────────────────────────────────────────────── */

  const med = codeOnly("src/lib/actions/medicines.ts");
  check(
    "prices are read from the database",
    /medicine\.findMany[\s\S]{0,300}priceInr: true/.test(med),
    "a price in the payload is a number the client chose"
  );
  check(
    "a prescription-only basket demands a prescription",
    /needsScript && !d\.prescriptionUrl/.test(med)
  );
  check(
    "and that is judged from the medicines, not a client flag",
    /medicines\.some\(\(m\) => m\.prescriptionOnly\)/.test(med)
  );
  check("stock is only enforced where it is tracked", /m\.stock !== null/.test(med));
  check(
    "the injectables catalogue is unreachable from here",
    !/prisma\.product\b/.test(med),
    "those are prescription-only clinical consumables, priced internal-only"
  );
  const medPage = codeOnly("src/app/doctor/portal/medicines/page.tsx");
  check("nor from the doctor's page", !/prisma\.product\b/.test(medPage));


  /* ── Every new panel says what it is for, briefly ─────────────────── */

  // The first version of this pinned the exact wording, which broke the moment
  // the copy was shortened, and a guard that fails on an improvement is one
  // people learn to ignore. What actually matters is the pair of properties:
  // a panel explains itself, and the explanation stays SHORT. A four-line note
  // competes with the thing it is explaining.
  const NOTE_LIMIT = 110;
  for (const file of [
    "src/app/doctor/portal/gift-cards/page.tsx",
    "src/app/doctor/portal/medicines/page.tsx",
    "src/app/doctor/portal/aftercare/page.tsx",
    "src/app/doctor/portal/gallery/page.tsx",
    "src/app/doctor/portal/plans/page.tsx",
    "src/app/doctor/portal/finance/page.tsx",
  ] as const) {
    const src = readFileSync(file, "utf8");
    const page = file.split("/").slice(-2)[0];

    const panels = (src.match(/<Panel/g) ?? []).length;
    const notes = (src.match(/note=\{/g) ?? []).length;
    check(`${page}: every panel explains itself`, notes >= panels, `${notes} of ${panels}`);

    // Measure the prose, not the JSX around it.
    const bodies = [...src.matchAll(/note=\{\s*<>([\s\S]*?)<\/>\s*\}/g)].map((m) =>
      m[1].replace(/\{"\s"\}/g, " ").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim()
    );
    const tooLong = bodies.filter((b) => b.length > NOTE_LIMIT);
    check(
      `${page}: the notes stay short`,
      tooLong.length === 0,
      tooLong.map((b) => `${b.length} chars: ${b.slice(0, 44)}…`).join(" | ")
    );
    check(`${page}: and none is empty`, bodies.every((b) => b.length > 8));
  }

  const panelSrc = readFileSync("src/components/doctor/portalUi.tsx", "utf8");
  check("Panel carries a note slot", /note\?: React\.ReactNode/.test(panelSrc));

  // The counter-redemption screen was removed at the clinic's request. Worth
  // pinning, because "why can nobody spend these cards" is a question somebody
  // will ask later and the answer should not have to be archaeology.
  check(
    "no counter-redemption screen is wired up",
    !/<RedeemForm/.test(readFileSync("src/app/doctor/portal/gift-cards/page.tsx", "utf8")),
    "removed by request; redeemGiftCard remains unwired in the actions module"
  );

  /* ── A sold card is shown in full ─────────────────────────────────── */

  const soldCard = codeOnly("src/components/doctor/SoldCard.tsx");
  check(
    "buyer and recipient are separate facts",
    /buyerName/.test(soldCard) && /recipientName/.test(soldCard),
    "whoever holds the code is usually not whoever paid"
  );
  check(
    "every redemption is listed, not just the balance",
    /redemptions\.map/.test(soldCard),
    "a dispute is about history, and a balance is one number"
  );
  check("an expired card says so", /Expired/.test(soldCard));
  check(
    "the gift page shows what is still owed",
    /Still to honour/.test(readFileSync("src/app/doctor/portal/gift-cards/page.tsx", "utf8")),
    "unspent cards are a real liability"
  );
  check(
    "the redeem action still reports what is left",
    /remainingInr/.test(codeOnly("src/lib/actions/giftCards.ts")),
    "kept for whenever a redemption path is decided"
  );

  /* ── Reading a prescription ────────────────────────────────────────── */

  const list = [
    { id: "1", name: "Tretinoin", brand: "Retino-A", strength: "0.025%" },
    { id: "2", name: "Clindamycin", brand: null, strength: null },
  ];
  check("folding ignores case and punctuation", fold("Retino-A") === fold("retino a"));

  const hits = exactMatches("Rx: Retino-A nightly, and something else", list);
  check("a brand on the paper is matched", hits.length === 1 && hits[0].id === "1");
  check("and the reason is checkable", /Retino-A/.test(hits[0].because));
  check(
    "nothing is matched that is not there",
    exactMatches("paracetamol only", list).length === 0
  );

  const parsed = parseMatches(
    '[{"name":"Clindamycin","because":"line 2"},{"name":"Unobtainium","because":"invented"}]',
    list
  );
  check("the model's answer is intersected with the list", parsed.length === 1);
  check("and the invented one is dropped", parsed[0].id === "2");
  check(
    "the list's spelling wins",
    parseMatches('[{"name":"clindamycin"}]', list)[0]?.name === "Clindamycin"
  );
  check("malformed JSON yields nothing", parseMatches("not json", list).length === 0);
  check(
    "an exact hit is preferred over an AI one",
    merge(hits, [{ id: "1", name: "Tretinoin", because: "guessed", source: "ai" }])
      .filter((m) => m.id === "1").length === 1
  );

  const prompt = buildPrompt("text", list);
  for (const [what, needle] of [
    ["it forbids inventing", "Do not invent"],
    ["it forbids interpreting", "Do not interpret"],
    ["it prefers a miss to a guess", "A missed medicine costs one tap"],
  ] as const) {
    check(what, prompt.includes(needle), needle);
  }

  /* ── Live: the tables work ─────────────────────────────────────────── */

  const [doctor, patient] = await Promise.all([
    prisma.doctor.findFirst({ select: { id: true } }),
    prisma.user.findFirst({ where: { role: "PATIENT" }, select: { id: true } }),
  ]);
  if (!doctor || !patient) {
    fails.push("need a doctor and a patient");
    return;
  }

  let offerId = "";
  let cardId = "";
  try {
    const offer = await prisma.giftCardOffer.create({
      data: {
        doctorId: doctor.id,
        title: "vfy-offer",
        valueInr: 5000,
        priceInr: 4500,
        status: OfferStatus.APPROVED,
      },
      select: { id: true },
    });
    offerId = offer.id;

    const card = await prisma.giftCard.create({
      data: {
        offerId,
        code: newGiftCardCode(),
        buyerUserId: patient.id,
        valueInr: 5000,
        balanceInr: 0,
      },
      select: { id: true, balanceInr: true, paidAt: true },
    });
    cardId = card.id;
    check("a fresh card has no balance", card.balanceInr === 0 && card.paidAt === null);

    // Settle it the way the payment path does.
    await prisma.giftCard.updateMany({
      where: { id: cardId, paidAt: null },
      data: { paidAt: new Date(), balanceInr: 5000 },
    });
    // And again, as a retried webhook would.
    const again = await prisma.giftCard.updateMany({
      where: { id: cardId, paidAt: null },
      data: { paidAt: new Date(), balanceInr: 5000 },
    });
    check("settling twice changes nothing", again.count === 0);

    const paid = await prisma.giftCard.findUniqueOrThrow({ where: { id: cardId } });
    check("the balance is released once", paid.balanceInr === 5000);

    // The concurrent-spend guard, exercised.
    const first = await prisma.giftCard.updateMany({
      where: { id: cardId, balanceInr: 5000 },
      data: { balanceInr: 3500 },
    });
    const second = await prisma.giftCard.updateMany({
      where: { id: cardId, balanceInr: 5000 },
      data: { balanceInr: 3500 },
    });
    check(
      "only one till can spend the same balance",
      first.count === 1 && second.count === 0,
      "the second read a balance that had already moved"
    );
  } finally {
    if (cardId) await prisma.giftCard.deleteMany({ where: { id: cardId } });
    if (offerId) await prisma.giftCardOffer.deleteMany({ where: { id: offerId } });
    const left = await prisma.giftCardOffer.count({ where: { title: "vfy-offer" } });
    check("the fixture cleaned up after itself", left === 0, `${left} left`);
  }
}

main()
  .catch((e) => fails.push(`threw: ${e.message ?? e}`))
  .finally(async () => {
    await prisma.$disconnect();
    console.log(`\n${pass} passed, ${fails.length} failed`);
    if (fails.length) {
      fails.forEach((f) => console.log(`  FAIL  ${f}`));
      process.exit(1);
    }
  });
