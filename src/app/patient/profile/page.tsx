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
} from "lucide-react";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { buildPatientMenu } from "@/lib/queries/nav";
import SectionHead from "@/components/hub/SectionHead";
import { requireUser } from "@/lib/session";
import { getProfilePageData } from "@/lib/queries/profileData";

export const metadata: Metadata = {
  title: "My Profile",
  description:
    "Your skin analysis reports, appointments, doctors, prescriptions, purchases, procedures and the discounts you've used.",
  robots: { index: false, follow: false },
};

const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/**
 * My Profile — everything the client has done here, in one place: reports,
 * appointments, doctors, prescriptions, purchases, procedures, discounts.
 *
 * Live data. The section shapes were defined by `@/data/profile` and the
 * real queries in `@/lib/queries/profileData` return exactly them, so this
 * page kept its layout when the backend arrived — only the import moved.
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
  } = await getProfilePageData(user.id);

  const upcoming = APPOINTMENTS.filter((a) => a.status === "Upcoming");

  const stats = [
    { value: String(SKIN_REPORTS.length), label: "skin reports" },
    { value: String(APPOINTMENTS.length), label: "appointments" },
    { value: String(PROCEDURES.length), label: "procedures" },
    { value: String(CONSULTED_DOCTORS.length), label: "doctors seen" },
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
                  title={`${MEMBERSHIP.planName} — ${MEMBERSHIP.discountPercent}% off consultations, until ${MEMBERSHIP.endsOn}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400/20 to-amber-200/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-200 ring-1 ring-amber-300/40"
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

            <dl className="mt-7 flex flex-wrap gap-3">
              {stats.map((s) => (
                <div
                  key={s.label}
                  className="rounded-2xl bg-white/[0.04] ring-1 ring-white/10 px-5 py-3"
                >
                  <dd className="display text-2xl text-ink">{s.value}</dd>
                  <dt className="mt-0.5 text-[11px] font-medium text-ink-muted">
                    {s.label}
                  </dt>
                </div>
              ))}
            </dl>

            {MEMBERSHIP && (
              <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl bg-amber-400/[10%] px-5 py-4 ring-1 ring-inset ring-amber-300/25">
                <p className="text-sm text-ink-soft">
                  <span className="font-bold text-ink">
                    {MEMBERSHIP.discountPercent}% off
                  </span>{" "}
                  every consultation at a listed clinic, and priority on the
                  slots everyone wants.
                </p>
                <p className="text-sm text-ink-muted">
                  {MEMBERSHIP.daysLeft <= 14
                    ? `Ends in ${MEMBERSHIP.daysLeft} ${
                        MEMBERSHIP.daysLeft === 1 ? "day" : "days"
                      }`
                    : `Runs until ${MEMBERSHIP.endsOn}`}
                </p>
                <Link
                  href="/patient/membership"
                  className="text-sm font-semibold text-amber-200 hover:text-amber-100"
                >
                  {MEMBERSHIP.daysLeft <= 14 ? "Renew" : "Manage"} →
                </Link>
              </div>
            )}

            {!MEMBERSHIP && (
              <Link
                href="/patient/membership"
                className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl bg-white/[0.04] px-5 py-4 ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.07]"
              >
                <p className="text-sm text-ink-soft">
                  <span className="font-bold text-ink">White Collar</span> — money
                  off every consultation, scans included, and appointments that
                  do not get moved.
                </p>
                <span className="ml-auto text-sm font-semibold text-teal-300">
                  See what it costs →
                </span>
              </Link>
            )}

            {upcoming.length > 0 && (
              <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl bg-teal-400/[12%] px-5 py-4 ring-1 ring-inset ring-teal-300/25">
                <CalendarDays className="h-5 w-5 shrink-0 text-teal-200" />
                <p className="text-sm text-ink-soft">
                  Next appointment —{" "}
                  <span className="font-bold text-ink">
                    {upcoming[0].doctor}
                  </span>
                  , {upcoming[0].date} at {upcoming[0].time} ·{" "}
                  {upcoming[0].mode}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* ── 1. Skin analysis reports ──────────────────────────────── */}
        <Section
          icon={Sparkles}
          eyebrow="Your readings"
          title="Skin analysis reports"
          sub="Every scan you've run, newest first. Download any of them to take to a doctor."
          action={{ label: "Run a new scan", href: "/patient/skin-analyzer" }}
        >
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SKIN_REPORTS.map((r) => (
              <li key={r.id} className="card-soft p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-ink-muted">
                      {r.date}
                    </p>
                    <p className="display-sm mt-1 text-2xl text-ink">
                      {r.score}
                      <span className="ml-1 text-sm font-medium text-ink-muted">
                        / 100
                      </span>
                    </p>
                  </div>
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-ink-soft">
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
                      className="rounded-full bg-brand-400/[12%] px-2.5 py-1 text-[11px] font-medium text-brand-200"
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
        </Section>

        {/* ── 2. Appointments booked ────────────────────────────────── */}
        <Section
          icon={CalendarDays}
          eyebrow="Your diary"
          title="Appointments booked"
          sub="Upcoming and past, including anything cancelled."
          action={{ label: "Book another", href: "/patient/doctors" }}
        >
          <div className="card-soft divide-y divide-white/10 overflow-hidden">
            {APPOINTMENTS.map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-ink">{a.doctor}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {a.specialty} · {a.mode}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-medium text-ink-soft">
                    {a.date}
                    <span className="ml-1.5 text-ink-muted">{a.time}</span>
                  </p>
                  <Status value={a.status} />
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ── 3. Consulted doctors ──────────────────────────────────── */}
        <Section
          icon={Stethoscope}
          eyebrow="Your clinicians"
          title="Consulted doctors"
          sub="Everyone who has seen you, and how often."
        >
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                  <p className="truncate text-xs text-ink-muted">
                    {d.specialty}
                  </p>
                  <p className="mt-1 text-[11px] font-medium text-teal-200">
                    {d.visits} {d.visits === 1 ? "visit" : "visits"} ·{" "}
                    {d.lastSeen}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Section>

        {/* ── 4. Prescriptions ──────────────────────────────────────── */}
        <Section
          icon={FileText}
          eyebrow="What you were given"
          title="Prescriptions"
          sub="Issued by the treating doctor. Complete the course even when it looks better."
        >
          <div className="grid gap-3 lg:grid-cols-2">
            {PRESCRIPTIONS.map((rx) => (
              <div key={rx.id} className="card-soft p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-ink">{rx.doctor}</p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      Issued {rx.issued} · valid till {rx.validTill}
                    </p>
                  </div>
                  <button className="btn-ghost !px-3 !py-1.5 text-xs">
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
        </Section>

        {/* ── 5. Online purchases ───────────────────────────────────── */}
        <Section
          icon={Package}
          eyebrow="Your orders"
          title="Online purchases"
          sub="Products and packages bought through BluDerma."
        >
          <div className="card-soft divide-y divide-white/10 overflow-hidden">
            {PURCHASES.map((o) => (
              <div
                key={o.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-ink">{o.item}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {o.kind} · {o.date}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <p className="text-sm font-bold text-ink">
                    {money(o.amount)}
                  </p>
                  <Status value={o.status} />
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ── 6. Procedures undergone ───────────────────────────────── */}
        <Section
          icon={Syringe}
          eyebrow="Your treatment history"
          title="Procedures undergone"
          sub="What has been done, by whom, and where each course stands."
          action={{ label: "Browse treatments", href: "/patient/explore" }}
        >
          <div className="card-soft divide-y divide-white/10 overflow-hidden">
            {PROCEDURES.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-ink">{p.name}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {p.category} · {p.doctor}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="rounded-full bg-brand-400/[12%] px-2.5 py-1 text-[11px] font-semibold text-brand-200">
                    {p.sessions}
                  </span>
                  <p className="text-sm font-medium text-ink-soft">{p.date}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ── 7. Discounts availed ──────────────────────────────────── */}
        <Section
          icon={Percent}
          eyebrow="What you saved"
          title="Discounts availed"
          sub="Offers you've used. Percentages only — the rupee value depends on the plan."
          action={{ label: "See what's running", href: "/patient/explore#deals" }}
        >
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {DISCOUNTS.map((d) => (
              <li key={d.id} className="card-soft flex items-start gap-3 p-5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-400/15 to-brand-400/15 text-teal-200 ring-1 ring-inset ring-teal-300/25">
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
        </Section>

      </main>

      <Footer />
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────── */

function Section({
  icon: Icon,
  eyebrow,
  title,
  sub,
  action,
  children,
}: {
  icon: typeof Sparkles;
  eyebrow: string;
  title: string;
  sub: string;
  action?: { label: string; href: string };
  children: React.ReactNode;
}) {
  return (
    <section className="container-page pt-12">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400/15 to-teal-400/15 text-brand-300 ring-1 ring-inset ring-brand-300/40">
            <Icon className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <div>
            <p className="section-eyebrow">{eyebrow}</p>
            <h2 className="display-sm mt-1 text-xl text-ink sm:text-2xl">
              {title}
            </h2>
            <p className="mt-1 max-w-xl text-sm text-ink-muted">{sub}</p>
          </div>
        </div>
        {action && (
          <Link
            href={action.href}
            className="hidden shrink-0 items-center gap-1 text-sm font-semibold text-brand-200 hover:text-brand-100 sm:inline-flex"
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

const STATUS_TONE: Record<string, string> = {
  Upcoming: "bg-teal-400/[12%] text-teal-200",
  Completed: "bg-white/10 text-ink-soft",
  Cancelled: "bg-rose-500/[12%] text-rose-300",
  Delivered: "bg-teal-400/[12%] text-teal-200",
  Shipped: "bg-brand-400/[12%] text-brand-200",
  Processing: "bg-amber-400/[12%] text-amber-300",
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
