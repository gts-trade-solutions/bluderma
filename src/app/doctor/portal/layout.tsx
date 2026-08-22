import type { Metadata } from "next";
import Link from "next/link";
import { AppointmentStatus, ApprovalState } from "@prisma/client";

import PortalRail, { type RailItem } from "@/components/doctor/PortalRail";
import { Notice, portalBtnQuiet } from "@/components/doctor/portalUi";
import { requireRole } from "@/lib/session";
import { getOwnDoctor } from "@/lib/doctor/guard";
import { ensurePractice } from "@/lib/doctor/ensurePractice";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: { default: "Doctor portal", template: "%s · BluDerma" },
  robots: { index: false, follow: false },
};

/**
 * The portal shell: a dark rail carrying the brand and navigation, and a light
 * canvas for the work.
 *
 * It used to be a white bar, a grey page and a row of underlined tabs, built
 * out of the admin console's components — which is a back-office look, and the
 * reason the portal read as an internal tool beside the client experience. The
 * canvas stays light on purpose: this is read across a whole clinic day and
 * the calendar's per-clinic colour coding needs the contrast.
 *
 * The flat #f6f8fb ground is gone — see `.portal-canvas` in globals.css for
 * why two very faint blooms are worth more than a solid grey, and why they
 * are kept at 5-6% rather than made into a feature.
 */
export default async function DoctorPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Middleware already gates /doctor/portal to DOCTOR/ADMIN; this is the guard
  // that actually protects the render.
  const user = await requireRole(["DOCTOR", "ADMIN"], "/doctor/portal");

  // A DOCTOR without a practice row used to see "no practice linked" on all
  // five pages, with the row only ever created by visiting /doctor/join — the
  // page they no longer go to. ADMIN is excluded deliberately: an admin is not
  // a practitioner and must not acquire a listing by opening the portal.
  if (user.role === "DOCTOR") await ensurePractice(user);

  const owner = await getOwnDoctor();

  // The Requests count rides in the rail so it is visible from every page — a
  // held slot is the one thing a doctor should not have to go looking for.
  const [awaitingCount, primary] = owner
    ? await Promise.all([
        prisma.appointment.count({
          where: {
            doctorId: owner.doctorId,
            approvalState: ApprovalState.AWAITING_DOCTOR,
            status: { not: AppointmentStatus.CANCELLED },
            scheduledAt: { gte: new Date() },
          },
        }),
        prisma.doctorClinic.findFirst({
          where: { doctorId: owner.doctorId, isActive: true },
          orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
          select: { clinic: { select: { name: true, area: true } } },
        }),
      ])
    : [0, null];

  // Onboarding takes over until the listing is live: the rest of the portal is
  // shown so the practitioner can see where they are heading, but it is not
  // navigable yet — there is nothing in a calendar nobody can book into.
  const setup = owner
    ? owner.status === "DRAFT" || owner.status === "REJECTED"
    : false;
  const notYet = "Unlocks when your listing is approved";

  const items: RailItem[] = [
    {
      label: setup ? "Set up your practice" : "Home",
      href: "/doctor/portal",
      icon: setup ? "clinic" : "chart",
      exact: true,
    },
    // Only once there is a day to look at.
    ...(setup
      ? []
      : [
          {
            label: "Today",
            href: "/doctor/portal/today",
            icon: "today",
          } satisfies RailItem,
        ]),
    {
      label: "Calendar",
      href: "/doctor/portal/calendar",
      icon: "calendar",
      locked: setup ? notYet : undefined,
    },
    {
      label: "Requests",
      href: "/doctor/portal/requests",
      icon: "inbox",
      badge: awaitingCount || undefined,
      locked: setup ? notYet : undefined,
    },
    {
      label: "My practice",
      href: "/doctor/portal/practice",
      icon: "clinic",
      locked: setup ? "Add your locations in the steps first" : undefined,
    },
    { label: "Profile", href: "/doctor/portal/profile", icon: "user" },
  ];

  // The banner told a DRAFT doctor to "finish it" — which is now the very
  // screen they are looking at. Only show it where it still says something.
  const pending = owner && owner.status !== "APPROVED" && !setup;

  const clinicLine = primary
    ? `${primary.clinic.name} · ${primary.clinic.area}`
    : null;

  return (
    <div className="theme-light portal-canvas min-h-screen">
      {/* Sets the rail state before the browser paints, so a doctor who
          collapsed it last time does not watch it slam shut a moment after
          the page appears. It has to be inline and blocking to beat first
          paint; reading localStorage from an effect is one frame too late.
          Wrapped in try/catch because storage throws outright in some
          private-browsing modes, and a nav preference is not worth a blank
          page. */}
      <script
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html:
            // Collapsed is the default: the rail is six links a practitioner
            // learns in a day, and the canvas is where the work is. Only an
            // explicit "open" keeps it wide.
            'try{if(localStorage.getItem("bd-rail")!=="open")' +
            'document.documentElement.setAttribute("data-rail","collapsed")}' +
            'catch(e){document.documentElement.setAttribute("data-rail","collapsed")}',
        }}
      />

      <PortalRail
        items={items}
        doctorName={owner?.name || "Your practice"}
        clinicName={clinicLine}
        status={owner?.status ?? "DRAFT"}
      />

      <div className="portal-shell">
        {/* A bar of its own, above the page.
            The practitioner's name and clinic lived only in the rail, which
            is off-screen on a phone and easy to stop seeing on a desktop, so
            every page opened with no sense of whose practice it was. It also
            gives the two things reached from everywhere — the day's list and
            the calendar — a fixed home, instead of each page inventing its
            own place to put them. */}
        <header className="sticky top-0 z-30 hidden border-b border-slate-200/70 bg-white/80 backdrop-blur-md lg:block">
          <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-8 py-2.5 lg:px-10">
            <div className="flex min-w-0 items-center gap-3">
              <span
                aria-hidden
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-600 to-teal-500 text-sm font-bold text-white shadow-[0_6px_16px_-6px_rgba(31,111,214,0.8)]"
              >
                {(owner?.name || "P").replace(/^Dr\.?\s+/i, "").charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900">
                  {owner?.name || "Your practice"}
                </p>
                {clinicLine && (
                  <p className="truncate text-xs text-slate-500">{clinicLine}</p>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Link href="/doctor/portal/today" className={portalBtnQuiet}>
                Today
              </Link>
              <Link href="/doctor/portal/calendar" className={portalBtnQuiet}>
                Calendar
              </Link>
            </div>
          </div>
        </header>

        {/* An unapproved practitioner can use the portal, but should never be
            left guessing why nobody can find them. */}
        {pending && (
          <div className="px-5 pt-6 sm:px-8 lg:px-10">
            <PendingNotice status={owner!.status} />
          </div>
        )}

        <main className="mx-auto max-w-[1500px] px-3.5 py-5 sm:px-7 sm:py-6 lg:px-9">
          {children}
        </main>
      </div>
    </div>
  );
}

function PendingNotice({ status }: { status: string }) {
  const copy: Record<
    string,
    { title: string; body: string; tone: "info" | "attention" | "warning"; cta?: { label: string; href: string } }
  > = {
    DRAFT: {
      title: "Your profile is not submitted yet",
      body: "Finish the remaining steps and send it for review. Clients cannot find you or book with you until it is approved.",
      tone: "attention",
      cta: { label: "Finish it", href: "/doctor/join" },
    },
    PENDING: {
      title: "Your profile is with our team",
      body: "We check registration details before a doctor goes live, usually within two working days. You will get an email either way.",
      tone: "info",
    },
    REJECTED: {
      title: "Your profile needs changes",
      body: "We asked for something to be adjusted. Everything you entered is still there.",
      tone: "warning",
      cta: { label: "See what we asked for", href: "/doctor/join?step=6" },
    },
    SUSPENDED: {
      title: "Your listing is paused",
      body: "You are not currently shown to clients. Contact us if you think this is a mistake.",
      tone: "warning",
    },
  };
  const c = copy[status] ?? copy.PENDING;

  return (
    <Notice
      tone={c.tone}
      title={c.title}
      action={
        c.cta ? (
          <Link href={c.cta.href} className={portalBtnQuiet}>
            {c.cta.label}
          </Link>
        ) : undefined
      }
    >
      {c.body}
    </Notice>
  );
}
