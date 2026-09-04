import type { Metadata } from "next";
import Link from "next/link";
import { Poppins } from "next/font/google";
import { AppointmentStatus, ApprovalState } from "@prisma/client";

import PortalRail, { type RailItem } from "@/components/doctor/PortalRail";
import Avatar from "@/components/Avatar";
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
 * The portal's face, loaded here rather than in the root layout.
 *
 * Poppins is the reference product's own typeface and carries this whole
 * surface — headings and body both. Declaring it on this layout means the
 * public site never downloads it: next/font emits the @font-face and the
 * preload wherever it is imported, and nothing outside /doctor/portal
 * imports it.
 *
 * Only the five weights actually used. Poppins ships nine as separate files.
 * latin-ext for the same reason the other two families have it: ₹ is U+20B9,
 * which `latin` does not cover, and half this portal is money.
 *
 * The variable is consumed by `.portal-canvas` in globals.css and by the
 * `font-portal` utility.
 */
const portalFont = Poppins({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-portal",
});

/**
 * The portal shell: a charcoal rail carrying the brand and navigation, and a
 * near-white canvas for the work.
 *
 * The rail is the mark's own #2F2F2F, which is the ground the logo is drawn
 * on, and it is the only dark surface here. The canvas stays light on
 * purpose: this is read across a whole clinic day and the calendar's
 * per-clinic colour coding needs the contrast.
 *
 * See `.portal-canvas` in globals.css for the ground and the typeface — both
 * are bound there rather than at every call site.
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

  /*
   * Grouped, and in the order a clinic day actually runs.
   *
   * These were thirteen links in one column with "Money" and "Gift cards"
   * sitting between two screens a practitioner opens hourly. The order is now
   * frequency-first inside four named groups, and PortalRail prints the group
   * name above the first item carrying it — so the list has to stay sorted by
   * section here or the headings repeat.
   */
  const items: RailItem[] = [
    {
      section: "Your day",
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
            section: "Your day",
            label: "Today",
            href: "/doctor/portal/today",
            icon: "today",
          } satisfies RailItem,
        ]),
    {
      section: "Your day",
      label: "Calendar",
      href: "/doctor/portal/calendar",
      icon: "calendar",
      locked: setup ? notYet : undefined,
    },
    {
      section: "Your day",
      label: "Confirm requests",
      href: "/doctor/portal/requests",
      icon: "inbox",
      badge: awaitingCount || undefined,
      locked: setup ? notYet : undefined,
    },
    {
      // The way in to every patient screen — chart, photographs, care sheets,
      // prescriptions. All of it existed and none of it was listed.
      section: "Clinical",
      label: "Patients",
      href: "/doctor/portal/patients",
      icon: "users",
      locked: setup ? notYet : undefined,
    },
    {
      // "Medicines" described the list; "Prescriptions" describes what the
      // doctor does there, which is what a nav label is for. The ℞ mark is
      // the one symbol every clinician reads without reading.
      section: "Clinical",
      label: "Prescriptions",
      href: "/doctor/portal/medicines",
      icon: "rx",
      locked: setup ? notYet : undefined,
    },
    {
      // Pre and post care lives inside this screen now, on its own tab:
      // planning a course of treatment and telling somebody how to prepare
      // for it are one job. /doctor/portal/aftercare redirects there.
      section: "Clinical",
      label: "Treatment programs",
      href: "/doctor/portal/plans",
      icon: "pulse",
      locked: setup ? notYet : undefined,
    },
    {
      section: "Clinical",
      label: "Gallery",
      href: "/doctor/portal/gallery",
      icon: "star",
      locked: setup ? notYet : undefined,
    },
    {
      section: "Business",
      label: "Money",
      href: "/doctor/portal/finance",
      icon: "chart",
      locked: setup ? notYet : undefined,
    },
    {
      // Its own entry, not a panel inside Prescriptions. Counting the shelf
      // and prescribing are different jobs done at different times, and the
      // one that was nested never got done.
      section: "Business",
      label: "My inventory",
      href: "/doctor/portal/inventory",
      icon: "clinic",
      locked: setup ? notYet : undefined,
    },
    {
      section: "Business",
      label: "Gift cards",
      href: "/doctor/portal/gift-cards",
      icon: "star",
      locked: setup ? notYet : undefined,
    },
    {
      section: "Setup",
      label: "My practice",
      href: "/doctor/portal/practice",
      icon: "clinic",
      locked: setup ? "Add your locations in the steps first" : undefined,
    },
    {
      section: "Setup",
      label: "Profile",
      href: "/doctor/portal/profile",
      icon: "user",
    },
  ];

  // The banner told a DRAFT doctor to "finish it" — which is now the very
  // screen they are looking at. Only show it where it still says something.
  const pending = owner && owner.status !== "APPROVED" && !setup;

  const clinicLine = primary
    ? `${primary.clinic.name} · ${primary.clinic.area}`
    : null;

  return (
    <div className={`${portalFont.variable} theme-light pro-surface portal-canvas min-h-screen`}>
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
        photo={owner?.image ?? null}
      />

      <div className="portal-shell">
        {/* A bar of its own, above the page.
            The practitioner's name and clinic lived only in the rail, which
            is off-screen on a phone and easy to stop seeing on a desktop, so
            every page opened with no sense of whose practice it was. It also
            gives the two things reached from everywhere — the day's list and
            the calendar — a fixed home, instead of each page inventing its
            own place to put them. */}
        <header className="sticky top-0 z-30 hidden border-b border-graphite-200 bg-white/90 backdrop-blur-md lg:block">
          <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-8 py-2.5 lg:px-10">
            {/* Same rule as the rail: the practitioner's own face is a link
                to their own profile, because that is what everybody tries. */}
            <Link
              href="/doctor/portal/profile"
              title="Open my profile"
              className="flex min-w-0 items-center gap-3 rounded-lg px-1.5 py-1 transition hover:bg-graphite-100"
            >
              <Avatar
                src={owner?.image}
                alt={owner?.name ?? "Your practice"}
                role="doctor"
                size={36}
                className="ring-1 ring-graphite-200"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-graphite-900">
                  {owner?.name || "Your practice"}
                </p>
                <p className="truncate text-xs text-graphite-500">
                  {/* The practice id sits with the name because that is where
                      a doctor looks for it when a referral or an aftercare
                      sheet asks. Monospace and selectable: its whole job is
                      being copied or read aloud. */}
                  {owner?.publicId && (
                    <span className="select-all font-mono font-semibold tracking-wide text-graphite-500">
                      {owner.publicId}
                    </span>
                  )}
                  {owner?.publicId && clinicLine ? " · " : ""}
                  {clinicLine}
                </p>
              </div>
            </Link>

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
