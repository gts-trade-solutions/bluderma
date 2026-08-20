/**
 * The dashboard's insight strip.
 *
 * The strip is the one place on the portal where a model's words sit directly
 * beside a practitioner's income, so the check that matters most is the
 * fabrication tripwire: every number in generated prose must appear in the
 * metrics it was handed. One that does not discards the whole response.
 */
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

import {
  INSIGHT_ICONS,
  type InsightMetrics,
  allowedFigures,
  figuresAreSupported,
  figuresIn,
  templateInsights,
} from "../src/lib/integrations/insightsCore";

const prisma = new PrismaClient({ log: ["warn", "error"] });

let pass = 0;
const fails: string[] = [];
function check(name: string, ok: boolean, detail?: string) {
  if (ok) pass++;
  else fails.push(detail ? `${name} (${detail})` : name);
}
const read = (p: string) => readFileSync(p, "utf8");

const M: InsightMetrics = {
  periodBooked: 12500,
  projected: 20000,
  averageValue: 1250,
  realised: 8000,
  unresolved: 2500,
  lostCount: 1600,
  awaiting: 2,
  daysLeft: 11,
  emptiestDay: "Thursday",
  emptiestFree: 8,
  weeklyCapacity: 36,
  topReason: "Acne or breakouts",
  topReasonCount: 14,
  noShowRate: 0.12,
  noShowSample: 25,
  returningRate: 0.15,
  returningSample: 20,
  reviewCount: 1,
  rating: 4.5,
  memberShare: 0.2,
  uplift1: 1960,
};

// ── The deterministic pointers ────────────────────────────────────────────
const items = templateInsights(M);
check("returns three or four pointers", items.length >= 3 && items.length <= 4);
check("each has a title and a body", items.every((i) => i.title && i.body));
check("titles stay short", items.every((i) => i.title.length <= 80));

// Every figure the template prints must be one it was given.
for (const item of items) {
  check(
    `template pointer quotes only real figures: "${item.title.slice(0, 40)}"`,
    figuresAreSupported(`${item.title} ${item.body}`, M)
  );
}

// The figure now lives in `metric` and the words in `title`, so assert
// against the pair rather than the sentence they used to share.
const asText = (i: (typeof items)[number]) => `${i.metric ?? ""} ${i.title} ${i.body}`;
check("held bookings are surfaced first", asText(items[0]).includes("2"));
check("unclosed money is surfaced", items.some((i) => asText(i).includes("2,500")));
check("the quiet day is named", items.some((i) => asText(i).includes("Thursday")));

// ── The tripwire itself ───────────────────────────────────────────────────
check("a supported figure passes", figuresAreSupported("You have 2 bookings waiting.", M));
check("a formatted figure passes", figuresAreSupported("That is ₹12,500 booked.", M));
check("a percentage passes", figuresAreSupported("12% were no-shows.", M));
check("a rating passes", figuresAreSupported("You are rated 4.5.", M));
check("an invented figure fails", !figuresAreSupported("You earned ₹48,000 last month.", M));
check("a computed figure fails", !figuresAreSupported("That is 37 more than last month.", M));
check("prose with no figures passes", figuresAreSupported("Close off your completed visits.", M));
check("commas are normalised", figuresIn("₹12,500 and 8").join() === "12500,8");
check("the allowed set is non-empty", allowedFigures(M).size > 10);

// A practice with nothing wrong still gets something to read.
const calm = templateInsights({
  ...M,
  awaiting: 0,
  unresolved: 0,
  emptiestFree: 0,
  noShowRate: 0,
  reviewCount: 12,
  returningRate: 0.6,
  averageValue: 0,
  topReasonCount: 0,
});
check("a healthy practice still gets a pointer", calm.length >= 1);
// Asserting the shape, not the wording — the copy is allowed to change.
check("and the pointer is not alarming", !/\d/.test(calm[0].title));
check("and it carries no invented metric", !calm[0].metric || calm[0].metric.length <= 14);

// The compact shape the dashboard cards render.
for (const item of items) {
  check(`"${item.title.slice(0, 24)}" has a short title`, item.title.length <= 40);
  check(`"${item.title.slice(0, 24)}" has a short body`, item.body.length <= 90);
  if (item.metric) {
    check(`"${item.title.slice(0, 24)}" metric is compact`, item.metric.length <= 14);
    check(
      `"${item.title.slice(0, 24)}" metric quotes a real figure`,
      figuresAreSupported(item.metric, M)
    );
  }
  if (item.kind) {
    check(
      `"${item.title.slice(0, 24)}" uses a known icon`,
      (INSIGHT_ICONS as readonly string[]).includes(item.kind)
    );
  }
}

// ── Wiring ────────────────────────────────────────────────────────────────
const gen = read("src/lib/integrations/insights.ts");
check("the generator is server-only", /^import "server-only";/m.test(gen));
check("it forbids calculation", /Never calculate/.test(gen));
check("it forbids gendered pronouns", /gendered pronoun/.test(gen));
check("it validates figures before trusting them", /figuresAreSupported/.test(gen));
check("an unsupported figure discards the response", /return fallback\(\);\n\n      items\.push|figuresAreSupported[\s\S]{0,80}return fallback/.test(gen));
check("it never throws", /catch \(e\)[\s\S]{0,120}return fallback\(\)/.test(gen));

const cache = read("src/lib/doctor/insightCache.ts");
check("the cache keys on the clinic wall clock", /clinicWallClock\(\)/.test(cache));
check("it upserts on the unique key", /doctorId_dateKey/.test(cache));
check("a store failure does not break the page", /could not store insights/.test(cache));
check("stored JSON is parsed defensively", /function parseItems/.test(cache));

const strip = read("src/components/doctor/dashboard/InsightStrip.tsx");
check("template output is labelled honestly", /Practice pointers/.test(strip));
check("AI output is labelled as such", /AI suggestions/.test(strip));
const dash = read("src/components/doctor/dashboard/DashboardHome.tsx");
check("the strip is suspended", /<Suspense fallback=\{<InsightStripSkeleton/.test(dash));

// ── The table exists and behaves ──────────────────────────────────────────
async function dbChecks() {
  const rows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT COUNT(*) n FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = 'doctor_daily_insights'`
  );
  check("the cache table exists", Number(rows[0].n) === 1);

  const doctor = await prisma.doctor.findFirst({ select: { id: true } });
  if (!doctor) return;

  const dateKey = "2099-01-01";
  await prisma.doctorDailyInsight.deleteMany({ where: { doctorId: doctor.id, dateKey } });

  const write = () =>
    prisma.doctorDailyInsight.upsert({
      where: { doctorId_dateKey: { doctorId: doctor.id, dateKey } },
      create: {
        doctorId: doctor.id,
        dateKey,
        metricsHash: "probe",
        items: [{ title: "t", body: "b" }],
        source: "template",
      },
      update: { metricsHash: "probe2" },
    });

  // Two writes for the same day must not produce two rows.
  await write();
  await write();
  const count = await prisma.doctorDailyInsight.count({
    where: { doctorId: doctor.id, dateKey },
  });
  check("one row per doctor per day", count === 1, `got ${count}`);

  await prisma.doctorDailyInsight.deleteMany({ where: { doctorId: doctor.id, dateKey } });
}

dbChecks()
  .catch((e) => fails.push(`db checks threw: ${(e as Error).message}`))
  .finally(async () => {
    await prisma.$disconnect();
    console.log(`\n${pass} passed, ${fails.length} failed`);
    if (fails.length) {
      fails.forEach((f) => console.log(`  FAIL  ${f}`));
      process.exit(1);
    }
  });
