import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Download,
  FileText,
  Package,
  Percent,
  Sparkles,
  Stethoscope,
  Syringe,
  Wallet,
} from "lucide-react";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { buildPatientMenu } from "@/lib/queries/nav";
import {
  ProfileRail,
  ProfileStrip,
  type ProfileSection,
} from "@/components/patient/ProfileNav";
import { requireUser } from "@/lib/session";
import { getProfilePageData } from "@/lib/queries/profileData";
import {
  DEMO_ADDRESSES,
  DEMO_PAY_LATER,
  DEMO_WALLET,
} from "@/data/patientDemo";

export const metadata: Metadata = {
  title: "My Profile",
  description:
    "Your skin analysis reports, conditions, wallet, prescriptions, treatments, locations, appointments and membership.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/**
 * My Profile — the client's whole record, behind one index.
 *
 * It was nine sections down a single scroll, which on a phone put a thousand
 * pixels of thumb between "my reports" and "my prescriptions". The content is
 * unchanged in kind; what is new is the rail that indexes it, and four
 * sections the record never had: what they are being treated for, the wallet,
 * the locations they use, and pay-later.
 *
 * ── Real, and sampled, and the difference is visible ──────────────────────
 * Reports, conditions, prescriptions, treatments, appointments, orders,
 * discounts and membership all come out of the database. The wallet, pay-later
 * and the saved addresses have no tables behind them yet and are drawn from
 * `@/data/patientDemo`.
 *
 * Pay-later and the saved addresses carry a `Sample` badge, because a mock-up
 * a reader cannot distinguish from the real thing is not a mock-up. The wallet
 * does NOT, by request: it reads as a live balance. The figures behind it are
 * still `DEMO_WALLET`, so it is the panel to wire up first, and the one to
 * check before this page goes anywhere a real client can spend against it.
 * When the tables land, the import changes and the badges come off.
 */
export default async function ProfilePage() {
  const user = await requireUser("/patient/profile");
  const {
    client: CLIENT,
    skinReports: SKIN_REPORTS,
    appointments: APPOINTMENTS,
    consultedDoctors: CONSULTED_DOCTORS,
    prescriptions: PRESCRIPTIONS,
    purchases: PURCHASES,
    procedures: PROCEDURES,
    discounts: DISCOUNTS,
    membership: MEMBERSHIP,
    conditions: CONDITIONS,
    plans: PLANS,
    clinics: CLINICS,
  } = await getProfilePageData(user.id);

  const upcoming = APPOINTMENTS.filter((a) => a.status === "Upcoming");

  const stats = [
    { value: String(SKIN_REPORTS.length), label: "skin reports" },
    { value: String(APPOINTMENTS.length), label: "appointments" },
    { value: String(PROCEDURES.length), label: "treatments" },
    { value: String(CONSULTED_DOCTORS.length), label: "doctors seen" },
  ];

  const sections: ProfileSection[] = [
    // The wallet leads. It is the one thing on this page that is money the
    // client can spend, and it sat sixth — below five clinical records, which
    // on a phone is most of a screen's worth of scrolling before a balance
    // they did not know they had.
    { id: "wallet", label: "My wallet", icon: "wallet", badge: money(DEMO_WALLET.balanceInr) },
    { id: "reports", label: "My reports", icon: "report", badge: String(SKIN_REPORTS.length) },
    { id: "conditions", label: "My conditions", icon: "condition", badge: String(CONDITIONS.length) },
    { id: "appointments", label: "My appointments", icon: "calendar", badge: String(APPOINTMENTS.length) },
    { id: "prescriptions", label: "My prescriptions", icon: "rx", badge: String(PRESCRIPTIONS.length) },
    { id: "treatments", label: "My treatments", icon: "treatment", badge: String(PROCEDURES.length) },
    { id: "pay-later", label: "Pay later", icon: "paylater" },
    { id: "locations", label: "Location", icon: "location" },
    { id: "orders", label: "My orders", icon: "order", badge: String(PURCHASES.length) },
    { id: "white-collar", label: "White Collar", icon: "crown", badge: MEMBERSHIP ? "Active" : undefined },
  ];

  return (
    <>
      <Navbar role="patient" menu={buildPatientMenu()} />

      <main className="bg-[var(--surface)] pb-20">
        {/* ── Header ────────────────────────────────────────────────── */}
        <section className="border-b border-white/10 bg-white/[0.04]">
          <div className="container-page py-9">
            <p className="section-eyebrow">My profile</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="display text-3xl text-ink sm:text-4xl">
                {CLIENT.name}
              </h1>
              {MEMBERSHIP && (
                <span
                  title={`${MEMBERSHIP.planName}: ${MEMBERSHIP.discountPercent}% off consultations, until ${MEMBERSHIP.endsOn}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400/25 to-amber-200/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-200 ring-1 ring-amber-300/40"
                >
                  <span aria-hidden>◆</span>
                  {MEMBERSHIP.planName}
                </span>
              )}
            </div>
            <p className="mt-2 text-sm text-ink-muted">
              {[CLIENT.city, CLIENT.skinType, `with BluDerma since ${CLIENT.since}`]
                .filter(Boolean)
                .join(" · ")}
            </p>

            <dl className="mt-7 grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap sm:gap-3">
              {stats.map((s) => (
                <div
                  key={s.label}
                  className="rounded-2xl bg-white/[0.06] px-4 py-3 ring-1 ring-white/10 sm:px-5"
                >
                  <dd className="display text-2xl text-ink">{s.value}</dd>
                  <dt className="mt-0.5 text-[11px] font-medium text-ink-muted">
                    {s.label}
                  </dt>
                </div>
              ))}
            </dl>

            {/* ── The wallet, before any scrolling ──────────────────────
                The balance is the one number on this page a client can spend,
                and it lived six sections down. It is a link, not a panel: the
                whole record is still below, this just makes sure nobody has
                to go looking for their own credit. */}
            <Link
              href="#wallet"
              className="group mt-6 flex flex-wrap items-center gap-x-6 gap-y-4 rounded-2xl bg-gradient-to-r from-brand-800/80 via-brand-900/70 to-teal-800/70 px-5 py-4 ring-1 ring-inset ring-teal-300/25 transition hover:ring-teal-300/50"
            >
              <span className="flex min-w-0 items-center gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/10 ring-1 ring-inset ring-white/15">
                  <Wallet className="h-6 w-6 text-teal-200" strokeWidth={1.7} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.16em] text-teal-200">
                    Your wallet
                  </span>
                  <span className="display mt-0.5 block text-3xl text-white">
                    {money(DEMO_WALLET.balanceInr)}
                  </span>
                </span>
              </span>

              {/* Full width on a phone. As a flex-1 sibling of the balance it
                  shrank instead of wrapping, and set one word per line down a
                  60px column. */}
              <span className="w-full min-w-0 text-sm text-white/70 sm:w-auto sm:flex-1">
                Spendable against consultations and orders, applied
                automatically at checkout.
                {DEMO_WALLET.expiringInr > 0 && (
                  <span className="mt-0.5 block text-xs text-amber-200/90">
                    {money(DEMO_WALLET.expiringInr)} of it expires on{" "}
                    {DEMO_WALLET.expiringOn}.
                  </span>
                )}
              </span>

              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-white ring-1 ring-inset ring-white/15 transition group-hover:bg-white/[0.16]">
                Open wallet
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>

            {upcoming.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-teal-400/[12%] px-5 py-4 ring-1 ring-inset ring-teal-300/25">
                <CalendarDays className="h-5 w-5 shrink-0 text-teal-200" />
                <p className="text-sm text-ink-soft">
                  Next appointment:{" "}
                  <span className="font-bold text-ink">{upcoming[0].doctor}</span>
                  , {upcoming[0].date} at {upcoming[0].time} · {upcoming[0].mode}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* The phone strip sits OUTSIDE the grid below, in normal flow. As a
            grid item its min-width was `auto`, so the column was sized to the
            intrinsic width of ten no-wrap pills (~1,365px) and `overflow-x-auto`
            could not contain it — the page itself scrolled sideways (measured:
            1,442px of scrollWidth at a 390px viewport), which is what made the
            whole profile render zoomed-out and unreadable on a phone. */}
        <ProfileStrip sections={sections} />

        {/* ── Rail + record ─────────────────────────────────────────── */}
        <div className="container-page grid gap-8 pt-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-10 lg:pt-10">
          <ProfileRail sections={sections} />

          <div className="min-w-0 space-y-14">
            {/* ── 1. Wallet ───────────────────────────────────────── */}
            <Section
              id="wallet"
              icon={Percent}
              eyebrow="Your credit"
              title="My wallet"
              sub="Cashback, referral credit and refunds. Spendable against consultations and orders."
            >
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-gradient-to-br from-brand-800 via-brand-900 to-teal-800 p-5 ring-1 ring-inset ring-white/15 sm:col-span-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-200">
                    Balance
                  </p>
                  <p className="display mt-1.5 text-4xl text-white">
                    {money(DEMO_WALLET.balanceInr)}
                  </p>
                  <p className="mt-2 text-sm text-white/70">
                    {money(DEMO_WALLET.expiringInr)} of this expires on{" "}
                    {DEMO_WALLET.expiringOn}.
                  </p>
                  <p className="mt-4 text-xs text-white/55">
                    Applied automatically at checkout. It never expires except
                    where a credit says so above.
                  </p>
                </div>
                <div className="card-soft flex flex-col justify-center p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                    Earned with us
                  </p>
                  <p className="display-sm mt-1.5 text-2xl text-ink">
                    {money(DEMO_WALLET.lifetimeCashbackInr)}
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">
                    Cashback and credit since you joined.
                  </p>
                </div>
              </div>

              <div className="card-soft mt-3 divide-y divide-white/10 overflow-hidden">
                {DEMO_WALLET.movements.map((mv) => (
                  <Row
                    key={mv.id}
                    title={mv.label}
                    sub={mv.detail}
                    meta={
                      <>
                        <span className="text-xs text-ink-muted">{mv.on}</span>
                        <span
                          className={`text-sm font-bold tabular-nums ${
                            mv.amountInr >= 0 ? "text-teal-300" : "text-ink-soft"
                          }`}
                        >
                          {mv.amountInr >= 0 ? "+" : "−"}
                          {money(Math.abs(mv.amountInr))}
                        </span>
                      </>
                    }
                  />
                ))}
              </div>
            </Section>

            {/* ── 2. Reports ──────────────────────────────────────── */}
            <Section
              id="reports"
              icon={Sparkles}
              eyebrow="Your readings"
              title="My reports"
              sub="Every scan you've run, newest first. Download any of them to take to a doctor."
              action={{ label: "Run a new scan", href: "/patient/skin-analyzer" }}
            >
              {SKIN_REPORTS.length > 0 ? (
                <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {SKIN_REPORTS.map((r) => (
                    <li key={r.id} className="card-soft p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-medium text-ink-muted">{r.date}</p>
                          <p className="display-sm mt-1 text-2xl text-ink">
                            {r.score}
                            <span className="ml-1 text-sm font-medium text-ink-muted">
                              / 100
                            </span>
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-center text-[11px] font-semibold text-ink-soft">
                          {r.skinType}
                        </span>
                      </div>

                      <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                        Needed most attention
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {r.topConcerns.map((c) => (
                          <span
                            key={c}
                            className="rounded-full bg-brand-400/[14%] px-2.5 py-1 text-[11px] font-medium text-brand-200"
                          >
                            {c}
                          </span>
                        ))}
                      </div>

                      <button className="btn-ghost mt-4 w-full !py-2 text-sm">
                        <Download className="h-4 w-4" /> Download report
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <Blank
                  title="No scans yet"
                  body="Your first skin analysis is free and takes about thirty seconds."
                  cta={{ label: "Scan my skin", href: "/patient/skin-analyzer" }}
                />
              )}
            </Section>

            {/* ── 3. Conditions ───────────────────────────────────── */}
            <Section
              id="conditions"
              icon={Stethoscope}
              eyebrow="What we're working on"
              title="My conditions"
              sub="Drawn from your own scans and from what you chose as the reason at booking. Not a diagnosis: that comes from a doctor."
            >
              {CONDITIONS.length > 0 ? (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {CONDITIONS.map((c) => (
                    <li key={c.key} className="card-soft p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-ink">{c.label}</p>
                          <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-teal-300">
                            {c.source}
                          </p>
                        </div>
                        <Link
                          href="/patient/explore"
                          className="shrink-0 text-xs font-semibold text-brand-200 hover:underline"
                        >
                          Treatments →
                        </Link>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-brand-400 to-teal-400"
                          style={{ width: `${Math.max(6, c.weight)}%` }}
                        />
                      </div>
                      <p className="mt-2 text-xs text-ink-muted">{c.detail}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <Blank
                  title="Nothing recorded yet"
                  body="Run a scan or book a consultation and what you're being seen for will collect here."
                  cta={{ label: "Browse treatments", href: "/patient/explore" }}
                />
              )}
            </Section>

            {/* ── 4. Appointments ─────────────────────────────────── */}
            <Section
              id="appointments"
              icon={CalendarDays}
              eyebrow="Your diary"
              title="My appointments"
              sub="Upcoming and past, including anything cancelled."
              action={{ label: "Book another", href: "/patient/doctors" }}
            >
              {APPOINTMENTS.length > 0 ? (
                <div className="card-soft divide-y divide-white/10 overflow-hidden">
                  {APPOINTMENTS.map((a) => (
                    <Row
                      key={a.id}
                      title={a.doctor}
                      sub={`${a.specialty} · ${a.mode}`}
                      meta={
                        <>
                          <span className="text-sm font-medium text-ink-soft">
                            {a.date}
                            <span className="ml-1.5 text-ink-muted">{a.time}</span>
                          </span>
                          <Status value={a.status} />
                        </>
                      }
                    />
                  ))}
                </div>
              ) : (
                <Blank
                  title="No appointments yet"
                  body="Consultation fees are shown up front. Treatment cost is quoted after an assessment."
                  cta={{ label: "See doctors", href: "/patient/doctors" }}
                />
              )}

              {CONSULTED_DOCTORS.length > 0 && (
                <>
                  <h3 className="mb-3 mt-8 text-sm font-bold text-ink">
                    Doctors you&apos;ve seen
                  </h3>
                  <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {CONSULTED_DOCTORS.map((d) => (
                      <li key={d.id} className="card-soft flex items-center gap-3 p-4">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={d.image}
                          alt=""
                          className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-white/10"
                          loading="lazy"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-ink">{d.name}</p>
                          <p className="truncate text-xs text-ink-muted">{d.specialty}</p>
                          <p className="mt-1 text-[11px] font-medium text-teal-200">
                            {d.visits} {d.visits === 1 ? "visit" : "visits"} · {d.lastSeen}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Section>

            {/* ── 5. Prescriptions ────────────────────────────────── */}
            <Section
              id="prescriptions"
              icon={FileText}
              eyebrow="What you were given"
              title="My prescriptions"
              sub="Issued by the treating doctor. Complete the course even when it looks better."
            >
              {PRESCRIPTIONS.length > 0 ? (
                <div className="grid gap-3 xl:grid-cols-2">
                  {PRESCRIPTIONS.map((rx) => (
                    <div key={rx.id} className="card-soft p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-ink">{rx.doctor}</p>
                          <p className="mt-0.5 text-xs text-ink-muted">
                            Issued {rx.issued}
                          </p>
                        </div>
                        <button className="btn-ghost shrink-0 !px-3 !py-1.5 text-xs">
                          <Download className="h-3.5 w-3.5" /> PDF
                        </button>
                      </div>
                      <ul className="mt-4 space-y-2">
                        {rx.items.map((item) => (
                          <li key={item} className="flex gap-2.5">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                            <span className="text-[13px] leading-relaxed text-ink-soft">
                              {item}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                <Blank
                  title="No prescriptions yet"
                  body="Anything a BluDerma doctor prescribes you lands here, and stays with your record."
                />
              )}
            </Section>

            {/* ── 6. Treatments ───────────────────────────────────── */}
            <Section
              id="treatments"
              icon={Syringe}
              eyebrow="Your treatment history"
              title="My treatments"
              sub="What has been done, by whom, and where each course stands."
              action={{ label: "Browse treatments", href: "/patient/explore" }}
            >
              {PROCEDURES.length > 0 ? (
                <div className="card-soft divide-y divide-white/10 overflow-hidden">
                  {PROCEDURES.map((p) => (
                    <Row
                      key={p.id}
                      title={p.name}
                      sub={`${p.category} · ${p.doctor}`}
                      meta={
                        <>
                          <span className="rounded-full bg-brand-400/[14%] px-2.5 py-1 text-[11px] font-semibold text-brand-200">
                            {p.sessions}
                          </span>
                          <span className="text-sm font-medium text-ink-soft">
                            {p.date}
                          </span>
                        </>
                      }
                    />
                  ))}
                </div>
              ) : (
                <Blank
                  title="Nothing yet"
                  body="Completed visits and courses appear here as they happen."
                  cta={{ label: "Browse treatments", href: "/patient/explore" }}
                />
              )}
            </Section>

            {/* ── 7. Pay later ────────────────────────────────────── */}
            <Section
              id="pay-later"
              icon={Package}
              eyebrow="Buy now, pay later"
              title="Split a course into instalments"
              sub={`Up to ${money(DEMO_PAY_LATER.approvedLimitInr)} through ${DEMO_PAY_LATER.provider}, with the first ${DEMO_PAY_LATER.interestFreeMonths} months at no cost.`}
              sample
            >
              <div className="card-soft p-5">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                      Available to you
                    </p>
                    <p className="display-sm mt-1 text-2xl text-ink">
                      {money(DEMO_PAY_LATER.approvedLimitInr - DEMO_PAY_LATER.usedInr)}
                    </p>
                  </div>
                  <p className="text-xs text-ink-muted">
                    {money(DEMO_PAY_LATER.usedInr)} of{" "}
                    {money(DEMO_PAY_LATER.approvedLimitInr)} in use
                  </p>
                </div>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 to-teal-400"
                    style={{
                      width: `${Math.round(
                        (DEMO_PAY_LATER.usedInr / DEMO_PAY_LATER.approvedLimitInr) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>

              <ul className="mt-3 grid gap-3 xl:grid-cols-2">
                {DEMO_PAY_LATER.plans.map((pl) => (
                  <li key={pl.id} className="card-soft p-5">
                    <p className="text-sm font-bold text-ink">{pl.item}</p>
                    <p className="mt-1 text-xs text-ink-muted">
                      {money(pl.paidInr)} paid of {money(pl.totalInr)}
                    </p>

                    <div className="mt-3 flex gap-1.5">
                      {Array.from({ length: pl.instalmentsTotal }, (_, i) => (
                        <span
                          key={i}
                          className={`h-1.5 flex-1 rounded-full ${
                            i < pl.instalmentsPaid ? "bg-teal-400" : "bg-white/12"
                          }`}
                        />
                      ))}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-ink-muted">
                        {pl.instalmentsPaid} of {pl.instalmentsTotal} instalments
                      </p>
                      <p className="text-xs font-bold text-ink">
                        {money(pl.instalmentInr)} due {pl.nextDue}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="card-soft mt-3 p-5">
                <p className="text-sm font-bold text-ink">How it works</p>
                <ul className="mt-3 space-y-2">
                  {DEMO_PAY_LATER.howItWorks.map((line) => (
                    <li key={line} className="flex gap-2.5">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-400" />
                      <span className="text-[13px] leading-relaxed text-ink-soft">
                        {line}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </Section>

            {/* ── 8. Location ─────────────────────────────────────── */}
            <Section
              id="locations"
              icon={Stethoscope}
              eyebrow="Where you're seen"
              title="Location"
              sub="Your saved addresses, and the listed clinics in your city."
            >
              <div className="mb-3 flex items-center gap-2">
                <h3 className="text-sm font-bold text-ink">Saved addresses</h3>
                <SampleTag />
              </div>
              <ul className="grid gap-3 sm:grid-cols-2">
                {DEMO_ADDRESSES.map((a) => (
                  <li key={a.id} className="card-soft p-5">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-ink">{a.label}</p>
                      {a.isDefault && (
                        <span className="rounded-full bg-teal-400/[14%] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-teal-200">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">
                      {a.line1}
                      <br />
                      {a.line2}, {a.pincode}
                    </p>
                    <p className="mt-2.5 text-xs text-ink-muted">
                      {a.homeVisitAvailable
                        ? "Home visits available at this address."
                        : "No listed doctor travels here yet."}
                    </p>
                  </li>
                ))}
              </ul>

              <h3 className="mb-3 mt-8 text-sm font-bold text-ink">
                {CLIENT.city ? `Clinics in ${CLIENT.city}` : "Listed clinics"}
              </h3>
              {CLINICS.length > 0 ? (
                <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {CLINICS.map((c) => (
                    <li key={c.id} className="card-soft p-5">
                      <p className="text-sm font-bold text-ink">
                        {c.name.replace(/^BluDerma\s+/, "")}
                      </p>
                      <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-teal-300">
                        {c.area}
                      </p>
                      <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
                        {c.addressLine1}
                        <br />
                        {c.city}, {c.pincode}
                      </p>
                      {c.phone && (
                        <p className="mt-2 text-xs text-ink-muted">{c.phone}</p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <Blank
                  title="No listed clinics in your city yet"
                  body="Video consultations are available everywhere we operate."
                  cta={{ label: "See doctors", href: "/patient/doctors" }}
                />
              )}

              {/* Stated plainly rather than faked. Clinic.lat/lng exist and
                  nothing populates them, so no distance is printed anywhere. */}
              <p className="mt-4 text-xs leading-relaxed text-ink-muted">
                We list clinics by area rather than by distance. We do not hold
                coordinates for every location yet, and a distance we cannot
                calculate is not one worth showing you.
              </p>
            </Section>

            {/* ── 9. Orders & discounts ───────────────────────────── */}
            <Section
              id="orders"
              icon={Package}
              eyebrow="Your orders"
              title="My orders"
              sub="Products and packages bought through BluDerma, and the offers you've used."
            >
              {PURCHASES.length > 0 ? (
                <div className="card-soft divide-y divide-white/10 overflow-hidden">
                  {PURCHASES.map((o) => (
                    <Row
                      key={o.id}
                      title={o.item}
                      sub={`${o.kind} · ${o.date}`}
                      meta={
                        <>
                          <span className="text-sm font-bold text-ink">
                            {money(o.amount)}
                          </span>
                          <Status value={o.status} />
                        </>
                      }
                    />
                  ))}
                </div>
              ) : (
                <Blank title="No orders yet" body="Anything you buy through us shows up here." />
              )}

              {DISCOUNTS.length > 0 && (
                <>
                  <h3 className="mb-3 mt-8 text-sm font-bold text-ink">
                    Discounts you&apos;ve used
                  </h3>
                  <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {DISCOUNTS.map((d) => (
                      <li key={d.id} className="card-soft flex items-start gap-3 p-5">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-brand-500 text-white">
                          <span className="text-xs font-extrabold">{d.saved}</span>
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-ink">{d.label}</p>
                          <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
                            {d.detail}
                          </p>
                          <p className="mt-1.5 text-[11px] font-medium text-ink-muted">
                            Used {d.usedOn}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Section>

            {/* ── 10. White Collar ────────────────────────────────── */}
            <Section
              id="white-collar"
              icon={Sparkles}
              eyebrow="Membership"
              title="White Collar"
              sub="What it costs, what it gives you, and exactly how it ends."
              action={{ label: "Manage membership", href: "/patient/membership" }}
            >
              {MEMBERSHIP ? (
                <div className="rounded-2xl bg-gradient-to-br from-amber-500/20 via-amber-400/10 to-transparent p-5 ring-1 ring-inset ring-amber-300/30">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-200">
                      <span aria-hidden>◆</span> {MEMBERSHIP.planName} · Active
                    </span>
                    <p className="text-sm text-ink-soft">
                      {MEMBERSHIP.daysLeft <= 14
                        ? `Ends in ${MEMBERSHIP.daysLeft} ${
                            MEMBERSHIP.daysLeft === 1 ? "day" : "days"
                          }`
                        : `Runs until ${MEMBERSHIP.endsOn}`}
                    </p>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                    <span className="font-bold text-ink">
                      {MEMBERSHIP.discountPercent}% off
                    </span>{" "}
                    every consultation at a listed clinic, and priority on the
                    slots everyone wants.
                  </p>
                </div>
              ) : (
                <Link
                  href="/patient/membership"
                  className="flex flex-wrap items-center gap-3 rounded-2xl bg-white/[0.06] px-5 py-4 ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.09]"
                >
                  <p className="text-sm text-ink-soft">
                    <span className="font-bold text-ink">You are not a member.</span>{" "}
                    Money off every consultation, scans included, and appointments
                    that do not get moved.
                  </p>
                  <span className="ml-auto text-sm font-semibold text-teal-300">
                    See what it costs →
                  </span>
                </Link>
              )}

              {PLANS.length > 0 && (
                <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                  {PLANS.map((p) => (
                    <li key={p.slug} className="card-soft p-5">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <p className="min-w-0 text-sm font-bold text-ink">{p.name}</p>
                        <p className="shrink-0 text-right">
                          <span className="display-sm text-xl text-ink">
                            {money(p.priceInr)}
                          </span>
                          <span className="ml-1 text-[11px] text-ink-muted">
                            /{p.interval === "ANNUAL" ? "year" : "month"}
                          </span>
                        </p>
                      </div>
                      {p.compareAtInr && (
                        <p className="mt-0.5 text-xs text-ink-muted">
                          <span className="line-through">{money(p.compareAtInr)}</span>{" "}
                          if bought monthly
                        </p>
                      )}

                      <ul className="mt-4 space-y-2">
                        <Perk on>{p.discountPercent}% off every consultation</Perk>
                        <Perk on={p.scanCredits > 0}>
                          {p.scanCredits > 0
                            ? `${p.scanCredits} skin ${
                                p.scanCredits === 1 ? "analysis" : "analyses"
                              } included each term`
                            : "No scans included"}
                        </Perk>
                        <Perk on={p.priorityBooking}>
                          {p.priorityBooking
                            ? "Priority slots, held back for members until 24 hours out"
                            : "Standard booking"}
                        </Perk>
                        <Perk on={p.waiveCancellationFee}>
                          {p.waiveCancellationFee
                            ? "No cancellation fee, ever"
                            : "Standard cancellation fee applies"}
                        </Perk>
                        {p.perks.map((perk) => (
                          <Perk key={perk} on>
                            {perk}
                          </Perk>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}

              {/* Not buried in terms: this is the thing people get caught by. */}
              <p className="mt-4 rounded-2xl bg-white/[0.04] px-5 py-4 text-xs leading-relaxed text-ink-muted ring-1 ring-inset ring-white/10">
                <span className="font-bold text-ink-soft">
                  Nothing auto-debits.
                </span>{" "}
                A membership runs for the term you buy and then stops. There is no
                standing mandate on your card. We email you before it ends and
                renewing is a decision you make each time.
              </p>
            </Section>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────── */

function Section({
  id,
  icon: Icon,
  eyebrow,
  title,
  sub,
  action,
  sample,
  children,
}: {
  id: string;
  icon: typeof Sparkles;
  eyebrow: string;
  title: string;
  sub: string;
  action?: { label: string; href: string };
  /** Marks a panel whose content has no table behind it yet. */
  sample?: boolean;
  children: React.ReactNode;
}) {
  return (
    // The offset clears the h-20 navbar AND, on a phone, the sticky section
    // strip under it (~3.25rem) — without it an anchor lands with its own
    // heading hidden behind the chrome that got you there.
    <section id={id} className="scroll-mt-[9rem] lg:scroll-mt-28">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-teal-500 text-white shadow-[0_8px_20px_-8px_rgba(50,143,240,0.8)]">
            <Icon className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <div>
            <p className="section-eyebrow">{eyebrow}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h2 className="display-sm text-xl text-ink sm:text-2xl">{title}</h2>
              {sample && <SampleTag />}
            </div>
            <p className="mt-1 max-w-xl text-sm text-ink-muted">{sub}</p>
          </div>
        </div>
        {/* Shown on a phone too. Hiding it below `sm` left the one action a
            section offers unreachable on the devices most people use. */}
        {action && (
          <Link
            href={action.href}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/[0.06] px-3 py-1.5 text-[13px] font-semibold text-brand-200 ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.1] hover:text-brand-100 sm:bg-transparent sm:px-0 sm:py-0 sm:text-sm sm:ring-0 sm:hover:bg-transparent"
          >
            {action.label}
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

/**
 * One line of a list: what it is on the left, what it costs or when or what
 * state on the right.
 *
 * This shape was written out four times — appointments, treatments, wallet
 * movements, orders — each with `justify-between` and a `min-w-0` that had no
 * `flex-1` beside it. On a phone that did the worst of both things: the meta
 * was pushed to the far edge while there was room, then dropped onto its own
 * line LEFT-aligned the moment there was not, so the same list changed shape
 * twice between a small phone and a large one.
 *
 * It stacks below `sm` rather than wrapping. 360px minus the page gutter and
 * the card padding leaves roughly 280px, and "Dr. Nithya Raghavan" beside
 * "Thursday, 21 Aug 2026 11:15" does not fit in 280px at any size worth
 * reading. Stacked, both get the full width and the eye reads down one
 * column instead of hunting across two.
 */
function Row({
  title,
  sub,
  meta,
}: {
  title: React.ReactNode;
  sub?: React.ReactNode;
  /** Right-hand side on a desktop; a wrapped line under the title on a phone. */
  meta: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5 sm:py-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-ink">{title}</p>
        {sub && <p className="mt-0.5 text-xs text-ink-muted">{sub}</p>}
      </div>
      {/* shrink-0 so a long title never squeezes a price or a status pill into
          an ellipsis; flex-wrap so two pieces of meta stack rather than
          overflow when the title has taken the width. */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5">
        {meta}
      </div>
    </div>
  );
}

/**
 * The badge that separates a mock-up from a record.
 *
 * Deliberately not subtle. A wallet balance a client cannot tell from their
 * own money is worse than no wallet at all.
 */
function SampleTag() {
  return (
    <span
      title="Illustrative content: this feature has no data behind it yet."
      className="inline-flex items-center gap-1 rounded-full bg-amber-400/[14%] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-300 ring-1 ring-inset ring-amber-300/30"
    >
      Sample
    </span>
  );
}

function Perk({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span
        aria-hidden
        className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
          on ? "bg-teal-400/20 text-teal-300" : "bg-white/[0.07] text-ink-muted"
        }`}
      >
        {on ? "✓" : "–"}
      </span>
      <span
        className={`text-[13px] leading-relaxed ${
          on ? "text-ink-soft" : "text-ink-muted"
        }`}
      >
        {children}
      </span>
    </li>
  );
}

/** An empty section says what it is for, and how to fill it. */
function Blank({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta?: { label: string; href: string };
}) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 px-6 py-10 text-center">
      <p className="text-sm font-bold text-ink">{title}</p>
      <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-ink-muted">
        {body}
      </p>
      {cta && (
        <Link
          href={cta.href}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/[0.08] px-4 py-2 text-sm font-semibold text-ink ring-1 ring-inset ring-white/15 transition hover:bg-white/[0.12]"
        >
          {cta.label}
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

const STATUS_TONE: Record<string, string> = {
  Upcoming: "bg-teal-400/[14%] text-teal-200",
  Completed: "bg-white/10 text-ink-soft",
  Cancelled: "bg-rose-500/[14%] text-rose-300",
  Delivered: "bg-teal-400/[14%] text-teal-200",
  Shipped: "bg-brand-400/[14%] text-brand-200",
  Processing: "bg-amber-400/[14%] text-amber-300",
};

function Status({ value }: { value: string }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
        STATUS_TONE[value] ?? "bg-white/10 text-ink-soft"
      }`}
    >
      {value}
    </span>
  );
}
