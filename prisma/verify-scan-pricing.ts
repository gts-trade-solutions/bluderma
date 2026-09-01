/**
 * The advertised price and the charged price are the same number.
 *
 * They were not. Three cards quote a scan price, and they disagreed:
 * SkinScanCard and SkinAnalyzerLanding had `₹99` typed into them as a literal
 * while `skin.scan_price_inr` said 499, so the site advertised 99 and the
 * checkout would have taken 499. AnalyzerRail did read the setting, but drew
 * its "usually" strike-through against that same setting, printing 499 twice
 * with one of them crossed out: a saving of nothing.
 *
 * A price on a page is a promise, so this suite treats a hardcoded figure as
 * a failure on its own, whatever the figure happens to be. Correct-by-accident
 * is how the 99 got there in the first place.
 *
 * Needs the app running (see ORIGIN) for the live half.
 *
 *   npx tsx prisma/verify-scan-pricing.ts [origin]
 */
import { existsSync, readFileSync } from "node:fs";

import { encode } from "next-auth/jwt";
import { PrismaClient } from "@prisma/client";

const ORIGIN = process.argv[2] ?? "http://localhost:3112";

let pass = 0;
const fails: string[] = [];
function check(name: string, ok: boolean, detail?: string) {
  if (ok) pass++;
  else fails.push(detail ? `${name} (${detail})` : name);
}
const read = (p: string) => readFileSync(p, "utf8");

/**
 * Source with its comments blanked.
 *
 * Three suites in this repo have now failed on the comment that EXPLAINS the
 * fix rather than on the code, so the price-literal scan below strips comments
 * before it looks. The notes above quote the old `₹99` deliberately.
 */
const codeOnly = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

function env(key: string): string {
  for (const f of [".env.local", ".env"]) {
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"#\r]*)"?/i);
      if (m && m[1] === key) return m[2].trim();
    }
  }
  return "";
}

/* ── No card may name a price ────────────────────────────────────────── */

const CARDS = [
  "src/components/hub/SkinScanCard.tsx",
  "src/components/hub/AnalyzerRail.tsx",
  "src/components/skin/SkinAnalyzerLanding.tsx",
];

for (const file of CARDS) {
  const code = codeOnly(read(file));
  // `₹0` is the word "free" written as a figure, not a price being quoted,
  // so it is allowed. Anything else must come from settings.
  const literals = (code.match(/₹\s*\d[\d,]*/g) ?? []).filter(
    (m) => m.replace(/[^\d]/g, "") !== "0"
  );
  check(
    `${file.split("/").pop()} names no price of its own`,
    literals.length === 0,
    literals.join(", ")
  );
  // Reading the setting is not enough on its own: AnalyzerRail did that and
  // still printed the same number twice.
  check(
    `${file.split("/").pop()} takes its figures from the hook`,
    /priceInr/.test(code)
  );
}

/* ── The strike-through rule ─────────────────────────────────────────── */

const pricing = codeOnly(read("src/lib/integrations/skinPricing.ts"));
check(
  "the anchor is a separate setting from the charged price",
  /skin\.scan_list_price_inr/.test(pricing) && /skin\.scan_price_inr/.test(pricing)
);
check(
  "an anchor at or below the charged price is collapsed",
  /Math\.max\(listPriceInr,\s*priceInr\)/.test(pricing),
  "otherwise a card can strike through a saving of nothing"
);

const hook = codeOnly(read("src/hooks/useSkinAccess.ts"));
check(
  "the hook hands cards a null anchor when no offer is running",
  /listPriceInr\s*>\s*[\w.]*\bpriceInr/.test(hook)
);

for (const file of CARDS) {
  const code = codeOnly(read(file));
  // Every card must be able to NOT draw the anchor.
  check(
    `${file.split("/").pop()} draws the anchor conditionally`,
    /listPriceInr\s*!==\s*null|listPriceInr\s*\?\?|anchor\s*!==\s*null/.test(code)
  );
}

/* ── The button charges rather than queues ───────────────────────────── */

for (const file of ["src/components/hub/SkinScanCard.tsx", "src/components/hub/AnalyzerRail.tsx"]) {
  const code = codeOnly(read(file));
  check(
    `${file.split("/").pop()} offers checkout where the gateway is configured`,
    /payable/.test(code) && /purchase|onBuy/.test(code)
  );
  // Asking staff survives only as the fallback, so it must still be reachable.
  check(
    `${file.split("/").pop()} still falls back to asking the clinic`,
    /requestAccess|onRequest/.test(code)
  );
}

/* ── Live: what the client is actually told ──────────────────────────── */

async function live() {
  const prisma = new PrismaClient({ log: ["error"] });
  const [user, priceRow, listRow] = await Promise.all([
    prisma.user.findUnique({
      where: { email: "demo.client@bluderma.local" },
      select: { id: true, email: true, name: true, role: true },
    }),
    prisma.siteSetting.findUnique({ where: { key: "skin.scan_price_inr" } }),
    prisma.siteSetting.findUnique({ where: { key: "skin.scan_list_price_inr" } }),
  ]);
  await prisma.$disconnect();

  check("the charged price is configured", priceRow?.value === "99", priceRow?.value ?? "unset");
  // Not "above it". An anchor EQUAL to the charged price is the correct
  // setting when there is no discount running — it collapses the strike-
  // through everywhere, which is what "quote 99, not 499" means. What must
  // never happen is an anchor BELOW the charged price: that renders as a
  // crossed-out number smaller than the one being asked for, which reads as
  // a price rise.
  const listInr = Number(listRow?.value ?? 0);
  check(
    "the anchor never sits below the charged price",
    listInr >= 99,
    listRow?.value ?? "unset"
  );
  // And the code has to act on that: the hook returns null for the anchor
  // unless it is strictly above the charged price, which is what stops a
  // "discount" from the same number to the same number being drawn.
  check(
    "an anchor that is not above the price is collapsed to null",
    /listPriceInr > status\.offer\.priceInr/.test(read("src/hooks/useSkinAccess.ts")),
    `configured anchor ${listInr}, charged 99`
  );

  if (!user) {
    fails.push("no demo client to sign in as");
    return;
  }

  const token = await encode({
    token: { id: user.id, role: user.role, email: user.email, name: user.name },
    secret: env("NEXTAUTH_SECRET"),
  });

  let res: Response;
  try {
    res = await fetch(`${ORIGIN}/api/skin/status`, {
      headers: { cookie: `next-auth.session-token=${token}` },
      cache: "no-store",
    });
  } catch {
    console.log(`\n  skipped the live half: nothing serving ${ORIGIN}`);
    return;
  }

  check("the status endpoint answers", res.ok, String(res.status));
  const body = (await res.json()) as {
    authed?: boolean;
    offer?: { priceInr?: number; listPriceInr?: number };
    payable?: boolean;
  };

  check("the session is recognised", body.authed === true);
  check(
    "it quotes the charged price, not the anchor",
    body.offer?.priceInr === 99,
    String(body.offer?.priceInr)
  );
  check(
    "and carries the anchor separately",
    (body.offer?.listPriceInr ?? 0) > (body.offer?.priceInr ?? 0),
    `${body.offer?.listPriceInr} vs ${body.offer?.priceInr}`
  );

  // Not a failure: it is a deployment fact, and the fallback is deliberate.
  // But it is the reason a doctor sees "Request another scan" in production,
  // so it gets said out loud rather than passing quietly.
  if (body.payable !== true) {
    console.log(
      "\n  NOTE  Razorpay is not configured here, so the button asks staff\n" +
        "        rather than charging. Set RAZORPAY_KEY_ID and\n" +
        "        RAZORPAY_KEY_SECRET to turn the checkout on."
    );
  }
}

/* -- The hero told everybody about their first scan ----------------------
   Reported from production: the second scan quoted 499 when it costs 99.
   The buy button was right; the HERO was not. It printed the struck-through
   list price beside a hardcoded "Your first scan / Rs 0" for every visitor,
   including one who had already used theirs — so the only two figures on the
   page were the one nobody pays and zero, and the price actually charged
   appeared nowhere above the fold. */
const landing = read("src/components/skin/SkinAnalyzerLanding.tsx");
check(
  "the hero price follows the entitlement, not a hardcoded zero",
  landing.includes('{firstScanFree ? "₹0" : priceInr !== null ? inr(priceInr) : "—"}'),
  "a returning client is quoted the free-scan story again"
);
check(
  "and its label changes with it",
  landing.includes('{firstScanFree ? "Your first scan" : "Your next scan"}')
);
check(
  "the hero badge stops promising a free first scan once it is used",
  landing.includes('{firstScanFree ? "First scan free" : "Scan again"}')
);
check(
  "the landing page reads firstScanFree from the shared hook",
  /firstScanFree,\s*\}\s*=\s*useSkinAccess\(\)/.test(landing)
);

/* -- Paying for a scan hands you the scan ------------------------------
   It used to stop at reload(), leaving somebody who had just paid on the
   same screen with no sign the money had done anything. Starting straight
   away is only safe because /api/razorpay/verify settles the payment before
   it answers, and settling is what grants the credit -- it does not wait on
   the webhook, which may arrive late or, on a local build, never. */
const access = read("src/hooks/useSkinAccess.ts");
check(
  "a settled payment goes straight into the analysis",
  // Not a proximity regex: the gap between the two is a comment explaining
  // why it is safe, and a check that breaks when somebody documents their
  // work better is a check that trains people not to.
  access.includes("await start();") && access.includes("[checkout, start]"),
  "payment succeeds and the client is left looking at the sales page"
);
check(
  "the credit is granted by verify, before the client is told it is paid",
  read("src/app/api/razorpay/verify/route.ts").includes("settlePayment"),
  "starting a scan on a webhook that has not landed yet would fail"
);
check(
  "and settling is what releases the scan credit",
  read("src/lib/payments/settle.ts").includes("releaseScanCredit")
);

/* -- Every surface that quotes the price uses the same source ----------- */
for (const f of [
  "src/components/hub/SkinScanCard.tsx",
  "src/components/hub/AnalyzerRail.tsx",
  "src/components/skin/SkinAnalyzerLanding.tsx",
]) {
  const src = read(f);
  check(`${f.split("/").pop()} distinguishes the first scan from the next`, src.includes("firstScanFree"));
  check(
    `${f.split("/").pop()} quotes no hardcoded rupee figure`,
    !/₹\s?(?:99|499)/.test(src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "")),
    "a literal price is how the page and the checkout drifted apart before"
  );
}

live()

  .catch((e) => fails.push(`live check threw: ${e.message ?? e}`))
  .then(() => {
    /* -- The button that refused to charge, then refused to scan -------------
   Reported from production: a client with no scans left presses "Buy another
   scan for Rs 99" and is told "You have no analyses remaining."

   Two predicates answering the same question differently. getScanOffer said
   `free` when no CONSUMED row existed; reserve() seeds a free scan only when
   NO row exists in any state. Anybody holding a row in some other state — a
   purchase begun and never settled, an admin grant pending payment — was
   "never scanned" to the first and "nothing to claim" to the second. The
   purchase route read `free`, took no money, handed off to the scan, and the
   scan refused. A loop with no way out: the same button both declines to
   charge them and declines to let them through. */
const pricing = read("src/lib/integrations/skinPricing.ts");
check(
  "the free test matches what reserve() can actually honour",
  pricing.includes("everHad === 0"),
  "counting only consumed rows lets a client fall between the two"
);
check(
  "and counts a live reservation as nothing left to pay",
  pricing.includes("reservedCount > 0")
);
check(
  "the old consumed-only test is gone",
  !pricing.includes("scansUsed === 0 && creditsAvailable === 0")
);
check(
  "everHad counts rows in every state, which is seedFreeIfNew's condition",
  pricing.includes("prisma.skinEntitlement.count({ where: { userId } })") &&
    read("src/lib/integrations/skinEntitlement.ts").includes(
      "const everHad = await prisma.skinEntitlement.count({ where: { userId } })"
    )
);

/* -- A discount badge that was always on ------------------------------- */
check(
  "the saving is only claimed where there is one",
  landing.includes("{firstScanFree ? (") &&
    landing.includes("anchor > priceInr ? ("),
  "100% off was rendered unconditionally beside the Rs 99 being charged"
);
check(
  "and the figure is computed, not asserted",
  landing.includes("Math.round(((anchor - priceInr) / anchor) * 100)")
);

console.log(`\n${pass} passed, ${fails.length} failed`);
    if (fails.length) {
      fails.forEach((f) => console.log(`  FAIL  ${f}`));
      process.exit(1);
    }
  });
