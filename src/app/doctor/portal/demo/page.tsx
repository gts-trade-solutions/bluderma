import Link from "next/link";

import DashboardHome from "@/components/doctor/dashboard/DashboardHome";
import DemoTour, { type TourStep } from "@/components/doctor/onboarding/DemoTour";
import { portalBtnQuiet } from "@/components/doctor/portalUi";
import { getOwnDoctor } from "@/lib/doctor/guard";
import { buildDemoBundle } from "@/lib/doctor/demoMetrics";

export const metadata = { title: "A look at your dashboard" };
export const dynamic = "force-dynamic";

/**
 * The dashboard a practitioner will have, shown while they wait for approval.
 *
 * ── Why this page exists ─────────────────────────────────────────────────
 * Onboarding ends with a screen of em dashes and a two-day wait. Everything
 * the portal is actually for is invisible until the moment it unlocks — which
 * is the moment a doctor has a clinic to run and least patience for learning
 * where anything is. The wait is the only unhurried time they will ever have
 * with this software, so it is where the walkthrough belongs.
 *
 * ── Why the numbers are fake and say so ──────────────────────────────────
 * Every figure here comes from lib/doctor/demoMetrics.ts and none of it
 * touches the database. This codebase has removed invented figures more than
 * once, and PendingPreview still shows "—" instead of a plausible number for
 * exactly that reason — a preview that quietly fabricates data teaches a
 * doctor to distrust the real figures a week later.
 *
 * The difference is disclosure, and it is deliberately impossible to miss: a
 * sticky amber bar that stays on screen through every scroll, the words DEMO
 * DATA in the first line of the tour, and a URL that says /demo. Nothing here
 * is presented as this practitioner's own.
 */

const STEPS: TourStep[] = [
  {
    anchor: "kpis",
    title: "The four figures, first",
    body: "Revenue booked is what clients agreed to pay this month — not what has arrived. The three beside it are the people behind that number. Every tile says in one line what it is counting, because a figure without a noun is not information.",
  },
  {
    anchor: "money",
    title: "Where the money actually sits",
    body: "The same total, split by what has happened to it: earned, still ahead of you, waiting to be marked done, and lost. The chart is dated bars rather than a smooth line, so a day with no bookings reads as a day with no bookings.",
  },
  {
    anchor: "seats",
    title: "The part you can still change",
    body: "A seat is one appointment slot in your working hours, and this is the next seven days. Not a fill percentage — a count of what is open and what it is worth, because that is the only version of the fact you can act on today.",
  },
  {
    anchor: "profit",
    title: "What you keep",
    body: "Takings minus what the practice costs to run. Machines are held apart and shown as capital being recovered: subtracting a laser from one month would read as a disaster for something that earns out over years. Record your costs and this becomes the number worth watching.",
  },
  {
    anchor: "diary",
    title: "Which days and hours fill",
    body: "The pattern behind you, not the week ahead. It is what tells you a Thursday clinic is running at half the rate of a Wednesday one, which is a staffing decision rather than a marketing one.",
  },
];

export default async function DemoDashboardPage() {
  const owner = await getOwnDoctor();

  const demo = buildDemoBundle(new Date());

  return (
    <>
      {/* Sticky, and above the portal header. The whole justification for
          showing invented figures is that nobody can mistake them for real,
          and a banner that scrolls away stops doing that job on the second
          screenful. */}
      <div className="sticky top-0 z-50 -mx-3.5 mb-5 border-b border-gold-300 bg-gold-100/95 px-4 py-2.5 backdrop-blur sm:-mx-7 sm:px-7 lg:-mx-9 lg:px-9">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="rounded-full bg-gold-800 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-gold-50">
            Demo data
          </span>
          <p className="min-w-0 flex-1 text-xs font-semibold text-gold-900">
            An example practice, so you can see what this looks like in use.
            None of these figures are yours and nothing here has been saved.
          </p>
          <Link href="/doctor/portal" className={`${portalBtnQuiet} !py-1.5 shrink-0`}>
            Back to my application
          </Link>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <DemoTour steps={STEPS} exitHref="/doctor/portal" />
        <p className="text-xs text-graphite-500">
          Five stops, about a minute. You can leave it at any point.
        </p>
      </div>

      <DashboardHome
        // Never read on the demo path — DashboardHome skips every query when
        // a bundle is supplied — but passed honestly rather than faked.
        doctorId={owner?.doctorId ?? "demo"}
        doctorName={owner?.name ?? "Doctor"}
        demo={demo}
      />
    </>
  );
}
