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
  check("the anchor is configured above it", Number(listRow?.value) > 99, listRow?.value ?? "unset");

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

live()
  .catch((e) => fails.push(`live check threw: ${e.message ?? e}`))
  .then(() => {
    console.log(`\n${pass} passed, ${fails.length} failed`);
    if (fails.length) {
      fails.forEach((f) => console.log(`  FAIL  ${f}`));
      process.exit(1);
    }
  });
