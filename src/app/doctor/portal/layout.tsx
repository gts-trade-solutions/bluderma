import type { Metadata } from "next";

import AccountMenu from "@/components/AccountMenu";
import BrandLogo from "@/components/BrandLogo";
import DoctorPortalNav from "@/components/doctor/DoctorPortalNav";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = {
  title: { default: "Doctor portal", template: "%s · BluDerma" },
  robots: { index: false, follow: false },
};

export default async function DoctorPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Middleware already gates /doctor/portal to DOCTOR/ADMIN; this is the guard
  // that actually protects the render.
  await requireRole(["DOCTOR", "ADMIN"], "/doctor/portal");

  return (
    <div className="min-h-screen bg-[#f7fafc]">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <BrandLogo href="/doctor" size={36} />
            <span className="rounded-full bg-teal-600 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-white">
              Doctor
            </span>
          </div>
          <AccountMenu />
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        <DoctorPortalNav />
        <main className="mt-6">{children}</main>
      </div>
    </div>
  );
}
