import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Camera,
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
import { prisma } from "@/lib/prisma";
import { getPayLater } from "@/lib/queries/payLater";
import AddressBook from "@/components/patient/AddressBook";
import FinancingPanel from "@/components/patient/FinancingPanel";
import GalleryConsent from "@/components/patient/GalleryConsent";
import MyPhotos from "@/components/patient/MyPhotos";
import NearbyClinics from "@/components/patient/NearbyClinics";
import { requireUser } from "@/lib/session";
import { getProfilePageData } from "@/lib/queries/profileData";
import {
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
 * ── What is real here, and the one thing that is not ─────────────────────
 * Everything on this page comes out of the database except the wallet.
 *
 * It used to be three. Saved addresses were two invented Chennai addresses
 * shown to every client as their own, and Buy Now Pay Later quoted an approved
 * credit limit through a lender that does not exist. Both are real tables now,
 * with an honest empty state instead of invented rows, so the `Sample` badge
 * that marked them has gone with them.
 *
 * The wallet is still DEMO_WALLET and carries no badge, by request. That makes
 * it the one figure on this page a client could act on and be wrong about, so
 * it is the next thing to put behind a table. verify-profile-data asserts both
 * halves of that: the badge stays off, and the numbers stay traceably mock, so
 * whoever wires it up gets a failing test pointing here.
 */
export default async function ProfilePage() {
  const user = await requireUser("/patient/profile");

  // Read here rather than through profileData: these are the one thing on this
  // page the client can edit, so they must not sit behind the same cache() as
  // the read-only history, which would serve a stale list right after a save.
  // Aftercare sheets a doctor has issued to this client. Newest first: the
  // one that matters is almost always the most recent procedure.
  const AFTERCARE = await prisma.aftercareSheet.findMany({
    where: { patientUserId: user.id },
    orderBy: { issuedAt: "desc" },
    take: 12,
    select: {
      id: true,
      procedure: true,
      procedureDate: true,
      reviewOn: true,
      doctorName: true,
      acknowledgedAt: true,
      doctorNotes: true,
    },
  });

  // Only SHARED plans. A draft is a doctor thinking aloud, and half-formed
  // clinical advice reaching a patient is worse than none.
  const CARE_PLANS = await prisma.treatmentPlan.findMany({
    where: { patientUserId: user.id, sharedAt: { not: null } },
    orderBy: { sharedAt: "desc" },
    take: 5,
    select: {
      id: true,
      sharedAt: true,
      doctor: { select: { name: true } },
      items: {
        where: { state: "ACCEPTED" },
        orderBy: { sortOrder: "asc" },
        select: { id: true, treatment: true, rationale: true },
      },
    },
  });

  const [MY_PHOTOS, MY_CARDS, MY_ORDERS] = await Promise.all([
    prisma.patientPhoto.findMany({
      where: { patientUserId: user.id },
      orderBy: { capturedAt: "desc" },
      take: 24,
      select: { id: true, angle: true, capturedAt: true, doctorId: true },
    }),
    // Only cards that were actually paid for. An abandoned checkout leaves an
    // inert row behind, and showing it would look like a card they own.
    prisma.giftCard.findMany({
      where: { buyerUserId: user.id, paidAt: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        code: true,
        valueInr: true,
        balanceInr: true,
        expiresAt: true,
        recipientName: true,
        offer: { select: { title: true, doctor: { select: { name: true } } } },
      },
    }),
    prisma.medicineOrder.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        publicId: true,
        status: true,
        totalInr: true,
        createdAt: true,
        items: { select: { id: true, name: true, qty: true } },
      },
    }),
  ]);

  const GALLERY = (
    await prisma.doctorGalleryCase.findMany({
      where: { patientUserId: user.id },
      orderBy: [{ consentGivenAt: "asc" }, { createdAt: "desc" }],
      take: 10,
      select: {
        id: true,
        treatmentName: true,
        detail: true,
        status: true,
        consentGivenAt: true,
        consentWithdrawnAt: true,
        doctor: { select: { name: true } },
      },
    })
  ).map((c) => ({
    id: c.id,
    treatmentName: c.treatmentName,
    detail: c.detail,
    doctorName: c.doctor.name,
    consentGiven: Boolean(c.consentGivenAt),
    consentWithdrawn: Boolean(c.consentWithdrawnAt),
    published: c.status === "PUBLISHED",
  }));
  // Anything still unanswered is the reason to surface this section at all.
  const GALLERY_WAITING = GALLERY.filter(
    (c) => !c.consentGiven && !c.consentWithdrawn
  ).length;

  const FINANCING = (
    await prisma.financingRequest.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        treatment: true,
        estimatedInr: true,
        status: true,
        createdAt: true,
        staffNote: true,
      },
    })
  ).map((r) => ({
    ...r,
    createdAt: r.createdAt.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
  }));

  const PAY_LATER = await getPayLater(user.id);

  const ADDRESSES = await prisma.patientAddress.findMany({
    where: { userId: user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      label: true,
      line1: true,
      line2: true,
      city: true,
      pincode: true,
      phone: true,
      isDefault: true,
    },
  });
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
    ...(GALLERY.length ? [{ id: "photos", label: "Before & after", icon: "treatment", badge: GALLERY_WAITING ? String(GALLERY_WAITING) : undefined }] : []),
    { id: "my-photos", label: "My photos", icon: "report", badge: MY_PHOTOS.length ? String(MY_PHOTOS.length) : undefined },
    ...(MY_CARDS.length ? [{ id: "gift-cards", label: "Gift cards", icon: "wallet", badge: String(MY_CARDS.length) }] : []),
    ...(MY_ORDERS.length ? [{ id: "medicines", label: "Medicines", icon: "rx", badge: String(MY_ORDERS.length) }] : []),
    { id: "plan", label: "My plan", icon: "treatment", badge: CARE_PLANS.length ? String(CARE_PLANS.length) : undefined },
    { id: "aftercare", label: "Aftercare", icon: "rx", badge: AFTERCARE.length ? String(AFTERCARE.length) : undefined },
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

            {/* The number a clinic asks for on the phone, and the one that goes
                in the "Patient ID" box on an aftercare sheet. A cuid does
                neither. Selectable and in a monospace face because its whole
                job is being read aloud or copied. */}
            {CLIENT.publicId && (
              <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-3 py-1.5 ring-1 ring-inset ring-white/10">
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
                  Patient ID
                </span>
                <span className="select-all font-mono text-xs font-bold tracking-wider text-ink">
                  {CLIENT.publicId}
                </span>
              </p>
            )}

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

                      {/* Was a <button> with no handler, in a server
                          component, so there was nowhere to attach one: it
                          rendered and did nothing. The per-scan report page
                          already existed and nothing pointed at it. */}
                      <Link
                        href={`/patient/skin-analysis/${r.id}/report`}
                        className="btn-ghost mt-4 w-full !py-2 text-sm"
                      >
                        <FileText className="h-4 w-4" /> Open full report
                      </Link>
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
                        {/* Only when a document was actually attached.
                            /api/uploads/view checks this prescription is
                            yours, then redirects to a five-minute signed URL:
                            `prescriptions/` is a private prefix and must not
                            be linked to directly. */}
                        {rx.fileUrl ? (
                          <a
                            href={`/api/uploads/view?url=${encodeURIComponent(rx.fileUrl)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-ghost shrink-0 !px-3 !py-1.5 text-xs"
                          >
                            <Download className="h-3.5 w-3.5" /> PDF
                          </a>
                        ) : (
                          <span className="shrink-0 text-[11px] font-medium text-ink-muted">
                            No file attached
                          </span>
                        )}
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

            {/* ── Gallery consent ─────────────────────────────────── */}
            {GALLERY.length > 0 && (
              <Section
                id="photos"
                icon={Camera}
                eyebrow="Your photographs"
                title="Before and after"
                sub="Your doctor may ask to show these publicly. It is entirely your choice, and you can change your mind."
              >
                <GalleryConsent cases={GALLERY} />
              </Section>
            )}

            {/* ── My own photographs ──────────────────────────────── */}
            <Section
              id="my-photos"
              icon={Camera}
              eyebrow="Your skin, over time"
              title="My photos"
              sub="Take the same views each visit and a doctor can see what actually changed. Only you and the doctors you book with can see these."
            >
              <MyPhotos
                photos={MY_PHOTOS.map((p) => ({
                  id: p.id,
                  angle: p.angle,
                  capturedAt: p.capturedAt.toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  }),
                  byDoctor: p.doctorId !== null,
                }))}
              />
            </Section>

            {/* ── Gift cards ──────────────────────────────────────── */}
            {MY_CARDS.length > 0 && (
              <Section
                id="gift-cards"
                icon={Wallet}
                eyebrow="Bought as a gift"
                title="Gift cards"
                sub="Quote the code at the clinic. A card can be used across several visits until the balance runs out."
              >
                <ul className="grid gap-3 sm:grid-cols-2">
                  {MY_CARDS.map((c) => (
                    <li key={c.id} className="card-soft p-5">
                      <p className="text-sm font-bold text-ink">{c.offer.title}</p>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {c.offer.doctor.name}
                        {c.recipientName ? ` · for ${c.recipientName}` : ""}
                      </p>
                      <p className="mt-3 select-all font-mono text-lg font-bold tracking-wider text-teal-300">
                        {c.code}
                      </p>
                      <div className="mt-3 flex items-baseline justify-between gap-2">
                        <span className="display-sm text-xl text-ink">
                          {money(c.balanceInr)}
                        </span>
                        <span className="text-xs text-ink-muted">
                          of {money(c.valueInr)} left
                        </span>
                      </div>
                      {c.expiresAt && (
                        <p className="mt-1.5 text-[11px] text-ink-muted">
                          Use it by{" "}
                          {c.expiresAt.toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {/* ── Medicine orders ─────────────────────────────────── */}
            {MY_ORDERS.length > 0 && (
              <Section
                id="medicines"
                icon={Syringe}
                eyebrow="From your doctor"
                title="Medicine orders"
                sub="What you ordered from the doctor who treated you, and where it has got to."
              >
                <ul className="space-y-3">
                  {MY_ORDERS.map((o) => (
                    <li key={o.id} className="card-soft p-5">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="font-mono text-xs font-bold text-ink-soft">
                          {o.publicId ?? o.id.slice(0, 8)}
                        </p>
                        <span className="rounded-full bg-white/[0.08] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-soft">
                          {o.status.toLowerCase()}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">
                        {o.items.map((i) => `${i.qty} × ${i.name}`).join(", ")}
                      </p>
                      <p className="mt-1.5 text-xs text-ink-muted">
                        {money(o.totalInr)} ·{" "}
                        {o.createdAt.toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {/* ── Treatment plan ──────────────────────────────────── */}
            <Section
              id="plan"
              icon={Sparkles}
              eyebrow="What your doctor suggests"
              title="My treatment plan"
              sub="Chosen by the doctor who read your analysis. Not a diagnosis, and not a quote."
            >
              {CARE_PLANS.length === 0 ? (
                <Blank
                  title="No plan yet"
                  body="After a doctor reviews your skin analysis, what they suggest appears here."
                />
              ) : (
                <ul className="space-y-3">
                  {CARE_PLANS.map((p) => (
                    <li key={p.id} className="card-soft p-5">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-sm font-bold text-ink">
                          From {p.doctor.name}
                        </p>
                        <p className="text-xs text-ink-muted">
                          {p.sharedAt?.toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                      <ul className="mt-3 space-y-2.5">
                        {p.items.map((i) => (
                          <li key={i.id} className="flex gap-3">
                            <span
                              aria-hidden
                              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-400"
                            />
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold text-ink">
                                {i.treatment}
                              </span>
                              {i.rationale && (
                                <span className="mt-0.5 block text-[13px] leading-relaxed text-ink-muted">
                                  {i.rationale}
                                </span>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                      {/* No prices here, deliberately. The catalogue is
                          price-free by rule and a treatment cost is quoted
                          after an assessment, not from a list. */}
                      <p className="mt-4 border-t border-white/10 pt-3 text-xs text-ink-muted">
                        Talk to {p.doctor.name} about what each of these
                        involves and what it costs.
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {/* ── Aftercare ───────────────────────────────────────── */}
            <Section
              id="aftercare"
              icon={FileText}
              eyebrow="After your procedure"
              title="Aftercare instructions"
              sub="What to do, what to avoid, and when to call the clinic. Issued by the doctor who treated you."
            >
              {AFTERCARE.length === 0 ? (
                <Blank
                  title="Nothing yet"
                  body="After a procedure, your doctor issues a sheet here with instructions for the days that follow."
                />
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {AFTERCARE.map((a) => (
                    <li key={a.id} className="card-soft p-5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="min-w-0 text-sm font-bold text-ink">
                          {a.procedure}
                        </p>
                        {/* Unconfirmed is the state worth flagging: it means
                            nobody has said the instructions were explained. */}
                        {!a.acknowledgedAt && (
                          <span className="shrink-0 rounded-full bg-amber-400/[14%] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-200">
                            Please read
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-ink-muted">
                        {a.doctorName} ·{" "}
                        {a.procedureDate.toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                      {a.reviewOn && (
                        <p className="mt-1.5 text-xs font-semibold text-teal-300">
                          Review on{" "}
                          {a.reviewOn.toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                          })}
                        </p>
                      )}
                      {a.doctorNotes && (
                        <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-ink-soft">
                          {a.doctorNotes}
                        </p>
                      )}
                      <Link
                        href={`/patient/aftercare/${a.id}`}
                        className="btn-ghost mt-4 w-full !py-2 text-sm"
                      >
                        <FileText className="h-4 w-4" /> Open the full sheet
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {/* ── 7. Pay later ────────────────────────────────────── */}
            <Section
              id="pay-later"
              icon={Package}
              eyebrow="Paying for treatment"
              title="Spreading the cost"
              sub="Ask the clinic what is possible. Nothing is applied for here."
            >
              {/* This section used to quote an "approved limit of ₹60,000
                  through BluDerma Care Credit" and list EMI options, which
                  read as though this platform were a lender. It is not one,
                  no finance partner is integrated, and a credit limit shown
                  to somebody deciding whether they can afford treatment is a
                  representation about money they can borrow.

                  So it is an enquiry now. The client says what they are
                  considering and roughly what they believe it costs; the
                  clinic replies. Real instalment plans, if the clinic ever
                  runs a programme, still show above from InstalmentPlan. */}
              {PAY_LATER.plans.length > 0 && (
                <ul className="mb-4 grid gap-3 xl:grid-cols-2">
                  {PAY_LATER.plans.map((pl) => (
                    <li key={pl.id} className="card-soft p-5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="min-w-0 text-sm font-bold text-ink">
                          {pl.item}
                        </p>
                        {pl.settled && (
                          <span className="shrink-0 rounded-full bg-teal-400/[14%] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-teal-200">
                            Paid off
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-ink-muted">
                        {money(pl.paidInr)} paid of {money(pl.totalInr)} ·{" "}
                        {pl.provider}
                      </p>
                      <div className="mt-3 flex gap-1.5">
                        {Array.from({ length: pl.instalmentsTotal }, (_, i) => (
                          <span
                            key={i}
                            className={`h-1.5 flex-1 rounded-full ${
                              i < pl.instalmentsPaid ? "bg-teal-400" : "bg-white/[0.12]"
                            }`}
                          />
                        ))}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs text-ink-muted">
                          {pl.instalmentsPaid} of {pl.instalmentsTotal} instalments
                        </p>
                        {pl.nextDue && (
                          <p className="text-xs font-bold text-ink">
                            {money(pl.instalmentInr)} due {pl.nextDue}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <FinancingPanel rows={FINANCING} />
            </Section>

            {/* ── 8. Location ─────────────────────────────────────── */}
            <Section
              id="locations"
              icon={Stethoscope}
              eyebrow="Where you're seen"
              title="Location"
              sub="Your saved addresses, and the listed clinics in your city."
            >
              {/* Real, and editable. This was DEMO_ADDRESSES: two invented
                  Chennai addresses shown to every client as though they were
                  their own, in a section with no actions at all, so even a
                  client who noticed could do nothing about it. They were also
                  the last Indian street addresses on a site that has
                  otherwise been stripped of them.

                  The "home visits available at this address" line went with
                  them. Nothing in the product records which doctors travel
                  where, so it was answering a question the data cannot. */}
              <AddressBook rows={ADDRESSES} />

                            <h3 className="mb-3 mt-8 text-sm font-bold text-ink">
                Listed clinics
              </h3>
              {/* Ordered by how near each one actually is, when the visitor
                  has shared a position. That happens in the client component,
                  because their coordinates live in localStorage and are not
                  something to send to a server merely so a list can be sorted.

                  The note that stood here said no distance could be shown
                  because nothing populated Clinic.lat/lng. Every clinic is
                  geocoded now, so it can. */}
              {CLINICS.length > 0 ? (
                <NearbyClinics clinics={CLINICS} />
              ) : (
                <Blank
                  title="No listed clinics yet"
                  body="Video consultations are available everywhere we operate."
                  cta={{ label: "See doctors", href: "/patient/doctors" }}
                />
              )}
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
  children,
}: {
  id: string;
  icon: typeof Sparkles;
  eyebrow: string;
  title: string;
  sub: string;
  action?: { label: string; href: string };
  /** Marks a panel whose content has no table behind it yet. */
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
