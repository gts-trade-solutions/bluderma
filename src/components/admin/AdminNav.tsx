"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItem {
  label: string;
  href: string;
  icon: string;
}

export const ADMIN_NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Overview",
    items: [{ label: "Dashboard", href: "/admin", icon: "grid" }],
  },
  {
    section: "Operations",
    items: [
      { label: "Doctor applications", href: "/admin/doctor-applications", icon: "user" },
      { label: "Enquiries", href: "/admin/enquiries", icon: "inbox" },
      { label: "Appointments", href: "/admin/appointments", icon: "calendar" },
      { label: "Payments", href: "/admin/payments", icon: "card" },
      { label: "Reviews", href: "/admin/reviews", icon: "quote" },
      { label: "Intake leads", href: "/admin/intake", icon: "inbox" },
      { label: "Skin requests", href: "/admin/skin-requests", icon: "sparkle" },
      { label: "Payment enquiries", href: "/admin/financing", icon: "card" },
      { label: "Medicine sellers", href: "/admin/vendors", icon: "box" },
      { label: "Gift cards", href: "/admin/gift-cards", icon: "tag" },
      { label: "Skin credits", href: "/admin/skin-credits", icon: "sparkle" },
    ],
  },
  {
    section: "Client records",
    items: [
      { label: "Prescriptions", href: "/admin/prescriptions", icon: "script" },
      { label: "Purchases", href: "/admin/purchases", icon: "box" },
      { label: "Discounts", href: "/admin/discounts", icon: "tag" },
    ],
  },
  {
    section: "Client catalogue",
    items: [
      { label: "Hub categories", href: "/admin/hub-categories", icon: "folder" },
      { label: "Hub treatments", href: "/admin/hub-treatments", icon: "list" },
      { label: "Deals", href: "/admin/deals", icon: "tag" },
      { label: "Promos", href: "/admin/promos", icon: "image" },
      { label: "Concerns", href: "/admin/concerns", icon: "help" },
    ],
  },
  {
    section: "Content",
    items: [
      { label: "Treatments", href: "/admin/treatments", icon: "list" },
      { label: "Products", href: "/admin/products", icon: "box" },
      { label: "Categories", href: "/admin/categories", icon: "folder" },
      { label: "Doctors", href: "/admin/doctors", icon: "user" },
      { label: "Banners", href: "/admin/banners", icon: "image" },
      { label: "Testimonials", href: "/admin/testimonials", icon: "quote" },
      { label: "FAQs", href: "/admin/faqs", icon: "help" },
    ],
  },
  {
    section: "Configuration",
    items: [
      { label: "Users", href: "/admin/users", icon: "users" },
      { label: "Email log", href: "/admin/email-log", icon: "inbox" },
      { label: "Site settings", href: "/admin/settings", icon: "cog" },
    ],
  },
];

const PATHS: Record<string, string> = {
  card: "M3 10h18M5 6h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Zm2 9h4",
  script: "M8 4h9a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6m2-2a2 2 0 0 0-2 2m2-2v2H6m4 4h6m-6 4h6m-6 4h3",
  tag: "M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9-9-9Zm5-5.5h.01",
  grid: "M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z",
  list: "M4 6h16M4 12h16M4 18h10",
  folder: "M4 7a1 1 0 0 1 1-1h4l2 2h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7Z",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 0c-3.6 0-6.5 2.4-6.5 6 0 .8.6 1.5 1.5 1.5h10c.9 0 1.5-.7 1.5-1.5 0-3.6-2.9-6-6.5-6Z",
  image: "M4 6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6Zm2 10 4-4 3 3 3-3 2 2",
  quote: "M8 7H5a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h2v1a2 2 0 0 1-2 2m14-9h-3a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h2v1a2 2 0 0 1-2 2",
  help: "M12 17h.01M9.1 9a3 3 0 1 1 4.2 2.8c-.8.4-1.3 1.1-1.3 2M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18Z",
  cog: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7.5 7.5 0 0 0-2-1.2L14.6 3H9.4L9 5.7c-.7.3-1.4.7-2 1.2l-2.3-1-2 3.4 2 1.5a7.5 7.5 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-1c.6.5 1.3.9 2 1.2l.4 2.7h5.2l.4-2.7c.7-.3 1.4-.7 2-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z",
  inbox: "M4 13h4l1.5 2.5h5L16 13h4M4 13V6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v7m-16 0v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5",
  calendar: "M8 3v3m8-3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z",
  box: "M12 3 4 7v10l8 4 8-4V7l-8-4Zm0 0v18M4 7l8 4 8-4",
  users: "M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 0c-3.3 0-6 2.2-6 5m13-5a3 3 0 1 0 0-6m2 11c0-2.5-2-4.5-5-5",
  sparkle: "M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z",
};

function Icon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none">
      <path
        d={PATHS[name] ?? PATHS.list}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function AdminNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav className="space-y-6">
      {ADMIN_NAV.map((group) => (
        <div key={group.section}>
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            {group.section}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              // "/admin" must only match exactly, or it lights up on every page.
              const active =
                item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "bg-brand-600 text-white"
                        : "text-ink-soft hover:bg-brand-50 hover:text-brand-700"
                    }`}
                  >
                    <Icon name={item.icon} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
