"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Appointments", href: "/doctor/portal" },
  { label: "My profile", href: "/doctor/portal/profile" },
];

export default function DoctorPortalNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav className="flex gap-2 border-b border-slate-200">
      {TABS.map((tab) => {
        const active =
          tab.href === "/doctor/portal"
            ? pathname === "/doctor/portal"
            : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
              active
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
