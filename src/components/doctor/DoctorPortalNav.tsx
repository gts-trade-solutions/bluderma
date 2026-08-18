"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The portal's sections.
 *
 * Replaced the original two tabs (Appointments, My profile) when the portal
 * grew a calendar and multi-clinic practice management. The confirmation queue
 * is a tab of its own rather than a filter inside the calendar because a
 * booking waiting on the doctor is time-critical — it holds a slot — and
 * something time-critical should not need to be discovered.
 */
const TABS = [
  { label: "Today", href: "/doctor/portal", exact: true },
  { label: "Calendar", href: "/doctor/portal/calendar" },
  { label: "Requests", href: "/doctor/portal/requests", badge: true },
  { label: "My practice", href: "/doctor/portal/practice" },
  { label: "Profile", href: "/doctor/portal/profile" },
];

export default function DoctorPortalNav({
  awaitingCount = 0,
}: {
  awaitingCount?: number;
}) {
  const pathname = usePathname() ?? "";

  return (
    <nav className="-mx-5 flex gap-1 overflow-x-auto border-b border-slate-200 px-5 no-scrollbar sm:mx-0 sm:px-0">
      {TABS.map((tab) => {
        const active = tab.exact
          ? pathname === tab.href
          : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
              active
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            {tab.label}
            {tab.badge && awaitingCount > 0 && (
              <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-amber-500 px-1 text-[11px] font-bold text-white">
                {awaitingCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
