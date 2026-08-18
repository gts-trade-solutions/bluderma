import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/admin/ui";

export const metadata = { title: "Dashboard" };

/** Admin always reflects the database as of now, never a cached snapshot. */
export const dynamic = "force-dynamic";

const RELATIVE = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function ago(date: Date): string {
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["second", 60],
    ["minute", 60],
    ["hour", 24],
    ["day", 30],
    ["month", 12],
  ];
  let value = seconds;
  for (const [unit, size] of units) {
    if (Math.abs(value) < size) return RELATIVE.format(Math.round(value), unit);
    value /= size;
  }
  return RELATIVE.format(Math.round(value), "year");
}

export default async function AdminDashboard() {
  const [
    treatments,
    published,
    categories,
    doctors,
    activeDoctors,
    testimonials,
    faqs,
    banners,
    enquiries,
    newEnquiries,
    appointments,
    upcoming,
    recentAudit,
  ] = await Promise.all([
    prisma.treatment.count(),
    prisma.treatment.count({ where: { isPublished: true } }),
    prisma.category.count(),
    prisma.doctor.count(),
    prisma.doctor.count({ where: { isActive: true } }),
    prisma.testimonial.count(),
    prisma.faq.count(),
    prisma.banner.count(),
    prisma.enquiry.count(),
    prisma.enquiry.count({ where: { status: "NEW" } }),
    prisma.appointment.count(),
    prisma.appointment.count({
      where: { status: "CONFIRMED", scheduledAt: { gte: new Date() } },
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { user: { select: { name: true, email: true } } },
    }),
  ]);

  // The trading picture, as opposed to the content picture below it. Last 30
  // days, because a lifetime total tells you nothing about this month.
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [
    takings,
    refunded,
    bookedRecently,
    cancelledRecently,
    intakeRecently,
    pendingReviews,
    scansUsed,
    creditsWaiting,
  ] = await Promise.all([
    prisma.payment.aggregate({
      where: { status: "PAID", paidAt: { gte: since } },
      _sum: { amountInr: true },
      _count: { _all: true },
    }),
    prisma.payment.aggregate({
      where: { refundedAt: { gte: since } },
      _sum: { refundedInr: true },
    }),
    prisma.appointment.count({ where: { createdAt: { gte: since } } }),
    prisma.appointment.count({
      where: { status: "CANCELLED", cancelledAt: { gte: since } },
    }),
    prisma.intakeResponse.count({ where: { createdAt: { gte: since } } }),
    prisma.review.count({ where: { status: "PENDING" } }),
    prisma.skinEntitlement.count({
      where: { state: "consumed", updatedAt: { gte: since } },
    }),
    prisma.skinEntitlement.count({ where: { state: "available" } }),
  ]);

  const gross = takings._sum.amountInr ?? 0;
  const returned = refunded._sum.refundedInr ?? 0;
  // A cancellation rate is only meaningful against what was booked.
  const cancelRate = bookedRecently
    ? Math.round((cancelledRecently / bookedRecently) * 100)
    : 0;

  const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;

  const metrics = [
    {
      label: "Net takings",
      value: money(gross - returned),
      sub: returned
        ? `${money(gross)} in, ${money(returned)} refunded`
        : `${takings._count._all} payment(s)`,
      href: "/admin/payments",
    },
    {
      label: "Bookings",
      value: String(bookedRecently),
      sub: `${cancelRate}% cancelled`,
      href: "/admin/appointments",
    },
    {
      label: "Intake leads",
      value: String(intakeRecently),
      sub: "questionnaires completed",
      href: "/admin/intake",
    },
    {
      label: "Reviews waiting",
      value: String(pendingReviews),
      sub: pendingReviews ? "needs a decision" : "nothing queued",
      href: "/admin/reviews",
    },
    {
      label: "Analyses run",
      value: String(scansUsed),
      sub: `${creditsWaiting} credit(s) unused`,
      href: "/admin/skin-credits",
    },
  ];

  const cards = [
    {
      label: "Treatments",
      value: treatments,
      sub: `${published} published`,
      href: "/admin/treatments",
    },
    {
      label: "Categories",
      value: categories,
      sub: "clinical groups",
      href: "/admin/categories",
    },
    {
      label: "Doctors",
      value: doctors,
      sub: `${activeDoctors} active`,
      href: "/admin/doctors",
    },
    {
      label: "Testimonials",
      value: testimonials,
      sub: "client quotes",
      href: "/admin/testimonials",
    },
    { label: "FAQs", value: faqs, sub: "questions", href: "/admin/faqs" },
    { label: "Banners", value: banners, sub: "hero slots", href: "/admin/banners" },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Everything the public site renders comes from here."
      />

      {/* Trading, last 30 days. */}
      <section className="mb-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Last 30 days
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {metrics.map((m) => (
            <Link
              key={m.label}
              href={m.href}
              className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-brand-300 hover:shadow-soft"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {m.label}
              </p>
              <p className="mt-1 text-2xl font-bold text-ink">{m.value}</p>
              <p className="mt-0.5 text-xs text-ink-muted">{m.sub}</p>
            </Link>
          ))}
        </div>
      </section>

      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
        Content
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-brand-300 hover:shadow-soft"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              {c.label}
            </p>
            <p className="mt-1 text-3xl font-extrabold text-ink">{c.value}</p>
            <p className="mt-0.5 text-xs text-ink-muted">{c.sub}</p>
          </Link>
        ))}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Link
          href="/admin/enquiries"
          className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-brand-300 hover:shadow-soft"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Enquiries
          </p>
          <p className="mt-1 text-3xl font-extrabold text-ink">{enquiries}</p>
          <p className="mt-0.5 text-xs text-ink-muted">
            {newEnquiries} awaiting first contact
          </p>
        </Link>
        <Link
          href="/admin/appointments"
          className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-brand-300 hover:shadow-soft"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Appointments
          </p>
          <p className="mt-1 text-3xl font-extrabold text-ink">{appointments}</p>
          <p className="mt-0.5 text-xs text-ink-muted">{upcoming} upcoming</p>
        </Link>
      </div>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="font-bold text-ink">Recent changes</h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            Every content edit is recorded with who made it.
          </p>
        </div>
        <div className="p-6">
          {recentAudit.length === 0 ? (
            <p className="text-sm text-ink-muted">
              No changes recorded yet. Edits you make here will appear in this list.
            </p>
          ) : (
            <ul className="space-y-3">
              {recentAudit.map((log) => (
                <li key={log.id} className="flex items-start gap-3 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                  <span className="text-ink-soft">
                    <span className="font-semibold text-ink">
                      {log.user?.name ?? log.user?.email ?? "Someone"}
                    </span>{" "}
                    {log.action}d {log.entity}
                    <span className="ml-2 text-xs text-ink-muted">
                      {ago(log.createdAt)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
