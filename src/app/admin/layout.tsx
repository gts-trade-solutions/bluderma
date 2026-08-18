import type { Metadata } from "next";
import Link from "next/link";

import AdminNav from "@/components/admin/AdminNav";
import AccountMenu from "@/components/AccountMenu";
import BrandLogo from "@/components/BrandLogo";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · BluDerma Admin" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Middleware already gates /admin, but this is the guard that actually
  // matters for rendering — it also gives us the user for the header.
  const user = await requireRole("ADMIN", "/admin");

  return (
    <div className="theme-light min-h-screen bg-[#f7fafc]">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
        <div className="flex h-16 items-center justify-between gap-4 px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <BrandLogo href="/admin" size={40} />
            <span className="rounded-full bg-ink px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-white">
              Admin
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/patient/explore"
              target="_blank"
              className="hidden text-sm font-medium text-ink-muted hover:text-brand-700 sm:inline"
            >
              View site ↗
            </Link>
            <AccountMenu />
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1600px] gap-8 px-5 py-8 sm:px-8">
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-24">
            <AdminNav />
            <p className="mt-8 px-3 text-xs text-ink-muted">
              Signed in as
              <br />
              <span className="font-medium text-ink-soft">{user.email}</span>
            </p>
          </div>
        </aside>

        <main className="min-w-0 flex-1 pb-16">{children}</main>
      </div>

      {/* Mobile nav — the sidebar is hidden below lg. */}
      <div className="border-t border-slate-200 bg-white p-4 lg:hidden">
        <AdminNav />
      </div>
    </div>
  );
}
