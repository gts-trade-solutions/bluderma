import type { Metadata } from "next";
import { AppointmentStatus, ApprovalState } from "@prisma/client";

import AccountMenu from "@/components/AccountMenu";
import BrandLogo from "@/components/BrandLogo";
import DoctorPortalNav from "@/components/doctor/DoctorPortalNav";
import { requireRole } from "@/lib/session";
import { getOwnDoctor } from "@/lib/doctor/guard";
import { prisma } from "@/lib/prisma";

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

  // The Requests badge lives in the chrome so it is visible from every tab —
  // a held slot is the one thing a doctor should not have to go looking for.
  const owner = await getOwnDoctor();
  const awaitingCount = owner
    ? await prisma.appointment.count({
        where: {
          doctorId: owner.doctorId,
          approvalState: ApprovalState.AWAITING_DOCTOR,
          status: { not: AppointmentStatus.CANCELLED },
          scheduledAt: { gte: new Date() },
        },
      })
    : 0;

  const pending = owner && owner.status !== "APPROVED";

  return (
    <div className="theme-light min-h-screen bg-[#f7fafc]">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <BrandLogo href="/doctor" size={44} />
            <span className="rounded-full bg-teal-600 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-white">
              Doctor
            </span>
          </div>
          <AccountMenu />
        </div>
      </header>

      {/* An unapproved practitioner can use the portal, but should never be
          left guessing why nobody can find them. */}
      {pending && <PendingBanner status={owner!.status} />}

      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        <DoctorPortalNav awaitingCount={awaitingCount} />
        <main className="mt-6">{children}</main>
      </div>
    </div>
  );
}

function PendingBanner({ status }: { status: string }) {
  const copy: Record<string, { title: string; body: string; tone: string }> = {
    DRAFT: {
      title: "Your profile is not submitted yet",
      body: "Finish the remaining steps and send it for review. Clients cannot see you or book with you until it is approved.",
      tone: "border-amber-200 bg-amber-50 text-amber-900",
    },
    PENDING: {
      title: "Your profile is with our team",
      body: "We check registration details before a practitioner goes live. You will get an email as soon as it is reviewed — usually within two working days.",
      tone: "border-blue-200 bg-blue-50 text-blue-900",
    },
    REJECTED: {
      title: "Your profile needs changes",
      body: "Open Profile to see what we asked for, make the changes and resubmit.",
      tone: "border-rose-200 bg-rose-50 text-rose-900",
    },
    SUSPENDED: {
      title: "Your listing is paused",
      body: "You are not currently shown to clients. Contact us if you think this is a mistake.",
      tone: "border-slate-300 bg-slate-100 text-slate-700",
    },
  };
  const c = copy[status] ?? copy.PENDING;

  return (
    <div className={`border-b px-5 py-3 sm:px-8 ${c.tone}`}>
      <div className="mx-auto max-w-6xl text-sm">
        <strong className="font-bold">{c.title}.</strong> {c.body}
      </div>
    </div>
  );
}
