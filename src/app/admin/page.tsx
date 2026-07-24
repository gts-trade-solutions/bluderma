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
      sub: "patient quotes",
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
